/*
 * The RZX exports and statics every ZX Spectrum core shares (`.plans/RZX_PLAN.md` §4.2,
 * `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-rzx.c`). The 48K, 128K and +2E/+3E build
 * scripts add them with their own prefix; `src/emu/machines/zxSpectrum/rzx/rzxCoreBridge.ts` keeps
 * the TypeScript side of the same list.
 */

/** The export names without the core's prefix */
const RZX_EXPORT_SUFFIXES = [
  "RzxSetMode",
  "RzxGetMode",
  "RzxPlayBufferPtr",
  "RzxPlayBufferCapacity",
  "RzxSetPlayFrame",
  "RzxGetStatus",
  "RzxGetFetchCount",
  "RzxGetReadIndex",
  "RzxRecBufferPtr",
  "RzxRecBufferCapacity",
  "RzxRecFrameTablePtr",
  "RzxGetRecFrameCount",
  "RzxGetRecByteCount",
  "RzxGetOverflow",
  "RzxClearRec",
  "RzxRecMarkBlockStart",
  "RzxGetRecClosePending",
  "RzxSetFrameTact"
];

/**
 * The RZX statics a Klive state file leaves out: a session in progress is IDE state, and a restore
 * ends it anyway (trap 4)
 */
const RZX_VOLATILE_SYMBOLS = [
  "rzxMode",
  "rzxStatus",
  "rzxFetchCount",
  "rzxPlayBuffer",
  "rzxPlayTarget",
  "rzxPlayInCount",
  "rzxPlayReadIndex",
  "rzxPlayIntRequest",
  "rzxRecBuffer",
  "rzxRecFrameTable",
  "rzxRecFrameCount",
  "rzxRecClosedBytes",
  "rzxRecByteCount",
  "rzxRecOverflow",
  "rzxRecClosePending",
  "rzxRecAtBlockStart"
];

/** The RZX exports of a core */
function rzxExports(prefix) {
  return RZX_EXPORT_SUFFIXES.map((suffix) => prefix + suffix);
}

module.exports = { RZX_EXPORT_SUFFIXES, RZX_VOLATILE_SYMBOLS, rzxExports };
