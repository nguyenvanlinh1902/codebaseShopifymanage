import * as tagRepository from '@functions/repositories/tagRepository';
import * as ticketRepository from '@functions/repositories/ticketRepository';

/**
 * Create a new tag
 *
 * @param {Object} params
 * @param {string} params.organizationId - Organization ID
 * @param {string} params.name - Tag name
 * @param {string} [params.color='gray'] - Tag color
 * @returns {Promise<Tag>}
 */
export async function createTag({organizationId, name, color}) {
  if (!name || name.trim().length === 0) {
    throw new Error('Tag name is required');
  }

  return tagRepository.create({
    organizationId,
    name: name.trim(),
    color: color || 'gray'
  });
}

/**
 * Get tag by ID with validation
 *
 * @param {string} tagId - Tag ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Tag>}
 */
export async function getTag(tagId, organizationId) {
  const tag = await tagRepository.getById(tagId);

  if (!tag) {
    throw new Error('Tag not found');
  }

  if (tag.organizationId !== organizationId) {
    throw new Error('Tag not found');
  }

  return tag;
}

/**
 * List all tags for an organization
 *
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Tag[]>}
 */
export async function listTags(organizationId) {
  return tagRepository.listByOrganization(organizationId);
}

/**
 * Update a tag
 *
 * @param {string} tagId - Tag ID
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Update data
 * @param {string} [data.name] - New name
 * @param {string} [data.color] - New color
 * @returns {Promise<Tag>}
 */
export async function updateTag(tagId, organizationId, data) {
  await getTag(tagId, organizationId);

  // Check if new name already exists
  if (data.name) {
    const existing = await tagRepository.getByName(organizationId, data.name);
    if (existing && existing.id !== tagId) {
      throw new Error('A tag with this name already exists');
    }
  }

  return tagRepository.update(tagId, data);
}

/**
 * Delete a tag
 *
 * @param {string} tagId - Tag ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<void>}
 */
export async function deleteTag(tagId, organizationId) {
  await getTag(tagId, organizationId);

  // Note: Tags remain in ticket.tagIds after deletion
  // In production, might want to clean up references

  await tagRepository.remove(tagId);
}

/**
 * Merge tags (move all usages from source to target)
 *
 * @param {string} sourceId - Source tag ID (will be deleted)
 * @param {string} targetId - Target tag ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Tag>}
 */
export async function mergeTags(sourceId, targetId, organizationId) {
  const [sourceTag, targetTag] = await Promise.all([getTag(sourceId, organizationId), getTag(targetId, organizationId)]);

  if (sourceId === targetId) {
    throw new Error('Cannot merge tag with itself');
  }

  // Note: In production, would need to update all tickets that have sourceId in tagIds
  // This is a simplified implementation

  await tagRepository.merge(sourceId, targetId);

  return targetTag;
}

/**
 * Get or create a tag by name
 *
 * @param {string} organizationId - Organization ID
 * @param {string} name - Tag name
 * @param {string} [color='gray'] - Color if creating
 * @returns {Promise<Tag>}
 */
export async function getOrCreateTag(organizationId, name, color = 'gray') {
  return tagRepository.getOrCreate(organizationId, name, color);
}
