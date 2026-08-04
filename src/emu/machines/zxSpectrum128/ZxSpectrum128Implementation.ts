import { MC_SP128_IMPLEMENTATION } from "@common/machines/constants";

/**
 * Selects the execution backend for a ZX Spectrum 128K machine.
 *
 * Keep DEFAULT_SP128_IMPLEMENTATION on TypeScript until the WASM backend reaches
 * feature parity. Explicit config values can opt into the WASM migration path.
 */
export type ZxSpectrum128Implementation = "typescript" | "wasm";

/** Machine configuration key used by the 128K machine factory. */
export const SP128_IMPLEMENTATION = MC_SP128_IMPLEMENTATION;

/** Default 128K backend used when the model/config does not explicitly select one. */
export const DEFAULT_SP128_IMPLEMENTATION: ZxSpectrum128Implementation = "typescript";

export function getZxSpectrum128Implementation(config?: Record<string, unknown>): ZxSpectrum128Implementation {
  const configured = config?.[SP128_IMPLEMENTATION];
  return configured === "typescript" || configured === "wasm"
    ? configured
    : DEFAULT_SP128_IMPLEMENTATION;
}
