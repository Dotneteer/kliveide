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

function checkDocsLinks({ verbose = false } = {}) {
  if (!existsSync(outDir)) {
    throw new Error(`No build output at ${outDir}. Run 'npm run doc:build' first.`);
  }
  const basePath = detectBasePath();
  const files = htmlFiles(outDir);
  const broken = new Map(); // target -> Set(pages referencing it)
  let checked = 0;

  for (const file of files) {
    const html = readFileSync(file, "utf8");
    const page = "/" + relative(outDir, file).split(sep).join("/");
    for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const raw = m[1];
      // Skip external, protocol-relative, anchors, and non-http schemes
      if (/^(https?:)?\/\//.test(raw) || /^(#|mailto:|data:|tel:|javascript:)/.test(raw)) continue;
      if (!raw.startsWith("/")) continue; // relative links are rare here; skip rather than guess
      if (basePath && !raw.startsWith(basePath + "/") && raw !== basePath) continue;
      const sitePath = basePath ? raw.slice(basePath.length) || "/" : raw;
      checked += 1;
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

  if (broken.size === 0) {
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
