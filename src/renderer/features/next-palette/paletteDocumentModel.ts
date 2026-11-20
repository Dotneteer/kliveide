import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { PaletteDeviceInfo, PaletteWriteEvent } from "@common/messaging/EmuApi";
import { isPaletteStop } from "@common/utils/breakpoint-scope";
import { paletteStopOf, paletteStopSlots, type PaletteStopDevice } from "@common/zxnext/palette/paletteStops";
import { getCssStringForPaletteCode, paletteCodeFromDeviceValue } from "@emu/machines/zxNext/palette";

import { NEXT_PALETTE_DEVICES, type NextPaletteDeviceId } from "./nextPaletteDevices";
import { isEntryWritten } from "./nextPaletteRead";

/*
 * The Palette document's view model (`dev/plans/NEXT_PALETTE_DEBUGGING_PLAN.md` §4): what an entry
 * means, which entries a `pal:` breakpoint watches, what the previous stop held, and where Follow
 * goes. Pure, so the document's behaviour is tested without rendering.
 *
 * Values are as the core stores them (`PaletteDeviceInfo`): a straight 9-bit RGB333 colour with the
 * two `$44` priority bits in bits 9 and 10. `paletteCodeFromDeviceValue` turns one into the
 * register layout the drawing helpers take.
 */

/** The document's persisted view: which device, which bank and entry are selected, and Follow */
export type PaletteDocumentViewState = {
  device: NextPaletteDeviceId;
  bank: 0 | 1;
  index: number;
  follow: boolean;
};

export const DEFAULT_PALETTE_DOCUMENT_VIEW_STATE: PaletteDocumentViewState = {
  device: "ula",
  bank: 0,
  index: 0,
  follow: false
};

/** The `pal:` spelling of a document device */
export const STOP_DEVICE_OF: Record<NextPaletteDeviceId, Exclude<PaletteStopDevice, "any">> = {
  ula: "ula",
  layer2: "l2",
  sprites: "spr",
  tilemap: "tm"
};

/** A device's bank as a core slot (`$43` bits 6-4 order) */
export function slotOf(device: NextPaletteDeviceId, bank: 0 | 1): number {
  return NEXT_PALETTE_DEVICES.find((d) => d.id === device)!.slots[bank];
}

/** The device and bank of a core slot */
export function deviceOfSlot(slot: number): { device: NextPaletteDeviceId; bank: 0 | 1 } {
  const device = NEXT_PALETTE_DEVICES.find((d) => d.slots.includes(slot & 7))!;
  return { device: device.id, bank: device.slots[0] === (slot & 7) ? 0 : 1 };
}

/** The 256 stored values of a slot */
export function slotValues(info: PaletteDeviceInfo | undefined, slot: number): number[] {
  if (!info) return [];
  const { device, bank } = deviceOfSlot(slot);
  return NEXT_PALETTE_DEVICES.find((d) => d.id === device)!.banks[bank](info) ?? [];
}

const hex = (value: number, digits: number) => `$${value.toString(16).toUpperCase().padStart(digits, "0")}`;

/** Everything the details pane says about one stored value */
export type PaletteEntryDetails = {
  /** The 9-bit colour, `$000`-`$1FF` */
  rgb333: number;
  red: number;
  green: number;
  blue: number;
  /** What a `$41` write of this colour sends: the colour's top eight bits */
  nextReg41: number;
  /** The `$44` pair that stores this value: the top eight bits, then priority bits and blue's low bit */
  nextReg44: [number, number];
  /** `$44` bit 7: Layer 2 draws this colour over the other layers */
  priority: boolean;
  /** The CSS colour the IDE draws it with */
  css: string;
};

export function entryDetails(value: number): PaletteEntryDetails {
  const rgb333 = value & 0x1ff;
  return {
    rgb333,
    red: (rgb333 >> 6) & 7,
    green: (rgb333 >> 3) & 7,
    blue: rgb333 & 7,
    nextReg41: (rgb333 >> 1) & 0xff,
    nextReg44: [(rgb333 >> 1) & 0xff, (value & 0x200 ? 0x80 : 0) | (value & 0x400 ? 0x40 : 0) | (rgb333 & 1)],
    priority: (value & 0x200) !== 0,
    css: getCssStringForPaletteCode(paletteCodeFromDeviceValue(rgb333))
  };
}

/** `$1C0` */
export const formatRgb333 = (value: number) => hex(value & 0x1ff, 3);
/** `$03` */
export const formatEntry = (index: number) => hex(index & 0xff, 2);

/**
 * Whether the device draws this entry as transparent: the sprite and tilemap index registers
 * (`$4B`, `$4C`) name an entry; ULA and Layer 2 compare the colour's top eight bits with `$14`.
 */
export function isTransparentEntry(
  info: PaletteDeviceInfo | undefined,
  device: NextPaletteDeviceId,
  index: number,
  value: number
): boolean {
  if (!info) return false;
  const def = NEXT_PALETTE_DEVICES.find((d) => d.id === device)!;
  if (def.transparencyIndex) return def.transparencyIndex(info) === index;
  return info.globalTransparency !== undefined && ((value >> 1) & 0xff) === info.globalTransparency;
}

/** The entries of a device's bank that are transparent, for the grid's marks */
export function transparentEntries(
  info: PaletteDeviceInfo | undefined,
  device: NextPaletteDeviceId,
  bank: 0 | 1
): Set<number> {
  const result = new Set<number>();
  const values = slotValues(info, slotOf(device, bank));
  values.forEach((value, index) => {
    if (isTransparentEntry(info, device, index, value)) result.add(index);
  });
  return result;
}

/** A device-bank's entries written since the last stop */
export function writtenEntries(info: PaletteDeviceInfo | undefined, slot: number): Set<number> {
  const result = new Set<number>();
  for (let index = 0; index < 256; index++) {
    if (isEntryWritten(info, slot, index)) result.add(index);
  }
  return result;
}

/**
 * The value an entry held at the previous stop, when it was written since and `baseline` (the
 * palettes at that stop) is known; otherwise `undefined`. A rewrite of the same value still has an
 * old value: the details say "written, unchanged".
 */
export function previousValue(
  info: PaletteDeviceInfo | undefined,
  baseline: PaletteDeviceInfo | undefined,
  slot: number,
  index: number
): number | undefined {
  if (!baseline || !isEntryWritten(info, slot, index)) return undefined;
  return slotValues(baseline, slot)[index];
}

/** A `pal:` breakpoint's watched entries in one slot, with whether any of them is enabled */
export type PaletteWatchMarks = Map<number, { enabled: boolean; bps: BreakpointInfo[] }>;

/**
 * The entries of `slot` an entry `pal:` breakpoint watches (`pal:spr1:$03`, `pal:l2:$00-$0f`,
 * `pal:any`): each with the breakpoints that watch it. Live-bank (`:live`) breakpoints and run-to
 * targets mark nothing.
 */
export function watchedEntries(breakpoints: readonly BreakpointInfo[], slot: number): PaletteWatchMarks {
  const result: PaletteWatchMarks = new Map();
  for (const bp of breakpoints) {
    if (!isPaletteStop(bp) || bp.runTo) continue;
    const stop = paletteStopOf(bp.paletteStop);
    if (!stop || stop.live || !paletteStopSlots(stop).includes(slot)) continue;
    const from = stop.from ?? 0;
    const to = stop.to ?? 0xff;
    for (let index = from; index <= to; index++) {
      const mark = result.get(index) ?? { enabled: false, bps: [] };
      mark.bps.push(bp);
      mark.enabled ||= !bp.disabled;
      result.set(index, mark);
    }
  }
  return result;
}

/** Whether an enabled `pal:` breakpoint watches any entry of the device, or its live bank */
export function deviceIsWatched(breakpoints: readonly BreakpointInfo[], device: NextPaletteDeviceId): boolean {
  const def = NEXT_PALETTE_DEVICES.find((d) => d.id === device)!;
  return breakpoints.some((bp) => {
    if (!isPaletteStop(bp) || bp.runTo || bp.disabled) return false;
    const stop = paletteStopOf(bp.paletteStop);
    return !!stop && paletteStopSlots(stop).some((slot) => def.slots.includes(slot));
  });
}

/** The spec of the breakpoint the document sets on one entry: `spr1:$03` (without `pal:`) */
export function entryBreakpointSpec(device: NextPaletteDeviceId, bank: 0 | 1, index: number): string {
  return `${STOP_DEVICE_OF[device]}${bank + 1}:$${(index & 0xff).toString(16).padStart(2, "0")}`;
}

/** The `bp-set` line for an entry breakpoint, as the document copies it */
export function entryBreakpointCommand(
  device: NextPaletteDeviceId,
  bank: 0 | 1,
  index: number,
  changed = false
): string {
  return `bp-set pal:${entryBreakpointSpec(device, bank, index).toUpperCase()}${changed ? " -changed" : ""}`;
}

/** The exact entry breakpoint on this entry (`pal:spr1:$03`), if there is one */
export function entryBreakpoint(
  breakpoints: readonly BreakpointInfo[],
  device: NextPaletteDeviceId,
  bank: 0 | 1,
  index: number
): BreakpointInfo | undefined {
  const spec = entryBreakpointSpec(device, bank, index);
  return breakpoints.find((bp) => isPaletteStop(bp) && !bp.runTo && bp.paletteStop === spec);
}

/** Where Follow takes the view: a device, a bank and an entry */
export type PaletteFollowTarget = { device: NextPaletteDeviceId; bank: 0 | 1; index: number };

/**
 * Where Follow goes after a stop: the write the machine stopped on when a `pal:` breakpoint stopped
 * it (`lastWrite`); otherwise the first entry written since the last stop, in slot order. A flip
 * goes to the device's newly live bank. `undefined` when nothing was written.
 */
export function followTarget(
  info: PaletteDeviceInfo | undefined,
  lastWrite: PaletteWriteEvent | undefined
): PaletteFollowTarget | undefined {
  if (lastWrite) {
    const { device, bank } = deviceOfSlot(lastWrite.slot);
    return { device, bank, index: lastWrite.kind === "entry" ? lastWrite.index : 0 };
  }
  for (let slot = 0; slot < 8; slot++) {
    for (let byte = 0; byte < 32; byte++) {
      const bits = info?.written?.[slot * 32 + byte] ?? 0;
      if (!bits) continue;
      let bit = 0;
      while (!(bits & (1 << bit))) bit++;
      const { device, bank } = deviceOfSlot(slot);
      return { device, bank, index: byte * 8 + bit };
    }
  }
  return undefined;
}

/** The last palette breakpoint hit, when it wrote this entry */
export function lastWriteOfEntry(
  lastWrite: PaletteWriteEvent | undefined,
  slot: number,
  index: number
): PaletteWriteEvent | undefined {
  return lastWrite?.kind === "entry" && lastWrite.slot === slot && lastWrite.index === index ? lastWrite : undefined;
}
