import { describe, it, expect } from "vitest";

import { romSysVarsFor } from "@renderer/appIde/annotations/romSysVars";
import { zx81SysVars } from "@emu/machines/zx8081/Zx81SysVars";
import { zx80SysVars } from "@emu/machines/zx8081/Zx80SysVars";
import { zxSpectrum48SysVars } from "@emu/machines/zxSpectrum48/ZxSpectrum48SysVars";
import { zxSpectrum128SysVars } from "@emu/machines/zxSpectrum128/ZxSpectrum128SysVars";

/*
 * Which system variables a ROM page document names (`.plans/ROM_ANNOTATION_EDITING_PLAN.md` §10):
 * the table the ROM's own machine reports through `getSysVars`.
 */

describe("romSysVarsFor", () => {
  it("gives each ROM its machine's table", () => {
    expect(romSysVarsFor("zx81")).toBe(zx81SysVars);
    expect(romSysVarsFor("zx80")).toBe(zx80SysVars);
    expect(romSysVarsFor("sp48-basic")).toBe(zxSpectrum48SysVars);
  });

  it("gives the 128K and +3 pages both tables, as those machines report them", () => {
    for (const kind of ["sp128-editor", "plus3-editor", "plus3-syntax", "plus3-dos"] as const) {
      expect(romSysVarsFor(kind)).toEqual([...zxSpectrum128SysVars, ...zxSpectrum48SysVars]);
    }
  });

  it("gives nothing for a ROM Klive does not know, so the selected machine's apply", () => {
    expect(romSysVarsFor(undefined)).toBeUndefined();
  });
});
