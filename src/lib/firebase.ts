
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional, but include if you have it
};

let app: FirebaseApp;
let db: Firestore;

if (typeof window !== 'undefined' && !getApps().length) {
  // Initialize Firebase on the client side
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} else if (getApps().length) {
  // Use the existing app if already initialized (e.g., during HMR)
  app = getApp();
  db = getFirestore(app);
} else {
  // For server-side rendering or if window is not defined yet,
  // and no app is initialized (less common for client-heavy apps but good for robustness)
  // This part might need adjustment if you have extensive server-side Firebase use
  // but for client-side focused Firestore, the above branches are primary.
  // For now, we'll rely on client-side initialization primarily.
  // If you encounter issues specifically with server components needing db access early,
  // we might need a more specific server-side init.
  // However, the error you're describing usually points to client-side init issues.
}

// Defensive check to ensure db is initialized before export.
// This primarily helps if the above logic somehow doesn't assign db.
if (!db && typeof window !== 'undefined') {
    // Fallback initialization if somehow missed, this is a safety net.
    if (!getApps().length) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApp();
    }
    db = getFirestore(app);
}


export { app, db };
