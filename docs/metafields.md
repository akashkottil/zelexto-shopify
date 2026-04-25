# Zelexto v2 — Metafield definitions

This theme reads from a small set of Shopify metafields. Create the
definitions below in **Shopify Admin → Settings → Custom data**.

All namespaces and keys are required for the theme to render the related UI.
Where a metafield is missing the theme silently falls back to a sensible
default (no UI rendered, or stock UI without enrichment).

---

## Shop metafields

### `shop.metafields.zelexto.cod_pincodes`
- **Namespace / key:** `zelexto.cod_pincodes`
- **Type:** JSON
- **Used by:** `snippets/pincode-check.liquid`, `assets/pincode.js` (when
  `settings.cod_provider == 'metafield'`)
- **Shape:**

  ```json
  {
    "110001": { "cod": true,  "eta": "1-2 days" },
    "400001": { "cod": true,  "eta": "1-2 days" },
    "560001": { "cod": false, "eta": "3-5 days" },
    "682001": { "cod": false, "eta": "5-7 days" }
  }
  ```

- **How to populate:** Admin → Settings → Custom data → Shop →
  Add definition → Type: JSON. Then Admin → Settings → Custom data →
  Shop → click the metafield row to edit and paste the JSON.

### `shop.metafields.zelexto.recent_sales`
- **Namespace / key:** `zelexto.recent_sales`
- **Type:** JSON (list of objects)
- **Used by:** Agent D — `assets/social-proof.js`
- **Shape:**

  ```json
  [
    { "name": "Riya",   "city": "Mumbai",    "product": "Atlas Chair",  "minutes_ago": 2 },
    { "name": "Arjun",  "city": "Bengaluru", "product": "Solo Lamp",    "minutes_ago": 7 }
  ]
  ```

---

## Product metafields

### `product.metafields.compliance.hsn_code`
- **Namespace / key:** `compliance.hsn_code`
- **Type:** Single-line text
- **Used by:** `snippets/hsn-code.liquid` (gated by `settings.show_hsn_codes`)
- **Notes:** 4–8 digit HSN code per HS classification. Falls back to
  `product.metafields.custom.hsn_code` when absent.

### `product.metafields.swatches.{option}`
- **Namespace / key:** `swatches.<option_name>` (one per swatch-driven option,
  e.g. `swatches.color`, `swatches.material`)
- **Type:** File reference (per option *value*)
- **Used by:** Agent B — `snippets/variant-picker.liquid`
- **Notes:** Upload a swatch image per *value* (e.g. "midnight", "sand").

### `product.metafields.custom.bundle_tiers`
- **Namespace / key:** `custom.bundle_tiers`
- **Type:** JSON
- **Used by:** Agent D — `assets/bundle.js`, `sections/bundle-builder.liquid`
- **Shape:**

  ```json
  [
    { "qty": 2, "discount_percent": 5 },
    { "qty": 3, "discount_percent": 10 },
    { "qty": 5, "discount_percent": 15 }
  ]
  ```

---

## Order metafields

These are populated by **Shopify Flow** on the `Order created` trigger,
copying from the cart attributes the theme writes during checkout.

### `order.metafields.compliance.gstin`
- **Type:** Single-line text
- **Source:** `cart.attributes.gstin` (set by `snippets/gst-invoice-field.liquid`)

### `order.metafields.compliance.business_name`
- **Type:** Single-line text
- **Source:** `cart.attributes.business_name`

### `order.metafields.compliance.payment_intent`
- **Type:** Single-line text (one of `full | partial | cod`)
- **Source:** `cart.attributes.payment_intent` (set by `payment-selector.js`)

### Shopify Flow recipe
1. Trigger: `Order created`.
2. Action: `Update order metafield` (one per field above).
3. Set **Value** to a Liquid expression like
   `{{ order.note_attributes.gstin }}` or use the *Note attributes* picker.

---

## Verifying definitions

After creating each definition you can validate by visiting the entity
admin page and confirming the metafield appears in the right rail. Theme
preview will render the gated UI as soon as a value is set.
