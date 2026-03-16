import {useEffect, useState} from 'react';
import {doc, onSnapshot} from 'firebase/firestore';
import {db} from '../config/firebase';

/**
 * Real-time hook for tracking recheck job progress.
 * Watches a single tracking_recheck_jobs document via Firestore onSnapshot.
 *
 * @param {string|null} jobId - Job document ID to watch
 * @returns {Object} - { job, clearJob }
 */
export default function useRecheckProgress(jobId) {
  const [job, setJob] = useState(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }

    const docRef = doc(db, 'tracking_recheck_jobs', jobId);
    const unsubscribe = onSnapshot(
      docRef,
      snapshot => {
        if (snapshot.exists()) {
          setJob({id: snapshot.id, ...snapshot.data()});
        }
      },
      error => {
        console.error('Error listening to recheck job:', error);
      }
    );

    return () => unsubscribe();
  }, [jobId]);

  const clearJob = () => setJob(null);

  return {job, clearJob};
}
