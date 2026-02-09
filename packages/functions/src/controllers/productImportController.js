import {ImportHistoryRepository} from '../repositories/importHistoryRepository.js';
import {ProductRepository} from '../repositories/productRepository.js';
import {ProductQueueRepository} from '../repositories/productQueueRepository.js';
import {StoreRepository} from '../repositories/storeRepository.js';
import {ShopifyService} from '../services/shopifyService.js';
import {
  parseCsv,
  validateProductData,
  mapToShopifyProduct,
  generateCsvTemplate
} from '../helpers/csvParser.js';

const importHistoryRepo = new ImportHistoryRepository();
const productRepo = new ProductRepository();
const productQueueRepo = new ProductQueueRepository();
const storeRepo = new StoreRepository();

/**
 * Upload CSV and initiate product import
 * Supports multiple files + multiple stores
 * Flow: Validate ALL files first → only import if all pass → return real results
 */
export async function uploadAndImport(req, res) {
  try {
    // Support both single file (csvData) and multiple files (csvFiles)
    const {userId, storeId, storeIds, csvData, fileName, csvFiles} = req.body;

    const targetStoreIds = storeIds || (storeId ? [storeId] : []);

    // Task 1: Validate input
    if (!userId) {
      return res.status(400).json({success: false, error: 'userId is required'});
    }

    if (targetStoreIds.length === 0) {
      return res.status(400).json({success: false, error: 'At least one store must be selected'});
    }

    // Build files list - support both single file and multi-file
    const filesToProcess = [];
    if (csvFiles && csvFiles.length > 0) {
      filesToProcess.push(...csvFiles);
    } else if (csvData) {
      filesToProcess.push({csvData, fileName: fileName || 'upload.csv'});
    } else {
      return res.status(400).json({success: false, error: 'No CSV data provided'});
    }

    // Task 2: Get all store information
    const stores = await Promise.all(targetStoreIds.map(id => storeRepo.getById(id)));
    const missingStores = stores.filter(s => !s);
    if (missingStores.length > 0) {
      return res.status(404).json({success: false, error: 'One or more stores not found'});
    }

    // Task 3: Parse & validate ALL files first (fail fast)
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

    // If any file failed validation → stop everything, return errors
    if (fileErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: `${fileErrors.length} file(s) failed validation. Fix all files before importing.`,
        fileErrors
      });
    }

    if (parsedFiles.length === 0) {
      return res.status(400).json({success: false, error: 'No valid files to process'});
    }

    // Helper: delay between API calls to respect Shopify rate limit (2 req/s)
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Helper: call Shopify API with retry on 429
    const callWithRetry = async (fn, maxRetries = 3) => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await fn();
        } catch (error) {
          const is429 = error.statusCode === 429 || error.status === 429 ||
            (error.message && error.message.includes('429'));
          if (is429 && attempt < maxRetries) {
            const retryAfter = (error.retryAfter || 2) * 1000;
            console.log(`Rate limited (429), waiting ${retryAfter}ms before retry ${attempt + 1}/${maxRetries}`);
            await delay(retryAfter);
            continue;
          }
          throw error;
        }
      }
    };

    // Task 4: All files valid → Process products for each store (sequential, rate-limited)
    const importResults = [];

    for (const store of stores) {
      const shopifyService = new ShopifyService({
        shopDomain: store.shopDomain,
        accessToken: store.accessToken
      });

      const storeFileResults = [];

      for (const parsedFile of parsedFiles) {
        let successCount = 0;
        let failedCount = 0;
        let skippedCount = 0;
        const failedProducts = [];

        // Process products one by one with delay to respect Shopify rate limit
        for (let i = 0; i < parsedFile.validProducts.length; i++) {
          const product = parsedFile.validProducts[i];

          try {
            // Check if product with SKU already exists
            if (product.sku) {
              const existing = await callWithRetry(() => shopifyService.getProductBySku(product.sku));
              if (existing) {
                skippedCount++;
                console.log(`[${i + 1}/${parsedFile.validProducts.length}] Skipped: ${product.title} (SKU exists)`);
                await delay(500); // 0.5s delay between requests
                continue;
              }
            }

            await delay(500); // 0.5s delay before create call

            const result = await callWithRetry(() => shopifyService.createProduct(product));

            await productRepo.save({
              storeId: store.id,
              userId,
              storeName: store.name,
              shopDomain: store.shopDomain,
              shopifyProductId: result.product?.id || result.id,
              action: 'created',
              importedAt: new Date().toISOString(),
              ...product
            });

            successCount++;
            console.log(`[${i + 1}/${parsedFile.validProducts.length}] Created: ${product.title}`);
          } catch (error) {
            failedCount++;
            failedProducts.push({
              title: product.title || 'Unknown',
              error: error.message || 'Unknown error'
            });
            console.error(`[${i + 1}/${parsedFile.validProducts.length}] Failed: ${product.title}`, error.message);
          }

          // Delay between products to stay under Shopify rate limit (2 req/s)
          await delay(600);
        }

        // Save import history
        const importJobData = {
          userId,
          storeId: store.id,
          storeName: store.name,
          shopDomain: store.shopDomain,
          fileName: parsedFile.fileName,
          totalProducts: parsedFile.validProducts.length,
          processedProducts: parsedFile.validProducts.length,
          successCount,
          failedCount,
          skippedCount,
          status: failedCount === parsedFile.validProducts.length ? 'failed' : 'completed',
          completedAt: new Date().toISOString()
        };

        if (parsedFile.invalidProducts.length > 0) {
          importJobData.invalidProducts = parsedFile.invalidProducts.slice(0, 100);
          importJobData.totalInvalidProducts = parsedFile.invalidProducts.length;
        }

        if (failedProducts.length > 0) {
          importJobData.failedProductDetails = failedProducts.slice(0, 100);
        }

        const importJob = await importHistoryRepo.create(importJobData);

        // Enqueue only failed products for cron retry
        if (failedProducts.length > 0) {
          const failedTitles = new Set(failedProducts.map(fp => fp.title));
          const enqueuePromises = parsedFile.validProducts
            .filter(p => failedTitles.has(p.title))
            .map((product, index) =>
              productQueueRepo.enqueue({
                importId: importJob.id,
                storeId: store.id,
                userId,
                storeName: store.name,
                shopDomain: store.shopDomain,
                accessToken: store.accessToken,
                product,
                productIndex: index,
                totalProducts: failedProducts.length
              })
            );
          await Promise.all(enqueuePromises);
        }

        storeFileResults.push({
          fileName: parsedFile.fileName,
          importId: importJob.id,
          successCount,
          failedCount,
          skippedCount,
          totalProducts: parsedFile.validProducts.length,
          failedProducts: failedProducts.slice(0, 20)
        });
      }

      importResults.push({
        storeId: store.id,
        storeName: store.name,
        files: storeFileResults
      });
    }

    const totalSuccess = importResults.reduce(
      (sum, r) => sum + r.files.reduce((s, f) => s + f.successCount, 0), 0
    );
    const totalFailed = importResults.reduce(
      (sum, r) => sum + r.files.reduce((s, f) => s + f.failedCount, 0), 0
    );

    return res.json({
      success: true,
      message: `${parsedFiles.length} file(s) imported to ${stores.length} store(s): ${totalSuccess} created, ${totalFailed} failed${totalFailed > 0 ? ' (queued for retry)' : ''}.`,
      data: {
        importResults,
        storesCount: stores.length,
        filesCount: parsedFiles.length,
        totalSuccess,
        totalFailed
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
 * Get imported products with pagination and search
 * Decision tree:
 * - importId → getByImportId (single import)
 * - search → searchProducts via BigQuery (full-text search)
 * - otherwise → getWithPagination via Firestore (simple pagination)
 */
export async function getProducts(req, res) {
  try {
    const {userId, storeId, importId, page, limit, search, vendor, store} = req.query;

    if (!userId && !storeId && !importId) {
      return res.status(400).json({
        success: false,
        error: 'userId, storeId, or importId is required'
      });
    }

    // Handle import ID separately (no pagination needed usually)
    if (importId) {
      const products = await productRepo.getByImportId(importId);
      return res.json({
        success: true,
        data: products
      });
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const searchQuery = search || '';

    // Parse filter arrays
    const vendors = vendor ? vendor.split(',').filter(Boolean) : [];
    const stores = store ? store.split(',').filter(Boolean) : [];

    // Decision tree: Use BigQuery if search or filters present
    if (searchQuery || vendors.length > 0 || stores.length > 0) {
      // Use BigQuery for better search performance
      const result = await productRepo.searchProducts({
        userId,
        search: searchQuery,
        vendors,
        stores,
        page: pageNum,
        limit: limitNum
      });

      return res.json({
        success: true,
        data: result.products,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    }

    // No search/filters: Use fast Firestore pagination
    const result = await productRepo.getWithPagination({
      userId,
      storeId,
      page: pageNum,
      limit: limitNum,
      search: searchQuery
    });

    return res.json({
      success: true,
      data: result.products,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
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
 * Get filter options (vendors and stores)
 */
export async function getProductFilterOptions(req, res) {
  try {
    const {userId} = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const options = await productRepo.getFilterOptions(userId);

    return res.json({
      success: true,
      data: options
    });
  } catch (error) {
    console.error('Get product filter options error:', error);
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

    // Get pending products (batch of 100)
    const pendingProducts = await productQueueRepo.getPendingBatch(100);

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
          console.log(
            `Queue item ${queueId} exceeded max attempts (${attempts}), marking as failed`
          );
          await productQueueRepo.markFailed(
            queueId,
            `Exceeded max retry attempts (${MAX_ATTEMPTS})`
          );
          continue;
        }

        // Mark as processing
        await productQueueRepo.updateStatus(queueId, 'processing');

        console.log(
          `Processing product ${productIndex +
            1}/${totalProducts} for import ${importId} (attempt ${attempts + 1})`
        );

        // Create Shopify service
        const shopifyService = new ShopifyService({
          shopDomain,
          accessToken
        });

        // Import product to Shopify
        let result;
        let action = 'created';
        try {
          // Check if product with SKU already exists
          if (product.sku) {
            const existing = await shopifyService.getProductBySku(product.sku);
            if (existing) {
              // Product already exists in this store - SKIP (do not update)
              console.log(
                `Product with SKU ${product.sku} already exists in store ${storeName}, skipping...`
              );

              // Mark queue item as completed (skipped)
              await productQueueRepo.updateStatus(queueId, 'completed');

              // Update import progress (skipped counts as success but not imported)
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

              console.log(`Skipped product: ${product.title} (already exists)`);
              continue; // Skip to next product
            }
          }

          // Product does not exist - Create new product
          result = await shopifyService.createProduct(product);
          action = 'created';

          // Save product to Firestore with ALL fields from CSV
          await productRepo.save({
            // Tracking fields
            importId,
            storeId,
            userId,
            storeName,
            shopDomain,
            shopifyProductId: result.product?.id || result.id,
            action,
            importedAt: new Date().toISOString(),

            // All product fields from mapToShopifyProduct()
            // Includes: handle, title, description, options, variants, inventory,
            // images, Google Shopping metadata, SEO fields, pricing, shipping, tax, etc.
            ...product
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

          console.log(`Successfully ${action} product: ${product.title}`);
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
            console.log(
              `Product ${product.title} will be retried (attempt ${newAttempts}/${MAX_ATTEMPTS})`
            );
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
