/**
 * Theme Operations Module
 * Handles all theme-related Shopify API operations
 */

/**
 * List all themes for the store
 */
export async function getThemes() {
  try {
    const themes = await this.shopify.theme.list();
    return themes;
  } catch (error) {
    console.error('Error listing themes:', error);
    throw new Error(`Failed to list themes: ${error.message}`);
  }
}

/**
 * Create a theme from a URL (ZIP file)
 * @param {string} name - Theme name
 * @param {string} src - Public URL to theme ZIP file
 * @param {string} role - Theme role: 'unpublished' (default) or 'main'
 */
export async function createTheme(name, src, role = 'unpublished') {
  try {
    const theme = await this.shopify.theme.create({name, src, role});
    return theme;
  } catch (error) {
    console.error('Error creating theme:', error);
    throw new Error(`Failed to create theme: ${error.message}`);
  }
}

/**
 * Delete a theme by ID
 */
export async function deleteTheme(themeId) {
  try {
    await this.shopify.theme.delete(themeId);
    return true;
  } catch (error) {
    console.error('Error deleting theme:', error);
    throw new Error(`Failed to delete theme: ${error.message}`);
  }
}

/**
 * Publish a theme (set role to main)
 */
export async function publishTheme(themeId) {
  try {
    const theme = await this.shopify.theme.update(themeId, {role: 'main'});
    return theme;
  } catch (error) {
    console.error('Error publishing theme:', error);
    throw new Error(`Failed to publish theme: ${error.message}`);
  }
}
