
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

// Project configuration for society-ilada
const firebaseConfig = {
  apiKey: "AIzaSyAp3IzvsP7WM_ek4-wKvUTq7P7LHdaCR6k",
  authDomain: "society-ilada.firebaseapp.com",
  projectId: "society-ilada",
  storageBucket: "society-ilada.firebasestorage.app",
  messagingSenderId: "681551898740",
  appId: "1:681551898740:web:4210df21e473809d80c921",
  measurementId: "G-QHTFFR28R1"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with improved connection stability
// experimentalForceLongPolling prevents ERR_CONNECTION_CLOSED errors
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  // Increase timeout for better stability
  cacheSizeBytes: 40000000 // 40 MB cache
});

// Enable offline persistence
// This allows the app to work offline and sync when connection is restored
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a time
    console.warn('Firebase persistence failed: Multiple tabs open');
  } else if (err.code === 'unimplemented') {
    // The current browser doesn't support persistence
    console.warn('Firebase persistence not supported in this browser');
  }
});

// Initialize Auth
export const auth = getAuth(app);
export { db };

export default app;
