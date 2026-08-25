// Build guard: fails the deployment when the produced SSR bundle cannot boot
// and serve "/". Catches Rolldown chunking regressions (e.g. the
// `TypeError: __exportAll is not a function` class of failure) that `vite build`
// itself reports as a success.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();

function findServerEntry() {
  const candidates = [
    ".output/server/index.mjs",
    ".output/server/index.js",
    "dist/server/server.js",
    "dist/server/index.mjs",
  ];
  for (const candidate of candidates) {
    const full = resolve(root, candidate);
    if (existsSync(full)) return full;
  }
  return null;
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(mjs|js)$/.test(name)) out.push(full);
  }
  return out;
}

// 1. Static check: any interop helper that is referenced but never declared.
const HELPERS = ["__exportAll", "__toESM", "__commonJS", "__commonJSMin", "__export", "__require"];
const serverFiles = [
  ...walk(resolve(root, ".output/server")),
  ...walk(resolve(root, "dist/server")),
];
let staticFailures = 0;
for (const file of serverFiles) {
  const code = readFileSync(file, "utf8");
  for (const helper of HELPERS) {
    // Rolldown may deconflict a reference as `__exportAll$1`; a trailing
    // identifier char (e.g. `__commonJSMin`) means it is a different symbol.
    const ref = new RegExp(`\\b${helper}(?:\\$\\d+)?(?![A-Za-z0-9_$])`);
    if (!ref.test(code)) continue;
    const declared = new RegExp(
      `(?:var|let|const|function|class)\\s+${helper}(?:\\$\\d+)?(?![A-Za-z0-9_$])`,
    ).test(code);
    // Helpers live in a shared runtime chunk and are imported (often renamed),
    // so an import binding counts as a valid declaration.
    const imported = new RegExp(
      `as\\s+${helper}(?:\\$\\d+)?(?![A-Za-z0-9_$])|\\{[^}]*\\b${helper}(?:\\$\\d+)?\\s*[,}]`,
    ).test(code);
    if (!declared && !imported) {
      console.error(`[verify-ssr] ${helper} is referenced but never declared in ${file}`);
      staticFailures++;
    }
  }
}

// 2. Runtime check: boot the SSR entry and render "/".
const entry = findServerEntry();
if (!entry) {
  console.error("[verify-ssr] no SSR server entry found in .output/server or dist/server");
  process.exit(1);
}

let runtimeFailure = null;
try {
  const mod = await import(pathToFileURL(entry).href);
  const handler = mod.default ?? mod;
  const fetchFn = typeof handler === "function" ? handler : handler?.fetch;
  if (typeof fetchFn !== "function") {
    // Some nitro presets start a listening server on import instead of
    // exporting a fetch handler; probe over HTTP in that case.
    const port = process.env["PORT"] ?? "3000";
    const res = await fetch(`http://127.0.0.1:${port}/`);
    if (res.status >= 500) runtimeFailure = `GET / returned ${res.status}`;
  } else {
    const ctx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
      props: {},
    };
    const res = await fetchFn(new Request("http://localhost/"), { ...process.env }, ctx);
    const body = await res.text();
    if (res.status >= 500) runtimeFailure = `GET / returned ${res.status}: ${body.slice(0, 500)}`;
    else if (/is not a function|ReferenceError/.test(body))
      runtimeFailure = `GET / body contains a runtime error: ${body.slice(0, 500)}`;
  }
} catch (error) {
  runtimeFailure = `SSR entry failed to boot: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`;
}

if (runtimeFailure) console.error(`[verify-ssr] ${runtimeFailure}`);

if (staticFailures > 0 || runtimeFailure) {
  console.error("[verify-ssr] SSR bundle verification FAILED — refusing to ship this build.");
  process.exit(1);
}

console.error(`[verify-ssr] OK — ${entry} boots and serves / without SSR errors.`);
process.exit(0);
