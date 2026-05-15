// Firebase configuration for client-side
// Uses environment variables from .env file (loaded by Vite)
import {initializeApp} from 'firebase/app';
import {getFirestore} from 'firebase/firestore';
import {getAuth} from 'firebase/auth';
import {getStorage} from 'firebase/storage';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const hasValidConfig = firebaseConfig.apiKey && firebaseConfig.projectId;

let app, db, auth, storage;

if (hasValidConfig) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
} else {
  console.warn('[Firebase] Missing config — Firebase features disabled. Set VITE_FIREBASE_* in packages/assets/.env');
  db = null;
  auth = null;
  storage = null;
}

export {db, auth, storage};
