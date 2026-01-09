/**
 * API Helper
 *
 * XMLHttpRequest wrapper for making API calls.
 * Uses XHR for maximum browser compatibility (no fetch polyfill needed).
 */

/**
 * Make an HTTP request
 *
 * @param {string} url - Request URL
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {object} data - Request body data
 * @param {object} options - Additional options
 * @returns {Promise<any>}
 */
export function makeRequest(url, method = 'GET', data = null, options = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (e) {
          resolve(xhr.responseText);
        }
      } else {
        reject(new Error(`Request failed: ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.onerror = function () {
      reject(new Error('Network error'));
    };

    xhr.open(method, url, true);

    // Set headers
    if (options.contentType) {
      xhr.setRequestHeader('Content-Type', options.contentType);
    }

    // Send request
    if (data && method !== 'GET') {
      const body = options.contentType?.includes('json') ? JSON.stringify(data) : data;
      xhr.send(body);
    } else {
      xhr.send();
    }
  });
}

export default makeRequest;
