import {pickTriggerData} from '../helpers/utils/pick.js';
import {generateDefaultRow} from '../helpers/utils/trigger.js';
import {insertBigQueryTable} from '../services/bigQueryService.js';

const STORE_COLLECTION = 'shopify_stores';
const GOOGLE_AUTH_COLLECTION = 'google_auth';
const GOOGLE_SHEETS_COLLECTION = 'google_sheets';

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
