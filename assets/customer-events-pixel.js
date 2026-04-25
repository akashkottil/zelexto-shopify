/**
 * Zelexto v2 — customer-events-pixel.js
 *
 * SOURCE OF TRUTH for the Shopify Admin → Customer Events → Custom Pixel.
 * This file lives in the repo for version control. The runtime copy is
 * pasted into Shopify Admin under Customer Events. Updates require a
 * copy/paste; the file is NOT loaded as a theme asset.
 *
 * It subscribes to standard Shopify Customer Events (analytics.subscribe)
 * and forwards them server-side to:
 *   - GA4 Measurement Protocol  (https://www.google-analytics.com/mp/collect)
 *   - Meta Conversions API      (https://graph.facebook.com/v18.0/<pixel_id>/events)
 *   - Klaviyo Track API         (https://a.klaviyo.com/api/track)
 *
 * Required environment variables (set in Pixel "Sandbox" / config UI):
 *   GA4_MEASUREMENT_ID         e.g. G-XXXXXXX
 *   GA4_API_SECRET             from GA4 → Admin → Data Streams → Measurement Protocol
 *   META_PIXEL_ID
 *   META_ACCESS_TOKEN          generated in Meta Business Manager
 *   KLAVIYO_PRIVATE_KEY        pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *
 * Pixel sandbox provides `analytics`, `browser`, and `init` globals
 * (see https://shopify.dev/docs/api/web-pixels-api).
 */

/* eslint-disable no-undef */

const env = init.settings || {};
const GA4_ID       = env.GA4_MEASUREMENT_ID;
const GA4_SECRET   = env.GA4_API_SECRET;
const META_ID      = env.META_PIXEL_ID;
const META_TOKEN   = env.META_ACCESS_TOKEN;
const KLAVIYO_KEY  = env.KLAVIYO_PRIVATE_KEY;

const sha256 = async (str) => {
  if (!str) return undefined;
  const buf = new TextEncoder().encode(String(str).trim().toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

async function clientId() {
  // Shopify pixel sandbox exposes browser cookies via `browser.cookie.get`.
  try {
    const ga = await browser.cookie.get('_ga');
    if (ga) return ga.split('.').slice(-2).join('.');
  } catch (_) {}
  return Math.random().toString(36).slice(2) + '.' + Date.now();
}

// ---- GA4 Measurement Protocol ----
async function ga4Send(name, params, customerId) {
  if (!GA4_ID || !GA4_SECRET) return;
  const cid = await clientId();
  const url = `https://www.google-analytics.com/mp/collect?api_secret=${GA4_SECRET}&measurement_id=${GA4_ID}`;
  const body = {
    client_id: cid,
    user_id: customerId || undefined,
    events: [{ name, params }]
  };
  return fetch(url, { method: 'POST', body: JSON.stringify(body) }).catch(() => {});
}

// ---- Meta Conversions API ----
async function metaSend(eventName, eventData, customer) {
  if (!META_ID || !META_TOKEN) return;
  const url = `https://graph.facebook.com/v18.0/${META_ID}/events?access_token=${META_TOKEN}`;
  const userData = {};
  if (customer && customer.email) userData.em = [await sha256(customer.email)];
  if (customer && customer.phone) userData.ph = [await sha256(customer.phone)];

  const payload = {
    data: [{
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_source_url: (event && event.context && event.context.window && event.context.window.location && event.context.window.location.href) || undefined,
      user_data: userData,
      custom_data: eventData || {}
    }]
  };
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

// ---- Klaviyo Track API ----
async function klaviyoSend(eventName, properties, customer) {
  if (!KLAVIYO_KEY) return;
  const url = 'https://a.klaviyo.com/api/track';
  const payload = {
    token: KLAVIYO_KEY,
    event: eventName,
    customer_properties: customer ? {
      $email: customer.email,
      $phone_number: customer.phone,
      $first_name: customer.firstName,
      $last_name: customer.lastName
    } : { $anonymous: true },
    properties: properties || {},
    time: Math.floor(Date.now() / 1000)
  };
  const data = btoa(JSON.stringify(payload));
  return fetch(`${url}?data=${data}`, { method: 'GET' }).catch(() => {});
}

// ---- Helpers ----
function lineItemsFromCheckout(checkout) {
  return (checkout && checkout.lineItems || []).map((li) => ({
    item_id: li.variant && li.variant.product && li.variant.product.id,
    item_variant: li.variant && li.variant.id,
    item_name: li.title,
    price: li.variant && li.variant.price && li.variant.price.amount,
    quantity: li.quantity
  }));
}

// ============================================================================
// Subscriptions
// ============================================================================

analytics.subscribe('checkout_completed', (event) => {
  const co = event.data.checkout;
  const customer = co && (co.email || co.phone) ? {
    email: co.email,
    phone: co.phone,
    firstName: co.shippingAddress && co.shippingAddress.firstName,
    lastName:  co.shippingAddress && co.shippingAddress.lastName
  } : null;

  const items = lineItemsFromCheckout(co);
  const value = co && co.totalPrice && co.totalPrice.amount;
  const currency = co && co.currencyCode;
  const orderId = co && co.order && co.order.id;

  const params = {
    transaction_id: orderId,
    value, currency, items
  };

  ga4Send('purchase', params, customer && customer.email);
  metaSend('Purchase', { value, currency, contents: items, num_items: items.length }, customer);
  klaviyoSend('Placed Order', { OrderId: orderId, Total: value, Currency: currency, Items: items }, customer);
});

analytics.subscribe('checkout_started', (event) => {
  const co = event.data.checkout;
  const items = lineItemsFromCheckout(co);
  const value = co && co.totalPrice && co.totalPrice.amount;
  const currency = co && co.currencyCode;
  ga4Send('begin_checkout', { value, currency, items });
  metaSend('InitiateCheckout', { value, currency, contents: items });
  klaviyoSend('Started Checkout', { Total: value, Currency: currency, Items: items });
});

analytics.subscribe('payment_info_submitted', (event) => {
  const co = event.data.checkout;
  ga4Send('add_payment_info', {
    value: co && co.totalPrice && co.totalPrice.amount,
    currency: co && co.currencyCode
  });
  metaSend('AddPaymentInfo', {
    value: co && co.totalPrice && co.totalPrice.amount,
    currency: co && co.currencyCode
  });
});

analytics.subscribe('product_viewed', (event) => {
  const v = event.data.productVariant;
  const params = {
    items: [{
      item_id: v && v.product && v.product.id,
      item_variant: v && v.id,
      item_name: v && v.product && v.product.title,
      price: v && v.price && v.price.amount
    }]
  };
  ga4Send('view_item', params);
  metaSend('ViewContent', { content_ids: [v && v.product && v.product.id] });
  klaviyoSend('Viewed Product', { ProductName: v && v.product && v.product.title });
});

analytics.subscribe('product_added_to_cart', (event) => {
  const li = event.data.cartLine;
  const item = {
    item_id: li && li.merchandise && li.merchandise.product && li.merchandise.product.id,
    item_variant: li && li.merchandise && li.merchandise.id,
    item_name: li && li.merchandise && li.merchandise.product && li.merchandise.product.title,
    price: li && li.cost && li.cost.totalAmount && li.cost.totalAmount.amount,
    quantity: li && li.quantity
  };
  ga4Send('add_to_cart', { items: [item] });
  metaSend('AddToCart', { contents: [item] });
  klaviyoSend('Added to Cart', { ProductName: item.item_name, Price: item.price });
});

analytics.subscribe('product_removed_from_cart', (event) => {
  const li = event.data.cartLine;
  ga4Send('remove_from_cart', {
    items: [{ item_id: li && li.merchandise && li.merchandise.product && li.merchandise.product.id }]
  });
});

analytics.subscribe('search_submitted', (event) => {
  const q = event.data.searchResult && event.data.searchResult.query;
  ga4Send('search', { search_term: q });
  metaSend('Search', { search_string: q });
  klaviyoSend('Searched Site', { Query: q });
});

analytics.subscribe('cart_viewed', (event) => {
  const c = event.data.cart;
  ga4Send('view_cart', {
    value: c && c.cost && c.cost.totalAmount && c.cost.totalAmount.amount,
    currency: c && c.cost && c.cost.totalAmount && c.cost.totalAmount.currencyCode
  });
});
