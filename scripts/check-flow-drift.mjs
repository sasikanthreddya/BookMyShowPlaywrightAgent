#!/usr/bin/env node
/**
 * Flow -> feature drift check.
 *
 * Nothing in this repo compiles flows/*.md into features/*.feature -- that
 * conversion is a human/agent step. So a feature can silently fall behind its
 * flow and the suite still goes green, which is worse than going red: you get
 * a passing run over incomplete coverage.
 *
 * This makes that gap loud. Each feature records the SHA-256 of the flow it
 * was generated from:
 *
 *     # flow-sha: <64 hex>
 *
 * Edit the flow -> hash no longer matches -> this fails. Regenerate the
 * feature, then re-record with `npm run flows:bless`.
 *
 * Content hashing, not mtimes: a git checkout rewrites mtimes and would give
 * false alarms. Line endings are normalised so CRLF/LF checkouts agree.
 *
 *   node scripts/check-flow-drift.mjs            # check, exit 1 on drift
 *   node scripts/check-flow-drift.mjs --write    # re-record hashes (bless)
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const FLOWS_DIR = "flows";
const FEATURES_DIR = "features";
const SHA_RE = /^[ \t]*#[ \t]*flow-sha:[ \t]*([0-9a-f]{64})\b.*$/im;
const write = process.argv.includes("--write");

const norm = (s) => s.replace(/\r\n/g, "\n").replace(/\s+$/, "");
const sha = (s) => createHash("sha256").update(norm(s), "utf8").digest("hex");

/** Numbered steps in a flow: lines like "3) Click on Movies tab". */
const countFlowSteps = (s) => (norm(s).match(/^[ \t]*\d+\)/gm) || []).length;

/** Executable Gherkin steps in a feature. */
const countGherkinSteps = (s) =>
  (norm(s).match(/^[ \t]*(Given|When|Then|And|But)[ \t]+\S/gm) || []).length;

if (!existsSync(FLOWS_DIR)) {
  console.error(`No ${FLOWS_DIR}/ directory — nothing to check.`);
  process.exit(0);
}

const flows = readdirSync(FLOWS_DIR).filter((f) => f.endsWith(".md")).sort();
const problems = [];
const ok = [];
let blessed = 0;

for (const file of flows) {
  const service = basename(file, ".md");
  const flowPath = join(FLOWS_DIR, file);
  const featurePath = join(FEATURES_DIR, `${service}.feature`);
  const flowSrc = readFileSync(flowPath, "utf8");
  const expected = sha(flowSrc);
  const counts = `flow has ${countFlowSteps(flowSrc)} numbered step(s)`;

  if (!existsSync(featurePath)) {
    problems.push(
      `MISSING  ${service}\n` +
        `    ${flowPath} exists but ${featurePath} does not (${counts}).\n` +
        `    Fix: /update-feature ${service}`,
    );
    continue;
  }

  const featureSrc = readFileSync(featurePath, "utf8");
  const found = SHA_RE.exec(featureSrc)?.[1];
  const detail = `${counts}; ${featurePath} has ${countGherkinSteps(featureSrc)} Gherkin step(s)`;

  if (write) {
    const line = `# flow-sha: ${expected}  (${flowPath} — regenerate with /update-feature ${service})`;
    const next = found
      ? featureSrc.replace(SHA_RE, line)
      : `${line}\n${featureSrc.replace(/^﻿/, "")}`;
    if (next !== featureSrc) {
      writeFileSync(featurePath, next);
      console.log(`blessed  ${service}  -> ${expected.slice(0, 12)}…`);
      blessed++;
    } else {
      console.log(`current  ${service}`);
    }
    continue;
  }

  if (!found) {
    problems.push(
      `UNTRACKED  ${service}\n` +
        `    ${featurePath} records no flow-sha, so drift cannot be detected.\n` +
        `    ${detail}\n` +
        `    Fix: confirm the feature covers the whole flow, then: npm run flows:bless`,
    );
  } else if (found !== expected) {
    problems.push(
      `DRIFT  ${service}\n` +
        `    ${flowPath} changed since ${featurePath} was generated.\n` +
        `    recorded ${found.slice(0, 12)}…  actual ${expected.slice(0, 12)}…\n` +
        `    ${detail}\n` +
        `    Fix: /update-feature ${service}   then: npm run flows:bless`,
    );
  } else {
    ok.push(service);
  }
}

// Features with no originating flow: worth knowing, not worth failing over.
const orphans = existsSync(FEATURES_DIR)
  ? readdirSync(FEATURES_DIR)
      .filter((f) => f.endsWith(".feature"))
      .map((f) => basename(f, ".feature"))
      .filter((s) => !flows.includes(`${s}.md`))
  : [];

if (write) {
  console.log(`\n${blessed} feature(s) re-recorded.`);
  process.exit(0);
}

for (const s of ok) console.log(`in sync  ${s}`);
for (const s of orphans) console.log(`note     ${s}.feature has no flows/${s}.md`);

if (problems.length) {
  console.error(`\n${"-".repeat(72)}`);
  console.error(`Flow/feature drift: ${problems.length} problem(s)\n`);
  console.error(problems.join("\n\n"));
  console.error(
    `\nA green test run does NOT mean the flows are covered. Resolve the above,` +
      `\nor run a tag-filtered suite (npm run test:smoke) to iterate meanwhile.`,
  );
  console.error(`${"-".repeat(72)}`);
  process.exit(1);
}

console.log(`\nAll ${ok.length} flow(s) in sync with their features.`);
