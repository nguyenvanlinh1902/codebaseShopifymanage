/**
 * Shopify Product Metafield Service — metafield definitions CRUD.
 */
import {toGid} from './shopify-helpers.js';

/** List metafield definitions for a given owner type. */
export async function listMetafieldDefinitions(shopify, ownerType = 'PRODUCT') {
  const result = await shopify.graphql(
    `query metafieldDefinitions($ownerType: MetafieldOwnerType!, $first: Int!) {
      metafieldDefinitions(ownerType: $ownerType, first: $first) {
        nodes {
          id name namespace key type { name } description
        }
      }
    }`,
    {ownerType, first: 100}
  );
  return result?.metafieldDefinitions?.nodes || [];
}

/** Create a metafield definition. */
export async function createMetafieldDefinition(shopify, input) {
  const result = await shopify.graphql(
    `mutation metafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition { id name namespace key }
        userErrors { field message code }
      }
    }`,
    {definition: input}
  );
  const payload = result?.metafieldDefinitionCreate;
  if (payload?.userErrors?.length > 0) {
    throw new Error(payload.userErrors.map(e => e.message).join('; '));
  }
  return payload?.createdDefinition;
}

/** Delete a metafield by GID or numeric ID. */
export async function deleteMetafield(shopify, metafieldId) {
  const gid = toGid('Metafield', metafieldId);
  const result = await shopify.graphql(
    `mutation metafieldDelete($input: MetafieldDeleteInput!) {
      metafieldDelete(input: $input) {
        deletedId
        userErrors { field message }
      }
    }`,
    {input: {id: gid}}
  );
  const payload = result?.metafieldDelete;
  if (payload?.userErrors?.length > 0) {
    throw new Error(payload.userErrors.map(e => e.message).join('; '));
  }
  return {deletedId: payload?.deletedId || metafieldId};
}
