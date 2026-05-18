import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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

// Force long-polling so corporate proxies / strict networks / browser
// extensions that block Firestore's WebChannel streaming don't cause
// "client is offline" errors.
// NOTE: The Firestore database in this project is a named database called
// "default" (not the implicit `(default)`), so we must pass the database ID.
const DB_ID = "default";
let _db: Firestore;
try {
  _db = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
      useFetchStreams: false,
    } as any,
    DB_ID
  );
} catch {
  // Already initialized (e.g. HMR) — fall back to existing instance.
  _db = getFirestore(app, DB_ID);
}

export const auth = getAuth(app);
export const db = _db;
export const storage = getStorage(app);
