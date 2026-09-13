import { MC_Z88_INTRAM } from "@common/machines/constants";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import type { UiReducer } from "@mvc/core/types";

import { isSameZ88Environment, type Z88Environment } from "../Z88Ports";

// ─── Vocabulary ──────────────────────────────────────────────────────────────

export type RamSizeOption = { value: string; label: string };

// --- The internal RAM sizes a Z88 can be fitted with.
export const RAM_SIZES: RamSizeOption[] = [
  { value: "32", label: "32K" },
  { value: "128", label: "128K" },
  { value: "512", label: "512K" }
];

export const DEFAULT_RAM_SIZE = "512";

export const RAM_CHANGE_WARNING =
  "Changing the RAM will stop the machine! Click Ok, when you are ready to proceed.";

// --- The chip mask the emulator stores for each fitted size. 512K is the
// --- default because it is the largest, and anything unrecognised is treated
// --- as a full complement rather than as an error.
const MASK_32K = 0x01;
const MASK_128K = 0x07;
const MASK_512K = 0x1f;

export function ramMaskOf(size: string): number {
  switch (size) {
    case "32":
      return MASK_32K;
    case "128":
      return MASK_128K;
    default:
      return MASK_512K;
  }
}

export function ramSizeOfMask(mask: number | undefined): string {
  switch (mask) {
    case MASK_32K:
      return "32";
    case MASK_128K:
      return "128";
    default:
      return DEFAULT_RAM_SIZE;
  }
}

// ─── State ───────────────────────────────────────────────────────────────────

export type Z88ChangeRamState = {
  env: Z88Environment;
  selectedSize: string;
  busy: boolean;
};

// ─── Events ──────────────────────────────────────────────────────────────────

export type Z88ChangeRamEvent =
  | { type: "envReplaced"; env: Z88Environment }
  | { type: "ramSizeChanged"; size: string }
  | { type: "applyStarted" }
  | { type: "applySettled" };

// ─── Initial state ───────────────────────────────────────────────────────────

export function initialState(env: Z88Environment): Z88ChangeRamState {
  return {
    env,
    // --- The dialog opens showing what the machine is actually fitted with.
    selectedSize: ramSizeOfMask(env.config?.[MC_Z88_INTRAM]),
    busy: false
  };
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export const reduce: UiReducer<Z88ChangeRamState, Z88ChangeRamEvent> = (state, event) => {
  switch (event.type) {
    case "envReplaced":
      // --- The container rebuilds the environment on every store notification;
      // --- only a machine that actually differs is worth a re-render.
      return isSameZ88Environment(state.env, event.env) ? state : { ...state, env: event.env };

    case "ramSizeChanged":
      return event.size === state.selectedSize ? state : { ...state, selectedSize: event.size };

    case "applyStarted":
      return state.busy ? state : { ...state, busy: true };

    case "applySettled":
      return state.busy ? { ...state, busy: false } : state;

    default:
      return state;
  }
};

// ─── Derived rules ───────────────────────────────────────────────────────────

// --- The mask the machine is fitted with right now.
export function fittedMaskOf(state: Z88ChangeRamState): number | undefined {
  return state.env.config?.[MC_Z88_INTRAM];
}

/**
 * Whether pressing Ok would actually change anything.
 *
 * Compares the *fitted size* rather than the raw mask, so a machine with no
 * `intRAM` key — which reads, and is displayed, as 512K — counts as already
 * having 512K. The old component compared masks, so opening this dialog on an
 * unconfigured machine and pressing Ok rebuilt it to write a value it was
 * already behaving as though it had.
 */
export function willChange(state: Z88ChangeRamState): boolean {
  return ramSizeOfMask(fittedMaskOf(state)) !== state.selectedSize;
}

// --- A machine that is not running loses nothing by being rebuilt, so the
// --- warning is only earned when there is a session to interrupt.
export function isRunning(state: Z88ChangeRamState): boolean {
  return (
    state.env.machineState !== MachineControllerState.Stopped &&
    state.env.machineState !== MachineControllerState.None
  );
}

export function showsRestartWarning(state: Z88ChangeRamState): boolean {
  return willChange(state) && isRunning(state);
}
