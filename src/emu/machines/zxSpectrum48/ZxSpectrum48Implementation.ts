import { MC_SP48_IMPLEMENTATION } from "@common/machines/constants";

/**
 * Selects the execution backend for a ZX Spectrum 48K machine.
 *
 * Change DEFAULT_SP48_IMPLEMENTATION to swap the rollout default in one place.
 * Explicit config values still override the default for experiments, manual
 * fallback, and compatibility comparisons.
 */
export type ZxSpectrum48Implementation = "typescript" | "wasm";

/** Machine configuration key used by the 48K machine factory. */
export const SP48_IMPLEMENTATION = MC_SP48_IMPLEMENTATION;

/** Default 48K backend used when the model/config does not explicitly select one. */
export const DEFAULT_SP48_IMPLEMENTATION: ZxSpectrum48Implementation = "wasm";

export function getZxSpectrum48Implementation(config?: Record<string, unknown>): ZxSpectrum48Implementation {
  const configured = config?.[SP48_IMPLEMENTATION];
  return configured === "typescript" || configured === "wasm"
    ? configured
    : DEFAULT_SP48_IMPLEMENTATION;
}
