/**
 * CSV upload and validation logic
 */

import {
  parseCsv,
  validateProductData,
  mapToShopifyProduct,
  generateCsvTemplate
} from '../../helpers/csvParser.js';
import {StoreRepository} from '../../repositories/storeRepository.js';

const storeRepo = new StoreRepository();

/**
 * Parse and validate multiple CSV files
 * Returns: { parsedFiles, fileErrors }
 */
export async function parseAndValidateCsvFiles(filesToProcess) {
  const parsedFiles = [];
  const fileErrors = [];

  for (const file of filesToProcess) {
    let products;
    try {
      products = parseCsv(file.csvData);
    } catch (error) {
      fileErrors.push({fileName: file.fileName, error: `Parse error: ${error.message}`});
      continue;
    }

    if (products.length === 0) {
      fileErrors.push({fileName: file.fileName, error: 'No products found in file'});
      continue;
    }

    const validProducts = [];
    const invalidProducts = [];

    products.forEach((product, index) => {
      const errors = validateProductData(product);
      if (errors.length > 0) {
        invalidProducts.push({
          row: index + 2,
          title: product['Title'] || product['title'] || `Row ${index + 2}`,
          errors
        });
      } else {
        validProducts.push(mapToShopifyProduct(product));
      }
    });

    if (validProducts.length === 0) {
      fileErrors.push({
        fileName: file.fileName,
        error: 'No valid products found',
        invalidProducts: invalidProducts.slice(0, 20)
      });
      continue;
    }

    parsedFiles.push({
      fileName: file.fileName,
      validProducts,
      invalidProducts,
      totalRows: products.length
    });
  }

  return {parsedFiles, fileErrors};
}

/**
 * Validate input parameters for upload
 * Returns error message if invalid, null if valid
 */
export function validateUploadInput(userId, targetStoreIds, filesToProcess) {
  if (!userId) {
    return 'userId is required';
  }

  if (targetStoreIds.length === 0) {
    return 'At least one store must be selected';
  }

  if (filesToProcess.length === 0) {
    return 'No CSV data provided';
  }

  return null;
}

/**
 * Build files list from request body
 * Supports both single file and multi-file uploads
 */
export function buildFilesToProcess(csvData, fileName, csvFiles) {
  const filesToProcess = [];

  if (csvFiles && csvFiles.length > 0) {
    filesToProcess.push(...csvFiles);
  } else if (csvData) {
    filesToProcess.push({csvData, fileName: fileName || 'upload.csv'});
  }

  return filesToProcess;
}

/**
 * Validate and fetch all stores
 * Checks: exists, active status, valid accessToken
 * Returns: { stores, error }
 */
export async function validateAndFetchStores(targetStoreIds) {
  const stores = await Promise.all(targetStoreIds.map(id => storeRepo.getById(id)));
  const missingStores = targetStoreIds.filter((id, i) => !stores[i]);

  if (missingStores.length > 0) {
    return {stores: null, error: `Store(s) not found: ${missingStores.join(', ')}`};
  }

  // Check for inactive/uninstalled stores
  const inactiveStores = stores.filter(s => s.status !== 'active');
  if (inactiveStores.length > 0) {
    const names = inactiveStores.map(s => `${s.name || s.shopDomain} (${s.status})`).join(', ');
    return {stores: null, error: `Store(s) not active: ${names}. Please reinstall the app.`};
  }

  // Check for missing or invalid accessToken
  const noTokenStores = stores.filter(s => !s.accessToken || !s.accessToken.startsWith('shpat_'));
  if (noTokenStores.length > 0) {
    const names = noTokenStores.map(s => s.name || s.shopDomain).join(', ');
    return {stores: null, error: `Store(s) missing valid access token: ${names}. Please reinstall the app.`};
  }

  return {stores, error: null};
}

/**
 * Generate CSV template for download
 */
export function getCsvTemplate() {
  return generateCsvTemplate();
}
