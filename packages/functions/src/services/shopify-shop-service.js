/**
 * Shopify Shop Service — shop info, themes, metafields, policies, collections.
 * Custom fields use namespace "toolshopify_cf".
 */

const CF_NAMESPACE = 'toolshopify_cf';

// ── Storefront Access Token ─────────────────────────────────────────────

/**
 * Create a Storefront Access Token and save it as a shop metafield.
 * Returns the token string.
 */
export async function createStorefrontToken(shopify) {
  try {
    // Check if token already exists in shop metafield
    const existingQuery = `{ shop { id metafield(namespace: "${CF_NAMESPACE}", key: "storefront_token") { value } } }`;
    const existing = await shopify.graphql(existingQuery);
    const shopId = existing.shop?.id;
    console.log('[createStorefrontToken] shopId:', shopId, 'existing token:', !!existing.shop?.metafield?.value);

    if (existing.shop?.metafield?.value) return existing.shop.metafield.value;

    // Create new Storefront Access Token
    const createMutation = `mutation { storefrontAccessTokenCreate(input: {title: "ToolShopify Custom Fields"}) {
      storefrontAccessToken { accessToken }
      userErrors { field message }
    }}`;
    const result = await shopify.graphql(createMutation);
    console.log('[createStorefrontToken] create result:', JSON.stringify(result));
    const {storefrontAccessToken, userErrors} = result.storefrontAccessTokenCreate;
    if (userErrors?.length > 0) throw new Error(userErrors.map(e => e.message).join(', '));

    const token = storefrontAccessToken.accessToken;

    // Save token to shop metafield
    const saveMutation = `mutation($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) { metafields { id } userErrors { field message } }
    }`;
    const saveResult = await shopify.graphql(saveMutation, {metafields: [{
      namespace: CF_NAMESPACE, key: 'storefront_token',
      ownerId: shopId, value: token, type: 'single_line_text_field'
    }]});
    console.log('[createStorefrontToken] save result:', JSON.stringify(saveResult));

    return token;
  } catch (error) {
    console.error('[createStorefrontToken] ERROR:', error.message);
    throw error;
  }
}

// ── Shop Metafields (config + enabled collections) ──────────────────────

/**
 * Get shop ID + all toolshopify_cf metafields in one query.
 */
async function getShopCfData(shopify) {
  const query = `{ shop {
    id
    config: metafield(namespace: "${CF_NAMESPACE}", key: "config") { value }
    collections: metafield(namespace: "${CF_NAMESPACE}", key: "collections") { value }
  }}`;
  const result = await shopify.graphql(query);
  const shop = result.shop;
  const config = shop.config?.value ? JSON.parse(shop.config.value) : [];
  const raw = shop.collections?.value ? JSON.parse(shop.collections.value) : {};
  // Back-compat: old format was an array of IDs (meant "all fields enabled").
  const collectionsMap = Array.isArray(raw)
    ? raw.reduce((acc, id) => ({...acc, [id]: config.map(f => f.key)}), {})
    : (raw || {});
  return {shopId: shop.id, config, collectionsMap};
}

/**
 * Save field config to shop metafield toolshopify_cf.config.
 */
export async function saveFieldConfig(shopify, fieldsConfig) {
  const {shopId} = await getShopCfData(shopify);
  console.log('[saveFieldConfig] shopId:', shopId, 'fields:', fieldsConfig.length);
  const mutation = `mutation($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) { metafields { id } userErrors { field message } }
  }`;
  const result = await shopify.graphql(mutation, {metafields: [{
    namespace: CF_NAMESPACE, key: 'config', ownerId: shopId,
    value: JSON.stringify(fieldsConfig), type: 'json'
  }]});
  console.log('[saveFieldConfig] result:', JSON.stringify(result));
  const {userErrors} = result.metafieldsSet;
  if (userErrors?.length > 0) throw new Error(userErrors.map(e => e.message).join(', '));
  return true;
}

/**
 * Set the field-key list for a collection in shop metafield toolshopify_cf.collections.
 * Pass empty array to disable (removes the collection entry).
 * Returns the updated map.
 */
export async function setCollectionFields(shopify, collectionId, fieldKeys) {
  const {shopId, collectionsMap} = await getShopCfData(shopify);
  const keys = Array.isArray(fieldKeys) ? fieldKeys.filter(Boolean) : [];
  const updated = {...collectionsMap};
  if (keys.length === 0) delete updated[collectionId];
  else updated[collectionId] = keys;
  console.log('[setCollectionFields] shopId:', shopId, 'collectionId:', collectionId, 'keys:', keys);

  const mutation = `mutation($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) { metafields { id } userErrors { field message } }
  }`;
  const result = await shopify.graphql(mutation, {metafields: [{
    namespace: CF_NAMESPACE, key: 'collections', ownerId: shopId,
    value: JSON.stringify(updated), type: 'json'
  }]});
  const {userErrors} = result.metafieldsSet;
  if (userErrors?.length > 0) throw new Error(userErrors.map(e => e.message).join(', '));
  return updated;
}

/**
 * Get the collection → fieldKeys map from shop metafield.
 */
export async function getCollectionsMap(shopify) {
  const {collectionsMap} = await getShopCfData(shopify);
  return collectionsMap;
}

// ── Collections List ────────────────────────────────────────────────────

/**
 * List all collections + mark which ones are enabled via shop metafield.
 */
export async function listCollections(shopify, {first = 50, after = null} = {}) {
  try {
    const [collectionsResult, collectionsMap] = await Promise.all([
      shopify.graphql(`query($first: Int!, $after: String) {
        collections(first: $first, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { id title handle image { url } productsCount { count } }
        }
      }`, {first, after}),
      getCollectionsMap(shopify)
    ]);

    const {nodes, pageInfo} = collectionsResult.collections;
    return {
      collections: nodes.map(c => ({
        id: c.id,
        title: c.title,
        handle: c.handle,
        image: c.image?.url || null,
        productsCount: c.productsCount?.count || 0,
        fieldKeys: collectionsMap[c.id] || []
      })),
      pageInfo
    };
  } catch (error) {
    console.error('Error listing collections:', error);
    throw new Error(`Failed to list collections: ${error.message}`);
  }
}

/**
 * Get shop info via GraphQL.
 */
export async function getShopInfo(shopify) {
  try {
    const query = `query { shop { id name email primaryDomain { url } } }`;
    const result = await shopify.graphql(query);
    return result.shop;
  } catch (error) {
    const statusCode = error.response?.statusCode || error.statusCode;
    const body = error.response?.body;
    const detail = statusCode
      ? `HTTP ${statusCode}${body ? ` — ${typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200)}` : ''}`
      : error.message || error.code || 'Unknown error';
    console.error('Error getting shop info:', detail, error);
    throw new Error(`Failed to get shop info: ${detail}`);
  }
}

/**
 * Verify shop credentials — throws on failure.
 */
export async function verifyCredentials(shopify) {
  await getShopInfo(shopify);
  return true;
}

/**
 * List all themes for the store (REST — Theme API has no GraphQL equivalent).
 */
export async function getThemes(shopify) {
  try {
    return await shopify.theme.list();
  } catch (error) {
    console.error('Error listing themes:', error);
    throw new Error(`Failed to list themes: ${error.message}`);
  }
}

/**
 * Create a theme from a ZIP URL.
 */
export async function createTheme(shopify, name, src, role = 'unpublished') {
  try {
    return await shopify.theme.create({name, src, role});
  } catch (error) {
    console.error('Error creating theme:', error);
    throw new Error(`Failed to create theme: ${error.message}`);
  }
}

/**
 * Delete a theme by ID.
 */
export async function deleteTheme(shopify, themeId) {
  try {
    await shopify.theme.delete(themeId);
    return true;
  } catch (error) {
    console.error('Error deleting theme:', error);
    throw new Error(`Failed to delete theme: ${error.message}`);
  }
}

/**
 * Publish a theme (set role to main).
 */
export async function publishTheme(shopify, themeId) {
  try {
    return await shopify.theme.update(themeId, {role: 'main'});
  } catch (error) {
    console.error('Error publishing theme:', error);
    throw new Error(`Failed to publish theme: ${error.message}`);
  }
}

/**
 * Ensure a metafield definition exists with storefront access.
 */
export async function ensureMetafieldDefinition(shopify, {name, key, type, ownerType, description}) {
  const existing = await getMetafieldDefinitions(shopify, ownerType);
  const found = existing.find(d => d.namespace === CF_NAMESPACE && d.key === key);

  if (!found) {
    await createMetafieldDefinition(shopify, {
      name, namespace: CF_NAMESPACE, key, type, ownerType, description,
      access: {storefront: 'PUBLIC_READ'}
    });
  }
}

/**
 * Delete a metafield definition by ID via GraphQL.
 */
export async function deleteMetafieldDefinition(shopify, id, deleteAllAssociatedMetafields = false) {
  try {
    const mutation = `mutation MetafieldDefinitionDelete($id: ID!, $deleteAllAssociatedMetafields: Boolean!) {
      metafieldDefinitionDelete(id: $id, deleteAllAssociatedMetafields: $deleteAllAssociatedMetafields) {
        deletedDefinitionId
        userErrors { field message }
      }
    }`;
    const result = await shopify.graphql(mutation, {id, deleteAllAssociatedMetafields});
    const {userErrors} = result.metafieldDefinitionDelete;
    if (userErrors?.length > 0) {
      throw new Error(userErrors.map(e => e.message).join(', '));
    }
    return true;
  } catch (error) {
    console.error('Error deleting metafield definition:', error);
    throw new Error(`Failed to delete metafield definition: ${error.message}`);
  }
}

/**
 * Get metafield definitions for a given owner type via GraphQL.
 */
export async function getMetafieldDefinitions(shopify, ownerType = 'PRODUCT') {
  try {
    const query = `query MetafieldDefinitions($ownerType: MetafieldOwnerType!) {
      metafieldDefinitions(ownerType: $ownerType, first: 100) {
        nodes {
          id namespace key name
          type { name }
          description ownerType pinnedPosition
        }
      }
    }`;
    const result = await shopify.graphql(query, {ownerType});
    return result.metafieldDefinitions.nodes;
  } catch (error) {
    console.error('Error getting metafield definitions:', error);
    throw new Error(`Failed to get metafield definitions: ${error.message}`);
  }
}

/**
 * Create a metafield definition via GraphQL.
 */
export async function createMetafieldDefinition(shopify, definition) {
  try {
    const mutation = `mutation MetafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition {
          id name namespace key type { name }
        }
        userErrors { field message }
      }
    }`;
    const result = await shopify.graphql(mutation, {definition});
    const {createdDefinition, userErrors} = result.metafieldDefinitionCreate;
    if (userErrors?.length > 0) {
      throw new Error(userErrors.map(e => e.message).join(', '));
    }
    return createdDefinition;
  } catch (error) {
    console.error('Error creating metafield definition:', error);
    throw new Error(`Failed to create metafield definition: ${error.message}`);
  }
}

/**
 * Get privacy settings (autoManaged status) via GraphQL privacySettings query.
 * Returns { privacyPolicy, cookieBanner, dataSaleOptOutPage } with autoManaged boolean.
 */
export async function getPrivacySettings(shopify) {
  try {
    const query = `query {
      privacySettings {
        privacyPolicy { autoManaged }
      }
    }`;
    const result = await shopify.graphql(query);
    const settings = result.privacySettings || {};
    console.log('[getPrivacySettings] result:', JSON.stringify(settings));
    return settings;
  } catch (error) {
    console.warn('[getPrivacySettings] Failed:', error.message);
    return {};
  }
}

/**
 * Get all shop policies via GraphQL (returns all types including CONTACT_INFORMATION).
 * Also fetches autoManaged status from privacySettings for PRIVACY_POLICY.
 * Falls back to REST if GraphQL fails (REST may not include all types).
 */
export async function getShopPolicies(shopify) {
  try {
    // Fetch policies and privacy settings in parallel
    const [policiesResult, privacySettings] = await Promise.all([
      shopify.graphql(`query { shop { shopPolicies { id type title body url } } }`),
      getPrivacySettings(shopify)
    ]);

    const autoManagedPrivacy = privacySettings.privacyPolicy?.autoManaged || false;
    console.log('[getShopPolicies] privacySettings:', JSON.stringify(privacySettings), '| autoManagedPrivacy:', autoManagedPrivacy);

    const policies = (policiesResult.shop.shopPolicies || []).map(p => ({
      id: p.id,
      type: p.type,
      title: p.title,
      body: p.body || '',
      url: p.url,
      autoManaged: p.type === 'PRIVACY_POLICY' ? autoManagedPrivacy : false
    }));

    return policies;
  } catch (gqlError) {
    console.warn('GraphQL shopPolicies failed, falling back to REST:', gqlError.message);
    try {
      const HANDLE_TO_TYPE = {
        'refund-policy': 'REFUND_POLICY',
        'privacy-policy': 'PRIVACY_POLICY',
        'terms-of-service': 'TERMS_OF_SERVICE',
        'shipping-policy': 'SHIPPING_POLICY',
        'subscription-policy': 'SUBSCRIPTION_POLICY',
        'contact-information': 'CONTACT_INFORMATION'
      };
      const policies = await shopify.policy.list();
      return policies.map(p => ({
        id: p.id,
        type: HANDLE_TO_TYPE[p.handle] || p.handle.toUpperCase().replace(/-/g, '_'),
        title: p.title,
        body: p.body || '',
        url: p.url,
        autoManaged: false
      }));
    } catch (restError) {
      console.error('Error getting shop policies:', restError);
      throw new Error(`Failed to get shop policies: ${restError.message}`);
    }
  }
}

/**
 * Disable Shopify-managed Privacy Policy (autoManaged ON → OFF).
 * Requires write_privacy_settings scope.
 * Note: There is NO enable mutation — turning autoManaged back ON must be done in Shopify Admin UI.
 */
export async function disablePrivacyAutoManaged(shopify) {
  const mutation = `mutation { privacyFeaturesDisable(featuresToDisable: [PRIVACY_POLICY]) { featuresDisabled userErrors { code field message } } }`;
  const result = await shopify.graphql(mutation);
  const {featuresDisabled, userErrors} = result.privacyFeaturesDisable;
  if (userErrors?.length > 0) {
    throw new Error(userErrors.map(e => e.message).join(', '));
  }
  return featuresDisabled || [];
}

/**
 * Update a single shop policy via GraphQL shopPolicyUpdate mutation.
 * Note: shopPolicyUpdate does NOT toggle autoManaged. To turn it OFF, use disablePrivacyAutoManaged.
 * @param {string} type - REFUND_POLICY | PRIVACY_POLICY | TERMS_OF_SERVICE | SHIPPING_POLICY | SUBSCRIPTION_POLICY | CONTACT_INFORMATION
 * @param {string} body - HTML content
 */
export async function updateShopPolicy(shopify, type, body) {
  try {
    const mutation = `mutation shopPolicyUpdate($shopPolicy: ShopPolicyInput!) {
      shopPolicyUpdate(shopPolicy: $shopPolicy) {
        shopPolicy { id type title }
        userErrors { field message }
      }
    }`;
    const result = await shopify.graphql(mutation, {shopPolicy: {type, body}});
    const {shopPolicy, userErrors} = result.shopPolicyUpdate;
    if (userErrors?.length > 0) {
      throw new Error(userErrors.map(e => e.message).join(', '));
    }
    return shopPolicy;
  } catch (error) {
    console.error(`Error updating shop policy ${type}:`, error);
    throw new Error(`Failed to update ${type}: ${error.message}`);
  }
}
