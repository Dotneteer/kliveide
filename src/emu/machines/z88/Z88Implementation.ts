import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";

import { MC_Z88_IMPLEMENTATION } from "@common/machines/constants";

/**
 * Selects the execution backend for a Cambridge Z88 machine.
 *
 * The WASM backend is the default since Step 14 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`
 * (2026-09-19). The TypeScript backend stays selectable - the "Cambridge Z88 (TypeScript)" models -
 * and remains the parity oracle for the comparison period.
 */
export type Z88Implementation = "typescript" | "wasm";

/** Machine configuration key used by the Cambridge Z88 machine factory */
export const Z88_IMPLEMENTATION = MC_Z88_IMPLEMENTATION;

/** The backend used when neither the configuration nor the model selects one */
export const DEFAULT_Z88_IMPLEMENTATION: Z88Implementation = "wasm";

/**
 * Resolves the backend of a Z88, key by key: the configuration's value, else the model's own
 * configuration's value, else the default.
 *
 * The fallback is per key, not per configuration: the Z88's configuration is rebuilt by several
 * paths (the LCD menu, the RAM and slot-0 dialogs, card hot-plug), and a configuration that lacks
 * the key must not silently switch a model that selects a backend back to the default.
 * @param config The machine configuration (it overrides the model's)
 * @param model The machine model
 */
export function getZ88Implementation(config?: MachineConfigSet, model?: MachineModel): Z88Implementation {
  const configured = config?.[Z88_IMPLEMENTATION] ?? model?.config?.[Z88_IMPLEMENTATION];
  return configured === "typescript" || configured === "wasm" ? configured : DEFAULT_Z88_IMPLEMENTATION;
}
