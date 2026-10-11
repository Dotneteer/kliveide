import type { SysVar } from "@abstractions/SysVar";
import type { RomPageKind } from "@common/roms/romIdentity";

import { zx80SysVars } from "@emu/machines/zx8081/Zx80SysVars";
import { zx81SysVars } from "@emu/machines/zx8081/Zx81SysVars";
import { zxSpectrum48SysVars } from "@emu/machines/zxSpectrum48/ZxSpectrum48SysVars";
import { zxSpectrum128SysVars } from "@emu/machines/zxSpectrum128/ZxSpectrum128SysVars";

/*
 * The system variables a ROM page's code works with, by the page's kind
 * (`.plans/ROM_ANNOTATION_EDITING_PLAN.md` §10).
 *
 * A ROM page document lists a ROM, not the machine that happens to be selected: a ZX81 ROM opened
 * while a Spectrum is running must name `$4029` after the ZX81's `NXTLIN`, not the Spectrum's
 * variables, which are not even at the same addresses. The tables are the ones the machines
 * themselves report (`getSysVars`), so a page reads the same in its document as on its machine.
 */

/** The 128K and +3 machines report their own variables and the 48K ones together. */
const SPECTRUM_128_SYS_VARS: SysVar[] = [...zxSpectrum128SysVars, ...zxSpectrum48SysVars];

/**
 * The system variable table for a ROM page, or `undefined` for a page Klive does not know — whose
 * listing then names the running machine's variables, as any other document does.
 */
export function romSysVarsFor(kind: RomPageKind | undefined): SysVar[] | undefined {
  switch (kind) {
    case "zx81":
      return zx81SysVars;
    case "zx80":
      return zx80SysVars;
    case "sp48-basic":
      return zxSpectrum48SysVars;
    case "sp128-editor":
    case "plus3-editor":
    case "plus3-syntax":
    case "plus3-dos":
      return SPECTRUM_128_SYS_VARS;
    default:
      return undefined;
  }
}
