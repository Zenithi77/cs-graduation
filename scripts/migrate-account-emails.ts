/**
 * One-off migration: rewrite every account's synthetic email to the
 * current `syntheticEmail()` output (proper Cyrillic→Latin transliteration).
 *
 * Background: an earlier version of `slugify()` collapsed every Cyrillic
 * character to "x", producing emails like ku1.xxxxxxxx.xxxxxxx@cs2026.internal.
 * That form still works for login (the email is read from Firestore), but
 * it's opaque and not future-proof. This script normalises everything to
 * readable, properly-unique emails like ku1.saihanbileg.bayarsaihan@cs2026.internal.
 *
 * For each `accounts/{uid}` doc, it:
 *   1. Recomputes the expected email from class+firstname+lastname.
 *   2. If it differs from the current email, updates:
 *        - Firebase Auth user (`updateUser` → new email)
 *        - `accounts/{uid}.email`
 *        - `users/{uid}.email`
 *   3. Skips otherwise (idempotent — safe to re-run).
 *
 * Usage (PowerShell):
 *   $env:TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","esModuleInterop":true}'
 *   npx ts-node --skipProject scripts/migrate-account-emails.ts            # all
 *   npx ts-node --skipProject scripts/migrate-account-emails.ts --dry-run  # preview
 *   npx ts-node --skipProject scripts/migrate-account-emails.ts "КУ-1"     # one class
 */

import * as path from "path";
import * as dotenv from "dotenv";

// Load .env.local so FIREBASE_SERVICE_ACCOUNT_JSON is available.
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { syntheticEmail } from "./lib/synthetic-email";

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

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const classFilter = args.find((a) => !a.startsWith("--"));

  const snap = await db.collection("accounts").get();
  let docs = snap.docs.map((d) => ({
    uid: d.id,
    data: d.data() as {
      uid: string;
      class: string;
      firstname: string;
      lastname: string;
      email: string;
    },
  }));

  if (classFilter) {
    docs = docs.filter((d) => d.data.class === classFilter);
    if (docs.length === 0) {
      console.error(`No accounts found for class "${classFilter}".`);
      process.exit(1);
    }
  }

  console.log(
    `${dryRun ? "[DRY RUN] " : ""}Scanning ${docs.length} account(s)` +
      (classFilter ? ` in class "${classFilter}"` : "") +
      ".\n",
  );

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const { uid, data } of docs) {
    const displayName = `${data.firstname} ${data.lastname}`;
    const oldEmail = data.email;
    const newEmail = syntheticEmail({
      class: data.class,
      firstname: data.firstname,
      lastname: data.lastname,
    });

    if (oldEmail === newEmail) {
      console.log(`  SKIP   ${displayName} (${data.class}) — already ${newEmail}`);
      skipped++;
      continue;
    }

    console.log(
      `  ${dryRun ? "WOULD " : ""}UPDATE ${displayName} (${data.class})\n` +
        `         ${oldEmail}\n      →  ${newEmail}`,
    );

    if (dryRun) {
      updated++;
      continue;
    }

    try {
      // Guard against a stray duplicate Auth user already holding the new email.
      const collider = await adminAuth.getUserByEmail(newEmail).catch(() => null);
      if (collider && collider.uid !== uid) {
        console.error(
          `  ERROR  ${displayName}: new email ${newEmail} is already held by uid ${collider.uid}; skipping.`,
        );
        errors++;
        continue;
      }

      await adminAuth.updateUser(uid, { email: newEmail });
      await db.collection("accounts").doc(uid).update({ email: newEmail });
      await db.collection("users").doc(uid).update({ email: newEmail });
      updated++;
    } catch (err) {
      console.error(`  ERROR  ${displayName}:`, err);
      errors++;
    }
  }

  console.log(
    `\n${dryRun ? "[DRY RUN] " : ""}Done. ` +
      `${dryRun ? "Would update" : "Updated"}: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
