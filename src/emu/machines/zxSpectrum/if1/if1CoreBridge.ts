/*
 * The TypeScript side of the cores' Interface 1 (`zx-spectrum-if1.c`, `.plans/MICRODRIVE_PLAN.md`).
 * The 48K and 128K cores export the same functions under their own prefix (`sp48If1SetPresent`, ...),
 * as the DivMMC's do; `scripts/if1-exports.cjs` keeps the build side of the list.
 *
 * A cartridge lives in the core as an .mdr holds it: up to 254 slots of 543 bytes (the 15-byte
 * header, then the 528-byte record). Every write into that image goes through `writeCoreBytes`, so
 * an attached reverse-debugging journal sees it.
 */

import { writeCoreBytes } from "@emu/machines/reverse/coreMemoryWrites";

export type Interface1CorePrefix = "sp48" | "sp128";

/** The export names without the core's prefix (`scripts/if1-exports.cjs` keeps the build side) */
export const IF1_EXPORT_SUFFIXES = [
  "If1SetPresent",
  "If1GetPresent",
  "If1RomPtr",
  "If1RomUploaded",
  "If1GetPaged",
  "If1SetPaged",
  "If1GetControl",
  "If1GetSelect",
  "If1GetFrozen",
  "If1GetDriveCount",
  "If1GetMaxSlots",
  "If1DriveImagePtr",
  "If1Insert",
  "If1Eject",
  "If1SetWriteProtected",
  "If1GetDriveInfo",
  "If1GetDirtyRevision",
  "If1GetSlotDirty",
  "If1ClearDirty",
  "If1GetSlotSignal"
] as const;

/** The Interface 1 exports of a core with the given prefix */
export type Interface1CoreExports<P extends string> = {
  [K in (typeof IF1_EXPORT_SUFFIXES)[number] as `${P}${K}`]: (...args: number[]) => number;
};

export const IF1_DRIVES = 8;
export const IF1_MAX_SLOTS = 254;
export const IF1_SLOT_SIZE = 543;

/** The head's segments within a slot, in tape order (`ZXIF1_SEG_*`) */
export const IF1_SEGMENTS = ["gapA", "headerPreamble", "headerData", "gapB", "recordPreamble", "recordData", "gapC"] as const;
export type Interface1Segment = (typeof IF1_SEGMENTS)[number];

export type Interface1DriveState = {
  inserted: boolean;
  slots: number;
  writeProtected: boolean;
  motorOn: boolean;
  /** Where the head is: its slot, its segment, and the data bytes handed out of that segment */
  slot: number;
  segment: Interface1Segment;
  dataIndex: number;
};

export type Interface1State = {
  present: boolean;
  paged: boolean;
  /** The last value written to port $EF */
  control: number;
  /** The drives selected: bit n is drive n + 1 */
  select: number;
  /** 0 running; 1 frozen by WAIT until a tact; 2 frozen for good (the "IN 0 crash") */
  frozen: number;
  dirtyRevision: number;
};

type CoreFunctions = Record<string, (...args: number[]) => number>;

/** What the support needs from the machine */
export interface Interface1MachineHost {
  /** The machine's core (undefined before `setup`) */
  getIf1Runtime(): { exports: object } | undefined;
}

/** How many slots an .mdr of `length` bytes holds, and whether it ends with the write-protect byte */
export function mdrShape(length: number): { slots: number; hasWriteProtectByte: boolean } | undefined {
  const hasWriteProtectByte = length % IF1_SLOT_SIZE === 1;
  const slots = Math.floor(length / IF1_SLOT_SIZE);
  if ((length % IF1_SLOT_SIZE !== 0 && !hasWriteProtectByte) || slots < 1 || slots > IF1_MAX_SLOTS) return undefined;
  return { slots, hasWriteProtectByte };
}

export class Interface1Support {
  constructor(
    readonly prefix: Interface1CorePrefix,
    private readonly host: Interface1MachineHost
  ) {}

  private get runtime(): { exports: object } | undefined {
    return this.host.getIf1Runtime();
  }

  private get fns(): CoreFunctions | undefined {
    return this.runtime?.exports as CoreFunctions | undefined;
  }

  private call(suffix: string, ...args: number[]): number {
    const fn = this.fns?.[this.prefix + suffix];
    return typeof fn === "function" ? ((fn(...args) as number) ?? 0) : 0;
  }

  private bytesAt(pointer: number, length: number): Uint8Array | undefined {
    const buffer = (this.runtime?.exports as { memory?: WebAssembly.Memory } | undefined)?.memory?.buffer;
    return buffer ? new Uint8Array(buffer, pointer, length) : undefined;
  }

  /** Does the core have the Interface 1 at all (the Timex build of the 48K core has none)? */
  get available(): boolean {
    return typeof this.fns?.[`${this.prefix}If1SetPresent`] === "function";
  }

  /** Puts an 8K ROM into the core */
  uploadRom(rom: Uint8Array): void {
    const target = this.bytesAt(this.call("If1RomPtr"), 0x2000);
    if (!target || !this.runtime) return;
    writeCoreBytes(this.runtime.exports, target, rom.subarray(0, 0x2000));
    this.call("If1RomUploaded");
  }

  /** The ROM in the core (8K) */
  rom(): Uint8Array | undefined {
    return this.bytesAt(this.call("If1RomPtr"), 0x2000);
  }

  /** Connects the interface (with a ROM already uploaded) or disconnects it; the host resets after */
  setPresent(present: boolean): void {
    this.call("If1SetPresent", present ? 1 : 0);
  }

  /** A snapshot's paging */
  setPaged(paged: boolean): void {
    this.call("If1SetPaged", paged ? 1 : 0);
  }

  /** The drives selected - their motors run - as one cheap read: bit n is drive n + 1 */
  selectBits(): number {
    return this.call("If1GetSelect") & 0xff;
  }

  state(): Interface1State {
    return {
      present: this.call("If1GetPresent") !== 0,
      paged: this.call("If1GetPaged") !== 0,
      control: this.call("If1GetControl") & 0xff,
      select: this.call("If1GetSelect") & 0xff,
      frozen: this.call("If1GetFrozen"),
      dirtyRevision: this.call("If1GetDirtyRevision")
    };
  }

  drive(index: number): Interface1DriveState {
    const field = (f: number) => this.call("If1GetDriveInfo", index, f);
    return {
      inserted: field(0) !== 0,
      slots: field(1),
      writeProtected: field(2) !== 0,
      motorOn: field(3) !== 0,
      slot: field(4),
      segment: IF1_SEGMENTS[field(5)] ?? "gapA",
      dataIndex: field(6)
    };
  }

  /**
   * Inserts an .mdr image into drive `index` (0-7). Its trailing byte, when it has one, sets the
   * write protection unless `writeProtected` says otherwise.
   * @returns false for a length that is no .mdr
   */
  insert(index: number, mdr: Uint8Array, writeProtected?: boolean): boolean {
    const shape = mdrShape(mdr.length);
    if (!shape || !this.runtime) return false;
    const image = this.bytesAt(this.call("If1DriveImagePtr", index), IF1_MAX_SLOTS * IF1_SLOT_SIZE);
    if (!image) return false;
    const slotBytes = shape.slots * IF1_SLOT_SIZE;
    writeCoreBytes(this.runtime.exports, image, mdr.subarray(0, slotBytes));
    const protect = writeProtected ?? (shape.hasWriteProtectByte && mdr[mdr.length - 1] !== 0);
    this.call("If1Insert", index, shape.slots, protect ? 1 : 0);
    return true;
  }

  eject(index: number): void {
    this.call("If1Eject", index);
  }

  setWriteProtected(index: number, writeProtected: boolean): void {
    this.call("If1SetWriteProtected", index, writeProtected ? 1 : 0);
  }

  /** Drive `index`'s cartridge as an .mdr (with the write-protect byte), or undefined when empty */
  cartridge(index: number): Uint8Array | undefined {
    const info = this.drive(index);
    if (!info.inserted) return undefined;
    const image = this.bytesAt(this.call("If1DriveImagePtr", index), info.slots * IF1_SLOT_SIZE);
    if (!image) return undefined;
    const mdr = new Uint8Array(image.length + 1);
    mdr.set(image);
    mdr[image.length] = info.writeProtected ? 1 : 0;
    return mdr;
  }

  /** Per slot: bit 0 the header has signal, bit 1 the record has */
  slotSignal(index: number, slot: number): number {
    return this.call("If1GetSlotSignal", index, slot) & 0x03;
  }

  /** The slots written since the last `clearDirty` */
  dirtySlots(index: number): number[] {
    const slots: number[] = [];
    const count = this.drive(index).slots;
    for (let slot = 0; slot < count; slot++) if (this.call("If1GetSlotDirty", index, slot) !== 0) slots.push(slot);
    return slots;
  }

  clearDirty(index: number): void {
    this.call("If1ClearDirty", index);
  }
}

/** A blank, unformatted cartridge: every byte $FF, so no block has a valid checksum */
export function blankMdr(slots = IF1_MAX_SLOTS): Uint8Array {
  const mdr = new Uint8Array(slots * IF1_SLOT_SIZE + 1).fill(0xff);
  mdr[mdr.length - 1] = 0;
  return mdr;
}
