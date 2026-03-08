import {StoreGroupRepository} from '../repositories/storeGroupRepository.js';
import {StoreRepository} from '../repositories/storeRepository.js';

const groupRepo = new StoreGroupRepository();
const storeRepo = new StoreRepository();

/**
 * Get all store groups
 * All authenticated users can list groups
 */
export async function getGroups(req, res) {
  try {
    const groups = await groupRepo.getAll();
    return res.json({success: true, data: groups});
  } catch (error) {
    console.error('Get groups error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * Create a store group (admin only)
 */
export async function createGroup(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Forbidden: admin only'});
    }

    const {name, description} = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({success: false, error: 'name is required'});
    }

    const group = await groupRepo.create({
      name: name.trim(),
      description: description || '',
      createdBy: req.userId
    });

    return res.status(201).json({success: true, data: group});
  } catch (error) {
    console.error('Create group error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * Update a store group (admin only)
 */
export async function updateGroup(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Forbidden: admin only'});
    }

    const {id} = req.params;
    const existing = await groupRepo.getById(id);
    if (!existing) {
      return res.status(404).json({success: false, error: 'Group not found'});
    }

    const {name, description} = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;

    const updated = await groupRepo.update(id, updateData);
    return res.json({success: true, data: updated});
  } catch (error) {
    console.error('Update group error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * Delete a store group (admin only)
 * Clears groupId from all stores in the group before deleting
 */
export async function deleteGroup(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Forbidden: admin only'});
    }

    const {id} = req.params;
    const existing = await groupRepo.getById(id);
    if (!existing) {
      return res.status(404).json({success: false, error: 'Group not found'});
    }

    await storeRepo.clearGroupId(id);
    await groupRepo.delete(id);

    return res.json({success: true, message: 'Group deleted successfully'});
  } catch (error) {
    console.error('Delete group error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
