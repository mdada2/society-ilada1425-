
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  User,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  ApplicationVerifier
} from 'firebase/auth';
import { getFirestore, initializeFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

// Project configuration for society-ilada (original project with data)
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

// Enable offline persistence (Browser only)
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firebase persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Firebase persistence not supported in this browser');
    }
  });
}

// Initialize Auth
export const auth = getAuth(app);
export { db };

// Authentication Helper Functions
export const signInWithEmail = async (email: string, password: string): Promise<User> => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

export const signUpWithEmail = async (email: string, password: string): Promise<User> => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

export const signOutUser = async (): Promise<void> => {
  await signOut(auth);
};

export const sendPasswordResetEmail = async (email: string): Promise<void> => {
  await firebaseSendPasswordResetEmail(auth, email);
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// Phone Authentication Helper Functions
let recaptchaVerifier: RecaptchaVerifier | null = null;

/**
 * Setup reCAPTCHA verifier for phone authentication
 * @param containerId - ID of the HTML element to render reCAPTCHA
 * @param isInvisible - Whether to use invisible reCAPTCHA (default: false)
 * @returns RecaptchaVerifier instance
 */
export const setupRecaptcha = (containerId: string, isInvisible: boolean = false): RecaptchaVerifier => {
  // Clear existing verifier if any
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
  }

  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: isInvisible ? 'invisible' : 'normal',
    callback: () => {
      // reCAPTCHA solved, allow signInWithPhoneNumber
      console.log('reCAPTCHA verified');
    },
    'expired-callback': () => {
      // Response expired, ask user to solve reCAPTCHA again
      console.warn('reCAPTCHA expired');
    }
  });

  return recaptchaVerifier;
};

/**
 * Sign in with phone number (sends OTP)
 * @param phoneNumber - Phone number in E.164 format (+919876543210)
 * @param appVerifier - RecaptchaVerifier instance
 * @returns ConfirmationResult for OTP verification
 */
export const signInWithPhone = async (
  phoneNumber: string,
  appVerifier: ApplicationVerifier
): Promise<ConfirmationResult> => {
  const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
  return confirmationResult;
};

/**
 * Verify OTP code
 * @param confirmationResult - Result from signInWithPhone
 * @param otp - 6-digit OTP code
 * @returns User object if successful
 */
export const verifyOTP = async (
  confirmationResult: ConfirmationResult,
  otp: string
): Promise<User> => {
  const result = await confirmationResult.confirm(otp);
  return result.user;
};

/**
 * Clear reCAPTCHA verifier
 */
export const clearRecaptcha = (): void => {
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
};

export default app;
