/* eslint-disable react/prop-types */
import {api} from '../../helpers/api';

/**
 * Upload a single file via Shopify staged upload flow.
 * @param {File} file
 * @param {string} storeId
 * @param {(progress: number) => void} onProgress  0-100
 * @returns {Promise<string>} CDN URL
 */
export async function uploadFile(file, storeId, onProgress) {
  // Step 1: get staged upload URL from our backend
  const res = await api('/api/shopify-products/upload-image', {
    method: 'POST',
    body: JSON.stringify({
      storeId,
      filename: file.name,
      mimeType: file.type,
      fileSize: file.size
    })
  });
  const result = await res.json();
  if (!result.success || !result.data) throw new Error(result.error || 'Failed to get upload URL');
  const {url, parameters, resourceUrl} = result.data;

  // Step 2: POST file directly to Shopify CDN
  const form = new FormData();
  (parameters || []).forEach(p => form.append(p.name, p.value));
  form.append('file', file);

  onProgress(30);

  // Use XMLHttpRequest for upload progress events
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) {
        const pct = 30 + Math.round((e.loaded / e.total) * 65);
        onProgress(pct);
      }
    };
    xhr.onload = () =>
      xhr.status < 400 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(form);
  });

  onProgress(100);

  // Derive CDN URL: prefer explicit resourceUrl, else use staged URL without query
  return resourceUrl || url.split('?')[0];
}
