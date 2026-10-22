import {
  MC_ZX80_ROM8K,
  MI_C64,
  MI_SCORPION,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_TIMEX,
  MI_Z88,
  MI_ZX80,
  MI_ZX81,
  MI_ZXNEXT
} from "@common/machines/constants";
import { getTimexModel } from "@emu/machines/timex/timexModels";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";

/*
 * Klive machine → zcc target (`.plans/Z88DK_INTEGRATION_PLAN.md` §5.2, decision C5; the facts are
 * `.ai/z88dk/targets.md`). The machine decides the target; the project's options only refine it.
 */

/** How Run delivers the program. */
export type Z88dkRunRoute =
  /** Klive injects the raw image's segments and calls the entry (the crt0 returns to BASIC). */
  | "inject"
  /** The Next loads the `.nex` appmake wrote. */
  | "nex"
  /** The ZX80/ZX81 load the `.O`/`.P` appmake wrote, as `tape-load -r` does. */
  | "program"
  /** The Z88 gets the application card appmake wrote in a slot, then OZ starts it. */
  | "card";

export type Z88dkTarget = {
  /** The zcc target arguments, one per element (`.ai/z88dk/README.md`: never one string). */
  args: string[];
  /** The model Klive injects into; undefined where Klive does not inject. */
  model?: SpectrumModelType;
  run: Z88dkRunRoute;
  /** The file `-create-app` writes beside the image (`.tap`, `.nex`, `.P`, ...). */
  appExtension: string;
  /** zcc's own target name, for messages. */
  name: string;
  /** Targets whose classic library sends `printf` through `writebyte`, which `-lndos` supplies. */
  needsNdos: boolean;
  /**
   * How to ask for the classic library: `+zxn` defaults to `sdcc_iy` and needs `-clib=classic`;
   * `+zx` has no such option (`Cannot find definition for -clib=classic`), classic is its default.
   */
  classicClib?: string;
  /**
   * How a banked build runs (`BANK_n` sections): `tape` - from appmake's tape, through the Tape
   * Loader, whose BASIC loader pages the banks in; undefined - the machine runs no banked builds.
   * The Next loads its `.nex`, which holds the banks.
   */
  banking?: "tape";
};

const ZX: Omit<Z88dkTarget, "model"> = { args: ["+zx"], run: "inject", appExtension: ".tap", name: "+zx", needsNdos: true };

/**
 * The target for a machine, or why there is none.
 * @param subtype the project's `-subtype=` override, when it sets one
 */
export function z88dkTargetFor(
  machineId: string | undefined,
  modelId?: string,
  config?: Record<string, any>,
  subtype?: string
): Z88dkTarget | { refused: string } {
  const withSubtype = (target: Z88dkTarget): Z88dkTarget =>
    subtype ? { ...target, args: [target.args[0], `-subtype=${subtype}`] } : target;
  switch (machineId ?? MI_SPECTRUM_48) {
    case MI_SPECTRUM_48:
      if (modelId?.includes("16k")) {
        return { refused: "z88dk builds programs at $8000, which a 16K Spectrum does not have. Switch to the 48K model." };
      }
      return withSubtype({ ...ZX, model: SpectrumModelType.Spectrum48 });
    // --- The 128K family injects in 48 BASIC: Klive's 128 BASIC injection starts the code with the
    // --- editor ROM paged in, where the classic crt0's ROM calls go wrong (a real USR runs with the
    // --- 48K ROM paged). A banked build runs from appmake's tape instead (`Z88dkCompiler`, §9).
    case MI_SPECTRUM_128:
    case MI_SCORPION:
      return withSubtype({ ...ZX, model: SpectrumModelType.Spectrum48, banking: "tape" });
    case MI_SPECTRUM_3E:
      return withSubtype({
        args: ["+zx", "-subtype=plus3"],
        model: SpectrumModelType.Spectrum48,
        run: "inject",
        appExtension: ".dsk",
        name: "+zx -subtype=plus3",
        needsNdos: true
      });
    case MI_TIMEX: {
      // --- The TC2048 is a 48K Spectrum; the TC2068/TS2068 have their own ROM and memory map
      const timex = getTimexModel(config).id;
      if (timex === "tc2048") return withSubtype({ ...ZX, model: SpectrumModelType.Spectrum48 });
      return withSubtype({
        args: ["+ts2068"],
        model: SpectrumModelType.Spectrum48,
        run: "inject",
        appExtension: ".tap",
        name: "+ts2068",
        needsNdos: true
      });
    }
    case MI_ZXNEXT:
      // --- The default +zxn library (sdcc_iy) cannot build with -debug (`.ai/z88dk/targets.md`)
      return {
        args: ["+zxn", `-subtype=${subtype || "nex"}`],
        model: SpectrumModelType.Next,
        run: "nex",
        appExtension: ".nex",
        name: "+zxn",
        needsNdos: true,
        classicClib: "-clib=classic"
      };
    case MI_ZX81:
      return { args: ["+zx81"], model: SpectrumModelType.ZX81, run: "program", appExtension: ".P", name: "+zx81", needsNdos: false };
    case MI_ZX80:
      // --- A ZX80 with the 8K ROM is a ZX81 to the software
      return config?.[MC_ZX80_ROM8K]
        ? { args: ["+zx81"], model: SpectrumModelType.ZX81, run: "program", appExtension: ".P", name: "+zx81", needsNdos: false }
        : { args: ["+zx80"], model: SpectrumModelType.ZX80, run: "program", appExtension: ".O", name: "+zx80", needsNdos: false };
    case MI_Z88:
      return { args: ["+z88", `-subtype=${subtype || "app"}`], run: "card", appExtension: ".epr", name: "+z88", needsNdos: false };
    case MI_C64:
      return { refused: "z88dk builds Z80 programs; the Commodore 64 has a 6510. Use a Spectrum, ZX80/ZX81, Next or Z88 machine." };
    default:
      return { refused: `z88dk does not build programs for this machine (${machineId}).` };
  }
}
