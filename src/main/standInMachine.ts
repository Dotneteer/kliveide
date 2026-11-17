import type { MachineConfigSet } from "@common/machines/info-types";

/*
 * The machine the user chose while another one stands in for it (`dev/plans/NEXT_SD_CARDS_PLAN.md`,
 * Q1). When a ZX Spectrum Next model's SD card is not on this computer and the user declines the
 * download, the session runs another machine (at startup, the default Next model; opening a project,
 * the machine that was running). The settings and the project keep the chosen machine until the user
 * changes the machine on purpose, which ends the stand-in.
 */

export type ChosenMachine = { machineId: string; modelId?: string; config?: MachineConfigSet };

let chosen: ChosenMachine | undefined;

/** Records the machine the settings and the project keep while another one runs */
export function setStandIn(machine: ChosenMachine): void {
  chosen = { ...machine };
}

/** Ends the stand-in: what runs is what is saved again */
export function clearStandIn(): void {
  chosen = undefined;
}

/** The machine to save instead of the running one, while a stand-in runs */
export function chosenMachine(): ChosenMachine | undefined {
  return chosen;
}
