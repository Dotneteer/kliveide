import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";

import { MC_HT_MODEL, MC_MEM_SIZE } from "@common/machines/constants";
import type { Ht1080zRomSetId } from "./Ht1080zRoms";

/**
 * The HT-1080Z: its models and the facts the host, the core and the renderer share
 * (`.plans/HT1080Z_PLAN.md` §3, §4.3 and §17; decisions D1 and D5).
 */

/** Series I and II: 10.644 MHz / 6 (the Genie manual) */
export const HT1080Z_CLOCK_S12 = 1_774_000;
/** The /64: 10.6645 MHz / 6 (traced on the /64 schematics) */
export const HT1080Z_CLOCK_64 = 1_777_417;

/** 112 T a line (one T per character slot), 312 lines a frame */
export const HT1080Z_TACTS_PER_LINE = 112;
export const HT1080Z_LINES_PER_FRAME = 312;
export const HT1080Z_TACTS_IN_FRAME = HT1080Z_TACTS_PER_LINE * HT1080Z_LINES_PER_FRAME;

/**
 * The picture (decision D6): 64 x 6 dots and 16 x 12 lines, with a 72-dot and 48-line border; the
 * core's `HT_SCREEN_WIDTH`/`HT_SCREEN_HEIGHT`
 */
export const HT1080Z_SCREEN_WIDTH = 528;
export const HT1080Z_SCREEN_HEIGHT = 288;

/**
 * The width of a dot against its height, as the emulator panel draws it (D6): Klive shows a
 * Spectrum pixel (7 MHz) square, and an HT dot lasts 7 / 10.644 of one - about 2:3.
 */
export const HT1080Z_PIXEL_ASPECT = 7_000_000 / 10_644_000;

/** The memory map */
export const HT1080Z_EXTENSION_ROM_START = 0x3000;
export const HT1080Z_KEYBOARD_START = 0x3800;
export const HT1080Z_VIDEO_RAM_START = 0x3c00;
export const HT1080Z_VIDEO_RAM_SIZE = 0x0400;
export const HT1080Z_RAM_START = 0x4000;

/**
 * The models (D1): each has its own ROMs, character set and clock (§4.3). Series I and II also come
 * with 48K of RAM, standing in for the expansion RAM board (HARDWARE.md §9.2) that much software
 * assumes; the /64 has 48K as built.
 */
export const HT1080Z_MODELS: MachineModel[] = [
  {
    modelId: "ht1080z-s1",
    displayName: "HT-1080Z Series I",
    config: { [MC_HT_MODEL]: "s1", [MC_MEM_SIZE]: 16 }
  },
  {
    modelId: "ht1080z-s2",
    displayName: "HT-1080Z Series II",
    config: { [MC_HT_MODEL]: "s2", [MC_MEM_SIZE]: 16 }
  },
  {
    modelId: "ht1080z-64",
    displayName: "HT-1080Z/64",
    config: { [MC_HT_MODEL]: "s64", [MC_MEM_SIZE]: 48 }
  },
  {
    modelId: "ht1080z-s1-48k",
    displayName: "HT-1080Z Series I (48K)",
    config: { [MC_HT_MODEL]: "s1", [MC_MEM_SIZE]: 48 }
  },
  {
    modelId: "ht1080z-s2-48k",
    displayName: "HT-1080Z Series II (48K)",
    config: { [MC_HT_MODEL]: "s2", [MC_MEM_SIZE]: 48 }
  }
];

/** What the core needs to know about a model (`ht1080zConfigure`) */
export type Ht1080zHardware = {
  romSet: Ht1080zRomSetId;
  /** 16 (RAM at $4000-$7FFF) or 48 (RAM at $4000-$FFFF) */
  ramKb: 16 | 48;
  clockFrequency: number;
};

export function resolveHt1080zHardware(config: MachineConfigSet | undefined): Ht1080zHardware {
  const model = config?.[MC_HT_MODEL];
  const romSet: Ht1080zRomSetId = model === "s1" || model === "s64" ? model : "s2";
  const mem = Number(config?.[MC_MEM_SIZE] ?? (romSet === "s64" ? 48 : 16));
  return {
    romSet,
    ramKb: mem >= 48 ? 48 : 16,
    clockFrequency: romSet === "s64" ? HT1080Z_CLOCK_64 : HT1080Z_CLOCK_S12
  };
}
