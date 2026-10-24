/*
 * The `.mdr` Microdrive cartridge image (`.plans/MICRODRIVE_PLAN.md` Phase 3; the facts are
 * `_input/microdrive/mdr-and-file-formats.md` and `microdrive-media.md`).
 *
 * An image is up to 254 slots of 543 bytes in tape order, then (usually) one write-protect byte. A
 * slot is a 15-byte header block - flag (bit 0 set), sector number, two unused bytes, the
 * cartridge's name, a checksum - and a 528-byte record block: a 15-byte descriptor (flag, record
 * number, length, the file's name, a checksum), 512 data bytes and their checksum. Every checksum
 * is the byte sum mod 255.
 *
 * A file is the records that share a name, in record-number order, the last with the EOF bit. A
 * SAVEd file's first record starts with a 9-byte header: type, length, start, program length (an
 * array's name byte), auto-run line - as the Interface 1 ROM fills HD_00..HD_11.
 */

export const MDR_SLOT_SIZE = 543;
export const MDR_MAX_SLOTS = 254;
export const MDR_HEADER_SIZE = 15;
export const MDR_DATA_SIZE = 512;
/** The full image: 254 slots and the write-protect byte */
export const MDR_FULL_SIZE = MDR_MAX_SLOTS * MDR_SLOT_SIZE + 1;
/** The QL's cartridge image (Q-emuLator/QLAY `.mdv`): 255 x 686 bytes, another format */
export const QL_MDV_SIZE = 255 * 686;
/** A SAVEd file's header in its first record */
export const MDR_FILE_HEADER_SIZE = 9;

/** The descriptor's flag bits (`microdrive-media.md` §2.3) */
const RECFLG_EOF = 0x02;
const RECFLG_SAVED = 0x04;

export type MdrImageErrorCode = "qlMdv" | "badLength" | "full";

export class MdrImageError extends Error {
  constructor (
    readonly code: MdrImageErrorCode,
    message: string,
    readonly args: Record<string, string | number> = {}
  ) {
    super(message);
    this.name = "MdrImageError";
  }
}

/** The byte sum mod 255 (the ROM's add with end-around carry: `$FF` never results) */
export function mdrChecksum (bytes: ArrayLike<number>, from = 0, length = bytes.length - from): number {
  let sum = 0;
  for (let i = from; i < from + length; i++) sum = (sum + bytes[i]) % 255;
  return sum;
}

export type MdrShape = {
  slots: number;
  /** The trailing write-protect byte is there */
  hasWriteProtectByte: boolean;
  /** The image says it is write-protected (its last byte is not 0) */
  writeProtected: boolean;
};

/** Checks an image's length: `n x 543`, optionally `+ 1` (Warajevo leaves the last byte out) */
export function mdrShape (bytes: Uint8Array): MdrShape {
  if (bytes.length === QL_MDV_SIZE) {
    throw new MdrImageError("qlMdv", "This is a QL Microdrive image (.mdv), not a ZX Spectrum one.");
  }
  const hasWriteProtectByte = bytes.length % MDR_SLOT_SIZE === 1;
  const slots = Math.floor(bytes.length / MDR_SLOT_SIZE);
  if ((bytes.length % MDR_SLOT_SIZE !== 0 && !hasWriteProtectByte) || slots < 1 || slots > MDR_MAX_SLOTS) {
    throw new MdrImageError("badLength", `An .mdr holds 1-254 sectors of 543 bytes; this file has ${bytes.length} bytes.`, {
      length: bytes.length
    });
  }
  return { slots, hasWriteProtectByte, writeProtected: hasWriteProtectByte && bytes[bytes.length - 1] !== 0 };
}

export type MdrSectorState = "unformatted" | "free" | "used" | "bad";

export type MdrSector = {
  /** The slot in the image (tape order) */
  slot: number;
  state: MdrSectorState;
  /** The header's sector number (1-254), when the header is valid */
  number?: number;
  /** The cartridge's name, as this header has it */
  label?: string;
  /** The record descriptor, when it is valid */
  record?: {
    flag: number;
    recordNumber: number;
    length: number;
    name: string;
    eof: boolean;
    saved: boolean;
    dataValid: boolean;
  };
};

const textOf = (bytes: Uint8Array, from: number, length: number) =>
  String.fromCharCode(...bytes.subarray(from, from + length)).replace(/ +$/, "");

/** One slot as the ROM reads it */
export function readMdrSector (bytes: Uint8Array, slot: number): MdrSector {
  const base = slot * MDR_SLOT_SIZE;
  const headerValid = (bytes[base] & 0x01) !== 0 && mdrChecksum(bytes, base, 14) === bytes[base + 14];
  if (!headerValid) return { slot, state: "unformatted" };
  const sector: MdrSector = { slot, state: "bad", number: bytes[base + 1], label: textOf(bytes, base + 4, 10) };
  const r = base + MDR_HEADER_SIZE;
  if ((bytes[r] & 0x01) !== 0 || mdrChecksum(bytes, r, 14) !== bytes[r + 14]) return sector;
  const flag = bytes[r];
  const length = bytes[r + 2] | (bytes[r + 3] << 8);
  sector.record = {
    flag,
    recordNumber: bytes[r + 1],
    length,
    name: textOf(bytes, r + 4, 10),
    eof: (flag & RECFLG_EOF) !== 0,
    saved: (flag & RECFLG_SAVED) !== 0,
    dataValid: mdrChecksum(bytes, r + 15, MDR_DATA_SIZE) === bytes[r + 15 + MDR_DATA_SIZE]
  };
  // --- Free: neither EOF nor a full record (RECLEN bit 9); bad: FORMAT's EOF test record with a CHR$ 0 name
  if ((flag & RECFLG_EOF) === 0 && (length & 0x0200) === 0) sector.state = "free";
  else if (bytes[r + 4] === 0x00) sector.state = "bad";
  else sector.state = "used";
  return sector;
}

export type MdrFileHeader = {
  /** 0 program, 1 number array, 2 character array, 3 bytes */
  type: number;
  length: number;
  start: number;
  /** A program's length without its variables; an array's name byte in the low byte */
  programLength: number;
  /** The auto-run line; 0x8000 or more (the ROM leaves $FFFF) means none */
  autorun: number;
};

export type MdrFile = {
  name: string;
  /** A SAVEd file (LOAD *); a PRINT-type file (OPEN #) has no header */
  saved: boolean;
  header?: MdrFileHeader;
  /** Bytes of the contents (the header excluded) */
  size: number;
  /** The slots of its records, in record order */
  slots: number[];
  /** Every record from 0 to the EOF record is there, with valid data */
  complete: boolean;
};

export type MdrCatalog = {
  /** The cartridge's name (from the first valid header) */
  label?: string;
  slots: number;
  formatted: number;
  free: number;
  bad: number;
  /** As CAT prints it: free sectors / 2 */
  freeK: number;
  /** In name order, as CAT lists them; names starting with CHR$ 0 are left out, as CAT does */
  files: MdrFile[];
};

export function readMdrCatalog (bytes: Uint8Array): MdrCatalog {
  const { slots } = mdrShape(bytes);
  const sectors = Array.from({ length: slots }, (_, slot) => readMdrSector(bytes, slot));
  const byName = new Map<string, MdrSector[]>();
  for (const s of sectors) {
    if (s.state !== "used" || !s.record) continue;
    const list = byName.get(s.record.name) ?? [];
    list.push(s);
    byName.set(s.record.name, list);
  }
  const files: MdrFile[] = [];
  for (const [name, records] of byName) {
    if (name.charCodeAt(0) === 0) continue;
    records.sort((a, b) => a.record!.recordNumber - b.record!.recordNumber);
    const eofAt = records.findIndex((r) => r.record!.eof);
    const complete =
      eofAt === records.length - 1 && records.every((r, i) => r.record!.recordNumber === i && r.record!.dataValid);
    const saved = records[0].record!.saved;
    const total = records.reduce((sum, r) => sum + Math.min(r.record!.length, MDR_DATA_SIZE), 0);
    const file: MdrFile = { name, saved, size: total, slots: records.map((r) => r.slot), complete };
    if (saved && records[0].record!.recordNumber === 0) {
      const d = records[0].slot * MDR_SLOT_SIZE + 30;
      const word = (o: number) => bytes[d + o] | (bytes[d + o + 1] << 8);
      file.header = { type: bytes[d], length: word(1), start: word(3), programLength: word(5), autorun: word(7) };
      file.size = Math.max(0, total - MDR_FILE_HEADER_SIZE);
    }
    files.push(file);
  }
  files.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const count = (state: MdrSectorState) => sectors.filter((s) => s.state === state).length;
  const free = count("free");
  return {
    label: sectors.find((s) => s.label !== undefined)?.label,
    slots,
    formatted: slots - count("unformatted"),
    free,
    bad: count("bad"),
    freeK: Math.floor(free / 2),
    files
  };
}

/** A file's contents: its records' data in order, the 9-byte header of a SAVEd file left out */
export function readMdrFile (bytes: Uint8Array, file: MdrFile): Uint8Array {
  const out: number[] = [];
  for (const slot of file.slots) {
    const r = slot * MDR_SLOT_SIZE + MDR_HEADER_SIZE;
    const length = Math.min(bytes[r + 2] | (bytes[r + 3] << 8), MDR_DATA_SIZE);
    for (let i = 0; i < length; i++) out.push(bytes[r + 15 + i]);
  }
  return new Uint8Array(file.header ? out.slice(MDR_FILE_HEADER_SIZE) : out);
}

const nameBytes = (name: string) => Array.from({ length: 10 }, (_, i) => (i < name.length ? name.charCodeAt(i) & 0xff : 0x20));

/** Writes a record descriptor and its data into a slot, with every checksum */
function putRecord (bytes: Uint8Array, slot: number, flag: number, recordNumber: number, name: string, data: ArrayLike<number>): void {
  const r = slot * MDR_SLOT_SIZE + MDR_HEADER_SIZE;
  const descriptor = [flag, recordNumber, data.length & 0xff, data.length >> 8, ...nameBytes(name)];
  bytes.set(descriptor, r);
  bytes[r + 14] = mdrChecksum(descriptor);
  const block = new Uint8Array(MDR_DATA_SIZE);
  block.set(Array.from(data).slice(0, MDR_DATA_SIZE));
  bytes.set(block, r + 15);
  bytes[r + 15 + MDR_DATA_SIZE] = mdrChecksum(block);
}

/** A free sector's descriptor, as FORMAT and ERASE leave one (IN-CHK) */
function putFree (bytes: Uint8Array, slot: number, name = ""): void {
  putRecord(bytes, slot, 0x00, 0x00, name, new Uint8Array(0));
}

export type NewMdrFile = {
  name: string;
  data: Uint8Array;
  /** A SAVEd file: its header (`length` is `data`'s); without it, a PRINT-type file */
  header?: Omit<MdrFileHeader, "length">;
};

/**
 * Writes a file into free sectors, in tape order, as SAVE * (or a PRINT # stream) would
 * @returns the slots it took
 * @throws MdrImageError ("full") when the free sectors are too few
 */
export function writeMdrFile (bytes: Uint8Array, file: NewMdrFile): number[] {
  const { slots } = mdrShape(bytes);
  const content: number[] = [];
  if (file.header) {
    const h = { ...file.header, length: file.data.length };
    content.push(h.type, h.length & 0xff, h.length >> 8, h.start & 0xff, (h.start >> 8) & 0xff,
      h.programLength & 0xff, (h.programLength >> 8) & 0xff, h.autorun & 0xff, (h.autorun >> 8) & 0xff);
  }
  content.push(...file.data);
  const records = Math.max(1, Math.ceil(content.length / MDR_DATA_SIZE));
  const free = Array.from({ length: slots }, (_, s) => s).filter((s) => readMdrSector(bytes, s).state === "free");
  if (free.length < records) {
    throw new MdrImageError("full", `The cartridge has ${free.length} free sectors; ${file.name} needs ${records}.`, {
      name: file.name,
      free: free.length,
      needed: records
    });
  }
  const used = free.slice(0, records);
  used.forEach((slot, i) => {
    const flag = (file.header ? RECFLG_SAVED : 0) | (i === records - 1 ? RECFLG_EOF : 0);
    putRecord(bytes, slot, flag, i, file.name, content.slice(i * MDR_DATA_SIZE, (i + 1) * MDR_DATA_SIZE));
  });
  return used;
}

/** Frees a file's sectors, as ERASE does */
export function eraseMdrFile (bytes: Uint8Array, file: MdrFile): void {
  for (const slot of file.slots) putFree(bytes, slot);
}

/** Renames a file in every record */
export function renameMdrFile (bytes: Uint8Array, file: MdrFile, newName: string): void {
  for (const slot of file.slots) {
    const r = slot * MDR_SLOT_SIZE + MDR_HEADER_SIZE;
    bytes.set(nameBytes(newName), r + 4);
    bytes[r + 14] = mdrChecksum(bytes, r, 14);
  }
}

/** Renames the cartridge in every valid header */
export function setMdrLabel (bytes: Uint8Array, label: string): void {
  const { slots } = mdrShape(bytes);
  for (let slot = 0; slot < slots; slot++) {
    if (readMdrSector(bytes, slot).state === "unformatted") continue;
    const base = slot * MDR_SLOT_SIZE;
    bytes.set(nameBytes(label), base + 4);
    bytes[base + 14] = mdrChecksum(bytes, base, 14);
  }
}

/** An unformatted cartridge: every byte $FF, so no block has a valid checksum; writable */
export function createBlankMdr (slots = MDR_MAX_SLOTS): Uint8Array {
  const bytes = new Uint8Array(slots * MDR_SLOT_SIZE + 1).fill(0xff);
  bytes[bytes.length - 1] = 0;
  return bytes;
}

/**
 * A cartridge formatted as the tools make one (`mdr-and-file-formats.md` §7): slot i holds sector
 * 254 - i, every sector free. The ROM's own FORMAT marks more sectors bad (on ROM 2 always sector 254).
 */
export function createFormattedMdr (label: string, slots = MDR_MAX_SLOTS): Uint8Array {
  const bytes = new Uint8Array(slots * MDR_SLOT_SIZE + 1);
  for (let slot = 0; slot < slots; slot++) {
    const base = slot * MDR_SLOT_SIZE;
    const header = [0x01, MDR_MAX_SLOTS - slot, 0x00, 0x00, ...nameBytes(label)];
    bytes.set(header, base);
    bytes[base + 14] = mdrChecksum(header);
    putFree(bytes, slot);
  }
  return bytes;
}

/** The image with its write-protect byte set as asked (added when it had none) */
export function withMdrWriteProtect (bytes: Uint8Array, writeProtected: boolean): Uint8Array {
  const { slots } = mdrShape(bytes);
  const out = new Uint8Array(slots * MDR_SLOT_SIZE + 1);
  out.set(bytes.subarray(0, slots * MDR_SLOT_SIZE));
  out[out.length - 1] = writeProtected ? 1 : 0;
  return out;
}

/** The cartridge types the "new disk" paths offer: formatted (as the tools make one) or blank */
export const MDR_CARTRIDGE_TYPES = ["mdr", "mdrblank"] as const;

export function isMdrCartridgeType (type: string): type is (typeof MDR_CARTRIDGE_TYPES)[number] {
  return (MDR_CARTRIDGE_TYPES as readonly string[]).includes(type);
}

/** A new cartridge of a `MDR_CARTRIDGE_TYPES` type, named `label` when formatted */
export function createMdrOfType (type: (typeof MDR_CARTRIDGE_TYPES)[number], label: string): Uint8Array {
  return type === "mdr" ? createFormattedMdr(label.slice(0, 10)) : createBlankMdr();
}
