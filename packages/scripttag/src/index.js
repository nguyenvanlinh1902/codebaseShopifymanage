/**
 * Scripttag Entry Point
 *
 * This script is loaded on the storefront via Shopify ScriptTag.
 * It initializes and renders Preact components into the storefront.
 *
 * Build: yarn build (in packages/scripttag)
 * Output: static/scripttag/avada-storefront.min.js
 */

import {render} from 'preact';
import SampleWidget from './components/SampleWidget/SampleWidget';
import ApiManager from './managers/ApiManager';
import {insertAfter, findTargetElement} from './helpers/dom';

/**
 * Initialize the widget
 */
async function init() {
  try {
    // 1. Get data from API (or use window data from Liquid)
    const apiManager = new ApiManager();
    const data = await apiManager.getWidgetData();

    // Skip if no data or disabled
    if (!data || !data.enabled) {
      console.log('[Avada] Widget disabled or no data');
      return;
    }

    // 2. Create container element
    const container = createContainer();

    // 3. Insert container into DOM
    const targetEl = findTargetElement(data.settings?.position || 'body-start');
    if (targetEl) {
      insertAfter(container, targetEl);
    }

    // 4. Render Preact component
    render(<SampleWidget data={data} />, container);

    console.log('[Avada] Widget initialized');
  } catch (error) {
    console.error('[Avada] Failed to initialize widget:', error);
  }
}

/**
 * Create the widget container element
 */
function createContainer() {
  const container = document.createElement('div');
  container.id = 'avada-widget';
  container.className = 'avada-widget-container';
  return container;
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for manual re-initialization (e.g., after AJAX navigation)
window.avadaWidgetInit = init;
