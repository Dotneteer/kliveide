import { MC_Z88_SLOT0 } from "@common/machines/constants";
import type { CardSlotState } from "@emu/machines/z88/memory/CardSlotState";
import type { MachineConfigSet } from "@common/machines/info-types";
import type { UiReducer } from "@mvc/core/types";

import { isSameZ88Environment, type Z88Environment } from "../Z88Ports";

// --- The card type that means "this slot is empty".
export const EMPTY_CARD_STATE: CardSlotState = { cardType: "-" };

// --- Slot 0 holds the internal ROM: it only exists from boot, so emptying it
// --- is a machine rebuild rather than a hot unplug.
export const SLOT0 = 0;

export type Z88RemoveCardState = {
  env: Z88Environment;
  slot: number;
  busy: boolean;
};

export type Z88RemoveCardEvent =
  | { type: "envReplaced"; env: Z88Environment }
  | { type: "removeStarted" }
  | { type: "removeSettled" };

export function initialState(env: Z88Environment, slot: number): Z88RemoveCardState {
  return { env, slot, busy: false };
}

export const reduce: UiReducer<Z88RemoveCardState, Z88RemoveCardEvent> = (state, event) => {
  switch (event.type) {
    case "envReplaced":
      return isSameZ88Environment(state.env, event.env) ? state : { ...state, env: event.env };

    case "removeStarted":
      return state.busy ? state : { ...state, busy: true };

    case "removeSettled":
      return state.busy ? { ...state, busy: false } : state;

    default:
      return state;
  }
};

// ─── Derived rules ───────────────────────────────────────────────────────────

// --- Emptying slot 0 changes what the machine boots with, so it cannot be done
// --- to a running machine in place.
export function requiresRestart(state: Z88RemoveCardState): boolean {
  return state.slot === SLOT0;
}

export function configWithEmptySlot0(config: MachineConfigSet): MachineConfigSet {
  return { ...config, [MC_Z88_SLOT0]: EMPTY_CARD_STATE };
}

export function confirmationOf(state: Z88RemoveCardState): string {
  return `Are you sure you want to remove card from Slot ${state.slot}?`;
}
