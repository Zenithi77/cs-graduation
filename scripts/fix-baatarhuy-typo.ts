/**
 * One-off: fix the "Баатархуy" (mixed Cyrillic + Latin y) typo in the
 * two КУ-4 accounts. Updates lastname in Firestore + Auth displayName
 * + synthetic email everywhere. Safe to re-run (idempotent on the new
 * spelling).
 *
 * Usage (PowerShell):
 *   $env:TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","esModuleInterop":true}'
 *   npx ts-node --skipProject scripts/fix-baatarhuy-typo.ts
 */

import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { syntheticEmail } from "./lib/synthetic-email";

const OLD_LASTNAME = "Баатархуy"; // Latin y
const NEW_LASTNAME = "Баатархүү"; // Cyrillic ү ү

function initAdmin() {
  if (getApps().length) return;
  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ??
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY env var not set.");
  const parsed = JSON.parse(raw);
  if (typeof parsed.private_key === "string") {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  initializeApp({
    credential: cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    }),
  });
}

async function main() {
  initAdmin();
  const adminAuth = getAuth();
  const db = getFirestore(undefined as any, "default");

  const snap = await db
    .collection("accounts")
    .where("lastname", "==", OLD_LASTNAME)
    .get();

  if (snap.empty) {
    console.log(`No accounts with lastname "${OLD_LASTNAME}" — nothing to do.`);
    return;
  }

  console.log(`Found ${snap.size} account(s) to fix.\n`);

  for (const doc of snap.docs) {
    const uid = doc.id;
    const data = doc.data() as {
      class: string;
      firstname: string;
      lastname: string;
      email: string;
    };

    const newDisplayName = `${data.firstname} ${NEW_LASTNAME}`;
    const newEmail = syntheticEmail({
      class: data.class,
      firstname: data.firstname,
      lastname: NEW_LASTNAME,
    });

    console.log(
      `  ${data.firstname} ${OLD_LASTNAME} (${data.class})\n` +
        `    lastname  → ${NEW_LASTNAME}\n` +
        `    email     ${data.email}\n           →  ${newEmail}\n` +
        `    display   → ${newDisplayName}`,
    );

    await adminAuth.updateUser(uid, {
      email: newEmail,
      displayName: newDisplayName,
    });
    await db.collection("accounts").doc(uid).update({
      lastname: NEW_LASTNAME,
      email: newEmail,
    });
    await db.collection("users").doc(uid).update({
      email: newEmail,
      displayName: newDisplayName,
    });
  }

  console.log(`\nDone. Fixed ${snap.size} account(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
