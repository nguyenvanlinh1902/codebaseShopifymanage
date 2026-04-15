import {StoreRepository} from '../repositories/storeRepository.js';
import {ThemeRepository} from '../repositories/themeRepository.js';
import {ShopifyService} from '../services/shopifyService.js';
import {getStorage} from 'firebase-admin/storage';
import crypto from 'crypto';

const storeRepo = new StoreRepository();
const themeRepo = new ThemeRepository();

/**
 * Helper: Get store and create ShopifyService instance
 */
async function getStoreAndService(storeId) {
  const store = await storeRepo.getById(storeId);
  if (!store) {
    throw new Error('Store not found');
  }

  const shopifyService = new ShopifyService({
    shopDomain: store.shopDomain,
    accessToken: store.accessToken
  });

  return {store, shopifyService};
}

/**
 * List all themes for a store
 */
export async function getThemes(req, res) {
  try {
    const {storeId} = req.query;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'storeId is required'
      });
    }

    const {shopifyService} = await getStoreAndService(storeId);
    const themes = await shopifyService.getThemes();

    return res.json({
      success: true,
      data: themes.map(t => ({
        id: t.id,
        name: t.name,
        role: t.role,
        processing: t.processing,
        previewable: t.previewable,
        theme_store_id: t.theme_store_id,
        created_at: t.created_at,
        updated_at: t.updated_at
      }))
    });
  } catch (error) {
    console.error('Get themes error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Helper: Upload base64 ZIP to Firebase Storage and return public URL + metadata
 * File is kept permanently (not auto-deleted) so it can be re-used.
 */
async function uploadToStorage(base64Data, fileName) {
  const bucket = getStorage().bucket();
  const uniqueName = `themes/${crypto.randomUUID()}_${fileName}`;
  const file = bucket.file(uniqueName);

  // Remove data URL prefix if present (e.g. "data:application/zip;base64,")
  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(cleanBase64, 'base64');

  await file.save(buffer, {contentType: 'application/zip'});
  await file.makePublic();

  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueName}`;

  return {publicUrl, storagePath: uniqueName, fileSize: buffer.length};
}

/**
 * Import a theme from an uploaded ZIP file
 */
export async function importTheme(req, res) {
  try {
    const {storeId, themeFile, fileName, themeName, role} = req.body;

    if (!storeId || !themeName) {
      return res.status(400).json({
        success: false,
        error: 'storeId and themeName are required'
      });
    }

    if (!themeFile) {
      return res.status(400).json({
        success: false,
        error: 'themeFile (base64 ZIP) is required'
      });
    }

    // Upload to Firebase Storage (kept permanently)
    const {publicUrl, storagePath, fileSize} = await uploadToStorage(themeFile, fileName || 'theme.zip');

    const {store, shopifyService} = await getStoreAndService(storeId);
    const themeRole = role || 'unpublished';
    const theme = await shopifyService.createTheme(themeName, publicUrl, themeRole);

    // Save import record to Firestore
    const userId = req.userId || req.query.userId;
    await themeRepo.create({
      userId,
      themeName,
      fileName: fileName || 'theme.zip',
      fileUrl: publicUrl,
      storagePath,
      fileSize,
      importedTo: [{
        storeId,
        storeName: store.name || store.shopDomain,
        shopifyThemeId: theme.id,
        status: 'imported'
      }]
    });

    return res.json({
      success: true,
      message: 'Theme import started. It may take a few minutes for Shopify to process.',
      data: {
        id: theme.id,
        name: theme.name,
        role: theme.role,
        processing: theme.processing
      }
    });
  } catch (error) {
    console.error('Import theme error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * List imported theme records for current user
 */
export async function getImportedThemes(req, res) {
  try {
    const records = await themeRepo.getAll();

    return res.json({
      success: true,
      data: records
    });
  } catch (error) {
    console.error('Get imported themes error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * Delete an imported theme record and its file from storage
 */
export async function deleteImportedTheme(req, res) {
  try {
    const {recordId} = req.params;

    const record = await themeRepo.getById(recordId);
    if (!record) {
      return res.status(404).json({success: false, error: 'Record not found'});
    }

    // Delete file from Firebase Storage
    if (record.storagePath) {
      try {
        const bucket = getStorage().bucket();
        await bucket.file(record.storagePath).delete();
      } catch (err) {
        console.warn('Failed to delete theme file from storage:', err.message);
      }
    }

    await themeRepo.delete(recordId);

    return res.json({success: true, message: 'Imported theme record deleted'});
  } catch (error) {
    console.error('Delete imported theme error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * Re-import an existing theme record to additional stores
 */
export async function reimportTheme(req, res) {
  try {
    const {recordId} = req.params;
    const {storeId, themeName, role} = req.body;

    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required'});
    }

    const record = await themeRepo.getById(recordId);
    if (!record) {
      return res.status(404).json({success: false, error: 'Record not found'});
    }

    const {store, shopifyService} = await getStoreAndService(storeId);
    const themeRole = role || 'unpublished';
    const name = themeName || record.themeName;
    const theme = await shopifyService.createTheme(name, record.fileUrl, themeRole);

    // Add this store to the importedTo list
    const importedTo = record.importedTo || [];
    importedTo.push({
      storeId,
      storeName: store.name || store.shopDomain,
      shopifyThemeId: theme.id,
      status: 'imported'
    });
    await themeRepo.update(recordId, {importedTo});

    return res.json({
      success: true,
      message: 'Theme re-imported successfully.',
      data: {
        id: theme.id,
        name: theme.name,
        role: theme.role,
        processing: theme.processing
      }
    });
  } catch (error) {
    console.error('Reimport theme error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * Delete a theme from Shopify store
 */
export async function deleteTheme(req, res) {
  try {
    const {themeId} = req.params;
    const {storeId} = req.query;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'storeId is required'
      });
    }

    const {shopifyService} = await getStoreAndService(storeId);

    // Check theme role before deleting
    const themes = await shopifyService.getThemes();
    const theme = themes.find(t => t.id === parseInt(themeId));

    if (!theme) {
      return res.status(404).json({
        success: false,
        error: 'Theme not found'
      });
    }

    if (theme.role === 'main') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete the main (live) theme. Publish another theme first.'
      });
    }

    await shopifyService.deleteTheme(parseInt(themeId));

    return res.json({
      success: true,
      message: 'Theme deleted successfully'
    });
  } catch (error) {
    console.error('Delete theme error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Publish a theme (set as main/live)
 */
export async function publishTheme(req, res) {
  try {
    const {themeId} = req.params;
    const {storeId} = req.body;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'storeId is required'
      });
    }

    const {shopifyService} = await getStoreAndService(storeId);
    const theme = await shopifyService.publishTheme(parseInt(themeId));

    return res.json({
      success: true,
      message: 'Theme published successfully',
      data: {
        id: theme.id,
        name: theme.name,
        role: theme.role
      }
    });
  } catch (error) {
    console.error('Publish theme error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
