import customFieldRepo from '../repositories/custom-field-repository.js';
import {generateLiquidSnippet} from '../helpers/custom-fields-liquid-template.js';

const VALID_INPUT_TYPES = ['text', 'number', 'textarea'];

function generateKey(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

const DEFAULT_FIELDS = [
  {label: 'Enter Your Name', key: 'enter_your_name', namespace: 'custom', type: 'single_line_text_field', inputType: 'text', required: true, sortOrder: 0},
  {label: 'Enter Your Number', key: 'enter_your_number', namespace: 'custom', type: 'single_line_text_field', inputType: 'text', required: true, sortOrder: 1}
];

/** Seed default fields if collection is empty */
async function ensureDefaults() {
  const existing = await customFieldRepo.getAll();
  if (existing.length > 0) return existing;

  const seeded = [];
  for (const field of DEFAULT_FIELDS) {
    const created = await customFieldRepo.create(field);
    seeded.push(created);
  }
  return seeded;
}

export async function listFields(req, res) {
  try {
    const fields = await ensureDefaults();
    res.json({success: true, data: fields});
  } catch (error) {
    console.error('Error listing custom fields:', error);
    res.status(500).json({success: false, error: error.message});
  }
}

export async function getSnippet(req, res) {
  try {
    const fields = await customFieldRepo.getAll();
    const snippet = generateLiquidSnippet(fields);
    res.json({success: true, data: {snippet}});
  } catch (error) {
    console.error('Error generating snippet:', error);
    res.status(500).json({success: false, error: error.message});
  }
}

export async function createField(req, res) {
  try {
    const {label, inputType, required = false, sortOrder = 0} = req.body;

    if (!label?.trim()) {
      return res.status(400).json({success: false, error: 'Label is required'});
    }
    if (!VALID_INPUT_TYPES.includes(inputType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid inputType. Must be one of: ${VALID_INPUT_TYPES.join(', ')}`
      });
    }

    const key = generateKey(label);
    const existing = await customFieldRepo.getByKey(key);
    if (existing) {
      return res.status(409).json({success: false, error: `Field with key "${key}" already exists`});
    }

    const field = await customFieldRepo.create({
      label: label.trim(),
      key,
      namespace: 'custom',
      type: 'single_line_text_field',
      inputType,
      required: Boolean(required),
      sortOrder: Number(sortOrder) || 0
    });

    res.status(201).json({success: true, data: field});
  } catch (error) {
    console.error('Error creating custom field:', error);
    res.status(500).json({success: false, error: error.message});
  }
}

export async function updateField(req, res) {
  try {
    const {id} = req.params;
    const {label, inputType, required, sortOrder} = req.body;

    const existing = await customFieldRepo.getById(id);
    if (!existing) {
      return res.status(404).json({success: false, error: 'Field not found'});
    }

    const updateData = {};
    if (label !== undefined) updateData.label = label.trim();
    if (inputType !== undefined) {
      if (!VALID_INPUT_TYPES.includes(inputType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid inputType. Must be one of: ${VALID_INPUT_TYPES.join(', ')}`
        });
      }
      updateData.inputType = inputType;
    }
    if (required !== undefined) updateData.required = Boolean(required);
    if (sortOrder !== undefined) updateData.sortOrder = Number(sortOrder) || 0;

    const updated = await customFieldRepo.update(id, updateData);
    res.json({success: true, data: updated});
  } catch (error) {
    console.error('Error updating custom field:', error);
    res.status(500).json({success: false, error: error.message});
  }
}

export async function deleteField(req, res) {
  try {
    const {id} = req.params;

    const existing = await customFieldRepo.getById(id);
    if (!existing) {
      return res.status(404).json({success: false, error: 'Field not found'});
    }

    await customFieldRepo.delete(id);
    res.json({success: true, data: {id}});
  } catch (error) {
    console.error('Error deleting custom field:', error);
    res.status(500).json({success: false, error: error.message});
  }
}
