import {useEffect, useRef, useState} from 'react';
import {collection, onSnapshot, query, where, orderBy, limit} from 'firebase/firestore';
import {db} from '../config/firebase';

/**
 * Real-time hook for tracking product import progress and history
 * Uses Firestore onSnapshot to listen for import job updates
 *
 * @param {Object} options - Hook options
 * @param {string} options.storeId - Store ID to filter imports
 * @param {function} options.onComplete - Callback when import completes
 * @param {function} options.onProgress - Callback when import progress updates
 * @returns {Object} - {importJob, importHistory, clearImportJob}
 */
export default function useImportProgress({storeId, onComplete = () => {}, onProgress = () => {}}) {
  const [importJob, setImportJob] = useState(null);
  const [importHistory, setImportHistory] = useState([]);

  // Use refs for callbacks to avoid re-subscribing on every render
  const onCompleteRef = useRef(onComplete);
  const onProgressRef = useRef(onProgress);
  onCompleteRef.current = onComplete;
  onProgressRef.current = onProgress;

  useEffect(() => {
    if (!storeId) return;

    // Query 1: Active import jobs (pending or processing)
    const activeImportsQuery = query(
      collection(db, 'product_imports'),
      where('storeId', '==', storeId),
      where('status', 'in', ['pending', 'processing'])
    );

    const unsubscribeActive = onSnapshot(
      activeImportsQuery,
      snapshot => {
        const changes = snapshot.docChanges();

        changes.forEach(change => {
          const docData = change.doc.data();
          const docId = change.doc.id;

          if (change.type === 'added') {
            setImportJob({id: docId, ...docData});
            onProgressRef.current({id: docId, ...docData});
          }

          if (change.type === 'modified') {
            setImportJob(prev => (prev?.id === docId ? {id: docId, ...docData} : prev));
            onProgressRef.current({id: docId, ...docData});

            const isComplete =
              docData.status === 'completed' ||
              docData.status === 'partial' ||
              docData.status === 'failed';

            if (isComplete) {
              onCompleteRef.current({id: docId, ...docData});
              setTimeout(() => {
                setImportJob(prev => (prev?.id === docId ? null : prev));
              }, 5000);
            }
          }

          if (change.type === 'removed') {
            setImportJob(prev => (prev?.id === docId ? null : prev));
          }
        });
      },
      error => {
        console.error('Error listening to active imports:', error);
      }
    );

    // Query 2: Recent import history (all statuses, last 10)
    const historyQuery = query(
      collection(db, 'product_imports'),
      where('storeId', '==', storeId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribeHistory = onSnapshot(
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

    return () => {
      unsubscribeActive();
      unsubscribeHistory();
    };
  }, [storeId]);

  return {
    importJob,
    importHistory,
    clearImportJob: () => setImportJob(null)
  };
}
