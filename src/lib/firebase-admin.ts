// Server-only Firebase Admin SDK init.
// Webhook route-аас Firestore-д "authenticated" дүрэм давж бичихэд хэрэглэнэ.
import { cert, getApp, getApps, initializeApp, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

function initAdmin(): App {
  if (getApps().length) return getApp();

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "[firebase-admin] FIREBASE_SERVICE_ACCOUNT_JSON env тохируулагдаагүй байна."
    );
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      "[firebase-admin] FIREBASE_SERVICE_ACCOUNT_JSON буруу JSON форматтай байна."
    );
  }

  // PEM хэлбэрийн private_key-ний \n-уудыг сэргээх (env-д single-line хадгалсан үед)
  if (typeof parsed.private_key === "string") {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }

  return initializeApp({
    credential: cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    }),
  });
}

export function getAdminDb(): Firestore {
  // Project дотор "default" нэртэй named database байгаа тул заавал ID өгнө.
  return getFirestore(initAdmin(), "default");
}
