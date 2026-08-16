import { MC_SPP3E_IMPLEMENTATION } from "@common/machines/constants";

/**
 * Selects the execution backend for a ZX Spectrum +2E/+3E machine.
 *
 * The WASM backend is the rollout default. The TypeScript backend remains
 * available as an explicit fallback while the migration is finalized.
 */
export type ZxSpectrumP3eImplementation = "typescript" | "wasm";

/** Machine configuration key used by the +3E machine factory. */
export const SPP3E_IMPLEMENTATION = MC_SPP3E_IMPLEMENTATION;

/** Default +3E backend used when the model/config does not explicitly select one. */
export const DEFAULT_SPP3E_IMPLEMENTATION: ZxSpectrumP3eImplementation = "wasm";

export function getZxSpectrumP3eImplementation(config?: Record<string, unknown>): ZxSpectrumP3eImplementation {
  const configured = config?.[SPP3E_IMPLEMENTATION];
  return configured === "typescript" || configured === "wasm"
    ? configured
    : DEFAULT_SPP3E_IMPLEMENTATION;
}
