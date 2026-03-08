import {StoreRepository} from '../repositories/storeRepository.js';
import shopifyConfig from '../config/shopify.js';

const storeRepo = new StoreRepository();

function normalizeShopDomain(shop) {
  if (!shop) return null;
  return shop
    .replace(/^https?:\/\//, '')
    .replace(/\.myshopify\.com.*$/, '')
    .trim()
    .toLowerCase();
}

/**
 * Register orders/create webhook via Shopify REST API
 */
async function registerOrderWebhook(shopDomain, accessToken) {
  const webhookUrl = `${shopifyConfig.appUrl}/api/orders/webhook`;
  const apiUrl = `https://${shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}/webhooks.json`;

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        webhook: {topic: 'orders/create', address: webhookUrl, format: 'json'}
      })
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`Webhook orders/create registered for ${shopDomain}: id=${data.webhook?.id}`);
      return {success: true, id: data.webhook?.id};
    } else if (res.status === 422) {
      console.log(`Webhook orders/create already exists for ${shopDomain}`);
      return {success: true, existing: true};
    } else {
      const errText = await res.text();
      const isProtectedData = errText.includes('protected customer data');
      if (isProtectedData) {
        console.warn(`[${shopDomain}] App needs Protected Customer Data access for orders/create webhook`);
      } else {
        console.error(`Failed to register webhook for ${shopDomain}:`, errText);
      }
      return {success: false, error: isProtectedData ? 'Need Protected Customer Data access' : errText};
    }
  } catch (err) {
    console.error(`Webhook registration error for ${shopDomain}:`, err.message);
    return {success: false, error: err.message};
  }
}

/**
 * Fetch shop info and save/update store in Firestore
 */
async function saveStore(shopDomain, accessToken, {clientId, clientSecret, scopes, installedVia}) {
  const shopInfoUrl = `https://${shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}/shop.json`;
  const shopInfoResponse = await fetch(shopInfoUrl, {
    headers: {'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json'}
  });

  let shopInfo = {};
  if (shopInfoResponse.ok) {
    const shopInfoData = await shopInfoResponse.json();
    shopInfo = shopInfoData.shop || {};
  }

  const existingStore = await storeRepo.getByShopDomain(shopDomain);

  const storeData = {
    accessToken,
    name: shopInfo.name || shopDomain,
    email: shopInfo.email || '',
    currency: shopInfo.currency || '',
    timezone: shopInfo.timezone || '',
    planName: shopInfo.plan_display_name || '',
    shopOwner: shopInfo.shop_owner || '',
    phone: shopInfo.phone || '',
    country: shopInfo.country_name || '',
    status: 'active',
    installedVia,
    partnerClientId: clientId,
    partnerClientSecret: clientSecret || '',
    scopes: scopes || '',
    lastConnected: new Date().toISOString()
  };

  if (existingStore) {
    await storeRepo.update(existingStore.id, storeData);
  } else {
    await storeRepo.create({
      userId: shopDomain,
      shopDomain,
      niche: '',
      connectedAt: new Date().toISOString(),
      ...storeData
    });
  }
}

/**
 * GET /api/authMultip/shopify?shop=xxx&client_id=xxx&client_secret=xxx
 * Redirect to Shopify OAuth consent screen
 */
export async function initiateInstall(req, res) {
  try {
    const {shop, client_id, client_secret} = req.query;

    if (!shop || !client_id || !client_secret) {
      return res.status(400).json({
        success: false,
        error: 'Missing required params: shop, client_id, client_secret'
      });
    }

    const shopDomain = normalizeShopDomain(shop);
    if (!shopDomain) {
      return res.status(400).json({success: false, error: 'Invalid shop domain'});
    }

    const origin = `${req.protocol}://${req.get('host')}`;
    const statePayload = Buffer.from(JSON.stringify({client_id, client_secret, origin})).toString('base64');
    const redirectUri = `${origin}/api/authMultip/shopify/callback`;

    const authUrl =
      `https://${shopDomain}.myshopify.com/admin/oauth/authorize?` +
      `client_id=${encodeURIComponent(client_id)}` +
      `&scope=${encodeURIComponent(shopifyConfig.scopes)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(statePayload)}`;

    return res.redirect(authUrl);
  } catch (error) {
    console.error('Multi-app initiate install error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * GET /api/authMultip/shopify/callback?code=xxx&shop=xxx&hmac=xxx&state=xxx
 * Exchange code for access token
 */
export async function handleCallback(req, res) {
  const redirectWithScript = (url) =>
    res.send(`<!DOCTYPE html><html><head><script>window.top.location.href="${url}";</script></head><body></body></html>`);
  const redirectWithError = (origin, msg) =>
    redirectWithScript(`${origin}/stores?error=${encodeURIComponent(msg)}`);

  try {
    const {code, shop, state} = req.query;

    // No code = initial install from Shopify admin
    // Show inline form to enter partner credentials, then redirect to OAuth
    if (!code && shop) {
      const shopDomain = normalizeShopDomain(shop);
      const callbackUrl = `${shopifyConfig.appUrl}/api/authMultip/shopify/callback`;
      const scopes = shopifyConfig.scopes;
      return res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect Store</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f6f6f7;display:flex;justify-content:center;align-items:center;min-height:100vh}
.card{background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.08);padding:32px;max-width:420px;width:100%}
h2{font-size:20px;margin-bottom:4px}
.shop{color:#637381;margin-bottom:24px;font-size:14px}
label{display:block;font-size:13px;font-weight:600;margin-bottom:4px;color:#303030}
input{width:100%;padding:10px 12px;border:1px solid #c9cccf;border-radius:8px;font-size:14px;margin-bottom:16px;outline:none}
input:focus{border-color:#5c6ac4;box-shadow:0 0 0 1px #5c6ac4}
button{width:100%;padding:12px;background:#008060;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer}
button:hover{background:#006e52}
.err{color:#d72c0d;font-size:13px;margin-bottom:12px;display:none}
</style></head><body>
<div class="card">
<h2>Enter Partner Credentials</h2>
<p class="shop">Store: <strong>${shopDomain}.myshopify.com</strong></p>
<div class="err" id="err">Please fill in all fields</div>
<label>Client ID</label>
<input id="cid" placeholder="e.g. a5e441d1ffb72f1c7a7c2b4a8e5e77d7" autofocus>
<label>Client Secret</label>
<input id="csec" type="password" placeholder="e.g. shpss_xxxxx">
<button onclick="go()">Connect & Get Access Token</button>
</div>
<script>
function go(){
  var cid=document.getElementById('cid').value.trim();
  var csec=document.getElementById('csec').value.trim();
  if(!cid||!csec){document.getElementById('err').style.display='block';return}
  var state=btoa(JSON.stringify({client_id:cid,client_secret:csec,origin:'${shopifyConfig.appUrl}'}));
  var url='https://${shopDomain}.myshopify.com/admin/oauth/authorize?'
    +'client_id='+encodeURIComponent(cid)
    +'&scope=${encodeURIComponent(scopes)}'
    +'&redirect_uri=${encodeURIComponent(callbackUrl)}'
    +'&state='+encodeURIComponent(state);
  window.top.location.href=url;
}
</script></body></html>`);
    }

    // Parse state to get credentials and origin
    let credentials = {};
    try {
      const decoded = Buffer.from(state || '', 'base64').toString();
      credentials = JSON.parse(decoded);
    } catch (e) {
      console.error('State parse error:', e.message, 'raw state:', state?.substring(0, 50));
    }
    const {client_id, client_secret, origin: savedOrigin} = credentials;
    const baseOrigin = savedOrigin || shopifyConfig.appUrl;

    if (!code || !shop || !state) {
      return redirectWithError(baseOrigin, 'Missing required parameters from Shopify');
    }
    if (!client_id || !client_secret) {
      return redirectWithError(baseOrigin, 'Missing credentials in state');
    }

    const shopDomain = normalizeShopDomain(shop);

    // Exchange authorization code for access token
    const tokenUrl = `https://${shopDomain}.myshopify.com/admin/oauth/access_token`;
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({client_id, client_secret, code})
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return redirectWithError(baseOrigin, 'Failed to exchange authorization code');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return redirectWithError(baseOrigin, 'No access token received');
    }

    // Save store to Firestore & register webhook
    await saveStore(shopDomain, accessToken, {
      clientId: client_id,
      clientSecret: client_secret,
      scopes: tokenData.scope,
      installedVia: 'multi-app-oauth'
    });
    await registerOrderWebhook(shopDomain, accessToken);

    console.log(`Multi-app installed on: ${shopDomain} (client_id: ${client_id})`);

    return redirectWithScript(`${baseOrigin}/stores?connected=${shopDomain}`);
  } catch (error) {
    console.error('Multi-app OAuth callback error:', error);
    const fallbackOrigin = shopifyConfig.appUrl;
    return redirectWithScript(`${fallbackOrigin}/stores?error=${encodeURIComponent(error.message)}`);
  }
}

// Required webhooks: topic → expected address suffix
const REQUIRED_WEBHOOKS = [
  {topic: 'orders/create', address: `${shopifyConfig.appUrl}/api/orders/webhook`}
];

/**
 * GET /api/authMultip/webhooks?shop=xxx
 * List webhooks for a store and check which required ones are missing
 */
export async function checkWebhooks(req, res) {
  try {
    const {shop} = req.query;
    if (!shop) {
      return res.status(400).json({success: false, error: 'Missing shop param'});
    }

    const shopDomain = normalizeShopDomain(shop);
    const store = await storeRepo.getByShopDomain(shopDomain);
    if (!store || !store.accessToken) {
      return res.status(404).json({success: false, error: 'Store not found or no access token'});
    }

    const apiUrl = `https://${shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}/webhooks.json`;
    const response = await fetch(apiUrl, {
      headers: {'X-Shopify-Access-Token': store.accessToken}
    });

    if (!response.ok) {
      return res.status(response.status).json({success: false, error: await response.text()});
    }

    const {webhooks} = await response.json();
    const missing = [];
    const wrongAddress = [];
    for (const req of REQUIRED_WEBHOOKS) {
      const match = webhooks.find(w => w.topic === req.topic);
      if (!match) {
        missing.push(req.topic);
      } else if (match.address !== req.address) {
        wrongAddress.push({topic: req.topic, current: match.address, expected: req.address, id: match.id});
      }
    }

    return res.json({
      success: true,
      shop: shopDomain,
      registered: webhooks.map(w => ({id: w.id, topic: w.topic, address: w.address})),
      missing,
      wrongAddress,
      allPresent: missing.length === 0 && wrongAddress.length === 0
    });
  } catch (error) {
    console.error('Check webhooks error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/authMultip/webhooks/fix?shop=xxx
 * Register missing required webhooks for a store
 */
export async function fixWebhooks(req, res) {
  try {
    const {shop} = req.query;
    if (!shop) {
      return res.status(400).json({success: false, error: 'Missing shop param'});
    }

    const shopDomain = normalizeShopDomain(shop);
    const store = await storeRepo.getByShopDomain(shopDomain);
    if (!store || !store.accessToken) {
      return res.status(404).json({success: false, error: 'Store not found or no access token'});
    }

    // Get current webhooks
    const baseApiUrl = `https://${shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}`;
    const listRes = await fetch(`${baseApiUrl}/webhooks.json`, {
      headers: {'X-Shopify-Access-Token': store.accessToken}
    });
    const {webhooks} = await listRes.json();

    const missing = [];
    const wrongAddress = [];
    for (const rw of REQUIRED_WEBHOOKS) {
      const match = webhooks.find(w => w.topic === rw.topic);
      if (!match) {
        missing.push(rw.topic);
      } else if (match.address !== rw.address) {
        wrongAddress.push({topic: rw.topic, id: match.id});
      }
    }

    if (missing.length === 0 && wrongAddress.length === 0) {
      return res.json({success: true, message: 'All webhooks already registered', fixed: []});
    }

    const fixed = [];
    const errors = [];

    // Delete webhooks with wrong address, then re-register
    for (const wa of wrongAddress) {
      await fetch(`${baseApiUrl}/webhooks/${wa.id}.json`, {
        method: 'DELETE',
        headers: {'X-Shopify-Access-Token': store.accessToken}
      });
      const result = await registerOrderWebhook(shopDomain, store.accessToken);
      if (result?.success) {
        fixed.push(`${wa.topic} (updated address)`);
      } else {
        errors.push(`${wa.topic}: ${result?.error || 'Unknown error'}`);
      }
    }

    // Register missing webhooks
    for (const topic of missing) {
      const result = await registerOrderWebhook(shopDomain, store.accessToken);
      if (result?.success) {
        fixed.push(topic);
      } else {
        errors.push(`${topic}: ${result?.error || 'Unknown error'}`);
      }
    }

    return res.json({success: true, fixed, errors, message: `Fixed ${fixed.length}, errors ${errors.length}`});
  } catch (error) {
    console.error('Fix webhooks error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * GET /api/authMultip/webhooks/all
 * Check webhooks for ALL stores, report missing ones
 */
export async function checkAllWebhooks(req, res) {
  try {
    const allStores = await storeRepo.getAll();
    const results = [];

    for (const store of allStores) {
      if (!store.accessToken || !store.shopDomain) continue;

      try {
        const apiUrl = `https://${store.shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}/webhooks.json`;
        const response = await fetch(apiUrl, {
          headers: {'X-Shopify-Access-Token': store.accessToken}
        });

        if (!response.ok) {
          results.push({shop: store.shopDomain, error: `HTTP ${response.status}`, missing: REQUIRED_WEBHOOKS.map(r => r.topic)});
          continue;
        }

        const {webhooks} = await response.json();
        const missing = [];
        const wrongAddress = [];
        for (const rw of REQUIRED_WEBHOOKS) {
          const match = webhooks.find(w => w.topic === rw.topic);
          if (!match) {
            missing.push(rw.topic);
          } else if (match.address !== rw.address) {
            wrongAddress.push({topic: rw.topic, current: match.address, expected: rw.address, id: match.id});
          }
        }

        results.push({
          shop: store.shopDomain,
          installedVia: store.installedVia || 'main-app',
          registered: webhooks.map(w => ({id: w.id, topic: w.topic, address: w.address})),
          missing,
          wrongAddress,
          ok: missing.length === 0 && wrongAddress.length === 0
        });
      } catch (err) {
        results.push({shop: store.shopDomain, error: err.message, missing: REQUIRED_WEBHOOKS.map(r => r.topic)});
      }
    }

    const storesNeedFix = results.filter(r => (r.missing?.length > 0) || (r.wrongAddress?.length > 0) || r.error);
    return res.json({
      success: true,
      total: results.length,
      ok: results.filter(r => r.ok).length,
      needsFix: storesNeedFix.length,
      stores: results
    });
  } catch (error) {
    console.error('Check all webhooks error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/authMultip/webhooks/fix-all
 * Register missing webhooks for ALL stores
 */
export async function fixAllWebhooks(req, res) {
  try {
    const allStores = await storeRepo.getAll();
    const results = [];

    for (const store of allStores) {
      if (!store.accessToken || !store.shopDomain) continue;

      try {
        const baseApiUrl = `https://${store.shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}`;
        const listRes = await fetch(`${baseApiUrl}/webhooks.json`, {
          headers: {'X-Shopify-Access-Token': store.accessToken}
        });

        if (!listRes.ok) {
          results.push({shop: store.shopDomain, error: `HTTP ${listRes.status}`, fixed: []});
          continue;
        }

        const {webhooks} = await listRes.json();
        const missing = [];
        const wrongAddress = [];
        for (const rw of REQUIRED_WEBHOOKS) {
          const match = webhooks.find(w => w.topic === rw.topic);
          if (!match) {
            missing.push(rw.topic);
          } else if (match.address !== rw.address) {
            wrongAddress.push({topic: rw.topic, id: match.id});
          }
        }

        if (missing.length === 0 && wrongAddress.length === 0) {
          results.push({shop: store.shopDomain, fixed: [], message: 'Already OK'});
          continue;
        }

        const fixed = [];
        const errors = [];

        // Delete webhooks with wrong address, then re-register
        for (const wa of wrongAddress) {
          await fetch(`${baseApiUrl}/webhooks/${wa.id}.json`, {
            method: 'DELETE',
            headers: {'X-Shopify-Access-Token': store.accessToken}
          });
          const result = await registerOrderWebhook(store.shopDomain, store.accessToken);
          if (result?.success) {
            fixed.push(`${wa.topic} (updated)`);
          } else {
            errors.push(`${wa.topic}: ${result?.error || 'Unknown error'}`);
          }
        }

        // Register missing webhooks
        for (const topic of missing) {
          const result = await registerOrderWebhook(store.shopDomain, store.accessToken);
          if (result?.success) {
            fixed.push(topic);
          } else {
            errors.push(`${topic}: ${result?.error || 'Unknown error'}`);
          }
        }

        results.push({shop: store.shopDomain, fixed, errors: errors.length > 0 ? errors : undefined});
      } catch (err) {
        results.push({shop: store.shopDomain, error: err.message, fixed: []});
      }
    }

    const totalFixed = results.filter(r => r.fixed?.length > 0).length;
    return res.json({
      success: true,
      total: results.length,
      fixed: totalFixed,
      stores: results
    });
  } catch (error) {
    console.error('Fix all webhooks error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
