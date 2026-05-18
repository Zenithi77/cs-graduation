/**
 * Seed pre-added accounts into Firebase Auth + Firestore.
 *
 * Prerequisites:
 *   1. Set the FIREBASE_SERVICE_ACCOUNT_JSON env var (same as production).
 *   2. Copy scripts/accounts-data.example.json → scripts/accounts-data.json
 *      and fill in real names + passwords.
 *
 * Usage (PowerShell):
 *   $env:TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","esModuleInterop":true}'
 *   npx ts-node --skipProject scripts/seed-accounts.ts            # all classes
 *   npx ts-node --skipProject scripts/seed-accounts.ts "КУ-1"     # one class
 *
 * Idempotency: an account is skipped if EITHER (a) a Firestore
 * `accounts` doc with the same class+firstname+lastname already exists,
 * OR (b) the synthetic email is already registered in Firebase Auth.
 * Check (a) protects against duplicates if the email-generation logic
 * ever changes.
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load .env.local so FIREBASE_SERVICE_ACCOUNT_JSON is available.
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

import {
  syntheticEmail,
  AccountEntry as BaseAccountEntry,
} from "./lib/synthetic-email";

// ── Types ──────────────────────────────────────────────────────────────────

interface AccountEntry extends BaseAccountEntry {
  password: string;
}

// ── Firebase Admin init ───────────────────────────────────────────────────

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

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  initAdmin();
  const adminAuth = getAuth();
  const db = getFirestore(undefined as any, "default");

  const dataPath = path.resolve(__dirname, "accounts-data.json");
  if (!fs.existsSync(dataPath)) {
    console.error(
      `ERROR: ${dataPath} not found.\n` +
        "Copy scripts/accounts-data.example.json → scripts/accounts-data.json and fill in real data.",
    );
    process.exit(1);
  }

  const allAccounts: AccountEntry[] = JSON.parse(
    fs.readFileSync(dataPath, "utf-8"),
  );

  const classFilter = process.argv[2];
  const accounts = classFilter
    ? allAccounts.filter((a) => a.class === classFilter)
    : allAccounts;

  if (classFilter && accounts.length === 0) {
    console.error(
      `No accounts found for class "${classFilter}". Check the class name in accounts-data.json.`,
    );
    process.exit(1);
  }

  console.log(
    classFilter
      ? `Processing ${accounts.length} account(s) for class "${classFilter}".\n`
      : `Processing all ${accounts.length} account(s).\n`,
  );

  let created = 0;
  let skipped = 0;

  for (const entry of accounts) {
    const email = syntheticEmail(entry);
    const displayName = `${entry.firstname} ${entry.lastname}`;

    // 0. Skip if a Firestore `accounts` doc already exists for this
    //    class+firstname+lastname (covers students seeded under an older
    //    email-generation scheme, so we don't create duplicate Auth users).
    const existingDoc = await db
      .collection("accounts")
      .where("class", "==", entry.class)
      .where("firstname", "==", entry.firstname)
      .where("lastname", "==", entry.lastname)
      .limit(1)
      .get();
    if (!existingDoc.empty) {
      const existingUid = existingDoc.docs[0].id;
      console.log(
        `  SKIP  ${displayName} (${entry.class}) — Firestore account doc already exists (uid: ${existingUid})`,
      );
      skipped++;
      continue;
    }

    // 1. Create Firebase Auth user (skip if email is already registered).
    let uid: string;
    try {
      const existing = await adminAuth.getUserByEmail(email).catch(() => null);
      if (existing) {
        uid = existing.uid;
        console.log(
          `  SKIP  ${displayName} (${entry.class}) — Auth user already exists (uid: ${uid})`,
        );
        skipped++;
      } else {
        const created_user = await adminAuth.createUser({
          email,
          password: entry.password,
          displayName,
          emailVerified: true,
        });
        uid = created_user.uid;
        console.log(`  CREATE ${displayName} (${entry.class}) — uid: ${uid}`);
        created++;
      }
    } catch (err) {
      console.error(`  ERROR creating auth user for ${displayName}:`, err);
      continue;
    }

    // 2. Write accounts/{uid} doc.
    const accountRef = db.collection("accounts").doc(uid);
    const accountSnap = await accountRef.get();
    if (!accountSnap.exists) {
      await accountRef.set({
        uid,
        class: entry.class,
        firstname: entry.firstname,
        lastname: entry.lastname,
        email,
      });
    }

    // 3. Ensure users/{uid} profile doc exists.
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      await userRef.set({
        uid,
        email,
        displayName,
        photoURL: "",
        isGraduate: true,
        class: entry.class,
        bio: "",
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
