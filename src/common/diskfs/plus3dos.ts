import type { DiskInformation, SectorInformation } from "@emu/machines/disk/DiskInformation";
import { readDiskData } from "@emu/machines/disk/disk-readers";
import { writeDiskData } from "@emu/machines/disk/disk-writer";
import {
  DiskFsError,
  type DiskFileAttributes,
  type DiskFileEntry,
  type DiskFileKind,
  type DiskFileSystem,
  type DiskFsInfo,
  type DiskSectorRef,
  type DiskSectorRole,
  type NewDiskFile
} from "./types";

/*
 * +3DOS (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, B1/B2), written from Amstrad's description of
 * the format in the +3 manual and the CP/M 2.2 directory format it builds on (D8):
 *
 * - The disk specification is the first 10 bytes of the first sector of track 0 - unless the
 *   track's sector IDs say CPC system ($41..) or CPC data ($C1..), whose geometry is fixed, or the
 *   first byte is neither 0 nor 3, when the disk is the +3's own format (40 x 1 x 9 x 512).
 * - After the reserved tracks come the blocks, numbered from 0; the directory takes the first
 *   `directory blocks`. A directory entry is 32 bytes: user (E5 = free), name (8), type (3, the top
 *   bits of which are read-only, system and archive), extent low, S1, extent high, record count, and
 *   16 block numbers - 8-bit, or 16-bit pairs when the disk has more than 255 blocks.
 * - An entry maps up to 16 block pointers; each 16K of a file is one logical extent, numbered by
 *   extent low + 32 x extent high, and an entry holds (pointers x block size) / 16K of them. A file's
 *   length in 128-byte records is its last logical extent x 128 + that entry's record count.
 * - A file +3 BASIC writes starts with a 128-byte PLUS3DOS header: "PLUS3DOS", $1A, issue 1,
 *   version 0, the file's length with the header (4 bytes), the BASIC header (type, length, two
 *   parameters) at offset 15, and at offset 127 the sum of the first 127 bytes.
 */

const SECTOR_EMPTY = 0xe5;
const HEADER_SIZE = 128;
const RECORD = 128;
const EXTENT = 16 * 1024;
const SIGNATURE = "PLUS3DOS";

/** A +3DOS disk specification */
export type Plus3DosSpec = {
  name: string;
  sidedness: 0 | 1 | 2;
  tracks: number;
  sectorsPerTrack: number;
  sectorSize: number;
  firstSectorId: number;
  reservedTracks: number;
  blockSize: number;
  directoryBlocks: number;
};

const TYPE_BY_KIND: Record<Exclude<DiskFileKind, "raw">, number> = { basic: 0, numberArray: 1, charArray: 2, code: 3 };
const KIND_BY_TYPE: DiskFileKind[] = ["basic", "numberArray", "charArray", "code"];

/** One file's directory entries, as found */
type FileEntries = {
  user: number;
  name: string;
  extension: string;
  attributes: DiskFileAttributes;
  /** Directory slots, by logical extent */
  slots: number[];
  blocks: number[];
  records: number;
  deleted: boolean;
};

export class Plus3DosFileSystem implements DiskFileSystem {
  readonly system = "+3dos";
  readonly spec: Plus3DosSpec;
  private readonly disk: DiskInformation;
  private readonly totalBlocks: number;
  private readonly wideBlocks: boolean;
  private readonly entriesPerDirectory: number;

  constructor (image: Uint8Array | DiskInformation) {
    this.disk = image instanceof Uint8Array ? readDiskData(image) : image;
    this.spec = detectSpec(this.disk);
    const s = this.spec;
    const dataTracks = s.tracks * (s.sidedness === 0 ? 1 : 2) - s.reservedTracks;
    this.totalBlocks = Math.floor((dataTracks * s.sectorsPerTrack * s.sectorSize) / s.blockSize);
    this.wideBlocks = this.totalBlocks > 255;
    this.entriesPerDirectory = (s.directoryBlocks * s.blockSize) / 32;
  }

  info (): DiskFsInfo {
    const used = this.usedBlocks();
    return {
      system: "+3DOS",
      format: this.spec.name,
      totalBytes: (this.totalBlocks - this.spec.directoryBlocks) * this.spec.blockSize,
      freeBytes: (this.totalBlocks - used.size) * this.spec.blockSize,
      blockSize: this.spec.blockSize,
      directoryEntries: this.entriesPerDirectory,
      usedEntries: this.directory().filter((e) => e[0] !== SECTOR_EMPTY).length
    };
  }

  list (options: { deleted?: boolean } = {}): DiskFileEntry[] {
    return this.files(options.deleted ?? false).map((f) => this.entryOf(f));
  }

  read (name: string): Uint8Array {
    const file = this.find(name);
    const bytes = this.fileBytes(file);
    const header = parseHeader(bytes);
    if (!header) return bytes;
    return bytes.slice(HEADER_SIZE, Math.min(bytes.length, header.fileLength));
  }

  write (file: NewDiskFile): DiskFileEntry {
    const { base, extension } = splitName(file.name);
    if (this.files(false).some((f) => sameName(f, base, extension))) {
      throw new DiskFsError("exists", `A file named ${file.name} is already on the disk.`, { name: file.name });
    }
    const bytes = file.kind === "raw" ? file.data : withHeader(file);
    const blocksNeeded = Math.max(1, Math.ceil(bytes.length / this.spec.blockSize));
    const used = this.usedBlocks();
    const free: number[] = [];
    for (let b = this.spec.directoryBlocks; b < this.totalBlocks && free.length < blocksNeeded; b++) {
      if (!used.has(b)) free.push(b);
    }
    if (free.length < blocksNeeded) {
      throw new DiskFsError("diskFull", `The disk has no room for ${file.name}.`, { name: file.name });
    }

    // --- The directory entries: as many as the blocks need
    const pointers = this.wideBlocks ? 8 : 16;
    const entriesNeeded = Math.ceil(blocksNeeded / pointers);
    const directory = this.directory();
    const slots = directory.map((e, i) => (e[0] === SECTOR_EMPTY ? i : -1)).filter((i) => i >= 0);
    if (slots.length < entriesNeeded) {
      throw new DiskFsError("directoryFull", `The directory has no room for ${file.name}.`, { name: file.name });
    }

    // --- Data first, then the entries that point to it
    free.forEach((block, i) => {
      const chunk = new Uint8Array(this.spec.blockSize).fill(0x1a);
      chunk.set(bytes.subarray(i * this.spec.blockSize, (i + 1) * this.spec.blockSize));
      this.writeBlock(block, chunk);
    });
    const records = Math.ceil(bytes.length / RECORD);
    const logicalPerEntry = (pointers * this.spec.blockSize) / EXTENT;
    for (let e = 0; e < entriesNeeded; e++) {
      const entry = new Uint8Array(32);
      entry[0] = file.user ?? 0;
      writePadded(entry, 1, base, 8);
      writePadded(entry, 9, extension, 3);
      const firstRecord = e * logicalPerEntry * (EXTENT / RECORD);
      const entryRecords = Math.min(records - firstRecord, logicalPerEntry * (EXTENT / RECORD));
      // --- The entry's last logical extent, and the records in it
      const lastLogical = e * logicalPerEntry + Math.max(0, Math.ceil(entryRecords / (EXTENT / RECORD)) - 1);
      entry[12] = lastLogical & 0x1f;
      entry[14] = lastLogical >> 5;
      entry[15] = entryRecords - (lastLogical - e * logicalPerEntry) * (EXTENT / RECORD);
      free.slice(e * pointers, (e + 1) * pointers).forEach((block, i) => {
        if (this.wideBlocks) {
          entry[16 + i * 2] = block & 0xff;
          entry[17 + i * 2] = block >> 8;
        } else {
          entry[16 + i] = block;
        }
      });
      this.writeDirectoryEntry(slots[e], entry);
    }
    return this.list().find((f) => sameName(f, base, extension))!;
  }

  delete (name: string): void {
    const file = this.find(name);
    if (file.attributes.readOnly) {
      throw new DiskFsError("readOnly", `${name} is read-only.`, { name });
    }
    for (const slot of file.slots) {
      const entry = this.directory()[slot].slice();
      entry[0] = SECTOR_EMPTY;
      this.writeDirectoryEntry(slot, entry);
    }
  }

  rename (name: string, newName: string): void {
    const file = this.find(name);
    const { base, extension } = splitName(newName);
    if (this.files(false).some((f) => f !== file && f.user === file.user && sameName(f, base, extension))) {
      throw new DiskFsError("exists", `A file named ${newName} is already on the disk.`, { name: newName });
    }
    for (const slot of file.slots) {
      const entry = this.directory()[slot].slice();
      const flags = [entry[9] & 0x80, entry[10] & 0x80, entry[11] & 0x80];
      writePadded(entry, 1, base, 8);
      writePadded(entry, 9, extension, 3);
      flags.forEach((f, i) => (entry[9 + i] |= f));
      this.writeDirectoryEntry(slot, entry);
    }
  }

  setAttributes (name: string, attributes: Partial<DiskFileAttributes>): void {
    const file = this.find(name);
    const next = { ...file.attributes, ...attributes };
    for (const slot of file.slots) {
      const entry = this.directory()[slot].slice();
      entry[9] = (entry[9] & 0x7f) | (next.readOnly ? 0x80 : 0);
      entry[10] = (entry[10] & 0x7f) | (next.system ? 0x80 : 0);
      entry[11] = (entry[11] & 0x7f) | (next.archive ? 0x80 : 0);
      this.writeDirectoryEntry(slot, entry);
    }
  }

  /** Moves a file to another user area (0..15) */
  setUser (name: string, user: number): void {
    const file = this.find(name);
    for (const slot of file.slots) {
      const entry = this.directory()[slot].slice();
      entry[0] = user & 0x0f;
      this.writeDirectoryEntry(slot, entry);
    }
  }

  layout (): Map<number, DiskSectorRole> {
    const roles = new Map<number, DiskSectorRole>();
    this.disk.tracks.forEach((track, t) => track.sectors.forEach((_, i) => roles.set(t * 256 + i, { role: "unused" })));
    const s = this.spec;
    for (let lt = 0; lt < s.reservedTracks; lt++) {
      for (let k = 0; k < s.sectorsPerTrack; k++) {
        const ref = this.sectorRef(lt, k);
        if (ref) roles.set(ref.trackIndex * 256 + ref.sectorIndex, { role: "system" });
      }
    }
    for (let b = 0; b < this.totalBlocks; b++) {
      const role: DiskSectorRole = b < s.directoryBlocks ? { role: "directory" } : { role: "free" };
      for (const ref of this.blockSectors(b)) roles.set(ref.trackIndex * 256 + ref.sectorIndex, role);
    }
    for (const file of this.files(false)) {
      const name = displayName(file.name, file.extension);
      for (const b of file.blocks) {
        for (const ref of this.blockSectors(b)) roles.set(ref.trackIndex * 256 + ref.sectorIndex, { role: "file", file: name });
      }
    }
    return roles;
  }

  image (): Uint8Array {
    return writeDiskData(this.disk);
  }

  // ---------------------------------------------------------------------------------------------
  // Geometry

  /** The physical sector of logical track `lt`'s `k`-th sector */
  private sectorRef (lt: number, k: number): DiskSectorRef | undefined {
    const s = this.spec;
    let cylinder: number;
    let head: number;
    if (s.sidedness === 0) {
      cylinder = lt;
      head = 0;
    } else if (s.sidedness === 1) {
      cylinder = lt >> 1;
      head = lt & 1;
    } else {
      cylinder = lt < s.tracks ? lt : lt - s.tracks;
      head = lt < s.tracks ? 0 : 1;
    }
    if (head >= this.disk.numSides) return undefined;
    const trackIndex = cylinder * this.disk.numSides + head;
    const track = this.disk.tracks[trackIndex];
    if (!track || track.unformatted) return undefined;
    const sectorIndex = track.sectors.findIndex((x) => x.R === s.firstSectorId + k);
    return sectorIndex < 0 ? undefined : { trackIndex, sectorIndex };
  }

  private sector (ref: DiskSectorRef): SectorInformation {
    return this.disk.tracks[ref.trackIndex].sectors[ref.sectorIndex];
  }

  /** The sectors of block `b`, in order */
  private blockSectors (block: number): DiskSectorRef[] {
    const s = this.spec;
    const perBlock = s.blockSize / s.sectorSize;
    const refs: DiskSectorRef[] = [];
    for (let i = 0; i < perBlock; i++) {
      const logical = block * perBlock + i;
      const ref = this.sectorRef(s.reservedTracks + Math.floor(logical / s.sectorsPerTrack), logical % s.sectorsPerTrack);
      if (!ref) {
        throw new DiskFsError("unformatted", `Block ${block} lies on a track the disk does not have.`, { block });
      }
      refs.push(ref);
    }
    return refs;
  }

  private readBlock (block: number): Uint8Array {
    const out = new Uint8Array(this.spec.blockSize);
    this.blockSectors(block).forEach((ref, i) => {
      out.set(this.sector(ref).sectorData.subarray(0, this.spec.sectorSize), i * this.spec.sectorSize);
    });
    return out;
  }

  private writeBlock (block: number, data: Uint8Array): void {
    this.blockSectors(block).forEach((ref, i) => {
      const sector = this.sector(ref);
      const part = data.subarray(i * this.spec.sectorSize, (i + 1) * this.spec.sectorSize);
      // --- Every stored copy of the sector: a written sector reads the same each time
      for (let at = 0; at + part.length <= sector.sectorData.length; at += part.length) {
        sector.sectorData.set(part, at);
      }
      sector.SR1 = 0;
      sector.SR2 = 0;
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Directory

  /** The directory's 32-byte entries */
  private directory (): Uint8Array[] {
    const entries: Uint8Array[] = [];
    for (let b = 0; b < this.spec.directoryBlocks; b++) {
      const bytes = this.readBlock(b);
      for (let i = 0; i + 32 <= bytes.length; i += 32) entries.push(bytes.subarray(i, i + 32));
    }
    return entries;
  }

  private writeDirectoryEntry (slot: number, entry: Uint8Array): void {
    const perBlock = this.spec.blockSize / 32;
    const block = Math.floor(slot / perBlock);
    const bytes = this.readBlock(block);
    bytes.set(entry, (slot % perBlock) * 32);
    this.writeBlock(block, bytes);
  }

  /** The files the directory lists (with their deleted entries, when asked) */
  private files (withDeleted: boolean): FileEntries[] {
    const files = new Map<string, FileEntries>();
    const order: FileEntries[] = [];
    const recordsPerExtent = EXTENT / RECORD;
    this.directory().forEach((entry, slot) => {
      const user = entry[0];
      const deleted = user === SECTOR_EMPTY;
      // --- A slot never used is all $E5; a deleted file keeps its name
      if (deleted && (!withDeleted || entry[1] === SECTOR_EMPTY)) return;
      if (!deleted && user > 15) return;
      const name = text(entry, 1, 8);
      const extension = text(entry, 9, 3);
      const key = `${deleted ? "x" : user}:${name}.${extension}`;
      let file = files.get(key);
      if (!file) {
        file = {
          user: deleted ? 0 : user,
          name,
          extension,
          attributes: { readOnly: (entry[9] & 0x80) !== 0, system: (entry[10] & 0x80) !== 0, archive: (entry[11] & 0x80) !== 0 },
          slots: [],
          blocks: [],
          records: 0,
          deleted
        };
        files.set(key, file);
        order.push(file);
      }
      const logical = (entry[12] & 0x1f) + (entry[14] << 5);
      const records = logical * recordsPerExtent + entry[15];
      file.records = Math.max(file.records, records);
      file.slots.push(slot);
      const pointers: number[] = [];
      for (let i = 0; i < (this.wideBlocks ? 8 : 16); i++) {
        const block = this.wideBlocks ? entry[16 + i * 2] | (entry[17 + i * 2] << 8) : entry[16 + i];
        if (block !== 0 && block < this.totalBlocks) pointers.push(block);
      }
      // --- Entries in extent order, whatever the directory's order
      (file as FileEntries & { parts?: [number, number[]][] }).parts ??= [];
      (file as FileEntries & { parts: [number, number[]][] }).parts.push([logical, pointers]);
    });
    for (const file of order) {
      const parts = (file as FileEntries & { parts: [number, number[]][] }).parts;
      parts.sort((a, b) => a[0] - b[0]);
      file.blocks = parts.flatMap((p) => p[1]);
      delete (file as FileEntries & { parts?: unknown }).parts;
    }
    return order;
  }

  private usedBlocks (): Set<number> {
    const used = new Set<number>();
    for (let b = 0; b < this.spec.directoryBlocks; b++) used.add(b);
    for (const file of this.files(false)) file.blocks.forEach((b) => used.add(b));
    return used;
  }

  private find (name: string): FileEntries {
    const { base, extension } = splitName(name);
    const file = this.files(false).find((f) => sameName(f, base, extension));
    if (!file) throw new DiskFsError("notFound", `${name} is not on the disk.`, { name });
    return file;
  }

  private fileBytes (file: FileEntries): Uint8Array {
    const bytes = new Uint8Array(file.blocks.length * this.spec.blockSize);
    file.blocks.forEach((b, i) => bytes.set(this.readBlock(b), i * this.spec.blockSize));
    return bytes.slice(0, Math.min(bytes.length, file.records * RECORD));
  }

  private entryOf (file: FileEntries): DiskFileEntry {
    const bytes = file.deleted ? new Uint8Array(0) : this.fileBytes(file);
    const header = parseHeader(bytes);
    const entry: DiskFileEntry = {
      name: displayName(file.name, file.extension),
      baseName: file.name,
      extension: file.extension,
      user: file.user,
      kind: header ? header.kind : "raw",
      size: header ? header.length : file.records * RECORD,
      allocated: file.blocks.length * this.spec.blockSize,
      attributes: file.attributes,
      deleted: file.deleted,
      sectors: file.deleted ? [] : file.blocks.flatMap((b) => this.blockSectors(b))
    };
    if (header?.kind === "basic") {
      entry.start = header.param1 < 32768 ? header.param1 : undefined;
      entry.variablesOffset = header.param2;
    } else if (header?.kind === "code") {
      entry.start = header.param1;
    } else if (header && (header.kind === "numberArray" || header.kind === "charArray")) {
      entry.variableName = String.fromCharCode(0x60 + ((header.param1 >> 8) & 0x1f));
    }
    return entry;
  }
}

// -----------------------------------------------------------------------------------------------
// The disk specification

/** Reads a disk's +3DOS specification */
export function detectSpec (disk: DiskInformation): Plus3DosSpec {
  const track0 = disk.tracks[0];
  if (!track0 || track0.unformatted || track0.sectors.length === 0) {
    throw new DiskFsError("unformatted", "Track 0 of the disk is not formatted.");
  }
  const firstId = Math.min(...track0.sectors.map((s) => s.R));
  const base = { sectorsPerTrack: 9, sectorSize: 512, blockSize: 1024, directoryBlocks: 2 };
  if ((firstId & 0xc0) === 0x40) {
    return { name: "CPC system", sidedness: 0, tracks: 40, firstSectorId: 0x41, reservedTracks: 2, ...base };
  }
  if ((firstId & 0xc0) === 0xc0) {
    return { name: "CPC data", sidedness: 0, tracks: 40, firstSectorId: 0xc1, reservedTracks: 0, ...base };
  }
  const bootSector = track0.sectors.find((s) => s.R === firstId)!;
  const spec = bootSector.sectorData;
  if (spec[0] !== 0 && spec[0] !== 3) {
    return { name: "+3", sidedness: 0, tracks: 40, firstSectorId: firstId, reservedTracks: 1, ...base };
  }
  const sidedness = (spec[1] & 0x03) as 0 | 1 | 2;
  return {
    name: spec[0] === 3 ? "PCW/+3 double-sided" : "+3",
    sidedness: sidedness > 2 ? 0 : sidedness,
    tracks: spec[2],
    sectorsPerTrack: spec[3],
    sectorSize: 128 << spec[4],
    firstSectorId: firstId,
    reservedTracks: spec[5],
    blockSize: 128 << spec[6],
    directoryBlocks: spec[7]
  };
}

// -----------------------------------------------------------------------------------------------
// Names and the PLUS3DOS header

type Plus3Header = { kind: DiskFileKind; length: number; param1: number; param2: number; fileLength: number };

/** The PLUS3DOS header of a file's first bytes, if it has a valid one */
export function parseHeader (bytes: Uint8Array): Plus3Header | undefined {
  if (bytes.length < HEADER_SIZE) return undefined;
  for (let i = 0; i < SIGNATURE.length; i++) if (bytes[i] !== SIGNATURE.charCodeAt(i)) return undefined;
  if (bytes[8] !== 0x1a) return undefined;
  let sum = 0;
  for (let i = 0; i < 127; i++) sum = (sum + bytes[i]) & 0xff;
  if (sum !== bytes[127]) return undefined;
  const type = bytes[15];
  return {
    kind: KIND_BY_TYPE[type] ?? "raw",
    length: bytes[16] | (bytes[17] << 8),
    param1: bytes[18] | (bytes[19] << 8),
    param2: bytes[20] | (bytes[21] << 8),
    fileLength: (bytes[11] | (bytes[12] << 8) | (bytes[13] << 16) | (bytes[14] << 24)) >>> 0
  };
}

/** A file's bytes with its PLUS3DOS header in front */
export function withHeader (file: NewDiskFile): Uint8Array {
  const out = new Uint8Array(HEADER_SIZE + file.data.length);
  for (let i = 0; i < SIGNATURE.length; i++) out[i] = SIGNATURE.charCodeAt(i);
  out[8] = 0x1a;
  out[9] = 1;
  out[10] = 0;
  const total = out.length;
  out[11] = total & 0xff;
  out[12] = (total >> 8) & 0xff;
  out[13] = (total >> 16) & 0xff;
  out[14] = (total >> 24) & 0xff;
  const kind = file.kind as Exclude<DiskFileKind, "raw">;
  out[15] = TYPE_BY_KIND[kind];
  out[16] = file.data.length & 0xff;
  out[17] = file.data.length >> 8;
  let param1: number;
  let param2: number;
  if (kind === "basic") {
    param1 = file.start ?? 0x8000;
    param2 = file.variablesOffset ?? file.data.length;
  } else if (kind === "code") {
    param1 = file.start ?? 0;
    param2 = 0x8000;
  } else {
    // --- An array: its variable's letter in the second byte, as the tape header has it
    const letter = (file.variableName ?? "a").toLowerCase().charCodeAt(0) & 0x1f;
    param1 = (letter | (kind === "charArray" ? 0xc0 : 0x80)) << 8;
    param2 = 0x8000;
  }
  out[18] = param1 & 0xff;
  out[19] = param1 >> 8;
  out[20] = param2 & 0xff;
  out[21] = param2 >> 8;
  let sum = 0;
  for (let i = 0; i < 127; i++) sum = (sum + out[i]) & 0xff;
  out[127] = sum;
  out.set(file.data, HEADER_SIZE);
  return out;
}

/** `NAME.EXT` → its two parts, upper-cased and checked */
export function splitName (name: string): { base: string; extension: string } {
  const at = name.lastIndexOf(".");
  const base = (at >= 0 ? name.slice(0, at) : name).toUpperCase();
  const extension = (at >= 0 ? name.slice(at + 1) : "").toUpperCase();
  const valid = /^[!#$%&'()\-@^_{}~0-9A-Z]+$/;
  if (!base || base.length > 8 || extension.length > 3 || !valid.test(base) || (extension && !valid.test(extension))) {
    throw new DiskFsError("badName", `"${name}" is not a +3DOS file name (up to 8 characters, a dot, up to 3).`, { name });
  }
  return { base, extension };
}

function sameName (file: { name: string; extension: string }, base: string, extension: string): boolean {
  return file.name === base && file.extension === extension;
}

function displayName (base: string, extension: string): string {
  return extension ? `${base}.${extension}` : base;
}

function text (bytes: Uint8Array, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += String.fromCharCode(bytes[offset + i] & 0x7f);
  return out.trimEnd();
}

function writePadded (bytes: Uint8Array, offset: number, value: string, length: number): void {
  for (let i = 0; i < length; i++) bytes[offset + i] = i < value.length ? value.charCodeAt(i) : 0x20;
}
