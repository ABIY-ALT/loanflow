// src/lib/firebase.ts
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

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
let db: Firestore;

if (typeof window !== 'undefined' && !getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    // db = getFirestore(app); // Standard initialization
    // For newer SDKs or specific configurations, you might use initializeFirestore
     db = initializeFirestore(app, {
       cacheSizeBytes: CACHE_SIZE_UNLIMITED // Optional: Configure cache
     });
  } catch (error) {
    console.error("Firebase initialization error:", error);
    // Fallback or error handling
  }
} else if (getApps().length > 0) {
  app = getApps()[0];
  db = getFirestore(app);
}


// Ensure db is exported, even if initialization might fail or be delayed server-side.
// Components should handle the possibility of db being undefined if used server-side without full init.
// However, for client components, this setup should work.
export { app, db };
