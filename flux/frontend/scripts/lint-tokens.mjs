#!/usr/bin/env node
// Lint for raw Tailwind colors that bypass Obsidian Plasma tokens.
// Run: node frontend/scripts/lint-tokens.mjs
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "..", "src");
const BANNED = [
  /bg-green-500(?!\/)/,
  /bg-red-500(?!\/)/,
  /bg-amber-500(?!\/)/,
  /text-green-500/,
  /text-red-500/,
  /text-amber-500/,
  /text-zinc-\d+/,
  /bg-zinc-\d+/,
  /bg-indigo-\d+/,
  /text-indigo-\d+/,
  /text-emerald-\d+/,
  /bg-emerald-\d+/,
];

function walk(dir, files = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, files);
    else if (p.endsWith(".tsx") || p.endsWith(".ts")) files.push(p);
  }
  return files;
}

let violations = 0;
for (const file of walk(ROOT)) {
  const content = readFileSync(file, "utf8");
  for (const re of BANNED) {
    if (re.test(content)) {
      const rel = file.replace(ROOT, "src");
      console.error(`[token-lint] ${rel}: found ${re}`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} token violations — use bg-success/danger/warn/cyan, text-success/danger, not raw Tailwind green-500/zinc.`);
  process.exit(1);
} else {
  console.log("token lint: ok — no raw Tailwind colors outside Obsidian Plasma tokens.");
}
