import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  Firestore,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const app: FirebaseApp =
  getApps().length ? getApp() : initializeApp(firebaseConfig);

if (typeof window !== "undefined" && !firebaseConfig.projectId) {
  // eslint-disable-next-line no-console
  console.error(
    "[firebase] Missing NEXT_PUBLIC_FIREBASE_* environment variables. " +
      "Create .env.local from .env.local.example and restart `npm run dev`."
  );
}

// Use long-polling auto-detect so corporate proxies / strict networks that
// block Firestore's WebChannel streaming don't cause "client is offline".
let _db: Firestore;
try {
  _db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  });
} catch {
  // Already initialized (e.g. HMR) — fall back to existing instance.
  _db = getFirestore(app);
}

export const auth = getAuth(app);
export const db = _db;
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
