// The MINT SUIT shop: Printful makes and ships, PayPal takes the payment,
// and this function sits between them so no key ever reaches the browser.
//
//   GET  /mintsuit-shop/products            what is for sale, from Printful
//   GET  /mintsuit-shop/thumb?f=..&w=480    a light JPEG copy of a photo, for cards
//   POST /mintsuit-shop/quote   {variant, quantity, country}
//   POST /mintsuit-shop/create  {variant, quantity, country}   -> PayPal order id
//   POST /mintsuit-shop/capture {orderID}   takes the money, then orders from Printful
//
// Secrets (supabase secrets set ...): PRINTFUL_TOKEN, PAYPAL_CLIENT_ID,
// PAYPAL_SECRET, PAYPAL_ENV ("live" or "sandbox"). Prices always come from
// Printful here, never from the page.

import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const PRINTFUL = "https://api.printful.com";
const PAYPAL = Deno.env.get("PAYPAL_ENV") === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";
const LIVE = Deno.env.get("PAYPAL_ENV") === "live";

const ALLOWED = ["https://mintsuit.com", "https://www.mintsuit.com", "http://localhost:8420", "http://127.0.0.1:8420"];

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : ALLOWED[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });
}

// ---------- Printful ----------

async function printful(path: string, init: RequestInit = {}) {
  const res = await fetch(PRINTFUL + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${Deno.env.get("PRINTFUL_TOKEN")}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Printful ${path}: ${data?.error?.message ?? data?.result ?? res.status}`);
  return data.result;
}

// Product photos are handed out through this function (/image?f=...), with
// the original address packed into an opaque token, so no address a
// shopper can see points at Printful. Only Printful's own file hosts are
// fetched this way.
const IMAGE_HOSTS = ["files.cdn.printful.com", "img.printful.com"];
// Photos the light copies may be made from: the maker's, and the site's own
// (the mockups uploaded in the panel).
const THUMB_HOSTS = [...IMAGE_HOSTS, "mintsuit.com", "www.mintsuit.com"];
function selfUrl() {
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1/mintsuit-shop`;
}
function hideImage(url: string | null) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!IMAGE_HOSTS.includes(u.hostname)) return url;
    const token = btoa(url).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `${selfUrl()}/image?f=${token}`;
  } catch { return url; }
}

function unhideImage(token: string) {
  const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64 + "===".slice((b64.length + 3) % 4));
}

// ---------- light copies of the photos ----------

// A card needs a picture a few hundred pixels wide, not the 1–2 MB original:
// the first time one is asked for, it is scaled, flattened onto white,
// saved as a JPEG in the public shop-thumbs bucket, and from then on
// served straight from storage.
const BUCKET = "shop-thumbs";

async function sha(text: string) {
  const d = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function publicThumb(name: string) {
  return `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/${BUCKET}/${name}`;
}

async function makeThumb(url: string, width: number): Promise<string> {
  const name = `${await sha(url)}-${width}.jpg`;
  const where = publicThumb(name);
  const head = await fetch(where, { method: "HEAD" });
  if (head.ok) return where;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`photo ${res.status}`);
  const img = await Image.decode(new Uint8Array(await res.arrayBuffer()));
  if (img.width > width) img.resize(width, Image.RESIZE_AUTO);
  const flat = new Image(img.width, img.height).fill(0xffffffff).composite(img, 0, 0);
  const jpeg = await flat.encodeJPEG(82);

  const { key, jwt } = serverKey();
  const up = await fetch(`${Deno.env.get("SUPABASE_URL")}/storage/v1/object/${BUCKET}/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      ...(jwt ? { Authorization: `Bearer ${key}` } : {}),
      "Content-Type": "image/jpeg",
      "Cache-Control": "max-age=31536000",
      "x-upsert": "true",
    },
    body: jpeg,
  });
  if (!up.ok) throw new Error(`storage ${up.status}: ${await up.text()}`);
  return where;
}

type Variant = {
  id: number;          // Printful sync variant id: what an order names
  catalog: number;     // Printful catalog variant id: what shipping rates name
  name: string;
  size: string | null;
  color: string | null;
  price: string;
  currency: string;
  image: string | null;
  thumb: string | null;
};
type Product = { id: number; name: string; image: string | null; thumb: string | null; variants: Variant[] };

// The product list is kept in memory, and in the shop_cache table so a
// fresh instance has it at once. Older than five minutes, it is still
// served but read again from Printful in the background; a payment always
// reads it fresh, so the price charged is the one set in Printful.
const FRESH = 5 * 60 * 1000;
let cache: { at: number; products: Product[] } | null = null;
let refreshing: Promise<Product[]> | null = null;
let countries: { code: string; name: string }[] | null = null;

async function products(fresh = false): Promise<Product[]> {
  if (fresh) return await refresh();
  if (cache && Date.now() - cache.at < FRESH) return cache.products;
  if (!cache) {
    try {
      const [row] = await db("shop_cache?key=eq.products&select=data,at");
      if (row) cache = { at: new Date(row.at).getTime(), products: row.data };
    } catch { /* no stored copy: read it now */ }
  }
  if (cache) {
    if (Date.now() - cache.at >= FRESH) later(refresh());
    return cache.products;
  }
  return await refresh();
}

function later(p: Promise<unknown>) {
  const task = p.catch(() => {});
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(task);
}

function refresh(): Promise<Product[]> {
  if (!refreshing) refreshing = readPrintful().finally(() => { refreshing = null; });
  return refreshing;
}

async function readPrintful(): Promise<Product[]> {
  const list = await printful("/store/products?limit=100");
  const out: Product[] = [];
  for (const p of list) {
    if (p.is_ignored) continue;
    const full = await printful(`/store/products/${p.id}`);
    const variants: Variant[] = full.sync_variants
      .filter((v: any) => !v.is_ignored && v.availability_status !== "discontinued")
      .map((v: any) => ({
        id: v.id,
        catalog: v.variant_id,
        name: v.name,
        size: v.size ?? null,
        color: v.color ?? null,
        price: v.retail_price,
        currency: v.currency,
        image: v.files?.find((f: any) => f.type === "preview")?.preview_url ?? p.thumbnail_url ?? null,
        thumb: null,
      }));
    if (variants.length) out.push({ id: p.id, name: p.name, image: variants[0].image ?? p.thumbnail_url, thumb: null, variants });
  }
  // The light copies are made here, once per photo, so the page never waits.
  const known = new Map((cache?.products ?? []).flatMap((p) => p.variants.map((v) => [v.image, v.thumb] as const)));
  for (const p of out) {
    for (const v of p.variants) {
      if (!v.image) continue;
      v.thumb = known.get(v.image) ?? await makeThumb(v.image, 480).catch(() => null);
    }
    p.thumb = p.variants[0].thumb;
  }
  cache = { at: Date.now(), products: out };
  await db("shop_cache?on_conflict=key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ key: "products", data: out, at: new Date().toISOString() }),
  }).catch(() => {});
  return out;
}

async function findVariant(id: number, fresh = false) {
  for (const p of await products(fresh)) {
    const v = p.variants.find((v) => v.id === id);
    if (v) return { product: p, variant: v };
  }
  throw new Error("That item is not for sale.");
}

// A rough state for the countries whose rates need one; the real address
// comes from PayPal at payment time.
const DEFAULT_STATE: Record<string, string> = { US: "NY", CA: "ON", AU: "NSW" };

async function quote(variantId: number, quantity: number, country: string, state?: string, fresh = false) {
  const { product, variant } = await findVariant(variantId, fresh);
  const q = Math.max(1, Math.min(10, Math.floor(quantity) || 1));
  const noShipping = "Sorry, this item can't be shipped to that country.";
  const rates = await printful("/shipping/rates", {
    method: "POST",
    body: JSON.stringify({
      recipient: { country_code: country, state_code: state || DEFAULT_STATE[country] },
      items: [{ variant_id: variant.catalog, quantity: q }],
      currency: variant.currency,
    }),
  }).catch(() => { throw new Error(noShipping); });
  if (!rates?.length) throw new Error(noShipping);
  const cheapest = rates.reduce((a: any, b: any) => (parseFloat(a.rate) <= parseFloat(b.rate) ? a : b));
  const items = (parseFloat(variant.price) * q).toFixed(2);
  const shipping = parseFloat(cheapest.rate).toFixed(2);
  return {
    product, variant, quantity: q, country,
    currency: variant.currency,
    items, shipping,
    total: (parseFloat(items) + parseFloat(shipping)).toFixed(2),
    shipping_name: cheapest.name,
  };
}

// What the site's panel says about each product (shop.json on the site):
// a product switched to Sold out there can't be bought here either.
// The panel's title for a product is also the name on the PayPal receipt.
type PanelEntry = { id: number; name: string; title: string; soldOut: boolean };
let panel: { at: number; entries: PanelEntry[] } | null = null;

async function readPanel() {
  if (!panel || Date.now() - panel.at > 60 * 1000) {
    try {
      const res = await fetch(`https://mintsuit.com/shop.json?t=${Date.now()}`);
      const data = await res.json();
      const list = data.products ?? [];
      panel = {
        at: Date.now(),
        entries: list.map((p: any) => ({
          id: Number(p.printful_id) || 0, name: String(p.name ?? ""), title: String(p.title ?? "").trim(), soldOut: !!p.sold_out,
        })),
      };
    } catch { /* keep what was known */ }
  }
  return panel;
}

// The same matching as the page: the same name, else one name starting the
// other, else nearly all of the entry's words in the product's name.
function words(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
async function entryFor(id: number, name: string): Promise<PanelEntry | null> {
  const entries = (await readPanel())?.entries ?? [];
  const tied = entries.find((e) => e.id && e.id === id);
  if (tied) return tied;
  const key = words(name), keyWords = key.split(" ");
  let best: PanelEntry | null = null, bestScore = 0;
  for (const e of entries) {
    if (e.id) continue;
    const n = words(e.name);
    if (!n) continue;
    let score = 0;
    if (n === key) score = 3;
    else if (key.startsWith(n) || n.startsWith(key)) score = 2;
    else {
      const mine = n.split(" ");
      const shared = mine.filter((w) => keyWords.includes(w)).length;
      if (shared / mine.length >= 0.75) score = 1 + shared / 100;
    }
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return best;
}

async function soldOut(product: { id: number; name: string }) {
  return (await entryFor(product.id, product.name))?.soldOut ?? false;
}

async function shownName(product: { id: number; name: string }) {
  return (await entryFor(product.id, product.name))?.title || product.name;
}

// ---------- PayPal ----------

async function paypalToken() {
  const auth = btoa(`${Deno.env.get("PAYPAL_CLIENT_ID")}:${Deno.env.get("PAYPAL_SECRET")}`);
  const res = await fetch(`${PAYPAL}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!res.ok) throw new Error("PayPal sign-in failed.");
  return data.access_token as string;
}

async function paypal(path: string, init: RequestInit = {}) {
  const token = await paypalToken();
  const res = await fetch(PAYPAL + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ---------- the orders table ----------

// Projects made since the new API keys arrived get an sb_secret_ key (sent
// as apikey only); older ones get the service_role JWT. Either works here.
function serverKey() {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const k = keys.default ?? Object.values(keys)[0];
    if (k) return { key: String(k), jwt: false };
  } catch { /* fall through */ }
  return { key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", jwt: true };
}

async function db(path: string, init: RequestInit = {}) {
  const { key, jwt } = serverKey();
  const auth: Record<string, string> = jwt ? { Authorization: `Bearer ${key}` } : {};
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, ...auth, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Database: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function log(route: string | undefined, orderId: string, message: string) {
  try {
    await db("shop_log", { method: "POST", body: JSON.stringify({ route, order_id: orderId || null, message: message.slice(0, 2000) }) });
  } catch { /* logging must never break a checkout */ }
}

// ---------- routes ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const route = new URL(req.url).pathname.split("/").filter(Boolean).pop();

  try {
    if (route === "image" && req.method === "GET") {
      const token = new URL(req.url).searchParams.get("f") ?? "";
      let u: URL;
      try { u = new URL(unhideImage(token)); } catch { return new Response("Not found", { status: 404, headers: cors(req) }); }
      if (u.protocol !== "https:" || !IMAGE_HOSTS.includes(u.hostname)) {
        return new Response("Not found", { status: 404, headers: cors(req) });
      }
      const img = await fetch(u);
      if (!img.ok) return new Response("Not found", { status: 404, headers: cors(req) });
      return new Response(img.body, {
        headers: {
          ...cors(req),
          "Content-Type": img.headers.get("content-type") ?? "image/png",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    if (route === "thumb" && req.method === "GET") {
      const q = new URL(req.url).searchParams;
      const width = Math.max(120, Math.min(800, parseInt(q.get("w") ?? "480", 10) || 480));
      let u: URL;
      try { u = new URL(unhideImage(q.get("f") ?? "")); } catch {
        return new Response("Not found", { status: 404, headers: cors(req) });
      }
      if (u.protocol !== "https:" || !THUMB_HOSTS.includes(u.hostname)) {
        return new Response("Not found", { status: 404, headers: cors(req) });
      }
      const where = await makeThumb(u.href, width);
      return new Response(null, {
        status: 302,
        headers: { ...cors(req), Location: where, "Cache-Control": "public, max-age=86400" },
      });
    }

    // ?fresh=1 reads the store now rather than the kept copy (the panel's
    // Sync with Printful button uses it).
    if (route === "products" && req.method === "GET") {
      const fresh = new URL(req.url).searchParams.get("fresh") === "1";
      const list = (await products(fresh)).map((p) => ({
        id: p.id, name: p.name, image: hideImage(p.image), thumb: p.thumb,
        variants: p.variants.map(({ catalog: _c, image, ...v }) => ({ ...v, image: hideImage(image) })),
      }));
      return json(req, { products: list });
    }

    // Every country Printful ships to, for the page's "Ship to" list.
    if (route === "countries" && req.method === "GET") {
      if (!countries) {
        const list = await printful("/countries");
        countries = list
          .map((c: any) => ({ code: c.code, name: c.name }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
      }
      return json(req, { countries });
    }

    if (route === "health" && req.method === "GET") {
      const { jwt } = serverKey();
      let database = "ok";
      try { await db("shop_orders?select=paypal_order_id&limit=1"); } catch (e) { database = String(e).slice(0, 200); }
      return json(req, { key: jwt ? "service_role" : "secret", database, paypal: LIVE ? "live" : "sandbox" });
    }

    if (req.method !== "POST") return json(req, { error: "Not found." }, 404);
    const body = await req.json().catch(() => ({}));

    if (route === "quote") {
      const q = await quote(Number(body.variant), Number(body.quantity), String(body.country || "").toUpperCase());
      return json(req, { currency: q.currency, items: q.items, shipping: q.shipping, total: q.total, shipping_name: q.shipping_name });
    }

    if (route === "create") {
      const country = String(body.country || "").toUpperCase();
      const q = await quote(Number(body.variant), Number(body.quantity), country, undefined, true);
      if (await soldOut(q.product)) throw new Error("Sorry, this item is sold out.");
      const shown = await shownName(q.product);
      const { ok, data } = await paypal("/v2/checkout/orders", {
        method: "POST",
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            custom_id: `${q.variant.id}:${q.quantity}:${country}`,
            description: `MINT SUIT — ${shown}`.slice(0, 127),
            amount: {
              currency_code: q.currency,
              value: q.total,
              breakdown: {
                item_total: { currency_code: q.currency, value: q.items },
                shipping: { currency_code: q.currency, value: q.shipping },
              },
            },
            items: [{
              name: shown.slice(0, 127),
              quantity: String(q.quantity),
              unit_amount: { currency_code: q.currency, value: parseFloat(q.variant.price).toFixed(2) },
              category: "PHYSICAL_GOODS",
            }],
          }],
          payment_source: {
            paypal: {
              experience_context: {
                brand_name: "MINT SUIT",
                shipping_preference: "GET_FROM_FILE",
                user_action: "PAY_NOW",
              },
            },
          },
        }),
      });
      if (!ok) throw new Error(data?.details?.[0]?.description ?? "PayPal could not start the payment.");
      return json(req, { id: data.id });
    }

    // The buyer picked an address in PayPal: the shipping is worked out again
    // for that country and the order's total changed to match, so any
    // address Printful ships to is accepted.
    if (route === "reship") {
      const id = String(body.orderID || "");
      if (!/^[A-Z0-9]{10,40}$/.test(id)) return json(req, { error: "Bad order." }, 400);
      const country = String(body.country || "").toUpperCase();
      if (!/^[A-Z]{2}$/.test(country)) return json(req, { error: "Bad country." }, 400);
      const state = /^[A-Za-z0-9-]{1,6}$/.test(String(body.state || "")) ? String(body.state) : undefined;
      const { data: order } = await paypal(`/v2/checkout/orders/${id}`);
      if (!order?.id) throw new Error("PayPal does not know that order.");
      const [variantId, quantity] = String(order.purchase_units[0].custom_id).split(":").map(Number);
      let q;
      try {
        q = await quote(variantId, quantity, country, state);
      } catch (e) {
        await log(route, id, `no shipping to ${country}: ${e}`);
        return json(req, { noship: true, error: "Sorry, this item can't be shipped to that country." });
      }
      const unit = `/purchase_units/@reference_id=='${order.purchase_units[0].reference_id ?? "default"}'`;
      const patch = await paypal(`/v2/checkout/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify([
          {
            op: "replace", path: `${unit}/amount`,
            value: {
              currency_code: q.currency, value: q.total,
              breakdown: {
                item_total: { currency_code: q.currency, value: q.items },
                shipping: { currency_code: q.currency, value: q.shipping },
              },
            },
          },
          { op: "replace", path: `${unit}/custom_id`, value: `${variantId}:${q.quantity}:${country}` },
        ]),
      });
      if (!patch.ok) {
        // Printful ships there, so the address stands; the order keeps the
        // shipping it was created with rather than turning the buyer away.
        await log(route, id, `patch ${patch.status}: ${JSON.stringify(patch.data).slice(0, 1500)}`);
        return json(req, { patched: false });
      }
      return json(req, { patched: true, currency: q.currency, items: q.items, shipping: q.shipping, total: q.total });
    }

    if (route === "capture") {
      const id = String(body.orderID || "");
      if (!/^[A-Z0-9]{10,40}$/.test(id)) return json(req, { error: "Bad order." }, 400);

      // The row goes in before any money moves, so every approved payment
      // is on record even if a later step fails. One row per PayPal order:
      // a second click or a retry finds it and orders nothing twice.
      const { data: approved } = await paypal(`/v2/checkout/orders/${id}`);
      if (!approved?.id) throw new Error("PayPal does not know that order.");
      const fresh = await db("shop_orders?on_conflict=paypal_order_id", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify({ paypal_order_id: id, status: "approved" }),
      });
      if (!fresh?.length) {
        const [row] = await db(`shop_orders?paypal_order_id=eq.${id}&select=status`);
        if (row && row.status !== "approved" && row.status !== "capture_failed") return json(req, { ok: true, again: true });
      }
      const note = (fields: Record<string, unknown>) =>
        db(`shop_orders?paypal_order_id=eq.${id}`, { method: "PATCH", body: JSON.stringify(fields) });

      const cap = await paypal(`/v2/checkout/orders/${id}/capture`, { method: "POST" });
      if (!cap.ok && cap.data?.details?.[0]?.issue !== "ORDER_ALREADY_CAPTURED") {
        const why = cap.data?.details?.[0]?.description ?? "The payment did not go through.";
        await note({ status: "capture_failed", error: why });
        throw new Error(why);
      }
      const { data: order } = await paypal(`/v2/checkout/orders/${id}`);
      if (order.status !== "COMPLETED") {
        await note({ status: "capture_failed", error: `PayPal status ${order.status}` });
        throw new Error("The payment is not complete.");
      }

      const unit = order.purchase_units[0];
      const [variantId, quantity] = String(unit.custom_id).split(":").map(Number);
      const ship = unit.shipping ?? {};
      const a = ship.address ?? {};
      const email = order.payer?.email_address ?? null;
      await note({
        status: "paid",
        email,
        amount: unit.amount?.value ?? null,
        currency: unit.amount?.currency_code ?? null,
        variant_id: variantId,
        quantity,
        country: a.country_code ?? null,
        paypal: order,
      });

      try {
        const pf = await printful(`/orders?confirm=${LIVE ? "true" : "false"}`, {
          method: "POST",
          body: JSON.stringify({
            external_id: id,
            recipient: {
              name: ship.name?.full_name ?? [order.payer?.name?.given_name, order.payer?.name?.surname].filter(Boolean).join(" "),
              address1: a.address_line_1,
              address2: a.address_line_2,
              city: a.admin_area_2,
              state_code: a.admin_area_1,
              country_code: a.country_code,
              zip: a.postal_code,
              email,
            },
            items: [{ sync_variant_id: variantId, quantity }],
          }),
        });
        await note({ status: LIVE ? "sent_to_printful" : "printful_draft", printful_order_id: pf.id, error: null });
      } catch (e) {
        // The customer has paid either way; the row says what to fix by hand.
        await note({ status: "printful_failed", error: String(e) });
      }
      return json(req, { ok: true });
    }

    return json(req, { error: "Not found." }, 404);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await log(route, "", message);
    const shown = /printful/i.test(message) ? "The shop hit a snag. Please try again in a moment." : message;
    return json(req, { error: shown }, 400);
  }
});
