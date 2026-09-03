/**
 * Serves the static docs export under a path prefix, so a build made for GitHub
 * Pages (basePath '/kliveide', or a preview path) can be smoke-tested locally
 * exactly as it will be served.
 *
 * `npx serve docs/out` cannot do this: it always mounts at '/', so every asset
 * URL 404s and basePath regressions stay invisible until they reach production.
 *
 * Usage:
 *   node scripts/serve-docs.cjs                              # mounts at /kliveide
 *   node scripts/serve-docs.cjs --prefix /kliveide/preview/x
 *   node scripts/serve-docs.cjs --prefix '' --port 4000
 */
const { createServer } = require("node:http");
const { existsSync, createReadStream, statSync } = require("node:fs");
const { join, extname, normalize } = require("node:path");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".zip": "application/zip",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

const root = join(__dirname, "..", "docs", "out");
const prefix = argValue("--prefix", "/kliveide").replace(/\/$/, "");
const port = Number(argValue("--port", "3000"));

/** Maps a request path to a file on disk, honouring trailingSlash-style exports. */
function resolveFile(urlPath) {
  const candidates = [urlPath, join(urlPath, "index.html"), `${urlPath}.html`];
  for (const candidate of candidates) {
    const full = normalize(join(root, candidate));
    if (!full.startsWith(root)) continue; // path traversal guard
    if (existsSync(full) && statSync(full).isFile()) return full;
  }
  return null;
}

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);

  if (prefix && !urlPath.startsWith(prefix + "/") && urlPath !== prefix) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end(`Not served here. This site is mounted at ${prefix}/\n`);
    console.log(`404 (outside prefix) ${urlPath}`);
    return;
  }

  const file = resolveFile(prefix ? urlPath.slice(prefix.length) || "/" : urlPath);
  if (!file) {
    const notFound = join(root, "404.html");
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    if (existsSync(notFound)) createReadStream(notFound).pipe(res);
    else res.end("404\n");
    console.log(`404 ${urlPath}`);
    return;
  }

  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
});

if (!existsSync(root)) {
  console.error(`No build output at ${root}. Run 'npm run doc:build' first.`);
  process.exit(1);
}

server.listen(port, () => {
  console.log(`Serving docs/out at http://localhost:${port}${prefix}/`);
  console.log("Requests outside the prefix return 404, mirroring GitHub Pages.");
});
