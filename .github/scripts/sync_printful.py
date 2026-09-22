"""Bring _data/shop.yml in line with the Printful store.

Run by the "Sync with Printful" button in Pages CMS (the sync-printful
workflow). Every product in the store gets an entry under `products`, tied
to it by its Printful id, which never changes; the entry's `name` is set to
the product's current name. What was set in the panel (title, mockups,
description, details, Sold out) is kept. New products get an empty entry,
on sale. Entries for products no longer in the store are left alone.

The store is read through the site's own shop function, so no Printful key
is needed here.
"""

import json
import re
import sys
import urllib.request

import yaml

PATH = "_data/shop.yml"
ORDER = ["name", "printful_id", "title", "mockups", "description", "specs", "available", "sold_out"]


def words(s):
    return re.sub(r"[^a-z0-9]+", " ", str(s or "").lower()).strip()


def by_name(entries, name):
    """The same matching the page uses, for entries not yet tied to an id."""
    key = words(name)
    key_words = key.split(" ")
    best, best_score = None, 0
    for e in entries:
        n = words(e.get("name"))
        if not n:
            continue
        if n == key:
            score = 3
        elif key.startswith(n) or n.startswith(key):
            score = 2
        else:
            mine = n.split(" ")
            shared = sum(1 for w in mine if w in key_words)
            score = 1 + shared / 100 if shared / len(mine) >= 0.75 else 0
        if score > best_score:
            best, best_score = e, score
    return best


def tidy(entry):
    out = {k: entry[k] for k in ORDER if k in entry}
    out.update({k: v for k, v in entry.items() if k not in out})
    return out


def main():
    with open(PATH, encoding="utf-8") as f:
        shop = yaml.safe_load(f) or {}

    api = str(shop.get("functions_url") or "").rstrip("/")
    if not api:
        sys.exit("No functions_url in _data/shop.yml")
    with urllib.request.urlopen(f"{api}/products?fresh=1", timeout=120) as res:
        store = json.load(res)["products"]

    entries = list(shop.get("products") or [])
    synced = []
    for product in store:
        pid, name = product["id"], product["name"]
        entry = next((e for e in entries if e.get("printful_id") == pid), None)
        if entry is None:
            entry = by_name([e for e in entries if not e.get("printful_id")], name)
        if entry is None:
            entry = {"name": name, "title": "", "sold_out": False}
            print(f"new: {name}")
        else:
            entries.remove(entry)
            if entry.get("name") != name:
                print(f"renamed: {entry.get('name')} -> {name}")
        entry["name"] = name
        entry["printful_id"] = pid
        synced.append(tidy(entry))

    # The store's products first, in its order; any others after them.
    shop["products"] = synced + [tidy(e) for e in entries]

    with open(PATH, "w", encoding="utf-8", newline="\n") as f:
        yaml.safe_dump(shop, f, sort_keys=False, allow_unicode=True, width=78)
    print(f"{len(store)} products in the store, {len(shop['products'])} entries in the panel")


if __name__ == "__main__":
    main()
