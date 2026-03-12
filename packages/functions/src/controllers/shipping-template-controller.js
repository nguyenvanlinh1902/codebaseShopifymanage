import {ShippingTemplateRepository} from '../repositories/shipping-template-repository.js';
import {StoreRepository} from '../repositories/storeRepository.js';
import {ShopifyService} from '../services/shopifyService.js';
import {
  getDeliveryProfiles,
  updateDeliveryProfileRates,
  matchTemplateToLiveProfiles,
  replaceDeliveryProfileRates
} from '../services/shopify-shipping-service.js';

const templateRepo = new ShippingTemplateRepository();
const storeRepo = new StoreRepository();

// ============ TEMPLATE CRUD ============

/** POST /templates — Create template by capturing live rates from a store */
export async function createTemplate(req, res) {
  try {
    const {name, description, sourceStore} = req.body;
    if (!name || !sourceStore) {
      return res.status(400).json({success: false, error: 'name and sourceStore are required'});
    }

    const store = await storeRepo.getByShopDomain(sourceStore);
    if (!store || !store.accessToken) {
      return res.status(404).json({success: false, error: 'Store not found or missing access token'});
    }

    const shopify = new ShopifyService(store);
    const profiles = await getDeliveryProfiles(shopify);

    const template = await templateRepo.createTemplate({name, description, sourceStore, profiles});
    res.status(201).json({success: true, data: template});
  } catch (err) {
    console.error('[Shipping] createTemplate error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** GET /templates — List all templates (without profiles) */
export async function listTemplates(req, res) {
  try {
    const templates = await templateRepo.listTemplates();
    res.json({success: true, data: templates});
  } catch (err) {
    console.error('[Shipping] listTemplates error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** GET /templates/:id — Get template with full profiles */
export async function getTemplate(req, res) {
  try {
    const template = await templateRepo.getTemplate(req.params.id);
    if (!template) return res.status(404).json({success: false, error: 'Template not found'});
    res.json({success: true, data: template});
  } catch (err) {
    console.error('[Shipping] getTemplate error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** PATCH /templates/:id — Update template name/description */
export async function updateTemplateMeta(req, res) {
  try {
    const {name, description} = req.body;
    await templateRepo.updateTemplateMeta(req.params.id, {name, description});
    res.json({success: true});
  } catch (err) {
    console.error('[Shipping] updateTemplateMeta error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** DELETE /templates/:id — Delete template */
export async function deleteTemplate(req, res) {
  try {
    await templateRepo.deleteTemplate(req.params.id);
    res.json({success: true});
  } catch (err) {
    console.error('[Shipping] deleteTemplate error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** POST /templates/:id/recapture — Re-capture profiles from source store */
export async function recaptureTemplate(req, res) {
  try {
    const template = await templateRepo.getTemplate(req.params.id);
    if (!template) return res.status(404).json({success: false, error: 'Template not found'});

    const sourceStore = req.body.sourceStore || template.sourceStore;
    const store = await storeRepo.getByShopDomain(sourceStore);
    if (!store || !store.accessToken) {
      return res.status(404).json({success: false, error: 'Store not found or missing access token'});
    }

    const shopify = new ShopifyService(store);
    const profiles = await getDeliveryProfiles(shopify);
    await templateRepo.updateTemplateProfiles(req.params.id, {sourceStore, profiles});

    res.json({success: true, data: {sourceStore, profileCount: profiles.length}});
  } catch (err) {
    console.error('[Shipping] recaptureTemplate error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

// ============ STORE RATES ============

/** GET /stores/:shopDomain/rates — Get live shipping rates for one store */
export async function getStoreRates(req, res) {
  try {
    const {shopDomain} = req.params;
    const store = await storeRepo.getByShopDomain(shopDomain);
    if (!store || !store.accessToken) {
      return res.status(404).json({success: false, error: 'Store not found or missing access token'});
    }

    const shopify = new ShopifyService(store);
    const profiles = await getDeliveryProfiles(shopify);
    res.json({success: true, data: profiles});
  } catch (err) {
    const detail = err.response?.body?.errors || err.message;
    console.error('[Shipping] getStoreRates error:', JSON.stringify(detail));
    res.status(500).json({success: false, error: typeof detail === 'string' ? detail : JSON.stringify(detail)});
  }
}

/** PUT /stores/:shopDomain/rates — Update rates for one store (inline edit) */
export async function updateStoreRates(req, res) {
  try {
    const {shopDomain} = req.params;
    const {updates} = req.body;
    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({success: false, error: 'updates array is required'});
    }

    const store = await storeRepo.getByShopDomain(shopDomain);
    if (!store || !store.accessToken) {
      return res.status(404).json({success: false, error: 'Store not found or missing access token'});
    }

    const shopify = new ShopifyService(store);
    const result = await updateDeliveryProfileRates(shopify, updates);
    res.json({success: result.success, data: result, errors: result.errors});
  } catch (err) {
    console.error('[Shipping] updateStoreRates error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

// ============ BULK APPLY ============

/** POST /bulk-apply — Apply template to multiple stores (async job) */
export async function bulkApply(req, res) {
  try {
    const {templateId, shopDomains} = req.body;
    if (!templateId || !shopDomains?.length) {
      return res.status(400).json({success: false, error: 'templateId and shopDomains[] required'});
    }

    const template = await templateRepo.getTemplate(templateId);
    if (!template) return res.status(404).json({success: false, error: 'Template not found'});

    // Validate all stores exist
    const stores = [];
    for (const domain of shopDomains) {
      const store = await storeRepo.getByShopDomain(domain);
      if (store && store.accessToken) stores.push(store);
    }

    if (!stores.length) {
      return res.status(400).json({success: false, error: 'No valid stores found'});
    }

    // Create job
    const job = await templateRepo.createJob({
      templateId,
      templateName: template.name,
      shopDomains: stores.map(s => s.shopDomain)
    });

    // Fire-and-forget: apply async
    applyTemplateToStores(job.id, template, stores).catch(err => {
      console.error('[Shipping] bulkApply async error:', err.message);
    });

    res.status(202).json({success: true, data: {jobId: job.id}});
  } catch (err) {
    console.error('[Shipping] bulkApply error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** GET /bulk-apply/:jobId — Get job status */
export async function getJobStatus(req, res) {
  try {
    const job = await templateRepo.getJob(req.params.jobId);
    if (!job) return res.status(404).json({success: false, error: 'Job not found'});
    res.json({success: true, data: job});
  } catch (err) {
    console.error('[Shipping] getJobStatus error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

// ============ DEBUG ============

/** GET /debug-match/:templateId/:shopDomain — Debug matching without applying */
export async function debugMatch(req, res) {
  try {
    const {templateId, shopDomain} = req.params;

    const template = await templateRepo.getTemplate(templateId);
    if (!template) return res.status(404).json({success: false, error: 'Template not found'});

    const store = await storeRepo.getByShopDomain(shopDomain);
    if (!store || !store.accessToken) {
      return res.status(404).json({success: false, error: 'Store not found'});
    }

    const shopify = new ShopifyService(store);
    const liveProfiles = await getDeliveryProfiles(shopify);

    // Summarize template profiles
    const templateSummary = (template.profiles || []).map(p => ({
      profileName: p.profileName,
      locationGroups: (p.locationGroups || []).map(lg => ({
        locationGroupId: lg.locationGroupId,
        zones: (lg.zones || []).map(z => ({
          zoneName: z.zoneName,
          rates: (z.rates || []).map(r => ({name: r.name, price: r.price, currencyCode: r.currencyCode}))
        }))
      }))
    }));

    // Summarize live profiles
    const liveSummary = liveProfiles.map(p => ({
      profileName: p.profileName,
      profileId: p.profileId,
      locationGroups: (p.locationGroups || []).map(lg => ({
        locationGroupId: lg.locationGroupId,
        zones: (lg.zones || []).map(z => ({
          zoneName: z.zoneName,
          zoneId: z.zoneId,
          rates: (z.rates || []).map(r => ({
            name: r.name, price: r.price, currencyCode: r.currencyCode,
            rateDefinitionId: r.rateDefinitionId, methodDefinitionId: r.methodDefinitionId
          }))
        }))
      }))
    }));

    // Run matching
    const updates = matchTemplateToLiveProfiles(template.profiles, liveProfiles);

    res.json({
      success: true,
      data: {
        templateName: template.name,
        shopDomain,
        templateProfiles: templateSummary,
        liveProfiles: liveSummary,
        matchResult: updates,
        matchCount: updates.length
      }
    });
  } catch (err) {
    res.status(500).json({success: false, error: err.message});
  }
}

// ============ INTERNAL ============

/** Apply template to multiple stores — replace strategy (delete old + create new) */
async function applyTemplateToStores(jobId, template, stores) {
  const results = await Promise.allSettled(
    stores.map(async store => {
      try {
        const shopify = new ShopifyService(store);
        const liveProfiles = await getDeliveryProfiles(shopify);

        const result = await replaceDeliveryProfileRates(
          shopify,
          template.profiles,
          liveProfiles
        );
        return {
          shopDomain: store.shopDomain,
          status: result.replaced > 0
            ? (result.success ? 'success' : 'partial')
            : 'skipped',
          error: result.errors.length > 0
            ? result.errors.map(e => `${e.zone}: ${e.message}`).join('; ')
            : (result.replaced === 0 ? 'No matching zones' : null),
          appliedAt: new Date().toISOString()
        };
      } catch (err) {
        return {shopDomain: store.shopDomain, status: 'failed', error: err.message};
      }
    })
  );

  const storeResults = results.map(r => r.status === 'fulfilled' ? r.value : {
    shopDomain: 'unknown',
    status: 'failed',
    error: r.reason?.message || 'Unknown error'
  });

  const allSuccess = storeResults.every(s => s.status === 'success');
  const allFailed = storeResults.every(s => s.status === 'failed');
  const overallStatus = allSuccess ? 'completed' : allFailed ? 'failed' : 'partial';

  await templateRepo.updateJob(jobId, {
    status: overallStatus,
    stores: storeResults,
    completedAt: new Date().toISOString()
  });
}
