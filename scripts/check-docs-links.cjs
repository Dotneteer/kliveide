/**
 * Audits the built documentation site for broken internal links and images.
 *
 * Walks every exported .html file and resolves each same-origin href/src against
 * the files actually on disk, mirroring how GitHub Pages serves them (trailing
 * slash -> index.html, and the basePath the site was built with).
 *
 * External links are not fetched - this is a fast, offline, deterministic check
 * meant to run in CI on every docs build.
 *
 * A link to an old address listed in docs/redirects.json also fails, although it resolves (to
 * the redirect stub): a page links the page itself. `next dev` writes no stubs, so such a link is
 * a "missing param in generateStaticParams" error there, and a visitor takes an extra hop here.
 *
 * Usage: node scripts/check-docs-links.cjs [--verbose]
 */
const { existsSync, readdirSync, readFileSync, statSync } = require("node:fs");
const { join, normalize, relative, sep } = require("node:path");

const repoRoot = join(__dirname, "..");
const outDir = join(repoRoot, "docs", "out");

/** Reads the basePath the site was built with from any page's asset URLs. */
function detectBasePath() {
  const home = join(outDir, "index.html");
  const m = readFileSync(home, "utf8").match(/href="([^"]*)\/_next\/static\//);
  return m ? m[1] : "";
}

function htmlFiles(dir) {
  const found = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name.endsWith(".html")) found.push(full);
    }
  };
  visit(dir);
  return found;
}

/** True if a site-absolute path resolves to a file the static host would serve. */
function resolves(sitePath) {
  let clean = sitePath.split("#")[0].split("?")[0];
  // Asset URLs are percent-encoded (the catch-all route chunk is emitted as
  // %5B%5B...mdxPath%5D%5D), but the files on disk are not.
  try {
    clean = decodeURIComponent(clean);
  } catch {
    /* leave as-is if it is not valid percent-encoding */
  }
  const candidates = [clean, join(clean, "index.html"), `${clean}.html`];
  return candidates.some((c) => {
    const full = normalize(join(outDir, c));
    return full.startsWith(outDir) && existsSync(full) && statSync(full).isFile();
  });
}

/** The URL a built file is served at: `a/b/index.html` -> `/a/b/`, `a/c.html` -> `/a/c`. */
function servedUrl(page, basePath) {
  const url = page.endsWith("/index.html")
    ? page.slice(0, -"index.html".length)
    : page.replace(/\.html$/, "");
  return basePath + url;
}

/** Resolves a relative href against a site-absolute page URL, keeping the fragment. */
function resolveRelative(href, pageUrl) {
  const u = new URL(href, `http://site${pageUrl}`);
  return u.pathname + u.hash;
}

/** Old addresses (docs/redirects.json keys), normalized to a trailing slash, with their new ones */
function redirectSources() {
  const file = join(repoRoot, "docs", "redirects.json");
  if (!existsSync(file)) return new Map();
  const slash = (u) => (u.endsWith("/") ? u : u + "/");
  return new Map(Object.entries(JSON.parse(readFileSync(file, "utf8"))).map(([from, to]) => [slash(from), to]));
}

function checkDocsLinks({ verbose = false } = {}) {
  if (!existsSync(outDir)) {
    throw new Error(`No build output at ${outDir}. Run 'npm run doc:build' first.`);
  }
  const basePath = detectBasePath();
  const files = htmlFiles(outDir);
  const broken = new Map(); // target -> Set(pages referencing it)
  const moved = redirectSources();
  const stale = new Map(); // old address -> Set(pages linking to it)
  let checked = 0;

  for (const file of files) {
    const html = readFileSync(file, "utf8");
    const page = "/" + relative(outDir, file).split(sep).join("/");
    // The leading whitespace keeps `data-href` out: Nextra's sidebar folder buttons
    // carry a non-navigating `data-href="/howto"` that is not a link. A non-empty
    // basePath used to hide them, because they are emitted without the prefix.
    for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
      const raw = m[1];
      // Skip external, protocol-relative, anchors, and non-http schemes
      if (/^(https?:)?\/\//.test(raw) || /^(#|mailto:|data:|tel:|javascript:)/.test(raw)) continue;
      // A relative href resolves against the URL the page is served at, as a browser does:
      // `en/guides/ide/navigation/index.html` is served as `.../navigation/` (trailingSlash),
      // so `./memory` there means `.../navigation/memory/`, not a sibling page. These went
      // unchecked until 2026-10 and hid 21 links broken by the move into `guides/`.
      const target = raw.startsWith("/") ? raw : resolveRelative(raw, servedUrl(page, basePath));
      if (basePath && !target.startsWith(basePath + "/") && target !== basePath) continue;
      const sitePath = basePath ? target.slice(basePath.length) || "/" : target;
      checked += 1;
      const bare = sitePath.split("#")[0].split("?")[0];
      const old = moved.get(bare.endsWith("/") ? bare : bare + "/");
      // --- The redirect stub itself points at the new address, so it never matches here
      if (old) {
        if (!stale.has(raw)) stale.set(raw, new Set());
        stale.get(raw).add(page);
      }
      if (!resolves(sitePath)) {
        if (!broken.has(raw)) broken.set(raw, new Set());
        broken.get(raw).add(page);
      }
    }
  }

  console.log(
    `Checked ${checked} internal references across ${files.length} pages` +
      (basePath ? ` (basePath "${basePath}")` : "")
  );

  for (const [target, pages] of [...stale].sort()) {
    const bare = target.split("#")[0];
    const to = moved.get(bare.endsWith("/") ? bare : bare + "/");
    console.error(`  ${target} is an old address (docs/redirects.json): link ${to} instead`);
    for (const p of verbose ? [...pages] : [...pages].slice(0, 3)) console.error(`      referenced by ${p}`);
  }

  if (broken.size === 0) {
    if (stale.size) return false;
    console.log("No broken internal links or images.");
    return true;
  }

  console.error(`\n${broken.size} broken target${broken.size === 1 ? "" : "s"}:`);
  for (const [target, pages] of [...broken].sort()) {
    const list = [...pages];
    const shown = verbose ? list : list.slice(0, 3);
    console.error(`  ${target}`);
    for (const p of shown) console.error(`      referenced by ${p}`);
    if (!verbose && list.length > shown.length) {
      console.error(`      ...and ${list.length - shown.length} more (use --verbose)`);
    }
  }
  return false;
}

if (require.main === module) {
  const ok = checkDocsLinks({ verbose: process.argv.includes("--verbose") });
  process.exit(ok ? 0 : 1);
}

module.exports = { checkDocsLinks };
