import {PubSub} from '@google-cloud/pubsub';
import {ImportHistoryRepository} from '../repositories/importHistoryRepository.js';
import {StoreRepository} from '../repositories/storeRepository.js';
import {ShopifyService} from '../services/shopifyService.js';
import {
  parseCsv,
  validateProductData,
  mapToShopifyProduct,
  generateCsvTemplate
} from '../helpers/csvParser.js';

const pubsub = new PubSub();
const importHistoryRepo = new ImportHistoryRepository();
const storeRepo = new StoreRepository();

const PRODUCT_IMPORT_TOPIC = 'product-import';

/**
 * Upload CSV and initiate product import
 */
export async function uploadAndImport(req, res) {
  try {
    const {userId, storeId, csvData, fileName} = req.body;

    // Task 1: Validate input
    if (!userId || !storeId || !csvData) {
      return res.status(400).json({
        success: false,
        error: 'userId, storeId, and csvData are required'
      });
    }

    // Task 2: Get store information
    const store = await storeRepo.getById(storeId);
    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    // Task 3: Parse CSV
    let products;
    try {
      products = parseCsv(csvData);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: `Failed to parse CSV: ${error.message}`
      });
    }

    if (products.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No products found in CSV file'
      });
    }

    // Task 4: Validate products
    const validProducts = [];
    const invalidProducts = [];

    products.forEach((product, index) => {
      const errors = validateProductData(product);
      if (errors.length > 0) {
        invalidProducts.push({
          row: index + 2, // +2 because index starts at 0 and there's a header
          product,
          errors
        });
      } else {
        validProducts.push(mapToShopifyProduct(product));
      }
    });

    if (validProducts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid products found in CSV',
        invalidProducts
      });
    }

    // Task 5: Create import job record
    const importJob = await importHistoryRepo.create({
      userId,
      storeId,
      storeName: store.name,
      shopDomain: store.shopDomain,
      fileName: fileName || 'upload.csv',
      totalProducts: validProducts.length,
      processedProducts: 0,
      successCount: 0,
      failedCount: 0,
      status: 'pending',
      invalidProducts: invalidProducts.length > 0 ? invalidProducts : undefined
    });

    // Task 6: Publish products to PubSub queue for background processing
    const topic = pubsub.topic(PRODUCT_IMPORT_TOPIC);

    // Publish each product as a separate message for parallel processing
    const publishPromises = validProducts.map((product, index) => {
      const message = {
        importId: importJob.id,
        storeId,
        shopDomain: store.shopDomain,
        accessToken: store.accessToken,
        product,
        productIndex: index,
        totalProducts: validProducts.length
      };

      return topic.publishMessage({
        json: message
      });
    });

    await Promise.all(publishPromises);

    // Task 7: Update import status to processing
    await importHistoryRepo.updateProgress(importJob.id, {
      status: 'processing'
    });

    return res.json({
      success: true,
      message: `Import job created. Processing ${validProducts.length} products in background.`,
      data: {
        importId: importJob.id,
        totalProducts: validProducts.length,
        invalidProducts: invalidProducts.length
      }
    });
  } catch (error) {
    console.error('Upload and import error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get import history for a user
 */
export async function getImportHistory(req, res) {
  try {
    const {userId, storeId} = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    let imports;
    if (storeId) {
      imports = await importHistoryRepo.getByStore(storeId);
    } else {
      imports = await importHistoryRepo.getByUser(userId);
    }

    return res.json({
      success: true,
      data: imports
    });
  } catch (error) {
    console.error('Get import history error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get import job details
 */
export async function getImportDetails(req, res) {
  try {
    const {importId} = req.params;

    const importJob = await importHistoryRepo.getById(importId);

    if (!importJob) {
      return res.status(404).json({
        success: false,
        error: 'Import job not found'
      });
    }

    return res.json({
      success: true,
      data: importJob
    });
  } catch (error) {
    console.error('Get import details error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get successful imports (stores that have been imported to)
 */
export async function getSuccessfulImports(req, res) {
  try {
    const {userId} = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const successfulImports = await importHistoryRepo.getRecentSuccessful(userId, 20);

    // Group by store
    const storeImports = {};
    successfulImports.forEach(imp => {
      if (!storeImports[imp.storeId]) {
        storeImports[imp.storeId] = {
          storeId: imp.storeId,
          storeName: imp.storeName,
          shopDomain: imp.shopDomain,
          imports: []
        };
      }
      storeImports[imp.storeId].imports.push({
        importId: imp.id,
        fileName: imp.fileName,
        totalProducts: imp.totalProducts,
        successCount: imp.results?.successCount || imp.successCount,
        completedAt: imp.completedAt
      });
    });

    return res.json({
      success: true,
      data: Object.values(storeImports)
    });
  } catch (error) {
    console.error('Get successful imports error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Download CSV template
 */
export async function downloadTemplate(req, res) {
  try {
    const template = generateCsvTemplate();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="product-import-template.csv"');
    return res.send(template);
  } catch (error) {
    console.error('Download template error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Background handler: Process product import from PubSub
 * This runs in a separate Cloud Function triggered by PubSub
 */
export async function processProductImport(message) {
  try {
    const data = message.json;
    const {importId, shopDomain, accessToken, product, totalProducts} = data;

    // Create Shopify service
    const shopifyService = new ShopifyService({
      shopDomain,
      accessToken
    });

    // Import product to Shopify
    let result;
    try {
      // Check if product with SKU already exists
      if (product.sku) {
        const existing = await shopifyService.getProductBySku(product.sku);
        if (existing) {
          // Update existing product
          result = await shopifyService.updateProduct(existing.product.id, product);
          result.action = 'updated';
        } else {
          // Create new product
          result = await shopifyService.createProduct(product);
          result.action = 'created';
        }
      } else {
        // Create new product (no SKU to check)
        result = await shopifyService.createProduct(product);
        result.action = 'created';
      }

      // Update import progress (success)
      const importJob = await importHistoryRepo.getById(importId);
      await importHistoryRepo.updateProgress(importId, {
        processedProducts: (importJob.processedProducts || 0) + 1,
        successCount: (importJob.successCount || 0) + 1
      });

      // Check if this is the last product
      if ((importJob.processedProducts || 0) + 1 >= totalProducts) {
        await importHistoryRepo.markCompleted(importId, {
          successCount: (importJob.successCount || 0) + 1,
          failedCount: importJob.failedCount || 0
        });
      }

      message.ack();
    } catch (error) {
      console.error(`Failed to import product ${product.title}:`, error);

      // Update import progress (failure)
      const importJob = await importHistoryRepo.getById(importId);
      await importHistoryRepo.updateProgress(importId, {
        processedProducts: (importJob.processedProducts || 0) + 1,
        failedCount: (importJob.failedCount || 0) + 1
      });

      // Check if this is the last product
      if ((importJob.processedProducts || 0) + 1 >= totalProducts) {
        if ((importJob.failedCount || 0) + 1 >= totalProducts) {
          // All products failed
          await importHistoryRepo.markFailed(importId, 'All products failed to import');
        } else {
          // Some products succeeded
          await importHistoryRepo.markCompleted(importId, {
            successCount: importJob.successCount || 0,
            failedCount: (importJob.failedCount || 0) + 1
          });
        }
      }

      // Ack the message even on failure (don't retry indefinitely)
      message.ack();
    }
  } catch (error) {
    console.error('Process product import error:', error);
    // Nack the message to retry later
    message.nack();
  }
}
