/*
 * TR-DOS disk images: `.trd` files, `.scl` containers, and the canonical layout the Beta 128 core
 * holds (`.plans/BETA128_TRDOS_PLAN.md` B3, B4). The facts and their sources are in §9 of the plan:
 * the TRD layout from Kaitai Struct's `tr_dos_image.ksy` (CC0), the filesystem and SCL details from
 * the Sinclair Wiki.
 *
 * - A `.trd` is headerless: logical tracks of 16 x 256-byte sectors, logical track = cylinder * 2 +
 *   side on a double-sided disk, = cylinder on a single-sided one. The catalogue is sectors 0-7 of
 *   logical track 0; the disk-info sector is sector 8.
 * - The core's canonical layout is always cylinder-major with two sides:
 *   ((cylinder * 2 + side) * 16 + sector) * 256, sectors counted from 0 here.
 */

export const TRD_SECTOR_SIZE = 256;
export const TRD_SECTORS_PER_TRACK = 16;
export const TRD_TRACK_SIZE = TRD_SECTOR_SIZE * TRD_SECTORS_PER_TRACK;
/** The disk-info sector: logical track 0, sector 8 */
export const TRD_INFO_OFFSET = 8 * TRD_SECTOR_SIZE;
/** Disk-info fields, as offsets into the image */
export const TRD_FIRST_FREE_SECTOR = TRD_INFO_OFFSET + 0xe1;
export const TRD_FIRST_FREE_TRACK = TRD_INFO_OFFSET + 0xe2;
export const TRD_DISK_TYPE = TRD_INFO_OFFSET + 0xe3;
export const TRD_FILE_COUNT = TRD_INFO_OFFSET + 0xe4;
export const TRD_FREE_SECTORS = TRD_INFO_OFFSET + 0xe5;
export const TRD_ID = TRD_INFO_OFFSET + 0xe7;
export const TRD_PASSWORD = TRD_INFO_OFFSET + 0xea;
export const TRD_DELETED_FILES = TRD_INFO_OFFSET + 0xf4;
export const TRD_LABEL = TRD_INFO_OFFSET + 0xf5;
/** The value at `TRD_ID` on a TR-DOS disk */
export const TRD_ID_VALUE = 0x10;
/** The catalogue holds 128 entries of 16 bytes */
export const TRD_MAX_FILES = 128;
export const TRD_ENTRY_SIZE = 16;
/** The most cylinders a drive (and the core) handles */
export const TRD_MAX_CYLINDERS = 86;

/** The disk types of the disk-info sector */
export const TRD_DISK_TYPES: Record<number, { cylinders: number; sides: number }> = {
  0x16: { cylinders: 80, sides: 2 },
  0x17: { cylinders: 40, sides: 2 },
  0x18: { cylinders: 80, sides: 1 },
  0x19: { cylinders: 40, sides: 1 }
};

/** A disk's shape */
export type TrdGeometry = { cylinders: number; sides: number };

/** A disk in the core's canonical layout */
export type CanonicalDisk = TrdGeometry & {
  /** cylinders * 2 sides * 16 sectors * 256 bytes */
  data: Uint8Array;
};

/** One catalogue entry */
export type TrdFileEntry = {
  /** Index in the catalogue */
  index: number;
  name: string;
  /** The type letter: B (BASIC), C (code), D (data array), # (stream) or another byte */
  type: string;
  /** Code: start address; BASIC: total length (program and variables) */
  param1: number;
  /** Code: length; BASIC: program length without the variables */
  param2: number;
  sectors: number;
  firstSector: number;
  firstTrack: number;
  deleted: boolean;
};

/** The disk-info sector */
export type TrdDiskInfo = {
  firstFreeSector: number;
  firstFreeTrack: number;
  diskType: number;
  fileCount: number;
  freeSectors: number;
  deletedFiles: number;
  label: string;
  isTrDos: boolean;
};

/** The disk-type byte of a geometry */
export function trdDiskType(geometry: TrdGeometry): number {
  if (geometry.sides === 2) return geometry.cylinders <= 40 ? 0x17 : 0x16;
  return geometry.cylinders <= 40 ? 0x19 : 0x18;
}

/**
 * The geometry of a `.trd` file: from its disk-info sector when it is a TR-DOS disk, else from its
 * size (double-sided, as many cylinders as the bytes fill)
 */
export function trdGeometry(bytes: Uint8Array): TrdGeometry {
  const fromType = bytes.length > TRD_ID && bytes[TRD_ID] === TRD_ID_VALUE ? TRD_DISK_TYPES[bytes[TRD_DISK_TYPE]] : undefined;
  if (fromType) {
    // --- A file can be shorter than the disk (empty tracks at the end may be left out) or longer
    const sizeCylinders = Math.ceil(bytes.length / (TRD_TRACK_SIZE * fromType.sides));
    return {
      cylinders: Math.min(TRD_MAX_CYLINDERS, Math.max(fromType.cylinders, sizeCylinders)),
      sides: fromType.sides
    };
  }
  const cylinders = Math.max(1, Math.ceil(bytes.length / (TRD_TRACK_SIZE * 2)));
  return { cylinders: Math.min(TRD_MAX_CYLINDERS, cylinders), sides: 2 };
}

/** Where a sector of a `.trd` file lives in the canonical layout */
export function trdFileOffsetToCanonical(fileOffset: number, geometry: TrdGeometry): number {
  const logicalTrack = Math.floor(fileOffset / TRD_TRACK_SIZE);
  const cylinder = geometry.sides === 2 ? logicalTrack >> 1 : logicalTrack;
  const side = geometry.sides === 2 ? logicalTrack & 1 : 0;
  return (cylinder * 2 + side) * TRD_TRACK_SIZE + (fileOffset % TRD_TRACK_SIZE);
}

/**
 * The `.trd` file sector a canonical sector maps to, or undefined when the file's geometry cannot
 * hold it (side 1 of a single-sided disk)
 */
export function canonicalSectorToTrdSector(canonicalSector: number, geometry: TrdGeometry): number | undefined {
  const track = Math.floor(canonicalSector / TRD_SECTORS_PER_TRACK);
  const sector = canonicalSector % TRD_SECTORS_PER_TRACK;
  const cylinder = track >> 1;
  const side = track & 1;
  if (side >= geometry.sides) return undefined;
  const logicalTrack = geometry.sides === 2 ? cylinder * 2 + side : cylinder;
  return logicalTrack * TRD_SECTORS_PER_TRACK + sector;
}

/** A `.trd` file in the core's layout */
export function trdToCanonical(bytes: Uint8Array): CanonicalDisk {
  const geometry = trdGeometry(bytes);
  const data = new Uint8Array(geometry.cylinders * 2 * TRD_TRACK_SIZE);
  for (let offset = 0; offset < bytes.length; offset += TRD_SECTOR_SIZE) {
    const target = trdFileOffsetToCanonical(offset, geometry);
    if (target + TRD_SECTOR_SIZE > data.length) break;
    data.set(bytes.subarray(offset, Math.min(bytes.length, offset + TRD_SECTOR_SIZE)), target);
  }
  return { ...geometry, data };
}

/** A canonical disk as a `.trd` file of its geometry */
export function canonicalToTrd(disk: CanonicalDisk): Uint8Array {
  const out = new Uint8Array(disk.cylinders * disk.sides * TRD_TRACK_SIZE);
  for (let offset = 0; offset < out.length; offset += TRD_SECTOR_SIZE) {
    const source = trdFileOffsetToCanonical(offset, disk);
    out.set(disk.data.subarray(source, source + TRD_SECTOR_SIZE), offset);
  }
  return out;
}

const decodeName = (bytes: Uint8Array, offset: number, length: number) =>
  String.fromCharCode(...bytes.subarray(offset, offset + length)).replace(/\s+$/, "");

/** The disk-info sector of a `.trd` image */
export function readTrdDiskInfo(bytes: Uint8Array): TrdDiskInfo {
  return {
    firstFreeSector: bytes[TRD_FIRST_FREE_SECTOR] ?? 0,
    firstFreeTrack: bytes[TRD_FIRST_FREE_TRACK] ?? 0,
    diskType: bytes[TRD_DISK_TYPE] ?? 0,
    fileCount: bytes[TRD_FILE_COUNT] ?? 0,
    freeSectors: (bytes[TRD_FREE_SECTORS] ?? 0) | ((bytes[TRD_FREE_SECTORS + 1] ?? 0) << 8),
    deletedFiles: bytes[TRD_DELETED_FILES] ?? 0,
    label: bytes.length > TRD_LABEL + 8 ? decodeName(bytes, TRD_LABEL, 8) : "",
    isTrDos: bytes[TRD_ID] === TRD_ID_VALUE
  };
}

/** The catalogue of a `.trd` image, up to the end marker (deleted entries included, flagged) */
export function readTrdCatalog(bytes: Uint8Array): TrdFileEntry[] {
  const files: TrdFileEntry[] = [];
  for (let index = 0; index < TRD_MAX_FILES; index++) {
    const at = index * TRD_ENTRY_SIZE;
    if (at + TRD_ENTRY_SIZE > bytes.length || bytes[at] === 0x00) break;
    files.push({
      index,
      name: decodeName(bytes, at, 8),
      type: String.fromCharCode(bytes[at + 8]),
      param1: bytes[at + 9] | (bytes[at + 10] << 8),
      param2: bytes[at + 11] | (bytes[at + 12] << 8),
      sectors: bytes[at + 13],
      firstSector: bytes[at + 14],
      firstTrack: bytes[at + 15],
      deleted: bytes[at] === 0x01
    });
  }
  return files;
}

/** The bytes of a catalogued file (whole sectors, as stored) */
export function readTrdFileData(bytes: Uint8Array, entry: TrdFileEntry): Uint8Array {
  const start = (entry.firstTrack * TRD_SECTORS_PER_TRACK + entry.firstSector) * TRD_SECTOR_SIZE;
  return bytes.slice(start, start + entry.sectors * TRD_SECTOR_SIZE);
}

const encodeName = (text: string, length: number) => {
  const out = new Uint8Array(length).fill(0x20);
  for (let i = 0; i < Math.min(length, text.length); i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
};

/** A blank, TR-DOS-formatted `.trd`: an empty catalogue and the disk-info sector */
export function createBlankTrd(geometry: TrdGeometry, label = ""): Uint8Array {
  const bytes = new Uint8Array(geometry.cylinders * geometry.sides * TRD_TRACK_SIZE);
  const tracks = geometry.cylinders * geometry.sides;
  bytes[TRD_FIRST_FREE_SECTOR] = 0;
  // --- Logical track 0 holds the catalogue: files start on logical track 1
  bytes[TRD_FIRST_FREE_TRACK] = 1;
  bytes[TRD_DISK_TYPE] = trdDiskType(geometry);
  bytes[TRD_FILE_COUNT] = 0;
  const free = (tracks - 1) * TRD_SECTORS_PER_TRACK;
  bytes[TRD_FREE_SECTORS] = free & 0xff;
  bytes[TRD_FREE_SECTORS + 1] = free >> 8;
  bytes[TRD_ID] = TRD_ID_VALUE;
  bytes.set(encodeName("", 9), TRD_PASSWORD);
  bytes[TRD_DELETED_FILES] = 0;
  bytes.set(encodeName(label, 8), TRD_LABEL);
  return bytes;
}

/** A file to add to a TR-DOS disk */
export type TrdNewFile = { name: string; type: string; param1: number; param2: number; data: Uint8Array };

/**
 * Adds a file after the last one, as TR-DOS's SAVE does: the catalogue entry, the data from the first
 * free sector, and the disk-info counters. Returns a new image.
 * @throws When the catalogue or the disk is full
 */
export function addTrdFile(image: Uint8Array, file: TrdNewFile): Uint8Array {
  const bytes = new Uint8Array(image);
  const info = readTrdDiskInfo(bytes);
  const entries = readTrdCatalog(bytes).length;
  if (entries >= TRD_MAX_FILES) throw new Error("The TR-DOS catalogue is full");
  const sectors = Math.ceil(file.data.length / TRD_SECTOR_SIZE);
  if (sectors > info.freeSectors) throw new Error("The TR-DOS disk is full");
  const at = entries * TRD_ENTRY_SIZE;
  bytes.set(encodeName(file.name, 8), at);
  bytes[at + 8] = file.type.charCodeAt(0) & 0xff;
  bytes[at + 9] = file.param1 & 0xff;
  bytes[at + 10] = (file.param1 >> 8) & 0xff;
  bytes[at + 11] = file.param2 & 0xff;
  bytes[at + 12] = (file.param2 >> 8) & 0xff;
  bytes[at + 13] = sectors;
  bytes[at + 14] = info.firstFreeSector;
  bytes[at + 15] = info.firstFreeTrack;
  const start = (info.firstFreeTrack * TRD_SECTORS_PER_TRACK + info.firstFreeSector) * TRD_SECTOR_SIZE;
  bytes.set(file.data, start);
  const next = info.firstFreeTrack * TRD_SECTORS_PER_TRACK + info.firstFreeSector + sectors;
  bytes[TRD_FIRST_FREE_SECTOR] = next % TRD_SECTORS_PER_TRACK;
  bytes[TRD_FIRST_FREE_TRACK] = Math.floor(next / TRD_SECTORS_PER_TRACK);
  bytes[TRD_FILE_COUNT] = info.fileCount + 1;
  const free = info.freeSectors - sectors;
  bytes[TRD_FREE_SECTORS] = free & 0xff;
  bytes[TRD_FREE_SECTORS + 1] = free >> 8;
  return bytes;
}

/**
 * A TR-DOS BASIC file's bytes and parameters: the program (and variables), then `$80 $AA` and the
 * autostart line, which the catalogue's lengths do not count (Sinclair Wiki, "TR-DOS filesystem")
 */
export function trdBasicFile(name: string, program: Uint8Array, autostartLine?: number): TrdNewFile {
  const tail = autostartLine === undefined ? [0x80] : [0x80, 0xaa, autostartLine & 0xff, (autostartLine >> 8) & 0xff];
  const data = new Uint8Array(program.length + tail.length);
  data.set(program);
  data.set(tail, program.length);
  return { name, type: "B", param1: program.length, param2: program.length, data };
}

/** A TR-DOS code file */
export function trdCodeFile(name: string, start: number, code: Uint8Array): TrdNewFile {
  return { name, type: "C", param1: start, param2: code.length, data: code };
}

// ------------------------------------------------------------------------------------------------
// SCL

const SCL_SIGNATURE = "SINCLAIR";
const SCL_HEADER_SIZE = 14;

/** Does the file start with the SCL signature? */
export function isSclImage(bytes: Uint8Array): boolean {
  return bytes.length >= 9 && String.fromCharCode(...bytes.subarray(0, 8)) === SCL_SIGNATURE;
}

/** The result of converting an `.scl` to a `.trd` */
export type SclConversion = { trd: Uint8Array; warnings: string[] };

/**
 * Builds an 80-track, double-sided `.trd` from an `.scl` container: its files, in order, from the
 * first free sector. The trailing 4-byte checksum (the sum of every byte before it) is checked when
 * present; a mismatch is a warning, not an error, as it is a convention rather than a specification.
 * @throws When the file is not an SCL or is truncated
 */
export function sclToTrd(bytes: Uint8Array, label = ""): SclConversion {
  if (!isSclImage(bytes)) throw new Error("Not an SCL file (no SINCLAIR signature)");
  const warnings: string[] = [];
  const count = bytes[8];
  let dataOffset = 9 + count * SCL_HEADER_SIZE;
  if (dataOffset > bytes.length) throw new Error("The SCL file is truncated in its headers");
  let trd = createBlankTrd({ cylinders: 80, sides: 2 }, label);
  for (let i = 0; i < count; i++) {
    const h = 9 + i * SCL_HEADER_SIZE;
    const sectors = bytes[h + 13];
    const length = sectors * TRD_SECTOR_SIZE;
    if (dataOffset + length > bytes.length) throw new Error(`The SCL file is truncated in file ${i + 1}`);
    trd = addTrdFile(trd, {
      name: String.fromCharCode(...bytes.subarray(h, h + 8)),
      type: String.fromCharCode(bytes[h + 8]),
      param1: bytes[h + 9] | (bytes[h + 10] << 8),
      param2: bytes[h + 11] | (bytes[h + 12] << 8),
      data: bytes.subarray(dataOffset, dataOffset + length)
    });
    dataOffset += length;
  }
  if (dataOffset + 4 <= bytes.length) {
    let sum = 0;
    for (let i = 0; i < dataOffset; i++) sum = (sum + bytes[i]) >>> 0;
    const stored = (bytes[dataOffset] | (bytes[dataOffset + 1] << 8) | (bytes[dataOffset + 2] << 16) | (bytes[dataOffset + 3] << 24)) >>> 0;
    if (stored !== sum) warnings.push("The SCL checksum does not match its contents");
  } else {
    warnings.push("The SCL file has no checksum");
  }
  return { trd, warnings };
}

/** Builds an `.scl` from a `.trd`'s live files (deleted entries left out), with the checksum */
export function trdToScl(trd: Uint8Array): Uint8Array {
  const files = readTrdCatalog(trd).filter((f) => !f.deleted);
  const parts: number[] = [...Array.from(SCL_SIGNATURE, (c) => c.charCodeAt(0)), files.length];
  for (const f of files) {
    const at = f.index * TRD_ENTRY_SIZE;
    parts.push(...trd.subarray(at, at + SCL_HEADER_SIZE));
  }
  for (const f of files) parts.push(...readTrdFileData(trd, f));
  let sum = 0;
  for (const b of parts) sum = (sum + b) >>> 0;
  parts.push(sum & 0xff, (sum >>> 8) & 0xff, (sum >>> 16) & 0xff, (sum >>> 24) & 0xff);
  return new Uint8Array(parts);
}

/** Any TR-DOS image file (`.trd` or `.scl`, told apart by content) in the core's layout */
export function trdosImageToCanonical(bytes: Uint8Array): CanonicalDisk & { scl: boolean; warnings: string[] } {
  if (isSclImage(bytes)) {
    const { trd, warnings } = sclToTrd(bytes);
    return { ...trdToCanonical(trd), scl: true, warnings };
  }
  return { ...trdToCanonical(bytes), scl: false, warnings: [] };
}
