// Build guard: fails the deployment when the produced SSR bundle cannot boot
// and serve "/". Catches Rolldown chunking regressions (e.g. the
// `TypeError: __exportAll is not a function` class of failure) that `vite build`
// itself reports as a success.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();

const SERVER_DIRS = [
  ".vercel/output/functions/__server.func",
  ".output/server",
  "dist/server",
];

function findServerEntry() {
  const candidates = [
    // Vercel Nitro preset output (what Vercel actually deploys).
    ".vercel/output/functions/__server.func/index.mjs",
    ".vercel/output/functions/__server.func/index.js",
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
const serverFiles = SERVER_DIRS.flatMap((dir) => walk(resolve(root, dir)));

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
  console.error(`[verify-ssr] no SSR server entry found in: ${SERVER_DIRS.join(", ")}`);
  process.exit(1);
}

// Vercel's Nitro preset emits a Node-style (req, res) handler; the Cloudflare
// preset emits a { fetch } / fetch-style handler. Support both.
async function probeNodeHandler(nodeHandler) {
  const { createServer } = await import("node:http");
  const server = createServer((req, res) => {
    try {
      const maybe = nodeHandler(req, res);
      if (maybe && typeof maybe.catch === "function") {
        maybe.catch((error) => {
          if (!res.headersSent) res.statusCode = 500;
          res.end(String(error?.stack ?? error));
        });
      }
    } catch (error) {
      if (!res.headersSent) res.statusCode = 500;
      res.end(String(error?.stack ?? error));
    }
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/`);
    const body = await res.text();
    console.error(`[verify-ssr] GET / -> ${res.status}`);
    if (res.status >= 500) return `GET / returned ${res.status}: ${body.slice(0, 500)}`;
    if (/is not a function|ReferenceError/.test(body))
      return `GET / body contains a runtime error: ${body.slice(0, 500)}`;
    return null;
  } finally {
    await new Promise((ok) => server.close(ok));
  }
}

let runtimeFailure = null;
try {
  const mod = await import(pathToFileURL(entry).href);
  const handler = mod.default ?? mod;
  const candidate = typeof handler === "function" ? handler : handler?.fetch;
  if (typeof candidate !== "function") {
    runtimeFailure = "SSR entry exports neither a fetch handler nor a request handler function";
  } else {
    const ctx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
      props: {},
    };
    let res;
    try {
      res = await candidate(new Request("http://localhost/"), { ...process.env }, ctx);
    } catch {
      res = undefined;
    }
    if (res && typeof res.text === "function" && typeof res.status === "number") {
      const body = await res.text();
      console.error(`[verify-ssr] GET / -> ${res.status}`);
      if (res.status >= 500) runtimeFailure = `GET / returned ${res.status}: ${body.slice(0, 500)}`;
      else if (/is not a function|ReferenceError/.test(body))
        runtimeFailure = `GET / body contains a runtime error: ${body.slice(0, 500)}`;
    } else {
      // Not a fetch handler — treat it as a Node (req, res) handler.
      runtimeFailure = await probeNodeHandler(candidate);
    }
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
