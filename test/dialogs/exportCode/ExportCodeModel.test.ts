import { describe, expect, it } from "vitest";

import {
  ADDRESS_RANGE_MESSAGE,
  BORDER_OPTIONS,
  DEFAULT_FORMAT,
  EXPORT_FAILURE_MESSAGE,
  EXPORT_SUCCESS_MESSAGE,
  FORMAT_OPTIONS,
  NO_BORDER,
  borderNumberOf,
  canExport,
  commandOf,
  exportFailureMessage,
  exportNameErrorOf,
  exportSuccessMessage,
  folderErrorOf,
  readExportCodeSettings,
  reduce,
  savedSettingsOf,
  screenFileErrorOf,
  showsStartupOptions,
  startAddressErrorOf,
  supportsLoader
} from "@renderer/appIde/dialogs/exportCode/ExportCodeModel";

import { aState, anEnv, rejectingValidation } from "./fakes";

describe("ExportCodeModel — reading the saved settings", () => {
  it("falls back to a working default for every field", () => {
    const settings = readExportCodeSettings({});

    expect(settings).toEqual({
      formatId: DEFAULT_FORMAT,
      exportFolder: "",
      exportName: "",
      programName: "",
      borderId: NO_BORDER,
      screenFilename: "",
      startAddress: "",
      // --- A BASIC loader with a CLEAR is what most people want from a tape.
      startBlock: true,
      addPause: false,
      addClear: true,
      singleBlock: false
    });
  });

  it("reads what was saved", () => {
    const settings = readExportCodeSettings({
      formatId: "tap",
      exportName: "game",
      exportFolder: "/out",
      programName: "MYGAME",
      border: 2,
      screenFilename: "title.scr",
      startBlock: false,
      addClear: false,
      addPause: true,
      singleBlock: true,
      startAddress: 32768 as never
    });

    expect(settings).toMatchObject({
      formatId: "tap",
      borderId: "2",
      startAddress: "32768",
      startBlock: false,
      addPause: true
    });
  });

  it("keeps a false that was saved rather than defaulting it back to true", () => {
    // --- `??` and not `||`: turning the loader off has to survive a reopen.
    expect(readExportCodeSettings({ startBlock: false }).startBlock).toBe(false);
    expect(readExportCodeSettings({ addClear: false }).addClear).toBe(false);
  });

  it("reads a black border as colour zero, not as no border", () => {
    expect(readExportCodeSettings({ border: 0 }).borderId).toBe("0");
  });
});

describe("ExportCodeModel — writing the settings back", () => {
  it("stores a chosen border as a number", () => {
    expect(borderNumberOf("5")).toBe(5);
    expect(borderNumberOf("0")).toBe(0);
  });

  it("stores no border as absent", () => {
    expect(borderNumberOf(NO_BORDER)).toBeUndefined();
  });

  it("round-trips through the saved shape", () => {
    const settings = readExportCodeSettings({
      formatId: "tap",
      exportName: "game",
      border: 3,
      startAddress: 32768 as never
    });

    expect(readExportCodeSettings(savedSettingsOf(settings))).toEqual(settings);
  });
});

describe("ExportCodeModel — the reducer", () => {
  it("applies a patch", () => {
    const next = reduce(aState(), { type: "settingsChanged", patch: { exportName: "game" } });

    expect(next.settings.exportName).toBe("game");
  });

  it("returns the same state for a patch that changes nothing", () => {
    // --- The controls write their value back on every re-render; a save on
    // --- each of those would hammer the project file.
    const state = aState({ settings: { exportName: "game", formatId: "tap" } });

    expect(
      reduce(state, { type: "settingsChanged", patch: { exportName: "game", formatId: "tap" } })
    ).toBe(state);
  });

  it("applies a patch where only one of several fields differs", () => {
    const state = aState({ settings: { exportName: "game", formatId: "tap" } });

    const next = reduce(state, {
      type: "settingsChanged",
      patch: { exportName: "game", formatId: "hex" }
    });

    expect(next).not.toBe(state);
    expect(next.settings.formatId).toBe("hex");
  });

  it("returns the same state for a redundant busy transition", () => {
    const idle = aState();
    const started = reduce(idle, { type: "exportStarted" });

    expect(reduce(started, { type: "exportStarted" })).toBe(started);
    expect(reduce(idle, { type: "exportSettled" })).toBe(idle);
    expect(reduce(started, { type: "exportSettled" }).busy).toBe(false);
  });

  it("returns the same state when the rule set is unchanged", () => {
    const state = aState();

    expect(reduce(state, { type: "envReplaced", env: { validation: state.env.validation } })).toBe(
      state
    );
  });
});

describe("ExportCodeModel — validation", () => {
  it("requires an export file name", () => {
    expect(exportNameErrorOf(aState())).toBe("Enter a file name.");
    expect(canExport(aState())).toBe(false);
  });

  it("does not require a folder or a screen file", () => {
    const state = aState({ settings: { exportName: "game" } });

    expect(folderErrorOf(state)).toBeUndefined();
    expect(screenFileErrorOf(state)).toBeUndefined();
    expect(canExport(state)).toBe(true);
  });

  it("accepts a decimal start address and rejects anything else", () => {
    expect(startAddressErrorOf(aState({ settings: { startAddress: "32768" } }))).toBeUndefined();
    expect(startAddressErrorOf(aState({ settings: { startAddress: "" } }))).toBeUndefined();
    expect(startAddressErrorOf(aState({ settings: { startAddress: "0x8000" } }))).toBe(
      "Enter a decimal address."
    );
  });

  it("refuses to export when any one of the four fields is wrong", () => {
    const ready = aState({ settings: { exportName: "game" } });
    expect(canExport(ready)).toBe(true);

    expect(canExport(aState({ settings: { exportName: "game", startAddress: "$8000" } }))).toBe(
      false
    );
    expect(
      canExport(
        aState(
          { settings: { exportName: "game", exportFolder: "??" } },
          anEnv({ validation: rejectingValidation({ isValidPath: () => false }) })
        )
      )
    ).toBe(false);
  });
});

describe("ExportCodeModel — which sections apply", () => {
  it("offers a loader for tape formats", () => {
    for (const format of ["tap", "tzx"]) {
      expect(supportsLoader(aState({ settings: { formatId: format } }))).toBe(true);
    }
  });

  it("offers no loader for Intel HEX", () => {
    // --- A HEX file carries raw bytes with no tape structure to load from.
    expect(supportsLoader(aState({ settings: { formatId: "hex" } }))).toBe(false);
  });

  it("shows the startup options only when a loader is being created", () => {
    expect(showsStartupOptions(aState({ settings: { formatId: "tzx", startBlock: true } }))).toBe(
      true
    );
    expect(showsStartupOptions(aState({ settings: { formatId: "tzx", startBlock: false } }))).toBe(
      false
    );
    // --- Even with the loader flag still set from a previous format.
    expect(showsStartupOptions(aState({ settings: { formatId: "hex", startBlock: true } }))).toBe(
      false
    );
  });

  it("offers every format and every border colour", () => {
    expect(FORMAT_OPTIONS.map((option) => option.value)).toEqual(["tap", "tzx", "hex"]);
    expect(BORDER_OPTIONS[0].value).toBe(NO_BORDER);
    expect(BORDER_OPTIONS).toHaveLength(9);
  });
});

describe("ExportCodeModel — the command", () => {
  it("builds the command from the current form", () => {
    const state = aState({
      settings: { exportName: "game", exportFolder: "/out", formatId: "tap" }
    });

    expect(commandOf(state)).toEqual({
      command: 'expc "/out/game.tap" -n game -f tap -as -c',
      fullFilename: "/out/game.tap"
    });
  });
});

describe("ExportCodeModel — reporting the outcome", () => {
  it("translates the command's own complaint about the address switch", () => {
    expect(exportFailureMessage("Invalid -addr value")).toBe(ADDRESS_RANGE_MESSAGE);
  });

  it("passes any other failure through", () => {
    expect(exportFailureMessage("Assembler not found")).toBe("Assembler not found");
  });

  it("still says something when the failure said nothing", () => {
    // --- The old dialog called `.includes` on the missing message and threw a
    // --- TypeError, which replaced the export failure with a crash.
    expect(exportFailureMessage(undefined)).toBe(EXPORT_FAILURE_MESSAGE);
    expect(exportFailureMessage("")).toBe(EXPORT_FAILURE_MESSAGE);
  });

  it("prefers the command's own success message", () => {
    expect(exportSuccessMessage("Wrote 2 blocks.")).toBe("Wrote 2 blocks.");
    expect(exportSuccessMessage(undefined)).toBe(EXPORT_SUCCESS_MESSAGE);
  });
});
