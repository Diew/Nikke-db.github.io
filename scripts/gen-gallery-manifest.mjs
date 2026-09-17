#!/usr/bin/env node
/**
 * gen-gallery-manifest.mjs — Generate gallery manifest JSON.
 *
 * Output format: { "folder": [{ "t": "thumb.webp", "f": "original.png" }, ...] }
 * - t = thumbnail filename (from gallery-thumbs/)
 * - f = original filename (from images/gallery/)
 *
 * Usage:
 *   node scripts/gen-gallery-manifest.mjs                    → writes to NPC Jail project
 *   node scripts/gen-gallery-manifest.mjs --stdout           → prints to stdout
 *   node scripts/gen-gallery-manifest.mjs --out path.json    → writes to custom path
 *
 * Deps: none (Node.js built-in only)
 */

import { readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const THUMBS_DIR = join(ROOT, 'gallery-thumbs');
const FULL_DIR = join(ROOT, 'images', 'gallery');

const EXCLUDE_PREFIXES = ['4koma'];
const IMAGE_EXTS = new Set(['.webp', '.png', '.jpg', '.jpeg', '.gif']);

// Parse args
const args = process.argv.slice(2);
const stdoutMode = args.includes('--stdout');
const outIdx = args.indexOf('--out');
const outPath = outIdx !== -1 ? args[outIdx + 1] : null;

const NPC_JAIL_ROOT = process.env.NPC_JAIL_ROOT || join(ROOT, '..', 'npc-jail');
const DEFAULT_OUT = join(NPC_JAIL_ROOT, 'public', 'data', 'nikke', 'gallery-manifest.json');

async function discoverFolders() {
  const entries = await readdir(THUMBS_DIR, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory() && !EXCLUDE_PREFIXES.some(p => e.name.startsWith(p)))
    .map(e => e.name)
    .sort();
}

async function scanFullDir(folder) {
  const dir = join(FULL_DIR, folder);
  try {
    const files = await readdir(dir);
    const map = new Map();
    for (const f of files) {
      if (IMAGE_EXTS.has(extname(f).toLowerCase())) {
        // key = basename without extension → maps to full filename
        map.set(basename(f, extname(f)).toLowerCase(), f);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

async function scanThumbDir(folder) {
  const dir = join(THUMBS_DIR, folder);
  const files = await readdir(dir);
  return files
    .filter(f => IMAGE_EXTS.has(extname(f).toLowerCase()))
    .sort();
}

async function main() {
  const folders = await discoverFolders();
  console.error(`Scanning ${folders.length} folders...`);

  const manifest = {};
  let totalFiles = 0;

  for (const folder of folders) {
    const thumbs = await scanThumbDir(folder);
    const fullMap = await scanFullDir(folder);

    if (thumbs.length === 0) continue;

    const entries = [];
    for (const thumb of thumbs) {
      const baseName = basename(thumb, extname(thumb)).toLowerCase();
      const fullFile = fullMap.get(baseName) || thumb; // fallback to thumb name
      entries.push({ t: thumb, f: fullFile });
    }

    manifest[folder] = entries;
    totalFiles += entries.length;
  }

  const json = JSON.stringify(manifest, null, 2) + '\n';
  console.error(`Generated manifest: ${Object.keys(manifest).length} folders, ${totalFiles} files`);

  if (stdoutMode) {
    process.stdout.write(json);
  } else {
    const target = outPath || DEFAULT_OUT;
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, json);
    console.error(`Written to: ${target}`);
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
