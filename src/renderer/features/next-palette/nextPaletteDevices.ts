import type { PaletteDeviceInfo } from "@common/messaging/EmuApi";

/*
 * The Next's palette-owning devices (`.plans/TILEMAP_INSPECTOR_PLAN.md` §4.6): shared by the Next
 * Palettes panel and `useNextDevicePalette`, so a device's live bank and transparency are decided in
 * one place.
 */

export type NextPaletteDeviceId = "ula" | "layer2" | "sprites" | "tilemap";

/**
 * The four palette-owning devices, in the order the Next's own documentation lists them.
 *
 * This is a table rather than eight hand-written blocks because the *shape* is the point: a Next
 * device does not have two independent palettes, it has one palette with two banks and a register
 * bit that says which of them is live. The previous panel flattened that into eight peer entries
 * named "ULA first", "ULA second", ..., which threw away the pairing, the "one of these is the one
 * the machine is drawing with" fact, and the reason anyone opens this panel.
 */
export type NextPaletteDeviceDef = {
  id: NextPaletteDeviceId;
  label: string;
  banks: [(info: PaletteDeviceInfo) => number[], (info: PaletteDeviceInfo) => number[]];
  /** Which bank the hardware is currently drawing from. */
  liveBank: (info: PaletteDeviceInfo) => 0 | 1;
  /** The register bit that decides it, for the bank control's tooltip. */
  liveSource: string;
  /**
   * The palette index this device treats as transparent, where that is an index at all.
   *
   * ULA and Layer 2 have none: Next Reg $14 is a global transparency *colour* matched against a
   * pixel's 8-bit value, not a palette slot, so there is no single entry to mark and marking an
   * arbitrary one would be a lie.
   */
  transparencyIndex?: (info: PaletteDeviceInfo) => number;
};

export const NEXT_PALETTE_DEVICES: NextPaletteDeviceDef[] = [
  {
    id: "ula",
    label: "ULA",
    banks: [(i) => i.ulaFirst, (i) => i.ulaSecond],
    liveBank: (i) => ((i.reg43Value ?? 0) & 0x02 ? 1 : 0),
    liveSource: "Reg $43, bit 1"
  },
  {
    id: "layer2",
    label: "Layer 2",
    banks: [(i) => i.layer2First, (i) => i.layer2Second],
    liveBank: (i) => ((i.reg43Value ?? 0) & 0x04 ? 1 : 0),
    liveSource: "Reg $43, bit 2"
  },
  {
    id: "sprites",
    label: "Sprites",
    banks: [(i) => i.spriteFirst, (i) => i.spriteSecond],
    liveBank: (i) => ((i.reg43Value ?? 0) & 0x08 ? 1 : 0),
    liveSource: "Reg $43, bit 3",
    transparencyIndex: (i) => i.spriteTransparencyIndex
  },
  {
    id: "tilemap",
    label: "Tilemap",
    banks: [(i) => i.tilemapFirst, (i) => i.tilemapSecond],
    liveBank: (i) => ((i.reg6bValue ?? 0) & 0x10 ? 1 : 0),
    liveSource: "Reg $6B, bit 4",
    transparencyIndex: (i) => i.tilemapTransparencyIndex
  }
];

/** A device by id. */
export function nextPaletteDevice(id: NextPaletteDeviceId): NextPaletteDeviceDef {
  return NEXT_PALETTE_DEVICES.find((d) => d.id === id)!;
}
