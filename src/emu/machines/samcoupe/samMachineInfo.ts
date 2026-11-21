import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";

import { MC_SAM_DRIVES, MC_SAM_EXTMEM, MC_SAM_MODEL, MC_SAM_MOUSE, MC_SAM_ROM } from "@common/machines/constants";
import { samRomImage, type SamRomImage } from "./SamRoms";

/**
 * The SAM Coupé: its models and the facts the host, the core and the renderer share
 * (`dev/plans/SAM_COUPE_PLAN.md` §4.3, D2).
 */

/** The CPU clock: the 24 MHz crystal divided by 4 */
export const SAM_CLOCK = 6_000_000;

/** A line is 384 T, a frame 312 lines (the core's `SAM_FRAME_TACTS`), 50.08 Hz */
export const SAM_TACTS_PER_LINE = 384;
export const SAM_LINES_PER_FRAME = 312;
export const SAM_TACTS_IN_FRAME = SAM_TACTS_PER_LINE * SAM_LINES_PER_FRAME;
/** The frame starts at the frame interrupt (vc 244), so screen line 0 is frame line 68 */
export const SAM_SCREEN_FIRST_LINE = 68;

/** The TV picture (D6): 12 MHz pixels, hc 96-383 plus the right border's 32 T, 288 lines; the core's `SAM_SCREEN_*` */
export const SAM_SCREEN_WIDTH = 640;
export const SAM_SCREEN_HEIGHT = 288;
/** The window's first hc and its lines above the screen */
export const SAM_TV_FIRST_HC = 96;
export const SAM_TV_TOP_LINES = 48;

/**
 * The width of a pixel against its height, as the emulator panel draws it: Klive shows a Spectrum pixel
 * (7 MHz) square, and a SAM pixel clock (12 MHz) lasts 7 / 12 of one
 */
export const SAM_PIXEL_ASPECT = 7 / 12;

/** The physical memory's layout in the core (`sam.c`) */
export const SAM_PAGE_SIZE = 0x4000;
export const SAM_PHYS_ROM = 0x000000;
export const SAM_PHYS_RAM = 0x008000;
export const SAM_PHYS_EXT = 0x088000;
export const SAM_PHYS_UNMAPPED = 0x188000;

/**
 * The IDE's partitions: internal pages 0-31 by their number, ROM0 and ROM1, and the external pack's
 * pages 0-63
 */
export const SAM_PARTITION_ROM0 = 0x40;
export const SAM_PARTITION_ROM1 = 0x41;
export const SAM_PARTITION_EXT = 0x80;

/** The models (D2) */
export const SAM_MODELS: MachineModel[] = [
  {
    modelId: "sam512",
    displayName: "SAM Coupé 512K",
    config: { [MC_SAM_MODEL]: "512" }
  },
  {
    modelId: "sam256",
    displayName: "SAM Coupé 256K",
    config: { [MC_SAM_MODEL]: "256" }
  }
];

/** What the core needs to know about a model (`samConfigure`) */
export type SamHardware = {
  /** Internal 16K pages: 32 (512K) or 16 (256K) */
  ramPages: number;
  /** External pages: 0, or 64 for one 1 MB pack */
  extPages: number;
  /** Internal drives, 0-2 */
  drives: number;
  /** The mouse interface */
  mouse: boolean;
  rom: SamRomImage;
};

export function resolveSamHardware(config: MachineConfigSet | undefined): SamHardware {
  const drives = Number(config?.[MC_SAM_DRIVES] ?? 1);
  return {
    ramPages: config?.[MC_SAM_MODEL] === "256" ? 16 : 32,
    extPages: Number(config?.[MC_SAM_EXTMEM] ?? 0) >= 1 ? 64 : 0,
    drives: Number.isFinite(drives) ? Math.max(0, Math.min(2, Math.trunc(drives))) : 1,
    mouse: config?.[MC_SAM_MOUSE] !== false,
    rom: samRomImage(config?.[MC_SAM_ROM])
  };
}

/** What a partition holds on a machine with this hardware: its group in the memory panel's chooser */
export type SamPartitionKind = "rom" | "ram" | "missing" | "ext";

export function samPartitionKind(hw: Pick<SamHardware, "ramPages" | "extPages">, partition: number): SamPartitionKind | undefined {
  if (partition === SAM_PARTITION_ROM0 || partition === SAM_PARTITION_ROM1) return "rom";
  if (partition >= 0 && partition < 32) return partition < hw.ramPages ? "ram" : "missing";
  if (partition >= SAM_PARTITION_EXT && partition < SAM_PARTITION_EXT + 64) return hw.extPages ? "ext" : undefined;
  return undefined;
}

/** Every partition's label: internal pages by number, R0/R1 for the ROMs, X00-X3F for external pages */
export function samPartitionLabels(hw: Pick<SamHardware, "ramPages" | "extPages">): Record<number, string> {
  const labels: Record<number, string> = {};
  for (let page = 0; page < 32; page++) labels[page] = page.toString(10).padStart(2, "0");
  labels[SAM_PARTITION_ROM0] = "R0";
  labels[SAM_PARTITION_ROM1] = "R1";
  if (hw.extPages) {
    for (let page = 0; page < hw.extPages; page++) labels[SAM_PARTITION_EXT + page] = `X${page.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return labels;
}

export function samPartitionDescriptions(hw: Pick<SamHardware, "ramPages" | "extPages">): Record<number, string> {
  const result: Record<number, string> = {};
  for (const [key, label] of Object.entries(samPartitionLabels(hw))) {
    const partition = Number(key);
    switch (samPartitionKind(hw, partition)) {
      case "rom":
        result[partition] = partition === SAM_PARTITION_ROM0 ? "ROM0 (R0)" : "ROM1 (R1)";
        break;
      case "ram":
        result[partition] = `RAM page ${partition}`;
        break;
      case "missing":
        result[partition] = `Page ${partition} (not fitted)`;
        break;
      default:
        result[partition] = `External page ${label.slice(1)}h`;
    }
  }
  return result;
}

const GROUPS: Record<SamPartitionKind, string> = { rom: "ROM", ram: "RAM", missing: "Not fitted", ext: "External RAM" };

export function samPartitionGroups(hw: Pick<SamHardware, "ramPages" | "extPages">): Record<number, string> {
  const result: Record<number, string> = {};
  for (const key of Object.keys(samPartitionLabels(hw))) {
    const partition = Number(key);
    result[partition] = GROUPS[samPartitionKind(hw, partition) ?? "missing"];
  }
  return result;
}

/** A partition's physical offset in the core's memory (the FFh page for one not fitted) */
export function samPartitionBase(hw: Pick<SamHardware, "ramPages" | "extPages">, partition: number): number {
  switch (samPartitionKind(hw, partition)) {
    case "rom":
      return SAM_PHYS_ROM + (partition - SAM_PARTITION_ROM0) * SAM_PAGE_SIZE;
    case "ram":
      return SAM_PHYS_RAM + partition * SAM_PAGE_SIZE;
    case "ext":
      return SAM_PHYS_EXT + (partition - SAM_PARTITION_EXT) * SAM_PAGE_SIZE;
    default:
      return SAM_PHYS_UNMAPPED;
  }
}

/** The partition a physical offset belongs to (the inverse of `samPartitionBase`) */
export function samPartitionOfPhysical(phys: number): number | undefined {
  if (phys < SAM_PHYS_RAM) return SAM_PARTITION_ROM0 + (phys >= SAM_PAGE_SIZE ? 1 : 0);
  if (phys < SAM_PHYS_EXT) return Math.floor((phys - SAM_PHYS_RAM) / SAM_PAGE_SIZE);
  if (phys < SAM_PHYS_UNMAPPED) return SAM_PARTITION_EXT + Math.floor((phys - SAM_PHYS_EXT) / SAM_PAGE_SIZE);
  return undefined;
}
