#!/usr/bin/env node
/**
 * P2.2c — Golden tour Franchir Imaging (non-PHI, fixture-based).
 *
 * Orchestrates package unit tests + asset MANIFEST / pin checks that map to
 * the product checklist (grouping, OpenJPEG policy, DOC PDF, localizer, workers).
 *
 * Usage:
 *   node scripts/imaging-golden-tour.mjs
 *   node scripts/imaging-golden-tour.mjs --ci
 *   node scripts/imaging-golden-tour.mjs --full
 *   node scripts/imaging-golden-tour.mjs --checks-only
 *   npm run imaging:golden-tour
 *
 * Flags:
 *   --ci           Skip sibling imaging:check (no Q checkout in CI)
 *   --full         Run full test:imaging + test:imaging-viewer (not focused files)
 *   --checks-only  Only imaging-viewer:check (+ imaging:check if sibling present)
 *   --require-sibling  Fail if questionnaires root missing (imaging:check)
 *
 * No PHI. No live patient data. No network.
 */

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRACKER_ROOT = path.resolve(__dirname, "..");
const Q_ROOT = path.resolve(TRACKER_ROOT, "..", "Franchir_Questionnaires_Patients");

const args = process.argv.slice(2);
const ci = args.includes("--ci") || process.env.CI === "true";
const full = args.includes("--full");
const checksOnly = args.includes("--checks-only");
const requireSibling = args.includes("--require-sibling");

/** Checklist → fixture / check (durable, non-PHI). */
const CHECKLIST = [
  {
    id: "grouping-tania-fatima",
    title: "Grouping Tania (~11) / Fatima (~42 SUID product target)",
    fixtures: [
      "packages/imaging/src/tania-series-metadata.test.ts",
      "packages/imaging/src/dicom-series-group.fatima.test.ts",
      "packages/imaging-viewer/src/golden-parity.test.ts",
    ],
    note: "Unit fixtures are synthetic; literal ~11 / ~42 series counts remain e2e/manual (PRODUCT.md).",
  },
  {
    id: "openjpeg-jpeg2000",
    title: "OpenJPEG path for JPEG2000",
    fixtures: [
      "packages/imaging-viewer/src/policy.test.ts",
      "packages/imaging-viewer/src/exports-contract.test.ts",
    ],
    note: "Policy gate + exports + asset presence; full WASM decode is host/manual.",
  },
  {
    id: "doc-pdf-band",
    title: "DOC PDF band",
    fixtures: [
      "packages/imaging/src/dicom-series-group.fatima.test.ts",
      "packages/imaging-viewer/src/encapsulated-pdf.test.ts",
    ],
    note: "Listing band heuristic (@franchir/imaging) + extract (@franchir/imaging-viewer).",
  },
  {
    id: "localizer-multi-plane",
    title: "Localizer multi-plane message policy",
    fixtures: [
      "packages/imaging-viewer/src/policy.test.ts",
      "packages/imaging-viewer/src/golden-parity.test.ts",
    ],
    note: "SEQUENTIAL_LOCALIZER_ORIENTATION_MSG via orientationFallbackMessage.",
  },
  {
    id: "worker-manifest",
    title: "Worker / OpenJPEG asset MANIFEST integrity",
    check: "imaging-viewer:check",
    note: "packages/imaging-viewer/assets/MANIFEST.json + public/ install parity.",
  },
  {
    id: "package-pins",
    title: "imaging-viewer:check + imaging:check (sibling pin)",
    check: "imaging:check",
    note: "imaging:check requires Franchir_Questionnaires_Patients sibling (skipped in --ci).",
  },
];

const FOCUSED_VITEST = [
  "packages/imaging/src/tania-series-metadata.test.ts",
  "packages/imaging/src/dicom-series-group.fatima.test.ts",
  "packages/imaging-viewer/src/golden-parity.test.ts",
  "packages/imaging-viewer/src/policy.test.ts",
  "packages/imaging-viewer/src/encapsulated-pdf.test.ts",
  "packages/imaging-viewer/src/exports-contract.test.ts",
];

function fail(msg) {
  console.error(`imaging-golden-tour FAIL: ${msg}`);
  process.exit(1);
}

function run(label, command, commandArgs) {
  console.log(`\n▶ ${label}`);
  console.log(`  $ ${command} ${commandArgs.join(" ")}`);
  const result = spawnSync(command, commandArgs, {
    cwd: TRACKER_ROOT,
    stdio: "inherit",
    env: process.env,
    shell: false,
  });
  if (result.error) fail(`${label}: ${result.error.message}`);
  if (result.status !== 0) fail(`${label}: exit ${result.status}`);
  return { label, ok: true };
}

function siblingPresent() {
  return existsSync(path.join(Q_ROOT, "packages", "imaging"));
}

function main() {
  const started = Date.now();
  const steps = [];
  const qPresent = siblingPresent();

  console.log("Franchir Imaging — golden tour (non-PHI)");
  console.log(`root=${TRACKER_ROOT}`);
  console.log(
    `flags: ci=${ci} full=${full} checksOnly=${checksOnly} requireSibling=${requireSibling}`,
  );
  console.log(`questionnairesSibling=${qPresent ? Q_ROOT : "absent"}`);

  if (!checksOnly) {
    if (full) {
      steps.push(run("test:imaging", "npm", ["run", "test:imaging"]));
      steps.push(run("test:imaging-viewer", "npm", ["run", "test:imaging-viewer"]));
    } else {
      // Focused fixtures only (faster local iteration; still covers checklist).
      const vitestArgs = [
        "vitest",
        "run",
        "--config",
        "vitest.config.mts",
        ...FOCUSED_VITEST.filter((p) => {
          // Skip non-test path if someone listed a source module by mistake
          return p.endsWith(".test.ts") && existsSync(path.join(TRACKER_ROOT, p));
        }),
      ];
      steps.push(run("vitest focused golden fixtures", "npx", vitestArgs));
    }
  }

  if (ci) {
    // Tracker SoT + public assets only — ignore Q sibling pin drift (parallel lanes / no Q checkout).
    steps.push(
      run("imaging-viewer:check (tracker-only)", "node", [
        "scripts/sync-imaging-viewer-package.mjs",
        "--check",
        "--tracker-only",
      ]),
    );
  } else {
    steps.push(run("imaging-viewer:check", "npm", ["run", "imaging-viewer:check"]));
  }

  let imagingCheck = "skipped";
  if (ci && !requireSibling) {
    imagingCheck = "skipped_ci";
    console.log("\n⏭ imaging:check skipped (--ci / CI=true; no Q checkout expected)");
  } else if (qPresent) {
    steps.push(run("imaging:check", "npm", ["run", "imaging:check"]));
    imagingCheck = "ok";
  } else if (requireSibling) {
    fail("imaging:check required but questionnaires sibling missing at " + Q_ROOT);
  } else {
    imagingCheck = "skipped_no_sibling";
    console.log("\n⏭ imaging:check skipped (questionnaires sibling not found)");
  }

  const summary = {
    ok: true,
    durationMs: Date.now() - started,
    mode: checksOnly ? "checks-only" : full ? "full" : "focused",
    ci,
    questionnairesSibling: qPresent,
    imagingCheck,
    steps: steps.map((s) => s.label),
    checklist: CHECKLIST.map((c) => ({
      id: c.id,
      title: c.title,
      note: c.note,
      fixtures: c.fixtures ?? null,
      check: c.check ?? null,
    })),
  };

  console.log("\n✔ imaging-golden-tour OK");
  console.log(JSON.stringify(summary, null, 2));
}

main();
