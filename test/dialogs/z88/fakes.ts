import { vi, type Mock } from "vitest";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MC_Z88_INTRAM, MC_Z88_SLOT0 } from "@common/machines/constants";
import type { Z88Environment } from "@renderer/appEmu/dialogs/z88/Z88Ports";

import { deepMerge, type DeepPartial } from "../../mvc/fixtures";

export { deepMerge };
export type { DeepPartial };
export { MC_Z88_INTRAM, MC_Z88_SLOT0 };

/**
 * Fixtures shared by the three Z88 card dialogs.
 *
 * They all read the same slice of the store and reach the machine through the
 * same port, so the environment builder and the machine fake live here rather
 * than three times over.
 */

// ─── Environment ─────────────────────────────────────────────────────────────

// --- A stopped machine with no configuration: nothing to interrupt, nothing
// --- fitted. Every test that cares says so explicitly.
export const IDLE_MACHINE: Z88Environment = {
  config: {},
  machineState: MachineControllerState.Stopped
};

export const anEnv = (over?: DeepPartial<Z88Environment>): Z88Environment =>
  deepMerge(IDLE_MACHINE, over);

// --- A machine mid-session, which is what makes a rebuild destructive.
export const aRunningEnv = (over?: DeepPartial<Z88Environment>): Z88Environment =>
  anEnv(deepMerge({ machineState: MachineControllerState.Running }, over));

// ─── Machine port ────────────────────────────────────────────────────────────

export type Z88FakeMachinePort = {
  applyCardState: Mock;
  setMachineConfig: Mock;
  signalFlapClosed: Mock;
};

export function fakeZ88MachinePort(
  over: Partial<Record<keyof Z88FakeMachinePort, Mock>> = {}
): Z88FakeMachinePort {
  return {
    applyCardState: over.applyCardState ?? vi.fn(async () => undefined),
    setMachineConfig: over.setMachineConfig ?? vi.fn(async () => undefined),
    signalFlapClosed: over.signalFlapClosed ?? vi.fn()
  };
}
