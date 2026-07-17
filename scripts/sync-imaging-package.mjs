#!/usr/bin/env node
/**
 * Sync @franchir/imaging (SoT = tracker) → questionnaires vendor copy.
 *
 * Usage:
 *   node scripts/sync-imaging-package.mjs
 *   node scripts/sync-imaging-package.mjs --target /path/to/Franchir_Questionnaires_Patients
 *   node scripts/sync-imaging-package.mjs --check
 */

import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRACKER_ROOT = path.resolve(__dirname, "..");
const SRC = path.join(TRACKER_ROOT, "packages", "imaging");

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const targetIdx = args.indexOf("--target");
const qRoot =
  targetIdx >= 0 && args[targetIdx + 1]
    ? path.resolve(args[targetIdx + 1])
    : path.resolve(TRACKER_ROOT, "..", "Franchir_Questionnaires_Patients");

const DEST = path.join(qRoot, "packages", "imaging");

function fail(msg) {
  console.error(`imaging:sync FAIL: ${msg}`);
  process.exit(1);
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.endsWith(" 2")) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full));
  }
  return out.sort();
}

function hashTree(root) {
  const files = listFiles(root);
  const h = createHash("sha256");
  for (const rel of files) {
    if (rel === "PINNED_FROM") continue;
    h.update(rel);
    h.update("\0");
    h.update(readFileSync(path.join(root, rel)));
    h.update("\0");
  }
  return { files: files.filter((f) => f !== "PINNED_FROM"), digest: h.digest("hex") };
}

function readVersion(pkgDir) {
  const pkg = JSON.parse(readFileSync(path.join(pkgDir, "package.json"), "utf8"));
  return pkg.version;
}

if (!existsSync(SRC)) fail(`missing SoT at ${SRC}`);
if (!existsSync(qRoot)) fail(`questionnaires root not found: ${qRoot}`);

const srcVersion = readVersion(SRC);
const srcHash = hashTree(SRC);

function hashSoTProjection(destRoot, sotFiles) {
  const h = createHash("sha256");
  for (const rel of sotFiles) {
    const full = path.join(destRoot, rel);
    if (!existsSync(full)) fail(`questionnaires missing file: ${rel}`);
    h.update(rel);
    h.update("\0");
    h.update(readFileSync(full));
    h.update("\0");
  }
  return h.digest("hex");
}

if (checkOnly) {
  if (!existsSync(DEST)) fail(`questionnaires copy missing: ${DEST}`);
  const destVersion = readVersion(DEST);
  if (srcVersion !== destVersion) {
    fail(`version drift SoT=${srcVersion} Q=${destVersion} — run npm run imaging:sync`);
  }
  const destDigest = hashSoTProjection(DEST, srcHash.files);
  if (srcHash.digest !== destDigest) {
    fail(`content drift (sha256) — run npm run imaging:sync`);
  }
  console.info(
    JSON.stringify({
      ok: true,
      version: srcVersion,
      files: srcHash.files.length,
      digest: srcHash.digest.slice(0, 12),
    }),
  );
  process.exit(0);
}

mkdirSync(path.dirname(DEST), { recursive: true });
rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
cpSync(SRC, DEST, { recursive: true });

writeFileSync(
  path.join(DEST, "PINNED_FROM"),
  `source=franchir-patient-tracker\nversion=${srcVersion}\nsyncedAt=${new Date().toISOString()}\n`,
  "utf8",
);

const after = hashTree(DEST);
console.info(
  JSON.stringify({
    synced: true,
    version: srcVersion,
    target: DEST,
    files: after.files.length,
    digest: after.digest.slice(0, 12),
  }),
);
