/*
 * The ZX Spectrum Next WASM artifacts (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` D3): one per distinct
 * hardware, built from the one C tree with the defines of `zxnext-profile.h`. Two profiles with the
 * same hardware share an artifact. `test/wasm/zxNext/wasm-next-artifacts.test.ts` keeps this list in
 * step with `NEXT_PROFILES` (`src/emu/machines/zxNext/nextProfiles.ts`).
 */
const ZXNEXT_ARTIFACTS = [
  // --- KS2, core 3.02.01: the original artifact name, which every earlier build packaged
  { artifact: "zx-spectrum-next.wasm", coreVersion: 30201, boardIssue: 2 },
  // --- KS2, core 3.02.04
  { artifact: "zx-spectrum-next-ks2-30204.wasm", coreVersion: 30204, boardIssue: 2 }
];

/** The compiler defines of an artifact */
function artifactDefines(entry) {
  return [`-DZXNEXT_CORE_VERSION=${entry.coreVersion}`, `-DZXNEXT_BOARD_ISSUE=${entry.boardIssue}`];
}

module.exports = { ZXNEXT_ARTIFACTS, artifactDefines };
