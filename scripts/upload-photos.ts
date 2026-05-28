/**
 * Bulk upload profile photos from images/ to Cloudinary and update Firestore.
 *
 * Filename format: "LastnameInitial.Firstname.JPG"  (e.g. "Б.Анар.JPG")
 * Firestore displayName format: "Firstname Lastname" (e.g. "Анар Базаррагчаа")
 *
 * Prerequisites — set in .env.local:
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
 *   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
 *   FIREBASE_SERVICE_ACCOUNT_JSON=...
 *
 * Usage:
 *   npx tsx scripts/upload-photos.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

function initAdmin() {
  if (getApps().length) return;
  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ??
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON env var not set.");
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

async function cloudinaryUpload(filePath: string, uid: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const blob = new Blob([buffer], { type: "image/jpeg" });
  const fd = new FormData();
  fd.append("file", blob, path.basename(filePath));
  fd.append("upload_preset", UPLOAD_PRESET!);
  fd.append("folder", `avatars/${uid}`);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: fd }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Cloudinary upload failed ${res.status}: ${text}`);
  }
  const json = (await res.json()) as { secure_url: string };
  return json.secure_url;
}

// Matches "X.Name" or "X. Name" where X is exactly one Cyrillic/Latin character
function parseName(stem: string): { initial: string; firstName: string } | null {
  const m = stem.match(/^([Ѐ-ӿА-ЯӨҮа-яөүA-Z])\.\s*(.+)$/u);
  if (!m) return null;
  return { initial: m[1], firstName: m[2].trim() };
}

interface UserDoc {
  docId: string;
  displayName: string;
}

// displayName = "Firstname Lastname" — match firstName and first letter of Lastname
function findMatch(
  initial: string,
  firstName: string,
  users: UserDoc[]
): UserDoc | null {
  return (
    users.find((u) => {
      const [fName = "", lName = ""] = u.displayName.trim().split(/\s+/);
      return fName === firstName && lName.charAt(0) === initial;
    }) ?? null
  );
}

async function main() {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    console.error(
      "Missing Cloudinary credentials. Add to .env.local:\n" +
        "  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...\n" +
        "  NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=..."
    );
    process.exit(1);
  }

  initAdmin();
  const db = getFirestore(undefined as any, "(default)");

  const snap = await db.collection("users").get();
  const users: UserDoc[] = snap.docs.map((d) => ({
    docId: d.id,
    ...(d.data() as Omit<UserDoc, "docId">),
  }));
  console.log(`Loaded ${users.length} users from Firestore.\n`);

  const imagesDir = path.resolve(__dirname, "../images-compressed");
  const files = fs
    .readdirSync(imagesDir)
    .filter((f) => /\.(jpg|jpeg)$/i.test(f));
  console.log(`Found ${files.length} image(s) in images/.\n`);

  let updated = 0,
    skipped = 0,
    failed = 0;

  for (const file of files) {
    const stem = path.parse(file).name;
    const parsed = parseName(stem);

    if (!parsed) {
      console.log(`SKIP   "${file}" — not in "Initial.Name" format`);
      skipped++;
      continue;
    }

    const match = findMatch(parsed.initial, parsed.firstName, users);
    if (!match) {
      console.log(
        `SKIP   "${file}" — no user found for ${parsed.initial}.${parsed.firstName}`
      );
      skipped++;
      continue;
    }

    try {
      process.stdout.write(`UPLOAD "${file}" → ${match.displayName} ... `);
      const filePath = path.join(imagesDir, file);
      const photoURL = await cloudinaryUpload(filePath, match.docId);
      await db.collection("users").doc(match.docId).update({ photoURL });
      console.log("✓");
      updated++;
    } catch (err) {
      console.log("✗");
      console.error(`  ERROR: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(
    `\nDone.  Updated: ${updated}  Skipped: ${skipped}  Failed: ${failed}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
