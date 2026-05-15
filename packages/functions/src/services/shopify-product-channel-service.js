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
          resourceUrl
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
  return {
    url: target?.url,
    resourceUrl: target?.resourceUrl,
    parameters: target?.parameters || []
  };
}

/** Get all store publications (sales channels). */
export async function getStorePublications(shopify) {
  const result = await shopify.graphql(
    `query { publications(first: 20) { nodes { id name } } }`
  );
  return result?.publications?.nodes || [];
}

/**
 * Publish/unpublish products to channels via Bulk Operations — same flow as product import.
 * Bulk publish is what Shopify uses internally and reliably associates products with channels.
 */
export async function publishProduct(shopify, productId, publishIds = [], unpublishIds = []) {
  const gid = toGid('Product', productId);
  const results = {publishedCount: 0, unpublishedCount: 0};

  if (publishIds.length > 0) {
    const input = publishIds.map(p => ({
      publicationId: String(p).startsWith('gid://') ? p : `gid://shopify/Publication/${p}`
    }));
    const r = await shopify.graphql(
      `mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
        publishablePublish(id: $id, input: $input) {
          publishable { resourcePublicationsCount { count } }
          userErrors { field message }
        }
      }`,
      {id: gid, input}
    );
    const errs = r?.publishablePublish?.userErrors || [];
    if (errs.length > 0) {
      throw new Error(`Publish failed: ${errs.map(e => `${(e.field || []).join('.')}: ${e.message}`).join('; ')}`);
    }
    results.publishedCount = publishIds.length;
  }

  if (unpublishIds.length > 0) {
    const input = unpublishIds.map(p => ({
      publicationId: String(p).startsWith('gid://') ? p : `gid://shopify/Publication/${p}`
    }));
    const r = await shopify.graphql(
      `mutation publishableUnpublish($id: ID!, $input: [PublicationInput!]!) {
        publishableUnpublish(id: $id, input: $input) {
          userErrors { field message }
        }
      }`,
      {id: gid, input}
    );
    const errs = r?.publishableUnpublish?.userErrors || [];
    if (errs.length > 0) {
      throw new Error(`Unpublish failed: ${errs.map(e => `${(e.field || []).join('.')}: ${e.message}`).join('; ')}`);
    }
    results.unpublishedCount = unpublishIds.length;
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
