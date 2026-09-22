// The MINT SUIT shop: Printful makes and ships, PayPal takes the payment,
// and this function sits between them so no key ever reaches the browser.
//
//   GET  /mintsuit-shop/products            what is for sale, from Printful
//   POST /mintsuit-shop/quote   {variant, quantity, country}
//   POST /mintsuit-shop/create  {variant, quantity, country}   -> PayPal order id
//   POST /mintsuit-shop/capture {orderID}   takes the money, then orders from Printful
//
// Secrets (supabase secrets set ...): PRINTFUL_TOKEN, PAYPAL_CLIENT_ID,
// PAYPAL_SECRET, PAYPAL_ENV ("live" or "sandbox"). Prices always come from
// Printful here, never from the page.

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

type Variant = {
  id: number;          // Printful sync variant id: what an order names
  catalog: number;     // Printful catalog variant id: what shipping rates name
  name: string;
  size: string | null;
  color: string | null;
  price: string;
  currency: string;
  image: string | null;
};
type Product = { id: number; name: string; image: string | null; variants: Variant[] };

let cache: { at: number; products: Product[] } | null = null;
let countries: { code: string; name: string }[] | null = null;

async function products(): Promise<Product[]> {
  if (cache && Date.now() - cache.at < 5 * 60 * 1000) return cache.products;
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
      }));
    if (variants.length) out.push({ id: p.id, name: p.name, image: variants[0].image ?? p.thumbnail_url, variants });
  }
  cache = { at: Date.now(), products: out };
  return out;
}

async function findVariant(id: number) {
  for (const p of await products()) {
    const v = p.variants.find((v) => v.id === id);
    if (v) return { product: p, variant: v };
  }
  throw new Error("That item is not for sale.");
}

// A rough state for the countries whose rates need one; the real address
// comes from PayPal at payment time.
const DEFAULT_STATE: Record<string, string> = { US: "NY", CA: "ON", AU: "NSW" };

async function quote(variantId: number, quantity: number, country: string, state?: string) {
  const { product, variant } = await findVariant(variantId);
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

// ---------- routes ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const route = new URL(req.url).pathname.split("/").filter(Boolean).pop();

  try {
    if (route === "products" && req.method === "GET") {
      const list = (await products()).map((p) => ({
        id: p.id, name: p.name, image: p.image,
        variants: p.variants.map(({ catalog: _c, ...v }) => v),
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
      const q = await quote(Number(body.variant), Number(body.quantity), country);
      const { ok, data } = await paypal("/v2/checkout/orders", {
        method: "POST",
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            custom_id: `${q.variant.id}:${q.quantity}:${country}`,
            description: `MINT SUIT — ${q.variant.name}`.slice(0, 127),
            amount: {
              currency_code: q.currency,
              value: q.total,
              breakdown: {
                item_total: { currency_code: q.currency, value: q.items },
                shipping: { currency_code: q.currency, value: q.shipping },
              },
            },
            items: [{
              name: q.variant.name.slice(0, 127),
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
      const q = await quote(variantId, quantity, country, state);
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
      if (!patch.ok) throw new Error(patch.data?.details?.[0]?.description ?? "Could not update the shipping.");
      return json(req, { currency: q.currency, items: q.items, shipping: q.shipping, total: q.total });
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
    return json(req, { error: e instanceof Error ? e.message : String(e) }, 400);
  }
});
