import {useEffect, useState} from 'react';
import {doc, onSnapshot} from 'firebase/firestore';
import {db} from '../config/firebase';

/**
 * Real-time hook for tracking check job progress.
 * Watches a single tracking_check_jobs document via Firestore onSnapshot.
 * Similar pattern to useImportProgress but for tracking checks.
 *
 * @param {string|null} jobId - Job document ID to watch
 * @returns {Object} - { job, clearJob }
 */
export default function useTrackingCheckProgress(jobId) {
  const [job, setJob] = useState(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }

    const docRef = doc(db, 'tracking_check_jobs', jobId);
    const unsubscribe = onSnapshot(
      docRef,
      snapshot => {
        if (snapshot.exists()) {
          setJob({id: snapshot.id, ...snapshot.data()});
        }
      },
      error => {
        console.error('Error listening to tracking check job:', error);
      }
    );

    return () => unsubscribe();
  }, [jobId]);

  const clearJob = () => setJob(null);

  return {job, clearJob};
}
