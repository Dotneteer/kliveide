/**
 * Writes docs/generated/site-info.json: the facts about the latest release the website shows.
 *
 * - `latestRelease`: the version of the newest `v*` tag. The landing page shows only features
 *   whose `since` version is at most this one, so it never claims something a visitor cannot
 *   download yet (R6 of .plans/DOCS_SITE_MODERNIZATION_PLAN.md).
 * - `releaseDate` and `downloads`: the release's install kits, for the Download button. They come
 *   from the GitHub API when it answers, and otherwise from the asset naming the release
 *   workflow uses (`KliveIdeSetup-<version>-<arch>.<ext>`), so an offline build still works.
 *
 * The CI checkout fetches tags (`fetch-depth: 0` in deploy-doc.yml), so `git describe` sees them.
 *
 * Usage: node scripts/build-doc-site-info.cjs
 */
const { execFileSync } = require("node:child_process");
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const repoRoot = join(__dirname, "..");
const outFile = join(repoRoot, "docs", "generated", "site-info.json");
const REPO = "Dotneteer/kliveide";

function latestTag() {
  try {
    return execFileSync("git", ["describe", "--tags", "--abbrev=0", "--match", "v*"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return undefined;
  }
}

/** The kit for each platform, from the release's asset names. */
function downloadsFrom(names, tag) {
  const url = (name) => `https://github.com/${REPO}/releases/download/${tag}/${name}`;
  const find = (re) => {
    const name = names.find((n) => re.test(n));
    return name ? url(name) : undefined;
  };
  return {
    macArm64: find(/arm64\.pkg$/),
    macX64: find(/x64\.pkg$/),
    windowsX64: find(/x64\.exe$/),
    windowsPortable: find(/Portable.*\.zip$/),
    linuxX64: find(/(x86_64|x64)\.AppImage$/),
    linuxArm64: find(/arm64\.AppImage$/)
  };
}

/** The asset names the release workflow produces, for when the API cannot be asked. */
function expectedAssets(version) {
  return [
    `KliveIdeSetup-${version}-arm64.pkg`,
    `KliveIdeSetup-${version}-x64.pkg`,
    `KliveIdeSetup-${version}-x64.exe`,
    `KliveIde-Portable-${version}-x64.zip`,
    `KliveIdeSetup-${version}-x86_64.AppImage`,
    `KliveIdeSetup-${version}-arm64.AppImage`
  ];
}

async function fetchRelease(tag) {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${tag}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "klive-docs-build" },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return undefined;
    const release = await response.json();
    return { names: release.assets.map((a) => a.name), date: release.published_at };
  } catch {
    return undefined;
  }
}

async function buildDocSiteInfo() {
  const tag = latestTag();
  const version = tag ? tag.replace(/^v/, "") : undefined;
  let info = {
    latestRelease: version ?? "0.0.0",
    releaseTag: tag ?? null,
    releaseDate: null,
    releasesPage: `https://github.com/${REPO}/releases/latest`,
    downloads: {},
    source: "none"
  };
  if (tag) {
    const release = await fetchRelease(tag);
    info = {
      ...info,
      releaseDate: release?.date ?? null,
      downloads: downloadsFrom(release?.names ?? expectedAssets(version), tag),
      source: release ? "github-api" : "naming-pattern"
    };
  }
  mkdirSync(join(repoRoot, "docs", "generated"), { recursive: true });
  writeFileSync(outFile, JSON.stringify(info, null, 2) + "\n");
  console.log(`site-info: latest release ${info.latestRelease} (downloads from ${info.source})`);
}

if (require.main === module) {
  buildDocSiteInfo().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { buildDocSiteInfo };
