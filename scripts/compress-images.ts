/**
 * Compress all images in images/ and write results to images-compressed/.
 * Resizes to max 1400px on the longest side and re-encodes as JPEG at quality 82.
 *
 * Usage:
 *   npx tsx scripts/compress-images.ts
 */

import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

const SRC_DIR = path.resolve(__dirname, "../images");
const OUT_DIR = path.resolve(__dirname, "../images-compressed");
const MAX_DIMENSION = 3000;
const QUALITY = 88;

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files = fs
    .readdirSync(SRC_DIR)
    .filter((f) => /\.(jpg|jpeg|png|JPG|JPEG|PNG)$/.test(f));

  if (files.length === 0) {
    console.log("No images found in images/");
    return;
  }

  console.log(`Compressing ${files.length} image(s) → images-compressed/\n`);

  for (const file of files) {
    const inPath = path.join(SRC_DIR, file);
    const outName = path.parse(file).name + ".jpg";
    const outPath = path.join(OUT_DIR, outName);

    try {
      const { size: sizeBefore } = fs.statSync(inPath);

      await sharp(inPath)
        .rotate()
        .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: QUALITY })
        .toFile(outPath);

      const { size: sizeAfter } = fs.statSync(outPath);
      const pct = Math.round((1 - sizeAfter / sizeBefore) * 100);

      console.log(
        `  ✓ ${file.padEnd(40)} ${mb(sizeBefore)} → ${mb(sizeAfter)}  (-${pct}%)`
      );
    } catch (err) {
      console.error(`  ✗ ${file}: ${(err as Error).message}`);
    }
  }

  console.log("\nDone. Compressed images are in images-compressed/");
}

function mb(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(2).padStart(6) + " MB";
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
