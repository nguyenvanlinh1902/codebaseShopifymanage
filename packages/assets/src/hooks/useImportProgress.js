import {useEffect, useState} from 'react';
import {collection, onSnapshot, query, where, orderBy, limit} from 'firebase/firestore';
import {db} from '../config/firebase';

/**
 * Real-time hook for tracking product import progress and history
 * Uses Firestore onSnapshot to listen for import job updates
 *
 * @param {Object} options - Hook options
 * @param {string} options.storeId - Store ID to filter imports
 * @returns {Object} - {importHistory}
 */
export default function useImportProgress({storeId}) {
  const [importHistory, setImportHistory] = useState([]);

  useEffect(() => {
    if (!storeId) return;

    // Listen to recent import history (all statuses, last 10)
    const historyQuery = query(
      collection(db, 'product_imports'),
      where('storeId', '==', storeId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(
      historyQuery,
      snapshot => {
        const history = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setImportHistory(history);
      },
      error => {
        console.error('Error listening to import history:', error);
      }
    );

    return () => unsubscribe();
  }, [storeId]);

  return {importHistory};
}
