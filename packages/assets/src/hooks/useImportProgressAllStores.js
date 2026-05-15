import {useEffect, useState} from 'react';
import {collection, onSnapshot, query, where, orderBy, limit} from 'firebase/firestore';
import {db} from '../config/firebase';

/**
 * Real-time hook for tracking product import progress across ALL stores
 * Uses Firestore onSnapshot to listen for import job updates
 *
 * @param {Object} options - Hook options
 * @param {string} options.userId - User ID to filter imports
 * @param {string} [options.storeId] - Optional store ID to filter (when a specific store is selected)
 * @returns {Object} - {importHistory}
 */
export default function useImportProgressAllStores({userId, storeId}) {
  const [importHistory, setImportHistory] = useState([]);

  useEffect(() => {
    if (!userId || !db) return;

    const q = storeId
      ? query(
          collection(db, 'product_imports'),
          where('storeId', '==', storeId),
          orderBy('createdAt', 'desc'),
          limit(200)
        )
      : query(collection(db, 'product_imports'), orderBy('createdAt', 'desc'), limit(200));

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const history = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setImportHistory(history);
      },
      error => {
        console.error('Error listening to import history (all stores):', error);
      }
    );

    return () => unsubscribe();
  }, [userId, storeId]);

  return {importHistory};
}
