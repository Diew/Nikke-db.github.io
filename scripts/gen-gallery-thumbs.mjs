#!/usr/bin/env node
/**
 * gen-gallery-thumbs.mjs — Generate 200px webp thumbnails from gallery screenshots.
 *
 * Input:  images/gallery/{story1..story13}/* + images/gallery/chapters/*
 * Output: gallery-thumbs/{story1..story13}/* + gallery-thumbs/chapters/*
 *
 * Usage: node scripts/gen-gallery-thumbs.mjs
 * Deps:  npm i sharp (in this repo)
 */

import { readdir, mkdir } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import sharp from 'sharp';

const ROOT = join(import.meta.dirname, '..');
const INPUT_DIR = join(ROOT, 'images', 'gallery');
const OUTPUT_DIR = join(ROOT, 'gallery-thumbs');

const THUMB_WIDTH = 200;
const WEBP_QUALITY = 80;

/** Folders to process */
// Auto-discover all folders except 4koma*
const EXCLUDE_PREFIXES = ['4koma'];

async function discoverFolders() {
  const entries = await readdir(INPUT_DIR, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory() && !EXCLUDE_PREFIXES.some(p => e.name.startsWith(p)))
    .map(e => e.name)
    .sort();
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function processFolder(folder) {
  const srcDir = join(INPUT_DIR, folder);
  const outDir = join(OUTPUT_DIR, folder);

  let files;
  try {
    files = await readdir(srcDir);
  } catch {
    console.log(`  ⏭  ${folder}: not found, skipping`);
    return { total: 0, done: 0, skipped: 0 };
  }

  const images = files.filter(f => IMAGE_EXTS.has(extname(f).toLowerCase()));
  if (images.length === 0) {
    console.log(`  ⏭  ${folder}: no images, skipping`);
    return { total: 0, done: 0, skipped: 0 };
  }

  await ensureDir(outDir);

  let done = 0;
  let skipped = 0;

  for (const file of images) {
    const thumbName = basename(file, extname(file)) + '.webp';
    const srcPath = join(srcDir, file);
    const outPath = join(outDir, thumbName);

    try {
      await sharp(srcPath)
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toFile(outPath);
      done++;
    } catch (err) {
      console.log(`  ⚠  ${folder}/${file}: ${err.message}`);
      skipped++;
    }
  }

  return { total: images.length, done, skipped };
}

async function main() {
  console.log(`Generating ${THUMB_WIDTH}px webp thumbnails...\n`);

  const folders = await discoverFolders();
  console.log(`Found ${folders.length} folders (excluding 4koma*)\n`);

  let totalFiles = 0;
  let totalDone = 0;
  let totalSkipped = 0;

  for (const folder of folders) {
    const { total, done, skipped } = await processFolder(folder);
    if (total > 0) {
      console.log(`  ✓ ${folder}: ${done}/${total} thumbnails${skipped ? ` (${skipped} failed)` : ''}`);
    }
    totalFiles += total;
    totalDone += done;
    totalSkipped += skipped;
  }

  console.log(`\nDone: ${totalDone}/${totalFiles} thumbnails generated → gallery-thumbs/`);
  if (totalSkipped > 0) console.log(`Failed: ${totalSkipped}`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
