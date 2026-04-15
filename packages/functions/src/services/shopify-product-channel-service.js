/**
 * Shopify Product Channel Service — publications, locations, staged uploads, duplicate.
 */
import {toGid, fromGid} from './shopify-helpers.js';

/** Create a staged upload URL for a product image. */
export async function createStagedUpload(shopify, {filename, mimeType, fileSize}) {
  const result = await shopify.graphql(
    `mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          parameters { name value }
        }
        userErrors { field message }
      }
    }`,
    {
      input: [{
        filename, mimeType,
        fileSize: String(fileSize),
        resource: 'PRODUCT_IMAGE',
        httpMethod: 'POST'
      }]
    }
  );
  const payload = result?.stagedUploadsCreate;
  if (payload?.userErrors?.length > 0) {
    throw new Error(payload.userErrors.map(e => e.message).join('; '));
  }
  const target = payload?.stagedTargets?.[0];
  return {url: target?.url, parameters: target?.parameters || []};
}

/** Get all store publications (sales channels). */
export async function getStorePublications(shopify) {
  const result = await shopify.graphql(
    `query { publications(first: 20) { nodes { id name } } }`
  );
  return result?.publications?.nodes || [];
}

/** Publish or unpublish a product on given channels. */
export async function publishProduct(shopify, productId, publishIds = [], unpublishIds = []) {
  const gid = toGid('Product', productId);
  const results = {};

  if (publishIds.length > 0) {
    const r = await shopify.graphql(
      `mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
        publishablePublish(id: $id, input: $input) {
          userErrors { field message }
        }
      }`,
      {id: gid, input: publishIds.map(pubId => ({publicationId: pubId}))}
    );
    results.published = r?.publishablePublish?.userErrors || [];
  }

  if (unpublishIds.length > 0) {
    const r = await shopify.graphql(
      `mutation publishableUnpublish($id: ID!, $input: [PublicationInput!]!) {
        publishableUnpublish(id: $id, input: $input) {
          userErrors { field message }
        }
      }`,
      {id: gid, input: unpublishIds.map(pubId => ({publicationId: pubId}))}
    );
    results.unpublished = r?.publishableUnpublish?.userErrors || [];
  }

  return results;
}

/** Get store locations. */
export async function getLocations(shopify) {
  const result = await shopify.graphql(
    `query {
      locations(first: 50) {
        nodes {
          id name
          address { address1 city country }
        }
      }
    }`
  );
  return result?.locations?.nodes || [];
}

/** Duplicate a product. */
export async function duplicateProduct(shopify, productId, newTitle) {
  const gid = toGid('Product', productId);
  const result = await shopify.graphql(
    `mutation productDuplicate($productId: ID!, $newTitle: String!) {
      productDuplicate(productId: $productId, newTitle: $newTitle) {
        newProduct { id }
        userErrors { field message }
      }
    }`,
    {productId: gid, newTitle}
  );
  const payload = result?.productDuplicate;
  if (payload?.userErrors?.length > 0) {
    throw new Error(payload.userErrors.map(e => e.message).join('; '));
  }
  return {newProductId: fromGid(payload.newProduct.id)};
}
