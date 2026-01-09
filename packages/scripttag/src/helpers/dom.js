/**
 * DOM Helpers
 *
 * Utilities for DOM manipulation in the storefront.
 */

/**
 * Insert element after reference node
 */
export function insertAfter(el, referenceNode) {
  referenceNode.parentNode.insertBefore(el, referenceNode.nextSibling);
}

/**
 * Insert element before reference node
 */
export function insertBefore(el, referenceNode) {
  referenceNode.parentNode.insertBefore(el, referenceNode);
}

/**
 * Insert element as first child of parent
 */
export function insertAsFirstChild(el, parent) {
  parent.insertBefore(el, parent.firstChild);
}

/**
 * Insert element as last child of parent
 */
export function insertAsLastChild(el, parent) {
  parent.appendChild(el);
}

/**
 * Find target element based on position setting
 *
 * @param {string} position - Position identifier
 * @returns {HTMLElement|null}
 */
export function findTargetElement(position) {
  const positions = {
    'body-start': () => document.body.firstChild,
    'body-end': () => document.body.lastChild,
    'after-add-to-cart': () =>
      document.querySelector('form[action*="/cart/add"] button[type="submit"]') ||
      document.querySelector('[data-add-to-cart]') ||
      document.querySelector('.product-form__submit'),
    'before-add-to-cart': () =>
      document.querySelector('form[action*="/cart/add"]') || document.querySelector('[data-product-form]'),
    'product-description': () =>
      document.querySelector('.product-single__description') ||
      document.querySelector('[data-product-description]') ||
      document.querySelector('.product__description')
  };

  const finder = positions[position];
  return finder ? finder() : document.body.firstChild;
}

/**
 * Wait for element to appear in DOM
 *
 * @param {string} selector - CSS selector
 * @param {number} timeout - Max wait time in ms
 * @returns {Promise<HTMLElement>}
 */
export function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) {
      resolve(el);
      return;
    }

    const observer = new MutationObserver((mutations, obs) => {
      const el = document.querySelector(selector);
      if (el) {
        obs.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}
