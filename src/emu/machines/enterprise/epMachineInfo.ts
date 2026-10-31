import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";

import { MC_EP_CARTRIDGE, MC_EP_EXDOS, MC_EP_HOSTFS, MC_EP_MODEL, MC_EP_PALETTE } from "@common/machines/constants";
import type { EpRomSetId } from "./EpRoms";

/**
 * The Enterprise 64/128: its models and the facts the host, the core and the renderer share
 * (`.plans/ENTERPRISE_PLAN.md` §4.3, D2).
 */

/** The CPU clock: the 8 MHz crystal divided by 2 */
export const EP_CLOCK = 4_000_000;

/** EXOS's frame: 312 NICK lines of 256.22 T, 79 941.9 T (the core's `EP_NOMINAL_FRAME_TACTS`) */
export const EP_TACTS_IN_FRAME = 79_942;

/** The TV picture (D7): the unblanked slots 10-55 (46 x 16 pixels), 288 lines; the core's `EP_SCREEN_*` */
export const EP_SCREEN_WIDTH = 736;
export const EP_SCREEN_HEIGHT = 288;

/**
 * The width of a pixel against its height, as the emulator panel draws it: Klive shows a Spectrum
 * pixel (7 MHz) square, and a NICK pixel (14.2375 MHz) lasts 7 / 14.2375 of one.
 */
export const EP_PIXEL_ASPECT = 7_000_000 / 14_237_536;

/**
 * The physical memory's layout in the core (`ep.c`): only the segments that hold something have room
 * in it; every other segment reads FFh from the unmapped block. The IDE's partitions are segment numbers.
 */
export const EP_SEGMENT_SIZE = 0x4000;
export const EP_PHYS_EXOS = 0x00000;
export const EP_PHYS_CART = 0x08000;
export const EP_PHYS_FILEIO = 0x0c000;
export const EP_PHYS_EXDOS = 0x10000;
export const EP_PHYS_RAM = 0x18000;
export const EP_PHYS_VRAM = 0x28000;
export const EP_PHYS_UNMAPPED = 0x38000;

/** NICK's line: 912 clocks of 14 237 536.27 Hz, in CPU T-states (256.22) */
export const EP_TACTS_PER_LINE = (912 * EP_CLOCK * 71) / 1_010_865_075;
/** NICK's slot (16 clocks) in T-states (4.495) */
export const EP_TACTS_PER_SLOT = EP_TACTS_PER_LINE / 57;
/** The TV window (`ep-nick.c`): its first line after vertical sync starts, its first slot */
export const EP_TV_FIRST_LINE = 25;
export const EP_TV_FIRST_SLOT = 10;

/** The ROMs present (`epConfigure`'s mask) */
export const EP_ROM_CART = 0x01;
export const EP_ROM_FILEIO = 0x02;
export const EP_ROM_EXDOS = 0x04;

/** The models (D2): the 128 runs EXOS 2.1 and IS-BASIC 2.1 in 128K; the 64 EXOS 2.0 and IS-BASIC 2.0 in 64K */
export const EP_MODELS: MachineModel[] = [
  {
    modelId: "ep128",
    displayName: "Enterprise 128",
    config: { [MC_EP_MODEL]: "128" }
  },
  {
    modelId: "ep64",
    displayName: "Enterprise 64",
    config: { [MC_EP_MODEL]: "64" }
  }
];

/** What the core needs to know about a model (`epConfigure`) */
export type EpHardware = {
  /** 128K of RAM (F8h-FFh); 64K otherwise (FCh-FFh) */
  is128: boolean;
  /** IS-BASIC in the cartridge slot (`MC_EP_CARTRIDGE`) */
  cartridge: boolean;
  /** The guide's linear colour levels instead of the board's resistor DAC (`MC_EP_PALETTE`) */
  linearPalette: boolean;
  /** Klive's FILE: device ROM at segment 10h (`MC_EP_HOSTFS`) */
  hostFs: boolean;
  /** The EXDOS floppy interface, its ROM at segments 20h-21h (`MC_EP_EXDOS`, off by default) */
  exdos: boolean;
  romSet: EpRomSetId;
};

export function resolveEpHardware(config: MachineConfigSet | undefined): EpHardware {
  const is128 = config?.[MC_EP_MODEL] !== "64";
  return {
    is128,
    cartridge: config?.[MC_EP_CARTRIDGE] !== false,
    linearPalette: config?.[MC_EP_PALETTE] === "linear",
    hostFs: config?.[MC_EP_HOSTFS] !== false,
    exdos: config?.[MC_EP_EXDOS] === true,
    romSet: is128 ? "21" : "20"
  };
}

/** What a segment holds on a machine with this hardware: its group in the memory panel's chooser */
export type EpSegmentKind = "exos" | "cartridge" | "expansion" | "exdos" | "ram" | "video" | "empty";

/** The hardware a segment's kind depends on (`exdos` absent: the card is not fitted) */
export type EpSegmentHardware = Pick<EpHardware, "is128" | "cartridge" | "hostFs"> & { exdos?: boolean };

export function epSegmentKind(hw: EpSegmentHardware, segment: number): EpSegmentKind {
  const s = segment & 0xff;
  if (s <= 0x01) return "exos";
  if (s === 0x04) return hw.cartridge ? "cartridge" : "empty";
  if (s === 0x10) return hw.hostFs ? "expansion" : "empty";
  if (s === 0x20 || s === 0x21) return hw.exdos ? "exdos" : "empty";
  if (s >= 0xfc) return "video";
  if (s >= 0xf8) return hw.is128 ? "ram" : "empty";
  return "empty";
}

const SEGMENT_GROUPS: Record<EpSegmentKind, string> = {
  exos: "EXOS ROM",
  cartridge: "Cartridge",
  expansion: "Expansion ROM",
  exdos: "Expansion ROM",
  ram: "RAM",
  video: "Video RAM",
  empty: "Empty"
};

function hex2(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

/**
 * The 256 segments' descriptions (the memory panel's chooser; the label, the hex number, stays the
 * identity): EXOS 0/1, IS-BASIC, Klive's FILE: ROM, the RAM and the video RAM that NICK shares
 */
export function epPartitionDescriptions(hw: EpSegmentHardware): Record<number, string> {
  const result: Record<number, string> = {};
  for (let s = 0; s < 256; s++) {
    const n = hex2(s);
    switch (epSegmentKind(hw, s)) {
      case "exos":
        result[s] = `EXOS ${s} (${n}h)`;
        break;
      case "cartridge":
        result[s] = `IS-BASIC (${n}h)`;
        break;
      case "expansion":
        result[s] = `FILE: device ROM (${n}h)`;
        break;
      case "exdos":
        result[s] = `EXDOS ${s - 0x20} (${n}h)`;
        break;
      case "ram":
        result[s] = `RAM ${n}h`;
        break;
      case "video":
        result[s] = `Video RAM ${n}h`;
        break;
      default:
        result[s] = `Segment ${n}h (empty)`;
    }
  }
  return result;
}

/** The caption each segment sits under in a chooser */
export function epPartitionGroups(hw: EpSegmentHardware): Record<number, string> {
  const result: Record<number, string> = {};
  for (let s = 0; s < 256; s++) result[s] = SEGMENT_GROUPS[epSegmentKind(hw, s)];
  return result;
}
