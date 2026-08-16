import { MC_ZXNEXT_IMPLEMENTATION } from "@common/machines/constants";

/**
 * Selects the execution backend for a ZX Spectrum Next machine.
 *
 * Keep the default on TypeScript until the WASM backend reaches the early
 * boot/storage/ULA milestone. Explicit config values still let migration
 * slices exercise the future WASM path without adding product-facing models.
 */
export type ZxNextImplementation = "typescript" | "wasm";

/** Machine configuration key used by the ZX Spectrum Next machine factory. */
export const ZXNEXT_IMPLEMENTATION = MC_ZXNEXT_IMPLEMENTATION;

/** Default Next backend used when the model/config does not explicitly select one. */
export const DEFAULT_ZXNEXT_IMPLEMENTATION: ZxNextImplementation = "typescript";

export function getZxNextImplementation(config?: Record<string, unknown>): ZxNextImplementation {
  const configured = config?.[ZXNEXT_IMPLEMENTATION];
  return configured === "typescript" || configured === "wasm"
    ? configured
    : DEFAULT_ZXNEXT_IMPLEMENTATION;
}
