import { MC_DIVMMC, MC_SP128_TIMING, MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_SPECTRUM_48 } from "./constants";
import type { MachineConfigSet } from "./info-types";
import { getModelConfig } from "./machine-registry";

/*
 * Which machines can have a DivMMC (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, C5): the 16K/48K, the
 * 128K with its own timing - not the Pentagon or the Scorpion, which have the Beta 128 - and the
 * +2A/+3/+2E/+3E. Whether one is connected is the machine config's `MC_DIVMMC`.
 */

export function isDivMmcMachine(machineId: string | undefined, modelId?: string, config?: MachineConfigSet): boolean {
  if (machineId === MI_SPECTRUM_48 || machineId === MI_SPECTRUM_3E) return true;
  if (machineId !== MI_SPECTRUM_128) return false;
  const timing = (config ?? getModelConfig(machineId, modelId))?.[MC_SP128_TIMING];
  return timing === undefined || timing === "sp128";
}

/** Is a DivMMC connected in this configuration? */
export function hasDivMmc(machineId: string | undefined, modelId?: string, config?: MachineConfigSet): boolean {
  return isDivMmcMachine(machineId, modelId, config) && !!config?.[MC_DIVMMC];
}
