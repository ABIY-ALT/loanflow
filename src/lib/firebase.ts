
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (typeof window !== 'undefined' && !getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('Firebase initialized successfully on the client.');
  } catch (error) {
    console.error('Firebase client initialization error:', error);
    // Potentially set up dummy objects or throw an error to make it clear
    // that Firebase is not available, to prevent downstream errors.
  }
} else if (getApps().length > 0) {
  app = getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  // This case is for server-side rendering or Node.js environments
  // where Firebase admin SDK might be used, or if client-side
  // initialization hasn't happened yet. For client-side auth,
  // the above `typeof window !== 'undefined'` block is key.
  // Initialize a default app instance for server-side use if necessary,
  // though for client-side auth, this might not be strictly needed
  // if all auth operations are client-driven.
  // For now, we'll rely on client-side initialization.
}

// @ts-ignore
export { app, auth, db };
