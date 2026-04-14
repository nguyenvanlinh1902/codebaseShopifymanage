/**
 * Upload CSV files directly to Firebase Storage (same pattern as Shopable).
 * Firebase SDK handles CORS automatically — no signed URLs needed.
 * Files stored at: csv-imports/{batchId}/{fileName}
 */
import {ref, uploadBytesResumable} from 'firebase/storage';
import {storage} from '../config/firebase';

const MAX_FILES = 100;

/**
 * Upload CSV files to Firebase Storage with progress tracking.
 * @param {File[]} files - Array of File objects from DropZone
 * @param {object} options
 * @param {function} options.onProgress - ({fileIndex, fileName, fileProgress, overall}) => void
 * @returns {{ batchId: string, fileNames: string[] }}
 */
export async function uploadCsvFiles(files, {onProgress} = {}) {
  if (files.length === 0) throw new Error('No files to upload');
  if (files.length > MAX_FILES) throw new Error(`Maximum ${MAX_FILES} files allowed per batch`);

  const batchId = crypto.randomUUID();
  const fileNames = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const storagePath = `csv-imports/${batchId}/${file.name}`;
    const storageRef = ref(storage, storagePath);

    await new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, file, {contentType: 'text/csv'});
      task.on('state_changed',
        (snap) => {
          const fileProgress = snap.bytesTransferred / snap.totalBytes;
          const overall = ((i + fileProgress) / files.length) * 100;
          onProgress?.({fileIndex: i, fileName: file.name, fileProgress, overall});
        },
        (err) => reject(err),
        () => {
          fileNames.push(file.name);
          resolve();
        }
      );
    });
  }

  return {batchId, fileNames};
}

export {MAX_FILES};
