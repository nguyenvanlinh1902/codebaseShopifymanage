/**
 * Shopify Shop Service — shop info, themes, metafields, policies.
 */

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
 * Update a single shop policy via GraphQL shopPolicyUpdate mutation.
 * Note: Shopify API does not support toggling autoGenerated — that's a UI-only setting.
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
