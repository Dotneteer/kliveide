import { describe, expect, it } from "vitest";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import {
  DEFAULT_RAM_SIZE,
  RAM_SIZES,
  fittedMaskOf,
  initialState,
  isRunning,
  ramMaskOf,
  ramSizeOfMask,
  reduce,
  showsRestartWarning,
  willChange
} from "@renderer/appEmu/dialogs/z88/changeRam/Z88ChangeRamModel";

import { MC_Z88_INTRAM, aState, anEnv, aRunningEnv } from "./fakes";

describe("Z88ChangeRamModel — size and mask", () => {
  it("maps each offered size to its chip mask and back", () => {
    for (const option of RAM_SIZES) {
      expect(ramSizeOfMask(ramMaskOf(option.value))).toBe(option.value);
    }
  });

  it("reads an unfitted or unrecognised machine as a full complement", () => {
    // --- 512K is the largest and the emulator's own default, so an unknown
    // --- mask is treated as "fully populated" rather than as an error.
    expect(ramSizeOfMask(undefined)).toBe(DEFAULT_RAM_SIZE);
    expect(ramSizeOfMask(0x99)).toBe(DEFAULT_RAM_SIZE);
  });
});

describe("Z88ChangeRamModel — initial state", () => {
  it("opens showing the size the machine is fitted with", () => {
    const state = initialState(anEnv({ config: { [MC_Z88_INTRAM]: 0x07 } }));

    expect(state.selectedSize).toBe("128");
    expect(state.busy).toBe(false);
  });

  it("opens on 512K for a machine with no RAM configured", () => {
    expect(initialState(anEnv()).selectedSize).toBe("512");
  });
});

describe("Z88ChangeRamModel — selection", () => {
  it("records a new selection", () => {
    const next = reduce(aState(), { type: "ramSizeChanged", size: "32" });

    expect(next.selectedSize).toBe("32");
  });

  it("returns the same state when the selection is unchanged", () => {
    const state = aState({ selectedSize: "128" });

    expect(reduce(state, { type: "ramSizeChanged", size: "128" })).toBe(state);
  });
});

describe("Z88ChangeRamModel — environment", () => {
  it("returns the same state for an equivalent environment", () => {
    // --- The container rebuilds the environment object on every store
    // --- notification; an equal one must wake no subscriber.
    const state = aState({}, anEnv({ config: { [MC_Z88_INTRAM]: 0x01 } }));
    const equivalent = anEnv({ config: { [MC_Z88_INTRAM]: 0x01 } });

    expect(reduce(state, { type: "envReplaced", env: equivalent })).toBe(state);
  });

  it("adopts an environment whose configuration differs", () => {
    const state = aState({}, anEnv({ config: { [MC_Z88_INTRAM]: 0x01 } }));
    const changed = anEnv({ config: { [MC_Z88_INTRAM]: 0x07 } });

    expect(reduce(state, { type: "envReplaced", env: changed })).not.toBe(state);
  });

  it("adopts an environment whose machine state differs", () => {
    const state = aState();

    const next = reduce(state, { type: "envReplaced", env: aRunningEnv() });

    expect(next).not.toBe(state);
    expect(isRunning(next)).toBe(true);
  });
});

describe("Z88ChangeRamModel — busy", () => {
  it("marks the dialog busy while the machine is rebuilt", () => {
    const started = reduce(aState(), { type: "applyStarted" });
    expect(started.busy).toBe(true);
    expect(reduce(started, { type: "applySettled" }).busy).toBe(false);
  });

  it("returns the same state for a redundant start or settle", () => {
    const idle = aState();
    const started = reduce(idle, { type: "applyStarted" });

    expect(reduce(started, { type: "applyStarted" })).toBe(started);
    expect(reduce(idle, { type: "applySettled" })).toBe(idle);
  });
});

describe("Z88ChangeRamModel — what a rebuild is worth", () => {
  it("sees no change when the selected size is already fitted", () => {
    const state = aState({ selectedSize: "128" }, anEnv({ config: { [MC_Z88_INTRAM]: 0x07 } }));

    expect(fittedMaskOf(state)).toBe(0x07);
    expect(willChange(state)).toBe(false);
  });

  it("sees a change when a different size is selected", () => {
    const state = aState({ selectedSize: "32" }, anEnv({ config: { [MC_Z88_INTRAM]: 0x07 } }));

    expect(willChange(state)).toBe(true);
  });

  it("sees no change when 512K is re-picked on an unconfigured machine", () => {
    // --- An unconfigured machine reads as 512K, so picking 512K on it changes
    // --- nothing — and must not restart it.
    expect(willChange(aState({ selectedSize: "512" }))).toBe(false);
  });
});

describe("Z88ChangeRamModel — restart warning", () => {
  it("warns when a running machine would be rebuilt", () => {
    const state = aState({ selectedSize: "32" }, aRunningEnv());

    expect(showsRestartWarning(state)).toBe(true);
  });

  it("stays quiet when nothing would change", () => {
    const state = aState({ selectedSize: "512" }, aRunningEnv());

    expect(showsRestartWarning(state)).toBe(false);
  });

  it("stays quiet for a stopped machine", () => {
    // --- Nothing is lost by rebuilding a machine that is not running.
    expect(showsRestartWarning(aState({ selectedSize: "32" }))).toBe(false);
  });

  it("stays quiet for a machine that was never started", () => {
    const state = aState(
      { selectedSize: "32" },
      anEnv({ machineState: MachineControllerState.None })
    );

    expect(showsRestartWarning(state)).toBe(false);
  });
});
