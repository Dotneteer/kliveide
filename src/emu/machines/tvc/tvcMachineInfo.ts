import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";

import { MC_TVC_MODEL } from "@common/machines/constants";
import type { TvcRomSetId } from "./TvcRoms";

/**
 * The Videoton TV Computer: its models and the facts the host, the core and the renderer share
 * (`.plans/VIDEOTON_TVC_PLAN.md` §4.3, D2).
 */

/** The CPU clock: the 25 MHz crystal divided by 8 */
export const TVC_CLOCK = 3_125_000;

/** The ROM's CRTC values: 100 characters (2 T each) a line, 314 lines a frame: 49.76 Hz */
export const TVC_TACTS_PER_LINE = 200;
export const TVC_LINES_PER_FRAME = 314;
export const TVC_TACTS_IN_FRAME = TVC_TACTS_PER_LINE * TVC_LINES_PER_FRAME;

/** The TV picture (D4): 76 characters of 8 dots, 288 lines; the core's `TVC_SCREEN_WIDTH`/`HEIGHT` */
export const TVC_SCREEN_WIDTH = 608;
export const TVC_SCREEN_HEIGHT = 288;

/**
 * The width of a dot against its height, as the emulator panel draws it: Klive shows a Spectrum
 * pixel (7 MHz) square, and a TVC dot (12.5 MHz) lasts 7 / 12.5 of one.
 */
export const TVC_PIXEL_ASPECT = 7_000_000 / 12_500_000;

/** The physical memory's layout in the core (`tvc.c`): every bank the mapper can show */
export const TVC_PHYS_U0 = 0x00000;
export const TVC_PHYS_VID0 = 0x10000;
export const TVC_PHYS_SYS = 0x20000;
export const TVC_PHYS_CART = 0x24000;
export const TVC_PHYS_EXTH = 0x28000;
export const TVC_PHYS_EXT_CARD = 0x2a000;
export const TVC_BANK_SIZE = 0x4000;

/** The models (D2): the 64K runs BASIC 1.2 with one video bank; the 64K+ BASIC 2.2 with four */
export const TVC_MODELS: MachineModel[] = [
  {
    modelId: "tvc64",
    displayName: "Videoton TVC 64K",
    config: { [MC_TVC_MODEL]: "64" }
  },
  {
    modelId: "tvc64p",
    displayName: "Videoton TVC 64K+",
    config: { [MC_TVC_MODEL]: "64p" }
  }
];

/** What the core needs to know about a model (`tvcConfigure`) */
export type TvcHardware = {
  /** The 64K+: four video banks (port 0Ch), no WAIT circuit, BASIC 2.2 */
  plus: boolean;
  romSet: TvcRomSetId;
};

export function resolveTvcHardware(config: MachineConfigSet | undefined): TvcHardware {
  const plus = config?.[MC_TVC_MODEL] === "64p";
  return { plus, romSet: plus ? "22" : "12" };
}
