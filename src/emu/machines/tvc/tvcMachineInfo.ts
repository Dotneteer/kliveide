import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";

import { MC_TVC_HBF, MC_TVC_MODEL } from "@common/machines/constants";
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

/** The TV picture (D4): 70 characters of 8 dots, 288 lines; the core's `TVC_SCREEN_WIDTH`/`HEIGHT` */
export const TVC_SCREEN_WIDTH = 560;
export const TVC_SCREEN_HEIGHT = 288;

/**
 * The width of a dot against its height, as the emulator panel draws it: Klive shows a Spectrum
 * pixel (7 MHz) square, and a TVC dot (12.5 MHz) lasts 7 / 12.5 of one.
 */
export const TVC_PIXEL_ASPECT = 7_000_000 / 12_500_000;

/**
 * The physical memory's layout in the core (`tvc.c`): every bank the mapper can show, as the IDE's
 * partitions - U0-U3 and VID0-VID3 are 0-7 (partition * 16K), SYS is -1, CART -2, and EXT -3 (the
 * card window, then EXTH, as the EXT page shows them)
 */
export const TVC_PHYS_U0 = 0x00000;
export const TVC_PHYS_VID0 = 0x10000;
export const TVC_PHYS_SYS = 0x20000;
export const TVC_PHYS_CART = 0x24000;
export const TVC_PHYS_EXT_CARD = 0x28000;
export const TVC_PHYS_EXTH = 0x2a000;
/** The HBF card (`tvc-hbf.c`): its ROM's four 4K pages, then its 4K RAM */
export const TVC_PHYS_HBF_ROM = 0x2c000;
export const TVC_PHYS_HBF_RAM = 0x30000;
export const TVC_HBF_PAGE_SIZE = 0x1000;
export const TVC_BANK_SIZE = 0x4000;
export const TVC_PARTITION_SYS = -1;
export const TVC_PARTITION_CART = -2;
export const TVC_PARTITION_EXT = -3;
/** The HBF card's ROM pages 0-3 are partitions -4 to -7, its RAM -8 (4K each) */
export const TVC_PARTITION_HBF_ROM0 = -4;
export const TVC_PARTITION_HBF_RAM = -8;

/**
 * The loop BASIC waits for a key in at its prompt, with SYS in page 3: 1.2's at D61Bh (inside KB_CHIN,
 * D618h, which loads HL with 0BE5h first), 2.2's at CA9Fh. Behaviour facts read from the ROMs
 * (`.plans/VIDEOTON_TVC_PLAN.md` §0.1).
 */
export const TVC12_KEY_WAIT_LOOP = 0xd61b;
export const TVC22_KEY_WAIT_LOOP = 0xca9f;

/**
 * The whole key-wait routine, start and end (exclusive): where BASIC is while it is idle at its prompt.
 * 1.2's is KB_CHIN (read from the ROM); 2.2's is where the ROM was seen looping after its banner.
 */
export const TVC12_KEY_WAIT_ROUTINE: readonly [number, number] = [0xd618, 0xd62d];
export const TVC22_KEY_WAIT_ROUTINE: readonly [number, number] = [0xca9f, 0xcaac];

/**
 * An address of the sign-on animation's loop, which runs until a key is pressed and does not use the
 * key wait: 1.2's at CAB7h (SYS), 2.2's at F2EEh (EXTH). Observed on the core: neither is reached
 * before the RAM test ends (frame 252 and 254 after power-on).
 */
export const TVC12_SIGN_ON_LOOP = 0xcab7;
export const TVC22_SIGN_ON_LOOP = 0xf2ee;

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
  /** The HBF floppy interface in slot 0, with VT-DOS (`MC_TVC_HBF`) */
  hbf: boolean;
  romSet: TvcRomSetId;
};

export function resolveTvcHardware(config: MachineConfigSet | undefined): TvcHardware {
  const plus = config?.[MC_TVC_MODEL] === "64p";
  return { plus, hbf: config?.[MC_TVC_HBF] === true, romSet: plus ? "22" : "12" };
}
