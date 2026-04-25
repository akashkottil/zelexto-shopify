# Analytics — Operator Guide

The Zelexto theme ships a single, settings-driven analytics layer that talks
to **GA4**, **GTM**, **Meta Pixel**, and **Klaviyo**. Purchase events come
from a separate **Customer Events Custom Pixel** that runs server-side and
dispatches to GA4 Measurement Protocol, Meta CAPI, and Klaviyo Track API.

## 1. Enable channels (theme settings)

In **Online Store → Themes → Customize → Theme settings → Analytics**:

| Setting | Where to find |
| --- | --- |
| `GA4 Measurement ID` | GA4 → Admin → Data Streams → your web stream → **Measurement ID** (`G-XXXXXXX`) |
| `GTM Container ID` | Tag Manager → container header (`GTM-XXXXXXX`) |
| `Meta Pixel ID` | Meta Events Manager → Data sources → Pixel ID |
| `Klaviyo public API key` | Klaviyo → Account → Settings → API Keys → **Public API Key** (six characters) |
| `Require cookie consent` | When ON, all dispatching is queued until the visitor accepts the consent banner |

Leaving an ID blank disables that channel entirely.

## 2. Install the Custom Pixel (purchase tracking)

Front-end pixels can be blocked by ad blockers and never see the order
confirmation page on Shopify checkout. To capture `purchase` reliably, copy
`assets/customer-events-pixel.js` into the Customer Events sandbox:

1. Shopify Admin → **Settings → Customer events** → **Add custom pixel**.
2. Name it `Zelexto Analytics Bridge`.
3. Paste the entire contents of `assets/customer-events-pixel.js` into the
   **Code** field.
4. Add the following keys under **Sandbox API access** (or via the pixel
   settings UI Shopify exposes):

   | Key | Where to get it |
   | --- | --- |
   | `GA4_MEASUREMENT_ID` | same as theme setting |
   | `GA4_API_SECRET` | GA4 → Admin → Data Streams → web stream → **Measurement Protocol API secrets** → Create |
   | `META_PIXEL_ID` | same as theme setting |
   | `META_ACCESS_TOKEN` | Meta Business Manager → Events Manager → your pixel → **Conversions API → Generate access token** |
   | `KLAVIYO_PRIVATE_KEY` | Klaviyo → Account → Settings → API Keys → **Create private API key** with `events:write` scope (`pk_…`) |

5. Set permissions to **Customer privacy → Required**.
6. **Save** then **Connect**.

> The repo file is the source of truth. After editing, paste the new contents
> into the same custom pixel and re-save — the pixel will not auto-update.

## 3. Verify

| Channel | How |
| --- | --- |
| GA4 | Admin → DebugView → run the site with GA debug extension. `view_item`, `add_to_cart`, `begin_checkout`, `purchase` should land within seconds |
| Meta Pixel | Install **Meta Pixel Helper**. Confirm `ViewContent`, `AddToCart`, `Purchase`. CAPI deliveries show in **Events Manager → Test events** with `event_source = website` |
| GTM | Preview mode → confirm `dataLayer` events fire on cart/search interactions |
| Klaviyo | Profiles → search yourself → activity feed should list `Viewed Product`, `Started Checkout`, `Placed Order` |

## 4. Event taxonomy

| Theme bus event | Canonical name (GA4) | Meta Pixel | Klaviyo |
| --- | --- | --- | --- |
| `cart:item-added`              | `add_to_cart`         | `AddToCart`        | `Added to Cart` |
| `cart:item-removed`            | `remove_from_cart`    | `RemoveFromCart`   | `Removed from Cart` |
| `cart:drawer-opened`           | `view_cart`           | `ViewCart`         | `Viewed Cart` |
| `cart:checkout-clicked`        | `begin_checkout`      | `InitiateCheckout` | `Started Checkout` |
| `search:submitted`             | `search`              | `Search`           | `Searched Site` |
| `analytics:sign_up`            | `sign_up`             | `Lead`             | `Subscribed to List` |
| `analytics:cart_abandoned`     | `cart_abandoned`      | `AddToCart`        | `Abandoned Cart` |
| PDP first paint inline         | `view_item`           | `ViewContent`      | `Viewed Product` |
| `[data-product-card]` IO-fired | `view_item_list`      | `ViewContent`      | `Viewed Product List` |
| Customer Pixel `checkout_completed` | `purchase`       | `Purchase`         | `Placed Order` |

## 5. Consent

When **Require cookie consent** is enabled:

- A small, focus-trapped banner appears on first visit.
- All `ZAnalytics.track()` calls are queued.
- Accept → events flush and a 180-day `zelexto_consent=accept` cookie is
  written.
- Reject → the queue is dropped and `zelexto_consent=reject` is written.
  The dispatcher will not fire to any channel until the cookie is cleared
  or set to `accept`.

The Custom Pixel (server-side) is gated by Shopify's own customer-privacy
setting. Set the pixel's privacy mode to **Required** so it runs only when
the storefront has consent.

## 6. Files

| Path | Purpose |
| --- | --- |
| `assets/analytics.js` | Front-end dispatcher + consent banner |
| `assets/customer-events-pixel.js` | Source-of-truth for the Admin Custom Pixel |
| `snippets/analytics-config.liquid` | Emits `window.themeAnalyticsConfig` |
| `snippets/analytics-head.liquid` | Loads GA4 / GTM / Meta / Klaviyo `<script>` tags |
| `snippets/analytics-product.liquid` | Inline `view_item` for PDP first paint |

## 7. Adding a custom event

```js
// anywhere on the storefront (after analytics.js is loaded)
window.ZAnalytics?.track('custom_event_name', {
  currency: 'INR',
  value: 199,
  items: [{ item_id: '123', quantity: 1 }]
});
```

Add a row to the `KLAVIYO_MAP` / `META_MAP` in `assets/analytics.js` to map
your new event onto channel-specific names if needed.
