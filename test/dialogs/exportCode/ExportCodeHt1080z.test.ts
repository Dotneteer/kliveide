import { describe, expect, it } from "vitest";

import { commandOf, formatOptionsFor, HT1080Z_FORMAT_OPTIONS } from "@renderer/appIde/dialogs/exportCode/ExportCodeModel";
import { selectViewModel } from "@renderer/appIde/dialogs/exportCode/ExportCodeViewModel";

import { aState, anEnv } from "./fakes";

/**
 * The Export dialog on the HT-1080Z (`.plans/HT1080Z_CODE_INJECTION_PLAN.md` D6, D-Q4): `.cmd` first,
 * then `.cas` and HEX, the program name as the module name, and none of the Spectrum's loader options.
 */
const ht = (settings: Record<string, unknown> = {}) =>
  aState({ settings: { exportName: "game", ...settings } }, anEnv({ formats: HT1080Z_FORMAT_OPTIONS }));

describe("Export dialog on the HT-1080Z", () => {
  it("offers .cmd, .cas and HEX, .cmd first", () => {
    expect(formatOptionsFor("ht1080z").map((o) => o.value)).toEqual(["cmd", "cas", "hex"]);
  });

  it("replaces a saved Spectrum format with .cmd", () => {
    expect(selectViewModel(ht({ formatId: "tzx" })).format.value).toBe("cmd");
    expect(commandOf(ht({ formatId: "tzx" })).command).toBe('expc "game.cmd" -n game -f cmd');
  });

  it("names the module, and hides the loader and startup options", () => {
    const vm = selectViewModel(ht({ formatId: "cas", startBlock: true, programName: "HELLO" }));
    expect(vm.loader.kind).toBe("hidden");
    expect(vm.startup.kind).toBe("hidden");
    expect(commandOf(ht({ formatId: "cas", startBlock: true, programName: "HELLO" })).command).toBe(
      'expc "game.cas" -n HELLO -f cas'
    );
  });
});

describe("disk export formats (DISK_IMAGES_AND_FILE_SYSTEMS_PLAN B6)", () => {
  it("offers a .dsk on the +2A/+3 and a .trd on the machines with a Beta 128", () => {
    expect(formatOptionsFor("spp3e").map((o) => o.value)).toContain("dsk");
    expect(formatOptionsFor("sp128").map((o) => o.value)).toContain("trd");
    expect(formatOptionsFor("scorpion").map((o) => o.value)).toContain("trd");
    expect(formatOptionsFor("sp48").map((o) => o.value)).not.toContain("dsk");
    expect(formatOptionsFor("sp48").map((o) => o.value)).toContain("mdr");
    expect(formatOptionsFor("sp128").map((o) => o.value)).toContain("mdr");
    expect(formatOptionsFor("scorpion").map((o) => o.value)).not.toContain("mdr");
  });
});
