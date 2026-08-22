import { MC_ZXNEXT_IMPLEMENTATION } from "@common/machines/constants";

/**
 * Selects the execution backend for a ZX Spectrum Next machine.
 *
 * The TypeScript backend remains the default while the WASM backend is audited
 * against the TypeScript parity oracle.
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
