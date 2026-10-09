import type { MachineModel } from "@common/machines/info-types";
import { MC_TIMEX_MODEL, MC_SCREEN_FREQ } from "@common/machines/constants";

/*
 * The models of the Timex core (`.plans/TIMEX_SCORPION_PLAN.md`, P2): the TC2048 (G9.4a), the TC2068
 * and the TS2068 (G9.4b). This is the TypeScript side of `timexHardReset` (timex.c);
 * `test/timex-hw/` keeps the two equal.
 *
 * Must stay free of emulator imports: the machine registry and the hardware sheet read it.
 */

/** The model ids, the values of `MC_TIMEX_MODEL` */
export type TimexModelId = "tc2048" | "tc2068" | "ts2068";

export type TimexModel = {
  id: TimexModelId;
  /** The argument of the core's `timexHardReset` */
  coreModel: number;
  displayName: string;
  /** The CPU clock in Hz: the SCLD's 14.112 MHz / 4 */
  clockHz: number;
  tactsPerLine: number;
  linesPerFrame: number;
  tactsPerFrame: number;
  /** Whether the 64-column mode's colours (and its border) are BRIGHT (plan §8) */
  hiresBright: boolean;
  /** The ROM the user names: 16K (the TC2048) or 24K (16K HOME ROM, then the 8K EXROM) */
  romSize: number;
  /** The 2068s: the 8K chunk map, the AY with two joysticks, the DOCK; the TC2048: a Kempston port */
  is2068: boolean;
  ntsc: boolean;
};

export const TIMEX_MODELS_INFO: Record<TimexModelId, TimexModel> = {
  tc2048: {
    id: "tc2048",
    coreModel: 0,
    displayName: "Timex Computer 2048",
    clockHz: 3_528_000,
    tactsPerLine: 224,
    linesPerFrame: 312,
    tactsPerFrame: 69_888,
    hiresBright: true,
    romSize: 0x4000,
    is2068: false,
    ntsc: false
  },
  tc2068: {
    id: "tc2068",
    coreModel: 1,
    displayName: "Timex Computer 2068",
    clockHz: 3_528_000,
    tactsPerLine: 224,
    linesPerFrame: 312,
    tactsPerFrame: 69_888,
    hiresBright: true,
    romSize: 0x6000,
    is2068: true,
    ntsc: false
  },
  ts2068: {
    id: "ts2068",
    coreModel: 2,
    displayName: "Timex Sinclair 2068",
    clockHz: 3_528_000,
    tactsPerLine: 224,
    linesPerFrame: 262,
    tactsPerFrame: 58_688,
    hiresBright: false,
    romSize: 0x6000,
    is2068: true,
    ntsc: true
  }
};

/** The model a configuration means (the TC2048 when it does not say) */
export function getTimexModel(config?: Record<string, any>): TimexModel {
  return TIMEX_MODELS_INFO[config?.[MC_TIMEX_MODEL] as TimexModelId] ?? TIMEX_MODELS_INFO.tc2048;
}

/** The registry's models of the `timex` machine */
export const TIMEX_MODELS: MachineModel[] = (["tc2048", "tc2068", "ts2068"] as TimexModelId[]).map((id) => ({
  modelId: id,
  displayName: TIMEX_MODELS_INFO[id].displayName,
  config: {
    [MC_TIMEX_MODEL]: id,
    ...(TIMEX_MODELS_INFO[id].ntsc ? { [MC_SCREEN_FREQ]: "ntsc" } : {})
  }
}));

/**
 * The TC2048 ROM's size. Klive does not ship the Timex ROMs (their rights are unclear, plan P5): the
 * user names their copies in the settings, and without one a machine boots the Sinclair 48K ROM.
 */
export const TC2048_ROM_SIZE = 0x4000;

/** The 2068s' ROM file: the 16K HOME ROM followed by the 8K EXROM */
export const TIMEX_2068_ROM_SIZE = 0x6000;

/**
 * What Klive knows about a ROM's code (`.plans/TIMEX_SCORPION_PLAN.md` P6): where its BASIC main
 * loop is (the code-injection and tape-load flows wait there) and where its tape routines are (the
 * tape device traps them). Found by running each ROM and comparing it with the 48K ROM, never
 * from a disassembly.
 */
export type TimexRomTraits = {
  name: string;
  /** The main loop's entry, in the HOME ROM: the counterpart of the 48K's $12AC */
  mainEntry: number;
  /** LD-START, LD-BYTES' invalid-header and resume points, SA-BYTES */
  tape: { load: number; invalidHeader: number; resume: number; save: number; inExrom: boolean };
};

/** The Sinclair 48K ROM's (and the TC2048 ROM's, which keeps them) */
export const SP48_ROM_TRAITS: TimexRomTraits = {
  name: "ZX Spectrum 48K",
  mainEntry: 0x12ac,
  tape: { load: 0x056c, invalidHeader: 0x05b6, resume: 0x05e2, save: 0x04c2, inExrom: false }
};

/**
 * The ROMs Klive has run, by the CRC-32 of the whole file (`romCrc32` in `@common/roms/romIdentity`). The TS2068 ROM's tape routines are the
 * 48K's, moved into the EXROM; its main loop is the 48K's MAIN-EXEC, moved to $0E28.
 */
export const TIMEX_KNOWN_ROMS: Record<string, TimexRomTraits> = {
  f1b5fa67: { ...SP48_ROM_TRAITS, name: "TC2048" },
  "48004230": {
    name: "TS2068",
    mainEntry: 0x0e32,
    tape: { load: 0x0112, invalidHeader: 0x015c, resume: 0x0188, save: 0x0068, inExrom: true }
  }
};
