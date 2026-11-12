/*
 * The ZX Spectrum Next WASM artifacts (`dev/ai/zxnext-models.md` D3): one per distinct
 * hardware, built from the one C tree with the defines of `zxnext-profile.h`. Two profiles with the
 * same hardware share an artifact. `test/wasm/zxNext/wasm-next-artifacts.test.ts` keeps this list in
 * step with `NEXT_PROFILES` (`src/emu/machines/zxNext/nextProfiles.ts`).
 */
const ZXNEXT_ARTIFACTS = [
  // --- KS2, core 3.02.01: the original artifact name, which every earlier build packaged
  { artifact: "zx-spectrum-next.wasm", coreVersion: 30201, boardIssue: 2 },
  // --- KS2, core 3.02.04
  { artifact: "zx-spectrum-next-ks2-30204.wasm", coreVersion: 30204, boardIssue: 2 },
  // --- KS2 and KS3, core 3.03.00 (`dev/plans/ZXNEXT_3_03_PLAN.md`): the KS3 board is issue 5,
  // --- g_board_issue 3 (`zxnext_top_issue5.vhd@3.02.04 ~39`)
  { artifact: "zx-spectrum-next-ks2-30300.wasm", coreVersion: 30300, boardIssue: 2 },
  { artifact: "zx-spectrum-next-ks3-30300.wasm", coreVersion: 30300, boardIssue: 3 }
];

/** The compiler defines of an artifact */
function artifactDefines(entry) {
  return [`-DZXNEXT_CORE_VERSION=${entry.coreVersion}`, `-DZXNEXT_BOARD_ISSUE=${entry.boardIssue}`];
}

module.exports = { ZXNEXT_ARTIFACTS, artifactDefines };
