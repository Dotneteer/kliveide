import { describe, expect, it } from "vitest";

import {
  BORDER_OPTIONS,
  FORMAT_OPTIONS
} from "@renderer/appIde/dialogs/exportCode/ExportCodeModel";
import { selectViewModel } from "@renderer/appIde/dialogs/exportCode/ExportCodeViewModel";

import { aState, anEnv, rejectingValidation } from "./fakes";

describe("ExportCodeViewModel — the always-visible fields", () => {
  it("offers every format and marks the selection", () => {
    const vm = selectViewModel(aState({ settings: { formatId: "tap" } }));

    expect(vm.format.options).toEqual(FORMAT_OPTIONS);
    expect(vm.format.value).toBe("tap");
  });

  it("carries the field values and their errors", () => {
    const vm = selectViewModel(aState({ settings: { exportFolder: "/out" } }));

    expect(vm.exportFolder.value).toBe("/out");
    expect(vm.exportName.error).toBe("Enter a file name.");
  });

  it("gives the program name no error of its own", () => {
    // --- An empty program name is legal: the command falls back to the file
    // --- name's stem.
    expect(selectViewModel(aState()).programName.error).toBeUndefined();
  });
});

describe("ExportCodeViewModel — the loader section", () => {
  it("shows the loader checkbox for a tape format", () => {
    const vm = selectViewModel(aState({ settings: { formatId: "tzx", startBlock: true } }));

    expect(vm.loader).toEqual({ kind: "shown", checked: true });
  });

  it("hides the loader checkbox for Intel HEX", () => {
    expect(selectViewModel(aState({ settings: { formatId: "hex" } })).loader.kind).toBe("hidden");
  });
});

describe("ExportCodeViewModel — the startup options", () => {
  it("shows them when a loader is being created", () => {
    const vm = selectViewModel(
      aState({
        settings: {
          formatId: "tzx",
          startBlock: true,
          addClear: true,
          addPause: false,
          singleBlock: true,
          borderId: "2",
          screenFilename: "title.scr",
          startAddress: "32768"
        }
      })
    );

    expect(vm.startup).toMatchObject({
      kind: "shown",
      addClear: true,
      addPause: false,
      singleBlock: true,
      border: { options: BORDER_OPTIONS, value: "2" },
      screenFile: { value: "title.scr" },
      startAddress: { value: "32768" }
    });
  });

  it("hides them when no loader is being created", () => {
    expect(
      selectViewModel(aState({ settings: { formatId: "tzx", startBlock: false } })).startup.kind
    ).toBe("hidden");
  });

  it("hides them for Intel HEX even with the loader flag still set", () => {
    expect(
      selectViewModel(aState({ settings: { formatId: "hex", startBlock: true } })).startup.kind
    ).toBe("hidden");
  });

  it("carries the start address error into the section", () => {
    const vm = selectViewModel(
      aState({ settings: { formatId: "tzx", startBlock: true, startAddress: "0x8000" } })
    );

    expect(vm.startup).toMatchObject({
      startAddress: { error: "Enter a decimal address." }
    });
  });
});

describe("ExportCodeViewModel — submission", () => {
  it("refuses a form with no export name", () => {
    expect(selectViewModel(aState()).submitEnabled).toBe(false);
  });

  it("allows a form with just an export name", () => {
    expect(selectViewModel(aState({ settings: { exportName: "game" } })).submitEnabled).toBe(true);
  });

  it("refuses a screen file the rules reject", () => {
    const state = aState(
      { settings: { exportName: "game", formatId: "tzx", startBlock: true, screenFilename: "??" } },
      anEnv({ validation: rejectingValidation({ isValidPath: () => false }) })
    );

    expect(selectViewModel(state).submitEnabled).toBe(false);
  });

  it("refuses while an export is already running", () => {
    const vm = selectViewModel(aState({ settings: { exportName: "game" }, busy: true }));

    expect(vm.submitting).toBe(true);
    expect(vm.submitEnabled).toBe(false);
  });

  it("labels the submit button Export", () => {
    expect(selectViewModel(aState()).submitLabel).toBe("Export");
  });
});
