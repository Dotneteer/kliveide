import { describe, expect, it } from "vitest";

import {
  RAM_CHANGE_WARNING,
  RAM_SIZES
} from "@renderer/appEmu/dialogs/z88/changeRam/Z88ChangeRamModel";
import { selectViewModel } from "@renderer/appEmu/dialogs/z88/changeRam/Z88ChangeRamViewModel";

import { MC_Z88_INTRAM, aRunningEnv, aState, anEnv } from "./fakes";

describe("Z88ChangeRamViewModel", () => {
  it("offers every RAM size and marks the selected one", () => {
    const vm = selectViewModel(aState({ selectedSize: "128" }));

    expect(vm.ramSize.options).toEqual(RAM_SIZES);
    expect(vm.ramSize.value).toBe("128");
  });

  it("carries the warning text when a running machine would be rebuilt", () => {
    const vm = selectViewModel(aState({ selectedSize: "32" }, aRunningEnv()));

    expect(vm.warning).toBe(RAM_CHANGE_WARNING);
  });

  it("omits the warning entirely when the row is not earned", () => {
    // --- Undefined, not an empty string: the row is absent, not blank.
    const vm = selectViewModel(
      aState({ selectedSize: "512" }, aRunningEnv({ config: { [MC_Z88_INTRAM]: 0x1f } }))
    );

    expect(vm.warning).toBeUndefined();
  });

  it("keeps Ok available for a selection that changes nothing", () => {
    // --- Pressing Ok on an unchanged selection is how the user says "leave it
    // --- as it is", so the button must stay live.
    const vm = selectViewModel(aState({ selectedSize: "512" }, anEnv()));

    expect(vm.applyEnabled).toBe(true);
  });

  it("disables Ok while the machine is being rebuilt", () => {
    expect(selectViewModel(aState({ busy: true })).applyEnabled).toBe(false);
  });
});
