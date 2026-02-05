import {ImportHistoryRepository} from '../repositories/importHistoryRepository.js';
import {ProductRepository} from '../repositories/productRepository.js';
import {ProductQueueRepository} from '../repositories/productQueueRepository.js';
import {StoreRepository} from '../repositories/storeRepository.js';
import {ShopifyService} from '../services/shopifyService.js';
import {parseCsv, validateProductData, mapToShopifyProduct, generateCsvTemplate} from '../helpers/csvParser.js';

const importHistoryRepo = new ImportHistoryRepository();
const productRepo = new ProductRepository();
const productQueueRepo = new ProductQueueRepository();
const storeRepo = new StoreRepository();

/**
 * Upload CSV and initiate product import
 * Supports importing to multiple stores at once
 */
export async function uploadAndImport(req, res) {
  try {
    const {userId, storeId, storeIds, csvData, fileName} = req.body;

    // Support both single store (storeId) and multiple stores (storeIds)
    const targetStoreIds = storeIds || (storeId ? [storeId] : []);

    // Task 1: Validate input
    if (!userId || !csvData) {
      return res.status(400).json({
        success: false,
        error: 'userId and csvData are required'
      });
    }

    if (targetStoreIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one store must be selected'
      });
    }

    // Task 2: Get all store information
    const stores = await Promise.all(targetStoreIds.map(id => storeRepo.getById(id)));
    const missingStores = stores.filter(s => !s);
    if (missingStores.length > 0) {
      return res.status(404).json({
        success: false,
        error: 'One or more stores not found'
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

    // Task 5: Create import job record for each store
    const importJobs = [];
    const allEnqueuePromises = [];

    for (const store of stores) {
      const importJobData = {
        userId,
        storeId: store.id,
        storeName: store.name,
        shopDomain: store.shopDomain,
        fileName: fileName || 'upload.csv',
        totalProducts: validProducts.length,
        processedProducts: 0,
        successCount: 0,
        failedCount: 0,
        status: 'pending'
      };

      // Only add invalidProducts field if there are invalid products
      if (invalidProducts.length > 0) {
        importJobData.invalidProducts = invalidProducts;
      }

      const importJob = await importHistoryRepo.create(importJobData);
      importJobs.push(importJob);

      // Task 6: Enqueue products to queue for CronJob processing
      const enqueuePromises = validProducts.map((product, index) => {
        const queueData = {
          importId: importJob.id,
          storeId: store.id,
          userId,
          storeName: store.name,
          shopDomain: store.shopDomain,
          accessToken: store.accessToken,
          product,
          productIndex: index,
          totalProducts: validProducts.length
        };

        return productQueueRepo.enqueue(queueData);
      });

      allEnqueuePromises.push(...enqueuePromises);
    }

    await Promise.all(allEnqueuePromises);

    return res.json({
      success: true,
      message: `Import jobs created for ${stores.length} store(s). ${validProducts.length} products per store queued for processing.`,
      data: {
        importJobs: importJobs.map(job => ({
          importId: job.id,
          storeId: job.storeId,
          storeName: job.storeName
        })),
        storesCount: stores.length,
        totalProducts: validProducts.length,
        invalidProducts: invalidProducts.length,
        queuedProductsTotal: validProducts.length * stores.length
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
 * Get imported products
 */
export async function getProducts(req, res) {
  try {
    const {userId, storeId, importId} = req.query;

    if (!userId && !storeId && !importId) {
      return res.status(400).json({
        success: false,
        error: 'userId, storeId, or importId is required'
      });
    }

    let products;
    if (importId) {
      products = await productRepo.getByImportId(importId);
    } else if (storeId) {
      products = await productRepo.getByStore(storeId);
    } else if (userId) {
      products = await productRepo.getByUser(userId);
    }

    return res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Get products error:', error);
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
 * Get queue statistics
 */
export async function getQueueStats(req, res) {
  try {
    const stats = await productQueueRepo.getQueueStats();

    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get queue stats error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Manual trigger: Process queue immediately
 */
export async function processQueueManual(req, res) {
  try {
    console.log('Manual queue processing triggered');

    // Run the queue processor
    await processProductQueue();

    // Get updated stats
    const stats = await productQueueRepo.getQueueStats();

    return res.json({
      success: true,
      message: 'Queue processing completed',
      data: stats
    });
  } catch (error) {
    console.error('Manual queue processing error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * CronJob handler: Process pending products from queue in batches
 * This runs every minute to process queued products
 */
export async function processProductQueue() {
  try {
    console.log('Starting product queue processing...');

    // Get queue statistics
    const stats = await productQueueRepo.getQueueStats();
    console.log('Queue stats:', stats);

    // Reset stuck items (items that have been processing for too long)
    const resetCount = await productQueueRepo.resetStuckItems(30); // 30 minutes timeout
    if (resetCount > 0) {
      console.log(`Reset ${resetCount} stuck items back to pending`);
    }

    // Get pending products (batch of 50)
    const pendingProducts = await productQueueRepo.getPendingBatch(50);

    if (pendingProducts.length === 0) {
      console.log('No pending products in queue');
      return;
    }

    console.log(`Processing ${pendingProducts.length} pending products`);

    // Process each product
    for (const queueItem of pendingProducts) {
      try {
        const {
          id: queueId,
          importId,
          storeId,
          userId,
          storeName,
          shopDomain,
          accessToken,
          product,
          productIndex,
          totalProducts,
          attempts
        } = queueItem;

        // Check max retry attempts
        const MAX_ATTEMPTS = 3;
        if (attempts >= MAX_ATTEMPTS) {
          console.log(`Queue item ${queueId} exceeded max attempts (${attempts}), marking as failed`);
          await productQueueRepo.markFailed(queueId, `Exceeded max retry attempts (${MAX_ATTEMPTS})`);
          continue;
        }

        // Mark as processing
        await productQueueRepo.updateStatus(queueId, 'processing');

        console.log(`Processing product ${productIndex + 1}/${totalProducts} for import ${importId} (attempt ${attempts + 1})`);

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

          // Save product to Firestore for tracking
          await productRepo.save({
            importId,
            storeId,
            userId,
            storeName,
            shopDomain,
            shopifyProductId: result.product?.id || result.id,
            title: product.title,
            sku: product.sku,
            price: product.price,
            compareAtPrice: product.compareAtPrice,
            vendor: product.vendor,
            productType: product.productType,
            tags: product.tags,
            status: product.status || 'active',
            action: result.action,
            importedAt: new Date().toISOString()
          });

          // Mark queue item as completed
          await productQueueRepo.updateStatus(queueId, 'completed');

          // Update import progress (success)
          const importJob = await importHistoryRepo.getById(importId);
          await importHistoryRepo.updateProgress(importId, {
            processedProducts: (importJob.processedProducts || 0) + 1,
            successCount: (importJob.successCount || 0) + 1,
            status: 'processing'
          });

          // Check if this is the last product
          if ((importJob.processedProducts || 0) + 1 >= totalProducts) {
            await importHistoryRepo.markCompleted(importId, {
              successCount: (importJob.successCount || 0) + 1,
              failedCount: importJob.failedCount || 0
            });
          }

          console.log(`Successfully ${result.action} product: ${product.title}`);
        } catch (error) {
          console.error(`Failed to import product ${product.title}:`, error);

          // Increment attempts
          const newAttempts = await productQueueRepo.incrementAttempts(queueId);

          // Check if we should retry
          if (newAttempts >= MAX_ATTEMPTS) {
            // Mark as failed after max attempts
            await productQueueRepo.markFailed(queueId, error.message);

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
          } else {
            // Reset to pending for retry
            await productQueueRepo.updateStatus(queueId, 'pending', error.message);
            console.log(`Product ${product.title} will be retried (attempt ${newAttempts}/${MAX_ATTEMPTS})`);
          }
        }
      } catch (error) {
        console.error('Error processing queue item:', error);
        // Continue to next item
      }
    }

    console.log('Product queue processing completed');
  } catch (error) {
    console.error('Process product queue error:', error);
    throw error;
  }
}
