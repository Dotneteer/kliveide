/**
 * The install kits a Klive release carries: their file names and the platform each one is for.
 * One list, used by the website build (`build-doc-site-info.cjs`, for the Download button) and by
 * the release workflow (`release.cjs publish`, which checks a release has exactly these files), so
 * the two can never disagree about names (.plans/RELEASE_AUTOMATION_PLAN.md §5).
 *
 * The names come from electron-builder's `artifactName` settings in package.json and the files
 * the jobs of .github/workflows/release-artifacts.yml upload.
 */

const REPO = "Dotneteer/kliveide";
const CHECKSUMS_FILE = "SHA256SUMS.txt";

/** [platform key, file name pattern for a version, matcher for any version] */
const KITS = [
  ["macArm64", (v) => `KliveIdeSetup-${v}-arm64.pkg`, /arm64\.pkg$/],
  ["macX64", (v) => `KliveIdeSetup-${v}-x64.pkg`, /x64\.pkg$/],
  ["windowsX64", (v) => `KliveIdeSetup-${v}-x64.exe`, /x64\.exe$/],
  ["windowsPortable", (v) => `KliveIde-Portable-${v}-x64.zip`, /Portable.*\.zip$/],
  ["linuxX64", (v) => `KliveIdeSetup-${v}-x86_64.AppImage`, /(x86_64|x64)\.AppImage$/],
  ["linuxArm64", (v) => `KliveIdeSetup-${v}-arm64.AppImage`, /arm64\.AppImage$/]
];

/** The kit file names of a version, in a fixed order */
function expectedAssets(version) {
  return KITS.map(([, name]) => name(version));
}

function downloadUrl(tag, name) {
  return `https://github.com/${REPO}/releases/download/${tag}/${name}`;
}

/** The download URL for each platform, from a release's asset names */
function downloadsFrom(names, tag) {
  const out = {};
  for (const [key, , re] of KITS) {
    const name = names.find((n) => re.test(n));
    out[key] = name ? downloadUrl(tag, name) : undefined;
  }
  return out;
}

/**
 * Compares the files a release would publish with the expected kits.
 * Returns the missing and the unexpected names (the checksums file is expected too, when `withChecksums`).
 */
function compareAssets(names, version, { withChecksums = false } = {}) {
  const expected = expectedAssets(version);
  if (withChecksums) expected.push(CHECKSUMS_FILE);
  return {
    missing: expected.filter((n) => !names.includes(n)),
    unexpected: names.filter((n) => !expected.includes(n))
  };
}

module.exports = { REPO, CHECKSUMS_FILE, expectedAssets, downloadUrl, downloadsFrom, compareAssets };
