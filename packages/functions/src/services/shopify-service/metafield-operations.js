/**
 * Metafield Operations Module
 * Handles all metafield-related Shopify API operations
 */

/**
 * Get metafield definitions for a given owner type using GraphQL
 */
export async function getMetafieldDefinitions(ownerType = 'PRODUCT') {
  try {
    const query = `
      query MetafieldDefinitions($ownerType: MetafieldOwnerType!) {
        metafieldDefinitions(ownerType: $ownerType, first: 100) {
          nodes {
            id
            namespace
            key
            name
            type { name }
            description
            ownerType
            pinnedPosition
          }
        }
      }
    `;
    const result = await this.shopify.graphql(query, {ownerType});
    return result.metafieldDefinitions.nodes;
  } catch (error) {
    console.error('Error getting metafield definitions:', error);
    throw new Error(`Failed to get metafield definitions: ${error.message}`);
  }
}

/**
 * Create a metafield definition using GraphQL
 */
export async function createMetafieldDefinition(definition) {
  try {
    const mutation = `
      mutation MetafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
        metafieldDefinitionCreate(definition: $definition) {
          createdDefinition {
            id
            name
            namespace
            key
            type { name }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    const result = await this.shopify.graphql(mutation, {definition});
    const {createdDefinition, userErrors} = result.metafieldDefinitionCreate;
    if (userErrors && userErrors.length > 0) {
      throw new Error(userErrors.map(e => e.message).join(', '));
    }
    return createdDefinition;
  } catch (error) {
    console.error('Error creating metafield definition:', error);
    throw new Error(`Failed to create metafield definition: ${error.message}`);
  }
}
