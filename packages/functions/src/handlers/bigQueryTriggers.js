import {pickTriggerData} from '../helpers/utils/pick.js';
import {generateDefaultRow} from '../helpers/utils/trigger.js';
import {insertBigQueryTable} from '../services/bigQueryService.js';

const STORE_COLLECTION = 'shopify_stores';
const GOOGLE_AUTH_COLLECTION = 'google_auth';
const GOOGLE_SHEETS_COLLECTION = 'google_sheets';
const PRODUCTS_COLLECTION = 'products';

function toISODate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  return new Date(value);
}

export const onTriggerStores = async event => {
  try {
    const defaultRow = generateDefaultRow({event, collectionId: STORE_COLLECTION});
    console.log(`[BQ:Store] ${defaultRow.operation} doc=${defaultRow.document_id}`);

    const pickedData = pickTriggerData({
      change: event.data,
      keys: [
        'userId',
        'shopDomain',
        'name',
        'niche',
        'email',
        'currency',
        'timezone',
        'status',
        'createdAt',
        'updatedAt'
      ]
    });

    const row = {
      ...defaultRow,
      ...pickedData,
      createdAt: toISODate(pickedData.createdAt),
      updatedAt: toISODate(pickedData.updatedAt)
    };

    await insertBigQueryTable(row, `${STORE_COLLECTION}_changelogs`);
    console.log(`[BQ:Store] Synced successfully`);
  } catch (error) {
    console.error(`[BQ:Store] Error:`, error.message || error);
  }
};

export const onTriggerGoogleAuth = async event => {
  try {
    const defaultRow = generateDefaultRow({event, collectionId: GOOGLE_AUTH_COLLECTION});
    console.log(`[BQ:GoogleAuth] ${defaultRow.operation} doc=${defaultRow.document_id}`);

    const pickedData = pickTriggerData({
      change: event.data,
      keys: ['userId', 'googleEmail', 'scopes', 'createdAt', 'updatedAt']
    });

    const row = {
      ...defaultRow,
      ...pickedData,
      scopes: pickedData.scopes ? JSON.stringify(pickedData.scopes) : null,
      createdAt: toISODate(pickedData.createdAt),
      updatedAt: toISODate(pickedData.updatedAt)
    };

    await insertBigQueryTable(row, `${GOOGLE_AUTH_COLLECTION}_changelogs`);
    console.log(`[BQ:GoogleAuth] Synced successfully`);
  } catch (error) {
    console.error(`[BQ:GoogleAuth] Error:`, error.message || error);
  }
};

export const onTriggerGoogleSheets = async event => {
  try {
    const defaultRow = generateDefaultRow({event, collectionId: GOOGLE_SHEETS_COLLECTION});
    console.log(`[BQ:GoogleSheets] ${defaultRow.operation} doc=${defaultRow.document_id}`);

    const pickedData = pickTriggerData({
      change: event.data,
      keys: [
        'userId',
        'spreadsheetId',
        'name',
        'title',
        'status',
        'googleEmail',
        'createdAt',
        'updatedAt'
      ]
    });

    const row = {
      ...defaultRow,
      ...pickedData,
      createdAt: toISODate(pickedData.createdAt),
      updatedAt: toISODate(pickedData.updatedAt)
    };

    await insertBigQueryTable(row, `${GOOGLE_SHEETS_COLLECTION}_changelogs`);
    console.log(`[BQ:GoogleSheets] Synced successfully`);
  } catch (error) {
    console.error(`[BQ:GoogleSheets] Error:`, error.message || error);
  }
};

export const onTriggerProducts = async event => {
  try {
    const defaultRow = generateDefaultRow({event, collectionId: PRODUCTS_COLLECTION});
    console.log(`[BQ:Products] ${defaultRow.operation} doc=${defaultRow.document_id}`);

    const pickedData = pickTriggerData({
      change: event.data,
      keys: [
        // Tracking
        'userId',
        'storeId',
        'storeName',
        'shopDomain',
        'shopifyProductId',
        'importId',
        'action',
        'importedAt',

        // Core
        'handle',
        'title',
        'description',
        'vendor',
        'productType',
        'tags',
        'status',
        'giftCard',

        // Options
        'option1Name',
        'option1Value',
        'option2Name',
        'option2Value',
        'option3Name',
        'option3Value',

        // Pricing
        'sku',
        'price',
        'compareAtPrice',
        'cost',

        // Inventory
        'inventoryQuantity',
        'inventoryTracker',
        'inventoryPolicy',
        'fulfillmentService',
        'barcode',

        // Shipping
        'weight',
        'weightUnit',
        'requiresShipping',

        // Tax
        'taxable',
        'taxCode',

        // Images
        'imageUrl',
        'imagePosition',
        'imageAlt',
        'variantImage',

        // Google Shopping
        'googleShoppingMPN',
        'googleShoppingAgeGroup',
        'googleShoppingGender',
        'googleShoppingProductCategory',
        'googleShoppingAdWordsGrouping',
        'googleShoppingAdWordsLabels',
        'googleShoppingCondition',
        'googleShoppingCustomProduct',
        'googleShoppingCustomLabel0',
        'googleShoppingCustomLabel1',
        'googleShoppingCustomLabel2',
        'googleShoppingCustomLabel3',
        'googleShoppingCustomLabel4',

        // SEO
        'seoTitle',
        'seoDescription',
        'seoHidden',

        // Timestamps
        'createdAt',
        'updatedAt'
      ]
    });

    const row = {
      ...defaultRow,
      ...pickedData,
      importedAt: toISODate(pickedData.importedAt),
      createdAt: toISODate(pickedData.createdAt),
      updatedAt: toISODate(pickedData.updatedAt)
    };

    await insertBigQueryTable(row, `${PRODUCTS_COLLECTION}_changelogs`);
    console.log(`[BQ:Products] Synced successfully`);
  } catch (error) {
    console.error(`[BQ:Products] Error:`, error.message || error);
  }
};
