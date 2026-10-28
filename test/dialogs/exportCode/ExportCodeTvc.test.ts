import { describe, expect, it } from "vitest";

import { commandOf, formatOptionsFor, TVC_FORMAT_OPTIONS } from "@renderer/appIde/dialogs/exportCode/ExportCodeModel";
import { selectViewModel } from "@renderer/appIde/dialogs/exportCode/ExportCodeViewModel";
import { tvcExportFile, tvcExportFormatOf, tvcFormatProblem } from "@renderer/appIde/utils/tvc-code";
import { parseTvcCasFile } from "@emu/machines/tvc/TvcCasFile";

import { aState, anEnv } from "./fakes";

/**
 * The Export dialog and the `.cas` on the Videoton TVC (`.plans/VIDEOTON_TVC_PLAN.md` §11): `.cas`
 * first, then HEX, and none of the Spectrum's loader options; the file is a program LOAD runs.
 */
const tvc = (settings: Record<string, unknown> = {}) =>
  aState({ settings: { exportName: "game", ...settings } }, anEnv({ formats: TVC_FORMAT_OPTIONS }));

describe("Export dialog on the TVC", () => {
  it("offers .cas and HEX, .cas first", () => {
    expect(formatOptionsFor("tvc").map((o) => o.value)).toEqual(["cas", "hex"]);
  });

  it("replaces a saved Spectrum format with .cas and hides the loader options", () => {
    const vm = selectViewModel(tvc({ formatId: "tzx", startBlock: true }));
    expect(vm.format.value).toBe("cas");
    expect(vm.loader.kind).toBe("hidden");
    expect(vm.startup.kind).toBe("hidden");
    expect(commandOf(tvc({ formatId: "tzx" })).command).toBe('expc "game.cas" -n game -f cas');
  });
});

describe("TVC .cas export", () => {
  it("picks .cas for a TVC build, and refuses another machine's format", () => {
    expect(tvcExportFormatOf(8, undefined)).toBe("cas");
    expect(tvcExportFormatOf(undefined, "tvc")).toBe("cas");
    expect(tvcExportFormatOf(1, "tvc")).toBeUndefined();
    expect(tvcFormatProblem("tap")).toMatch(/\.cas/);
    expect(tvcFormatProblem("hex")).toBeUndefined();
  });

  it("writes an autostart program file: the launcher line, then the code", () => {
    const file = tvcExportFile({ segments: [{ startAddress: 0x1a30, emittedCode: [0xc9] }] });
    if ("error" in file) throw new Error(file.error);
    const tape = parseTvcCasFile(file.data, "game.cas");
    expect(tape.fileType).toBe(0x01);
    expect(tape.autostart).toBe(true);
    expect(tape.payload.length).toBe(0x1a31 - 0x19ef);
    expect(tape.payload[0x1a30 - 0x19ef]).toBe(0xc9);
  });

  it("refuses code the TVC cannot load", () => {
    expect(tvcExportFile({ segments: [{ startAddress: 0x1000, emittedCode: [0xc9] }] })).toHaveProperty("error");
  });
});
