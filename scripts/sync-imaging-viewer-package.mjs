#!/usr/bin/env node
/**
 * Sync @franchir/imaging-viewer (SoT = tracker) → questionnaires vendor copy,
 * and install/check codec assets (dwv-workers + OpenJPEG) into app public/.
 *
 * Usage:
 *   node scripts/sync-imaging-viewer-package.mjs
 *   node scripts/sync-imaging-viewer-package.mjs --target /path/to/Franchir_Questionnaires_Patients
 *   node scripts/sync-imaging-viewer-package.mjs --check
 *   node scripts/sync-imaging-viewer-package.mjs --check --target .
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
const SRC = path.join(TRACKER_ROOT, "packages", "imaging-viewer");
const ASSETS_SRC = path.join(SRC, "assets");

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
/** Skip questionnaires pin even if sibling checkout exists (CI / parallel lanes). */
const trackerOnly = args.includes("--tracker-only");
const targetIdx = args.indexOf("--target");
const qRootArg =
  targetIdx >= 0 && args[targetIdx + 1]
    ? path.resolve(args[targetIdx + 1])
    : null;
const qRoot =
  qRootArg ?? path.resolve(TRACKER_ROOT, "..", "Franchir_Questionnaires_Patients");

const DEST = path.join(qRoot, "packages", "imaging-viewer");

const PUBLIC_ASSET_DIRS = ["dwv-workers", "openjpeg"];

function fail(msg) {
  console.error(`imaging-viewer:sync FAIL: ${msg}`);
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

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

/**
 * Contenu stable pour le digest pin : ignore `generatedAt` du MANIFEST
 * (sinon chaque sync fait dériver le sha même si les binaires sont inchangés).
 */
function stableFileBytes(filePath, rel) {
  const raw = readFileSync(filePath);
  if (rel !== "assets/MANIFEST.json") return raw;
  try {
    const manifest = JSON.parse(raw.toString("utf8"));
    const files = manifest.files ?? {};
    const keys = Object.keys(files).sort();
    const normalized = {
      files: Object.fromEntries(keys.map((k) => [k, files[k]])),
    };
    return Buffer.from(`${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  } catch {
    return raw;
  }
}

function hashTree(root) {
  const files = listFiles(root);
  const h = createHash("sha256");
  for (const rel of files) {
    if (rel === "PINNED_FROM") continue;
    h.update(rel);
    h.update("\0");
    h.update(stableFileBytes(path.join(root, rel), rel));
    h.update("\0");
  }
  return { files: files.filter((f) => f !== "PINNED_FROM"), digest: h.digest("hex") };
}

function readVersion(pkgDir) {
  const pkg = JSON.parse(readFileSync(path.join(pkgDir, "package.json"), "utf8"));
  return pkg.version;
}

function listAssetFiles() {
  if (!existsSync(ASSETS_SRC)) fail(`missing assets SoT at ${ASSETS_SRC}`);
  // Docs stay in package; only codec binaries are installed into public/.
  return listFiles(ASSETS_SRC).filter(
    (rel) =>
      rel !== "MANIFEST.json" &&
      !rel.endsWith(".md") &&
      !rel.endsWith(".MD"),
  );
}

function computeAssetFiles() {
  const files = listAssetFiles();
  return Object.fromEntries(
    files.map((rel) => [rel, sha256File(path.join(ASSETS_SRC, rel))]),
  );
}

function writeAssetsManifest() {
  const files = computeAssetFiles();
  const manifestPath = path.join(ASSETS_SRC, "MANIFEST.json");
  let generatedAt = new Date().toISOString();
  if (existsSync(manifestPath)) {
    try {
      const prev = JSON.parse(readFileSync(manifestPath, "utf8"));
      const prevFiles = prev.files ?? {};
      const same =
        Object.keys(files).length === Object.keys(prevFiles).length &&
        Object.keys(files).every((k) => prevFiles[k] === files[k]);
      if (same && typeof prev.generatedAt === "string") {
        generatedAt = prev.generatedAt;
      }
    } catch {
      /* rewrite with fresh timestamp */
    }
  }
  const manifest = { generatedAt, files };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

function checkAssetsManifest() {
  const computed = computeAssetFiles();
  const manifestPath = path.join(ASSETS_SRC, "MANIFEST.json");
  if (!existsSync(manifestPath)) {
    fail("missing assets/MANIFEST.json — run npm run imaging-viewer:sync once");
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const listed = manifest.files ?? {};
  const keys = new Set([...Object.keys(computed), ...Object.keys(listed)]);
  const drifts = [];
  for (const rel of keys) {
    if (!listed[rel]) drifts.push(`${rel}: missing from MANIFEST.json`);
    else if (!computed[rel]) drifts.push(`${rel}: in MANIFEST but missing on disk`);
    else if (listed[rel] !== computed[rel]) drifts.push(`${rel}: MANIFEST checksum stale`);
  }
  if (drifts.length) {
    fail(
      `assets MANIFEST drift:\n  - ${drifts.join("\n  - ")} — run npm run imaging-viewer:sync`,
    );
  }
  return Object.keys(computed).length;
}

function installAssets(appRoot) {
  const publicRoot = path.join(appRoot, "public");
  mkdirSync(publicRoot, { recursive: true });
  for (const dir of PUBLIC_ASSET_DIRS) {
    const from = path.join(ASSETS_SRC, dir);
    const to = path.join(publicRoot, dir);
    if (!existsSync(from)) fail(`missing asset dir ${from}`);
    rmSync(to, { recursive: true, force: true });
    mkdirSync(path.dirname(to), { recursive: true });
    cpSync(from, to, { recursive: true });
  }
}

function checkAssets(appRoot, label) {
  const publicRoot = path.join(appRoot, "public");
  const expected = listAssetFiles();
  const drifts = [];
  for (const rel of expected) {
    const want = sha256File(path.join(ASSETS_SRC, rel));
    const full = path.join(publicRoot, rel);
    if (!existsSync(full)) {
      drifts.push(`${rel}: missing in ${label} public/`);
      continue;
    }
    const got = sha256File(full);
    if (got !== want) drifts.push(`${rel}: checksum drift (${label})`);
  }
  if (drifts.length) {
    fail(
      `codec assets drift vs packages/imaging-viewer/assets (${label}):\n  - ${drifts.join("\n  - ")} — run npm run imaging-viewer:sync`,
    );
  }
  return expected.length;
}

function hashSoTProjection(destRoot, sotFiles) {
  const h = createHash("sha256");
  for (const rel of sotFiles) {
    const full = path.join(destRoot, rel);
    if (!existsSync(full)) fail(`questionnaires missing file: ${rel}`);
    h.update(rel);
    h.update("\0");
    h.update(stableFileBytes(full, rel));
    h.update("\0");
  }
  return h.digest("hex");
}

if (!existsSync(SRC)) fail(`missing SoT at ${SRC}`);

const srcVersion = readVersion(SRC);
const qExists = existsSync(qRoot);

if (checkOnly) {
  const assetCount = checkAssetsManifest();
  const srcHash = hashTree(SRC);
  const trackerAssetCount = checkAssets(TRACKER_ROOT, "tracker");

  if (qExists && !trackerOnly) {
    if (!existsSync(DEST)) fail(`questionnaires copy missing: ${DEST}`);
    const destVersion = readVersion(DEST);
    if (srcVersion !== destVersion) {
      fail(`version drift SoT=${srcVersion} Q=${destVersion} — run npm run imaging-viewer:sync`);
    }
    const destDigest = hashSoTProjection(DEST, srcHash.files);
    if (srcHash.digest !== destDigest) {
      fail(`content drift (sha256) — run npm run imaging-viewer:sync`);
    }
    const qAssetCount = checkAssets(qRoot, "questionnaires");
    console.info(
      JSON.stringify({
        ok: true,
        version: srcVersion,
        files: srcHash.files.length,
        digest: srcHash.digest.slice(0, 12),
        assets: {
          count: assetCount,
          trackerPublic: trackerAssetCount,
          questionnairesPublic: qAssetCount,
        },
      }),
    );
  } else if (qRootArg) {
    fail(`questionnaires root not found: ${qRoot}`);
  } else {
    console.info(
      JSON.stringify({
        ok: true,
        version: srcVersion,
        files: srcHash.files.length,
        digest: srcHash.digest.slice(0, 12),
        assets: {
          count: assetCount,
          trackerPublic: trackerAssetCount,
          questionnairesSkipped: true,
        },
      }),
    );
  }
  process.exit(0);
}

if (!qExists) fail(`questionnaires root not found: ${qRoot}`);

const assetManifest = writeAssetsManifest();
installAssets(TRACKER_ROOT);

mkdirSync(path.dirname(DEST), { recursive: true });
rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
cpSync(SRC, DEST, { recursive: true });

writeFileSync(
  path.join(DEST, "PINNED_FROM"),
  `source=franchir-patient-tracker\nversion=${srcVersion}\nsyncedAt=${new Date().toISOString()}\n`,
  "utf8",
);

installAssets(qRoot);

const after = hashTree(DEST);
console.info(
  JSON.stringify({
    synced: true,
    version: srcVersion,
    target: DEST,
    files: after.files.length,
    digest: after.digest.slice(0, 12),
    assetsInstalled: {
      tracker: path.join(TRACKER_ROOT, "public"),
      questionnaires: path.join(qRoot, "public"),
      count: Object.keys(assetManifest.files).length,
    },
  }),
);
