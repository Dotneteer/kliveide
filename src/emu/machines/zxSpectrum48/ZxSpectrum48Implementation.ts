/**
 * Selects the execution backend for a ZX Spectrum 48K machine.
 *
 * `wasm` currently selects the WASM bootstrap facade. It preserves the
 * TypeScript behaviour while the C core is brought to feature parity.
 */
export type ZxSpectrum48Implementation = "typescript" | "wasm";

/** Machine configuration key used by the 48K machine factory. */
export const SP48_IMPLEMENTATION = "sp48Implementation";

export function getZxSpectrum48Implementation(config?: Record<string, unknown>): ZxSpectrum48Implementation {
  return config?.[SP48_IMPLEMENTATION] === "wasm" ? "wasm" : "typescript";
}
