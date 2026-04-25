# Zelexto v2 — India payments operator guide

A practical setup guide for an Indian merchant going live with this theme.
Each section corresponds to a setting group in **Online Store → Customize →
Theme settings**.

---

## 1. Razorpay (default gateway)

The theme does not implement payments — Razorpay is enabled at the platform
level. The theme only renders the badges and copy.

1. **Admin → Settings → Payments → Add payment methods** → search for
   `Razorpay Secure (UPI, Cards, Wallets, NetBanking)` and activate.
2. Enter your Razorpay key and secret. Use *Test mode* until validated.
3. Theme settings → **Payments (India) → Methods to badge** — tick the
   methods you want shown on PDP / cart / footer.
4. Optional: tick **Show EMI from / month line** and set a minimum order
   value (e.g. ₹3,000) — the PDP will show "EMI from ₹X/mo".

Verify by placing a test order; checkout should render the Razorpay widget
with UPI / Cards / Netbanking tabs.

---

## 2. Razorpay Magic Checkout (1-step checkout)

Magic Checkout is a separate **App Embed** distributed by Razorpay.

1. Install the **Razorpay Magic Checkout** app from the Shopify App Store.
2. Follow the in-app onboarding (KYC, payouts, address blocks).
3. Theme settings → toggle **Razorpay Magic Checkout installed** to *on*.
   This unhides `snippets/razorpay-magic-hook.liquid` so the app's embed
   block has somewhere to mount.
4. Verify on a real device — Magic Checkout takes over the buy-now flow and
   prefills address from the buyer's phone-number-linked profile.

---

## 3. Cash on Delivery (COD)

The theme supports three pincode-source providers; pick one in
**Theme settings → Payments (India) → Cash on Delivery → Pincode
serviceability source**.

### Option A — `metafield` (default, no app required)
1. Create **shop metafield** `zelexto.cod_pincodes` (type **JSON**), schema
   in `docs/metafields.md`.
2. Paste your serviceable pincodes into that metafield.
3. In **Admin → Settings → Payments → Manual payment methods**, add
   *Cash on Delivery (COD)*.

The theme reads the metafield client-side and toggles the
`cod-availability` UI; ineligible pincodes render *Prepaid only* / *We don't
deliver here yet*.

### Option B — `gokwik` (App Proxy)
1. Install **GoKwik** from the Shopify App Store and complete KYC.
2. In GoKwik, configure their **App Proxy** so requests to
   `/apps/proxy/pincode?zip=<6-digit>` return JSON of the form
   `{ "serviceable": true, "cod": true, "eta": "1-2 days" }`.
3. Theme settings → set provider to *GoKwik App Proxy*.

### Option C — `shipway` (App Proxy)
Same as GoKwik but using the Shipway app.

### Option D — `off`
Disables COD entirely — the pincode UI hides itself.

### COD fees
- **COD handling fee (INR)** — defaults to `49`.
- **Waive COD fee above (INR)** — defaults to `1499`.
The theme renders these in `snippets/cod-fee.liquid`. The actual fee is
applied at checkout via a Shopify Function or a Shopify Flow rule (theme
only displays it).

---

## 4. Partial payment (advance + balance)

Partial payment is implemented by an **app's checkout extension**; the theme
captures the buyer's intent into a cart attribute the app reads.

1. Install one of:
   - **GoKwik Advance COD**
   - **Razorpay Magic Checkout** (with partial-pay enabled)
   - **Simpl** (with prepay-on-delivery)
2. In their app dashboard, set the **advance percentage** to match the
   `Partial advance %` you'll use in theme settings.
3. Theme settings → **Partial payment app** → pick the matching provider.
   - `Disabled` hides the partial-pay UI everywhere.
4. Theme settings → set **Advance %** (10–90) and **Minimum order (INR)**.

The theme writes the choice to `cart.attributes.payment_intent` (one of
`full | partial | cod`). The app's extension is responsible for honoring it
at checkout, capturing the advance, and creating the deferred balance.

---

## 5. India compliance

### GSTIN field on cart
1. Theme settings → **India Compliance → Show GSTIN field on cart** (on by
   default).
2. The cart shows a "GSTIN (for business invoice)" toggle. Buyers entering
   a valid GSTIN populate `cart.attributes.gstin` and `business_name`.
3. Use **Shopify Flow** on `Order created` to copy the cart attributes into
   `order.metafields.compliance.gstin` / `business_name` (see
   `docs/metafields.md`).

### Lakh formatting
- **Format INR with lakh notation** — when on, all `[data-money-cents]`
  elements are re-rendered using `Intl.NumberFormat('en-IN')` so prices
  display as `₹1,00,000` instead of `₹100,000`. Default: on.

### HSN codes on PDP
- Set per-product HSN codes via `product.metafields.compliance.hsn_code`.
- Toggle **Show HSN codes on PDP** to render them under the price.

### Legal footer block
- Theme settings → **India Compliance** → fill **Registered business
  address**, **CIN number**, **Shop GSTIN**.
- These are surfaced by `snippets/legal-footer.liquid` rendered from the
  footer section.

### Legal pages
The theme ships six policy templates that all use `main-page`:
- `templates/page.terms.json`
- `templates/page.privacy.json`
- `templates/page.returns.json`
- `templates/page.shipping.json`
- `templates/page.refund.json`
- `templates/page.cod-policy.json`

Create matching `Pages` in **Online Store → Pages** with handles `terms`,
`privacy`, `returns`, `shipping`, `refund-policy`, `cod-policy`. Shopify
will auto-pair pages with a matching template suffix; otherwise pick the
template explicitly in the page editor.

---

## 6. Verification checklist

- [ ] Razorpay test order succeeds with UPI / cards / netbanking.
- [ ] PDP shows badges for the methods enabled in settings.
- [ ] Pincode check returns `serviceable + cod + ETA` for at least one IN
      pincode.
- [ ] Partial-pay radio writes `payment_intent: 'partial'` to
      `/cart/update.js` (verify via `fetch('/cart.js').then(r => r.json())`).
- [ ] GSTIN entry persists across page reloads (cart attribute survives).
- [ ] Lakh-formatted price renders ₹1,00,000 on a ₹100,000 item.
- [ ] Legal footer shows CIN + GSTIN + address.
