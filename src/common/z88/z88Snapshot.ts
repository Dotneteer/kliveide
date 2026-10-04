/*
 * The parser of OZvm `.z88` snapshot files.
 *
 * Normative format: https://gitlab.com/b4works/ozvm/-/wikis/Z88-Snapshot-Format. The design is in
 * `.plans/Z88_SNAPSHOT_PLAN.md` §4.1.
 *
 * This module only reads the file. Whether Klive can load what it read (the card types and sizes it
 * emulates, hybrid cards) is decided by `z88SnapshotMapping.ts`. That way the `.z88` viewer can show
 * a file Klive cannot load, and say why.
 *
 * Pure: no Node or DOM APIs. Used by the IDE viewer, the load command and the tests.
 */

import { decodeLatin1, parseJavaProperties } from "./z88Properties";
import { readZipEntries } from "./z88Zip";
import type { Z88Tim } from "./z88Rtc";

/** The size of a Z88 bank */
export const Z88_BANK_SIZE = 0x4000;

/** The bottom bank of the slot-0 internal RAM */
export const Z88_INTERNAL_RAM_BANK = 0x20;

/** OZvm's slot type codes for the hybrid 512K RAM + 512K Flash cards */
export const Z88_OZVM_HYBRID_TYPES: readonly number[] = [8, 9, 12];

/** The Z80 state stored in a snapshot */
export type Z88SnapshotCpu = {
  af: number;
  bc: number;
  de: number;
  hl: number;
  ix: number;
  iy: number;
  pc: number;
  sp: number;
  /** The alternate (shadow) register set */
  af_: number;
  bc_: number;
  de_: number;
  hl_: number;
  i: number;
  r: number;
  im: number;
  iff1: boolean;
  iff2: boolean;
};

/** The Blink registers stored in a snapshot */
export type Z88SnapshotBlink = {
  com: number;
  int: number;
  sta: number;
  tmk: number;
  tsta: number;
  /** SR0..SR3: the bank bound to each segment */
  sr: [number, number, number, number];
  /** TIM0..TIM4, as saved (before any RTC catch-up) */
  tim: Z88Tim;
  /** PB0..PB3: LORES0, LORES1, HIRES0, HIRES1 */
  pb: [number, number, number, number];
  /** SBF, the Screen Base File register (stored under the key "SBR", as OZvm writes it) */
  sbf: number;
  /** LCD width in pixels / 8 */
  scw: number;
  /** LCD height in pixels / 8 */
  sch: number;
};

/** An external card slot (1..3) of a snapshot */
export type Z88SnapshotSlot = {
  /** OZvm's `SLOTnTYPE` code */
  ozvmType: number;
  /** The `slotN.bin` image; for a legacy hybrid it is the Flash half */
  bytes?: Uint8Array;
  /** Hybrid cards: `ramN.bin` (the lower 512K) */
  ram?: Uint8Array;
  /** Hybrid cards: `flashN.bin` (the upper 512K), or a legacy `slotN.bin` */
  flash?: Uint8Array;
};

/** A breakpoint stored in a snapshot */
export type Z88SnapshotBreakpoint = {
  /** The bank */
  bank: number;
  /** The offset within the bank (0000-3FFF in a well-formed file; kept as written) */
  offset: number;
  /** A display breakpoint is shown but does not stop */
  display: boolean;
};

/** A parsed `.z88` snapshot */
export type Z88Snapshot = {
  cpu: Z88SnapshotCpu;
  blink: Z88SnapshotBlink;
  /** Slot 0, the internal ROM area (banks 00h..) */
  rom: {
    /** OZvm's `SLOT0TYPE`, or undefined when the file does not store it (old files) */
    ozvmType?: number;
    bytes: Uint8Array;
  };
  /** Slot 0, the internal RAM (banks 20h..) */
  ram: Uint8Array;
  /** Index 1..3; index 0 is always null (slot 0 is `rom` + `ram`). Null means an empty slot. */
  slots: [null, Z88SnapshotSlot | null, Z88SnapshotSlot | null, Z88SnapshotSlot | null];
  /** True: start the machine after loading. False: stop in the debugger at PC. */
  autorun: boolean;
  /** `Z88StoppedAtTime`: host ms since 1970 when the machine was saved, if stored */
  stoppedAt?: number;
  breakpoints: Z88SnapshotBreakpoint[];
  /** The `snapshot.png` LCD picture, if present. Cosmetic only. */
  png?: Uint8Array;
  /** Every ZIP member, with its uncompressed size, in archive order */
  entries: { name: string; size: number }[];
  /** Problems that do not stop the snapshot from being read */
  warnings: string[];
};

/** The members of a snapshot that the format defines */
const SETTINGS = "snapshot.settings";
const ROM = "rom.bin";
const RAM = "ram.bin";
const PNG = "snapshot.png";

/**
 * Parses a `.z88` snapshot.
 * @param bytes The file contents
 * @throws An `Error` whose message says what is wrong, when the file is not a valid snapshot
 */
export function parseZ88Snapshot(bytes: Uint8Array): Z88Snapshot {
  const zip = readZipEntries(bytes);
  const entries = [...zip.entries()].map(([name, data]) => ({ name, size: data.length }));
  const warnings: string[] = [];

  // --- The required members
  const settingsBytes = zip.get(SETTINGS);
  if (!settingsBytes) {
    throw new Error(`The file is not a Z88 snapshot: it has no ${SETTINGS}`);
  }
  const romBytes = zip.get(ROM);
  if (!romBytes) {
    throw new Error(`The snapshot has no ${ROM}`);
  }
  const ramBytes = zip.get(RAM);
  if (!ramBytes) {
    throw new Error(`The snapshot has no ${RAM}`);
  }
  checkBankImage(ROM, romBytes, 32);
  checkBankImage(RAM, ramBytes, 32);

  const props = new Settings(parseJavaProperties(decodeLatin1(settingsBytes)));

  const cpu: Z88SnapshotCpu = {
    af: props.word("AF"),
    bc: props.word("BC"),
    de: props.word("DE"),
    hl: props.word("HL"),
    ix: props.word("IX"),
    iy: props.word("IY"),
    pc: props.word("PC"),
    sp: props.word("SP"),
    af_: props.word("_AF"),
    bc_: props.word("_BC"),
    de_: props.word("_DE"),
    hl_: props.word("_HL"),
    i: props.byte("I"),
    r: props.byte("R"),
    im: props.byte("IM"),
    iff1: props.bool("IFF1"),
    iff2: props.bool("IFF2")
  };
  if (cpu.im > 2) {
    throw new Error(`Invalid interrupt mode IM=${cpu.im}`);
  }

  const blink: Z88SnapshotBlink = {
    com: props.byte("COM"),
    int: props.byte("INT"),
    sta: props.byte("STA"),
    tmk: props.byte("TMK"),
    tsta: props.byte("TSTA"),
    sr: [props.byte("SR0"), props.byte("SR1"), props.byte("SR2"), props.byte("SR3")],
    tim: [
      props.byte("TIM0"),
      props.byte("TIM1"),
      props.byte("TIM2"),
      props.byte("TIM3"),
      props.byte("TIM4")
    ],
    pb: [props.word("PB0"), props.word("PB1"), props.word("PB2"), props.word("PB3")],
    sbf: props.word("SBR"),
    scw: props.word("SCW", 0x0050),
    sch: props.word("SCH", 0x0008)
  };

  // --- Slot 0's ROM type is optional on old files: the size of rom.bin then decides
  const slot0Type = props.has("SLOT0TYPE") ? props.decimal("SLOT0TYPE") : undefined;

  // --- External slots: the type is required; the image depends on it
  const slots: Z88Snapshot["slots"] = [null, null, null, null];
  for (let slot = 1; slot <= 3; slot++) {
    const key = `SLOT${slot}TYPE`;
    if (!props.has(key)) {
      throw new Error(`The snapshot settings have no ${key}`);
    }
    const ozvmType = props.decimal(key);
    slots[slot] = readSlot(zip, slot, ozvmType, warnings);
  }

  // --- Session and debug information
  const autorun = props.has("Autorun") ? props.bool("Autorun") : true;
  let stoppedAt: number | undefined;
  if (props.has("Z88StoppedAtTime")) {
    stoppedAt = props.decimal("Z88StoppedAtTime");
  }
  const breakpoints = parseBreakpoints(props.raw("Breakpoints") ?? "", warnings);

  // --- Members the format does not define, or a slot image for an empty slot
  for (const { name } of entries) {
    if (!isKnownMember(name, slots)) {
      warnings.push(`Unused member in the snapshot: ${name}`);
    }
  }

  return {
    cpu,
    blink,
    rom: { ozvmType: slot0Type, bytes: romBytes },
    ram: ramBytes,
    slots,
    autorun,
    stoppedAt,
    breakpoints,
    png: zip.get(PNG),
    entries,
    warnings
  };
}

/**
 * Reads an external slot's image(s). An occupied slot without its image is not an error: OZvm then
 * inserts no card, so it is read as empty, with a warning.
 */
function readSlot(
  zip: Map<string, Uint8Array>,
  slot: number,
  ozvmType: number,
  warnings: string[]
): Z88SnapshotSlot | null {
  if (ozvmType === 0) {
    return null;
  }
  const slotName = `slot${slot}.bin`;
  if (Z88_OZVM_HYBRID_TYPES.includes(ozvmType)) {
    const ramName = `ram${slot}.bin`;
    const flashName = `flash${slot}.bin`;
    const ram = zip.get(ramName);
    // --- Older files stored only the Flash half, as slotN.bin
    const flash = zip.get(flashName) ?? zip.get(slotName);
    if (ram) checkBankImage(ramName, ram, 32);
    if (flash) checkBankImage(zip.has(flashName) ? flashName : slotName, flash, 32);
    if (!ram && !flash) {
      warnings.push(`Slot ${slot} is a hybrid card, but the snapshot has no image for it`);
      return null;
    }
    return { ozvmType, ram, flash };
  }

  const bytes = zip.get(slotName);
  if (!bytes) {
    warnings.push(`Slot ${slot} has card type ${ozvmType}, but the snapshot has no ${slotName}`);
    return null;
  }
  checkBankImage(slotName, bytes, 64);
  return { ozvmType, bytes };
}

/**
 * Checks that an image is a whole number of 16K banks, and no more than fit its area.
 * @param name The member name, for the message
 * @param bytes The image
 * @param maxBanks The number of banks the area has
 */
function checkBankImage(name: string, bytes: Uint8Array, maxBanks: number): void {
  if (bytes.length === 0 || bytes.length % Z88_BANK_SIZE !== 0) {
    throw new Error(`${name} is ${bytes.length} bytes, not a whole number of 16K banks`);
  }
  if (bytes.length > maxBanks * Z88_BANK_SIZE) {
    throw new Error(`${name} is ${bytes.length} bytes, larger than the ${maxBanks * 16}K it can hold`);
  }
}

/**
 * Parses the `Breakpoints` value: a comma-separated list of `[d]BBHHHH` items. A malformed item is
 * skipped with a warning; breakpoints are informational and never block a load.
 */
function parseBreakpoints(value: string, warnings: string[]): Z88SnapshotBreakpoint[] {
  const result: Z88SnapshotBreakpoint[] = [];
  for (const rawItem of value.split(",")) {
    const item = rawItem.trim();
    if (!item) continue;
    const match = /^(\[d\])?([0-9a-fA-F]{1,6})$/.exec(item);
    if (!match) {
      warnings.push(`Ignored a malformed breakpoint: ${item}`);
      continue;
    }
    const ext = parseInt(match[2], 16);
    result.push({ bank: ext >> 16, offset: ext & 0xffff, display: !!match[1] });
  }
  return result;
}

function isKnownMember(name: string, slots: Z88Snapshot["slots"]): boolean {
  if (name === SETTINGS || name === ROM || name === RAM || name === PNG) {
    return true;
  }
  const match = /^(slot|ram|flash)([123])\.bin$/.exec(name);
  if (!match) {
    return false;
  }
  const slot = slots[Number(match[2])];
  if (!slot) {
    return false;
  }
  const hybrid = Z88_OZVM_HYBRID_TYPES.includes(slot.ozvmType);
  // --- A hybrid uses ramN/flashN, or a legacy slotN; any other card uses slotN only
  return hybrid || match[1] === "slot";
}

/** Typed access to the settings, with the format's value widths */
class Settings {
  constructor(private readonly props: Map<string, string>) {}

  has(key: string): boolean {
    return this.props.has(key);
  }

  raw(key: string): string | undefined {
    return this.props.get(key);
  }

  byte(key: string, defaultValue?: number): number {
    return this.hex(key, 0xff, defaultValue);
  }

  word(key: string, defaultValue?: number): number {
    return this.hex(key, 0xffff, defaultValue);
  }

  decimal(key: string): number {
    const text = this.required(key).trim();
    if (!/^-?\d+$/.test(text)) {
      throw new Error(`${key} is not a decimal number: "${text}"`);
    }
    const value = Number(text);
    if (!Number.isSafeInteger(value)) {
      throw new Error(`${key} is out of range: ${text}`);
    }
    return value;
  }

  /** As Java's `Boolean.valueOf`: "true" in any case is true, anything else false */
  bool(key: string): boolean {
    return this.required(key).trim().toLowerCase() === "true";
  }

  private hex(key: string, max: number, defaultValue?: number): number {
    if (!this.props.has(key) && defaultValue !== undefined) {
      return defaultValue;
    }
    const text = this.required(key).trim();
    if (!/^[0-9a-fA-F]+$/.test(text)) {
      throw new Error(`${key} is not a hexadecimal number: "${text}"`);
    }
    const value = parseInt(text, 16);
    if (value > max) {
      throw new Error(`${key} is out of range: ${text}`);
    }
    return value;
  }

  private required(key: string): string {
    const value = this.props.get(key);
    if (value === undefined) {
      throw new Error(`The snapshot settings have no ${key}`);
    }
    return value;
  }
}
