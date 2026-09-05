import { describe, expect, it } from "vitest";

import {
  EMPTY_CARD_STATE,
  confirmationOf,
  configWithEmptySlot0,
  initialState,
  reduce,
  requiresRestart
} from "@renderer/appEmu/dialogs/z88/removeCard/Z88RemoveCardModel";

import { MC_Z88_SLOT0, aState, anEnv } from "./fakes";

describe("Z88RemoveCardModel", () => {
  it("opens on the slot it was asked about", () => {
    expect(initialState(anEnv(), 3).slot).toBe(3);
    expect(initialState(anEnv(), 3).busy).toBe(false);
  });

  it("names the slot in the question", () => {
    expect(confirmationOf(aState({}, anEnv(), 2))).toBe(
      "Are you sure you want to remove card from Slot 2?"
    );
  });

  it("treats slot 0 as a rebuild and every card slot as a hot unplug", () => {
    // --- Slot 0 is the internal ROM: the machine only has it from boot.
    expect(requiresRestart(aState({}, anEnv(), 0))).toBe(true);
    for (const slot of [1, 2, 3]) {
      expect(requiresRestart(aState({}, anEnv(), slot))).toBe(false);
    }
  });

  it("empties slot 0 without disturbing the rest of the configuration", () => {
    const next = configWithEmptySlot0({ other: "kept", [MC_Z88_SLOT0]: { cardType: "ROM" } });

    expect(next).toEqual({ other: "kept", [MC_Z88_SLOT0]: EMPTY_CARD_STATE });
  });

  it("marks the dialog busy while the card is being removed", () => {
    const started = reduce(aState(), { type: "removeStarted" });

    expect(started.busy).toBe(true);
    expect(reduce(started, { type: "removeSettled" }).busy).toBe(false);
  });

  it("returns the same state for a redundant start or settle", () => {
    const idle = aState();
    const started = reduce(idle, { type: "removeStarted" });

    expect(reduce(started, { type: "removeStarted" })).toBe(started);
    expect(reduce(idle, { type: "removeSettled" })).toBe(idle);
  });

  it("returns the same state for an equivalent environment", () => {
    const state = aState({}, anEnv({ config: { a: 1 } }));

    expect(reduce(state, { type: "envReplaced", env: anEnv({ config: { a: 1 } }) })).toBe(state);
  });
});
