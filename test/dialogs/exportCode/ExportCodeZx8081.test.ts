import { describe, expect, it } from "vitest";

import {
  commandOf,
  FORMAT_OPTIONS,
  formatOptionsFor,
  ZX80_FORMAT_OPTIONS,
  ZX81_FORMAT_OPTIONS
} from "@renderer/appIde/dialogs/exportCode/ExportCodeModel";
import { selectViewModel } from "@renderer/appIde/dialogs/exportCode/ExportCodeViewModel";

import { aState, anEnv } from "./fakes";

/**
 * The Export dialog on a ZX81 or ZX80 (`.plans/ZX8081_CODE_INJECTION_PLAN.md` D8): the machine's own
 * program file, none of the Spectrum's loader options, and auto-run on a `.p`.
 */
const zx81 = (settings: Record<string, unknown> = {}) =>
  aState({ settings: { exportName: "game", ...settings } }, anEnv({ formats: ZX81_FORMAT_OPTIONS }));
const zx80 = (settings: Record<string, unknown> = {}) =>
  aState({ settings: { exportName: "game", ...settings } }, anEnv({ formats: ZX80_FORMAT_OPTIONS }));

describe("Export dialog on the ZX80/ZX81", () => {
  it("offers formats by machine", () => {
    expect(formatOptionsFor("zx81").map((o) => o.value)).toEqual(["p", "hex"]);
    expect(formatOptionsFor("zx80").map((o) => o.value)).toEqual(["o", "p", "hex"]);
    // --- The 48K adds a Microdrive cartridge (`.plans/MICRODRIVE_PLAN.md` Q7)
    expect(formatOptionsFor("sp48").map((o) => o.value)).toEqual([...FORMAT_OPTIONS.map((o) => o.value), "mdr"]);
  });

  it("replaces a saved Spectrum format with the machine's own", () => {
    const vm = selectViewModel(zx81({ formatId: "tzx" }));
    expect(vm.format.value).toBe("p");
    expect(commandOf(zx81({ formatId: "tzx" })).command).toBe('expc "game.p" -f p -as');
  });

  it("offers auto-run on a .p file and hides the Spectrum loader options", () => {
    const vm = selectViewModel(zx81({ formatId: "p", startBlock: true }));
    expect(vm.loader).toEqual({ kind: "shown", checked: true, label: "Run the program when loaded" });
    expect(vm.startup.kind).toBe("hidden");
    expect(commandOf(zx81({ formatId: "p", startBlock: false })).command).toBe('expc "game.p" -f p');
  });

  it("has no loader for a ZX80 program", () => {
    const vm = selectViewModel(zx80({ formatId: "o", startBlock: true }));
    expect(vm.loader.kind).toBe("hidden");
    expect(commandOf(zx80({ formatId: "o", startBlock: true })).command).toBe('expc "game.o" -f o');
  });
});
