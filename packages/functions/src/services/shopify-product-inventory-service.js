/**
 * Shopify Product Inventory Service — set on-hand quantities at locations.
 */
import {toGid} from './shopify-helpers.js';

/** Set on-hand inventory quantity for an item at a location. */
export async function setInventoryQuantity(shopify, inventoryItemId, locationId, quantity) {
  const itemGid = toGid('InventoryItem', inventoryItemId);
  const locationGid = toGid('Location', locationId);

  const result = await shopify.graphql(
    `mutation inventorySetOnHandQuantities($input: InventorySetOnHandQuantitiesInput!) {
      inventorySetOnHandQuantities(input: $input) {
        inventoryAdjustmentGroup {
          reason
          changes { name delta }
        }
        userErrors { field message }
      }
    }`,
    {
      input: {
        reason: 'correction',
        setQuantities: [{
          inventoryItemId: itemGid,
          locationId: locationGid,
          quantity: parseInt(quantity)
        }]
      }
    }
  );

  const payload = result?.inventorySetOnHandQuantities;
  if (payload?.userErrors?.length > 0) {
    throw new Error(payload.userErrors.map(e => e.message).join('; '));
  }
  return {success: true};
}
