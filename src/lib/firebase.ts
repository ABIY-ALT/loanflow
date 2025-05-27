
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
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

// Check if Firebase has already been initialized to avoid re-initializing
if (!getApps().length) {
  // Initialize Firebase
  if (
    !firebaseConfig.apiKey ||
    !firebaseConfig.projectId
  ) {
    console.error(
      'Firebase API Key or Project ID is not defined. Check your .env.local file and ensure it is loaded.'
    );
    // Avoid throwing an error that crashes the server, allow db to be potentially undefined
    // so components can handle it, but log a severe warning.
    // In a real app, you might throw here or handle it more gracefully.
  } else {
     app = initializeApp(firebaseConfig);
  }
} else {
  // Use the existing app
  app = getApps()[0];
}

// Initialize Firestore.
// getFirestore is designed to be called multiple times and returns the same instance for a given app.
// If app failed to initialize (e.g. missing config), db will reflect that.
// @ts-ignore
const db: Firestore = app ? getFirestore(app) : undefined; 

if (!db && app) {
    console.error("Firestore (db) could not be initialized. 'app' was initialized but getFirestore(app) might have failed or returned undefined. Check Firebase config and service status.");
} else if (!app) {
    console.error("Firebase app could not be initialized, so Firestore (db) is also undefined. Check Firebase config.");
}


export { app, db };
