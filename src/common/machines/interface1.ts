import { MC_INTERFACE1, MC_SP128_TIMING, MI_SPECTRUM_128, MI_SPECTRUM_48 } from "./constants";
import type { MachineConfigSet } from "./info-types";
import { getModelConfig } from "./machine-registry";

/*
 * Which machines can have a ZX Interface 1 (`.plans/MICRODRIVE_PLAN.md` Q2): the 16K/48K and the
 * 128K/+2 with its own timing - not the Pentagon or the Scorpion, not the +2A/+3 (no ROMCS), not the
 * Timex. Whether one is connected is the machine config's `MC_INTERFACE1`.
 */

export function isInterface1Machine(machineId: string | undefined, modelId?: string, config?: MachineConfigSet): boolean {
  if (machineId === MI_SPECTRUM_48) return true;
  if (machineId !== MI_SPECTRUM_128) return false;
  const timing = (config ?? getModelConfig(machineId, modelId))?.[MC_SP128_TIMING];
  return timing === undefined || timing === "sp128";
}

/** Is an Interface 1 connected in this configuration? */
export function hasInterface1(machineId: string | undefined, modelId?: string, config?: MachineConfigSet): boolean {
  return isInterface1Machine(machineId, modelId, config) && !!config?.[MC_INTERFACE1];
}
