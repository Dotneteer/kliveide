import { describe, expect, it } from "vitest";

import { selectViewModel } from "@renderer/appEmu/dialogs/z88/removeCard/Z88RemoveCardViewModel";

import { aState, anEnv } from "./fakes";

describe("Z88RemoveCardViewModel", () => {
  it("asks about the slot it was opened for", () => {
    expect(selectViewModel(aState({}, anEnv(), 0)).question).toBe(
      "Are you sure you want to remove card from Slot 0?"
    );
  });

  it("allows removal until one is running", () => {
    expect(selectViewModel(aState()).removeEnabled).toBe(true);
    expect(selectViewModel(aState({ busy: true })).removeEnabled).toBe(false);
  });
});
