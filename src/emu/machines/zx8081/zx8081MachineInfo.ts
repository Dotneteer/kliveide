import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";

import { MC_MEM_SIZE, MC_SCREEN_FREQ, MC_ZX80_ROM8K, MI_ZX80, MI_ZX81 } from "@common/machines/constants";

/**
 * The Sinclair ZX80 and ZX81: their models and the facts the host and the renderer share
 * (`.plans/ZX8081_WASM_PLAN.md` §4.3, decision D2 - two machine ids, one host and one core).
 */

/** 3.25 MHz on both machines and both TV standards */
export const ZX8081_BASE_CLOCK_FREQUENCY = 3_250_000;

/** An emulation frame: 1/50 s (PAL) or 1/60 s (NTSC) of the CPU clock (the core's own constants) */
export const ZX8081_TACTS_IN_FRAME_PAL = 65_000;
export const ZX8081_TACTS_IN_FRAME_NTSC = 54_167;

/** The ROM resources (`src/public/roms`); free for non-commercial use - see zx8081-roms-readme.txt */
export const ZX81_ROM = "zx81";
export const ZX80_ROM = "zx80";

/** The ZX81 ROM's LOAD finishes here (prints 0/0); the ZX80's at its exit to MAIN-EXEC (CLK) */
export const ZX81_LOAD_FINISHED = 0x06d1;
export const ZX80_LOAD_FINISHED = 0x0203;

/** The ZX81's system variables the IDE reads */
export const ZX81_D_FILE = 0x400c;
export const ZX81_E_LINE = 0x4014;
/** SLOW-DISP: the editor's wait-for-key loop (where the tape-load flow starts typing) */
export const ZX81_KEY_WAIT = 0x04cf;
/**
 * The ZX80 ROM's display-and-keyboard loop at the prompt, reached once a frame. There is no commented
 * ZX80 listing in the repository: this was found by sampling the PC at the prompt, and
 * `test/zx8081-hw/zx80.test.ts` checks that typing works from it.
 */
export const ZX80_KEY_WAIT = 0x013f;
/** MODE: the cursor mode (K/L/F/G); see the ROM's K-DECODE ($04DF) */
export const ZX81_MODE = 0x4006;

export const ZX81_MODELS: MachineModel[] = [
  { modelId: "zx81-16k", displayName: "Sinclair ZX81 (16K)", config: { [MC_MEM_SIZE]: 16, [MC_SCREEN_FREQ]: "pal" } },
  { modelId: "zx81-1k", displayName: "Sinclair ZX81 (1K)", config: { [MC_MEM_SIZE]: 1, [MC_SCREEN_FREQ]: "pal" } },
  { modelId: "zx81-64k", displayName: "Sinclair ZX81 (64K)", config: { [MC_MEM_SIZE]: 64, [MC_SCREEN_FREQ]: "pal" } },
  {
    modelId: "zx81-16k-us",
    displayName: "Timex Sinclair 1000 / ZX81 US (16K, NTSC)",
    config: { [MC_MEM_SIZE]: 16, [MC_SCREEN_FREQ]: "ntsc" }
  },
  {
    modelId: "zx81-1k-us",
    displayName: "ZX81 US (1K, NTSC)",
    config: { [MC_MEM_SIZE]: 1, [MC_SCREEN_FREQ]: "ntsc" }
  }
];

export const ZX80_MODELS: MachineModel[] = [
  { modelId: "zx80-16k", displayName: "Sinclair ZX80 (16K)", config: { [MC_MEM_SIZE]: 16 } },
  { modelId: "zx80-1k", displayName: "Sinclair ZX80 (1K)", config: { [MC_MEM_SIZE]: 1 } },
  {
    modelId: "zx80-8krom-16k",
    displayName: "Sinclair ZX80 with the 8K ROM (16K)",
    config: { [MC_MEM_SIZE]: 16, [MC_ZX80_ROM8K]: true }
  }
];

/** What the core needs to know about a model (`zx8081Configure`) */
export type Zx8081Hardware = {
  machineId: typeof MI_ZX80 | typeof MI_ZX81;
  /** The ZX81 ULA (NMI generator, 207-T lines) */
  hardwareZx81: boolean;
  /** The 8K ZX81 ROM (the ZX81, or a ZX80 with the upgrade) */
  romZx81: boolean;
  ramKb: 1 | 16 | 64;
  ntsc: boolean;
};

export function resolveZx8081Hardware(machineId: string, config: MachineConfigSet | undefined): Zx8081Hardware {
  const isZx81 = machineId === MI_ZX81;
  const mem = Number(config?.[MC_MEM_SIZE] ?? 16);
  return {
    machineId: isZx81 ? MI_ZX81 : MI_ZX80,
    hardwareZx81: isZx81,
    romZx81: isZx81 || config?.[MC_ZX80_ROM8K] === true,
    ramKb: mem >= 64 && isZx81 ? 64 : mem >= 16 ? 16 : 1,
    ntsc: isZx81 && config?.[MC_SCREEN_FREQ] === "ntsc"
  };
}

/**
 * The model that suits a program file (CLK's static analyser): the file's machine, and 16K for a
 * program over 1K. A ZX80 file wants a ZX80; a ZX81 file a ZX81 (or a ZX80 with the 8K ROM).
 */
export function zx8081ModelForProgram(isZx81: boolean, ramKb: 1 | 16): { machineId: string; modelId: string } {
  return isZx81
    ? { machineId: MI_ZX81, modelId: ramKb === 1 ? "zx81-1k" : "zx81-16k" }
    : { machineId: MI_ZX80, modelId: ramKb === 1 ? "zx80-1k" : "zx80-16k" };
}
