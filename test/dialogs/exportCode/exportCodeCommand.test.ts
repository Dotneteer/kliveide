import { describe, expect, it } from "vitest";

import { buildExportCodeCommand } from "@renderer/appIde/dialogs/exportCode/exportCodeCommand";
import type { ExportCodeCommandOptions } from "@renderer/appIde/dialogs/exportCode/exportCodeCommand";

/**
 * The command builder was already a pure function, but it had no tests: every
 * one of these switches was only ever exercised by clicking the dialog.
 */
const baseOptions: ExportCodeCommandOptions = {
  formatId: "tzx",
  exportFolder: "",
  exportName: "game",
  programName: "",
  borderId: "none",
  startBlock: false,
  addPause: false,
  singleBlock: false,
  startAddress: "",
  addClear: false,
  screenFilename: ""
};

const build = (over: Partial<ExportCodeCommandOptions> = {}) =>
  buildExportCodeCommand({ ...baseOptions, ...over });

describe("buildExportCodeCommand — the file name", () => {
  it("appends the format as an extension when the name has none", () => {
    expect(build().fullFilename).toBe("game.tzx");
  });

  it("keeps an extension the user already typed", () => {
    expect(build({ exportName: "game.tap" }).fullFilename).toBe("game.tap");
  });

  it("appends the format when the name ends in a bare dot", () => {
    expect(build({ exportName: "game." }).fullFilename).toBe("game..tzx");
  });

  it("joins the export folder onto the file name", () => {
    expect(build({ exportFolder: "/out" }).fullFilename).toBe("/out/game.tzx");
  });

  it("normalises Windows separators so the command is portable", () => {
    expect(build({ exportFolder: "C:\\out\\tapes" }).fullFilename).toBe("C:/out/tapes/game.tzx");
  });
});

describe("buildExportCodeCommand — the program name", () => {
  it("uses the program name when one is given", () => {
    expect(build({ programName: "MYGAME" }).command).toContain("-n MYGAME");
  });

  it("falls back to the export name's stem", () => {
    // --- Which is why the field is optional: the tape header gets a sensible
    // --- name without the user having to repeat themselves.
    expect(build({ exportName: "game.tap" }).command).toContain("-n game");
  });
});

describe("buildExportCodeCommand — the switches", () => {
  it("emits the bare command when nothing is enabled", () => {
    expect(build().command).toBe('expc "game.tzx" -n game -f tzx');
  });

  it("adds the loader switch for a BASIC loader", () => {
    expect(build({ startBlock: true }).command).toContain(" -as");
  });

  it("adds the pause switch", () => {
    expect(build({ addPause: true }).command).toContain(" -p");
  });

  it("adds the clear switch", () => {
    expect(build({ addClear: true }).command).toContain(" -c");
  });

  it("adds the single-block switch", () => {
    expect(build({ singleBlock: true }).command).toContain(" -sb");
  });

  it("adds a border colour when one is chosen", () => {
    expect(build({ borderId: "2" }).command).toContain(" -b 2");
  });

  it("omits the border switch for no border", () => {
    // --- "none" is not a colour index; passing it would be a command error.
    expect(build({ borderId: "none" }).command).not.toContain("-b");
  });

  it("adds a black border, which is colour zero and not nothing", () => {
    expect(build({ borderId: "0" }).command).toContain(" -b 0");
  });

  it("adds a start address when one is given", () => {
    expect(build({ startAddress: "32768" }).command).toContain(" -addr 32768");
  });

  it("omits the address switch for an empty address", () => {
    expect(build({ startAddress: "" }).command).not.toContain("-addr");
  });

  it("quotes the screen file and normalises its separators", () => {
    expect(build({ screenFilename: "C:\\shots\\title.scr" }).command).toContain(
      ' -scr "C:/shots/title.scr"'
    );
  });

  it("omits the screen switch when no screen file is given", () => {
    expect(build().command).not.toContain("-scr");
  });

  it("emits every switch in a fixed order", () => {
    const { command } = build({
      exportFolder: "/out",
      exportName: "game",
      programName: "MYGAME",
      formatId: "tap",
      startBlock: true,
      addPause: true,
      borderId: "5",
      singleBlock: true,
      startAddress: "32768",
      addClear: true,
      screenFilename: "title.scr"
    });

    expect(command).toBe(
      'expc "/out/game.tap" -n MYGAME -f tap -as -p -b 5 -sb -addr 32768 -c -scr "title.scr"'
    );
  });
});
