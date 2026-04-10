import {PolicyTemplateRepository} from '../repositories/policy-template-repository.js';

const repo = new PolicyTemplateRepository();

const ALLOWED_TYPES = [
  'REFUND_POLICY', 'PRIVACY_POLICY', 'TERMS_OF_SERVICE',
  'SHIPPING_POLICY', 'CONTACT_INFORMATION'
];

/**
 * GET /api/policy-templates
 * Return all saved templates. Frontend merges with hardcoded defaults.
 */
export async function getTemplates(req, res) {
  try {
    const templates = await repo.getAll();
    return res.json({success: true, data: templates});
  } catch (error) {
    console.error('Get policy templates error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * PUT /api/policy-templates
 * Bulk upsert templates. Admin only.
 * Body: { templates: [{ type: 'REFUND_POLICY', body: '<html>...' }, ...] }
 */
export async function saveTemplates(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Admin access required'});
    }

    const {templates} = req.body;
    if (!Array.isArray(templates) || templates.length === 0) {
      return res.status(400).json({success: false, error: 'templates array is required'});
    }

    const valid = templates.every(t => t.type && typeof t.body === 'string' && ALLOWED_TYPES.includes(t.type));
    if (!valid) {
      return res.status(400).json({success: false, error: 'Each template must have a valid type and body'});
    }

    const saved = await repo.bulkUpsert(templates);
    return res.json({success: true, data: saved});
  } catch (error) {
    console.error('Save policy templates error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * DELETE /api/policy-templates/:type
 * Delete a template (reverts to hardcoded default). Admin only.
 */
export async function deleteTemplate(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Admin access required'});
    }

    const {type} = req.params;
    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({success: false, error: 'Invalid policy type'});
    }

    await repo.delete(type);
    return res.json({success: true});
  } catch (error) {
    console.error('Delete policy template error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
