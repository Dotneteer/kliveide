import {
  TRD_DELETED_FILES,
  TRD_ENTRY_SIZE,
  TRD_FILE_COUNT,
  TRD_FIRST_FREE_SECTOR,
  TRD_FIRST_FREE_TRACK,
  TRD_FREE_SECTORS,
  TRD_LABEL,
  TRD_MAX_FILES,
  TRD_PASSWORD,
  TRD_SECTOR_SIZE,
  TRD_SECTORS_PER_TRACK,
  addTrdFile,
  createBlankTrd,
  isSclImage,
  readTrdCatalog,
  readTrdDiskInfo,
  readTrdFileData,
  sclToTrd,
  trdBasicFile,
  trdCodeFile,
  trdGeometry,
  trdToScl,
  type TrdFileEntry,
  type TrdGeometry
} from "@emu/machines/disk/trd/trdImage";
import {
  DiskFsError,
  type DiskFileAttributes,
  type DiskFileEntry,
  type DiskFileKind,
  type DiskFileSystem,
  type DiskFsInfo,
  type DiskSectorRole,
  type NewDiskFile
} from "./types";

/*
 * TR-DOS (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, B3), over `trdImage.ts`'s catalogue
 * functions. The facts are the ones BETA128_TRDOS_PLAN §9 records: a 16-byte catalogue entry (name
 * 8, type letter, two parameters, sector count, first sector and track), a deleted file's first
 * name byte $01, files laid down one after another from the disk-info sector's first free sector.
 *
 * - Deleting marks the entry, as TR-DOS's ERASE does; the space comes back only with `compact`, the
 *   counterpart of TR-DOS's MOVE, which lays the remaining files down again without gaps.
 * - A name is `NAME.T`: up to 8 characters and the type letter (B, C, D, #, or another).
 * - BASIC: parameter 1 is the program and variables' length, parameter 2 the program's; the data
 *   ends with $80, then $AA and the auto-run line. CODE: parameter 1 is the start, parameter 2 the
 *   length.
 * - An `.scl` is opened as the `.trd` it converts to; `scl()` writes the files back as an `.scl`.
 */

const NO_ATTRIBUTES: DiskFileAttributes = { readOnly: false, system: false, archive: false };

export class TrdosFileSystem implements DiskFileSystem {
  readonly system = "trdos";
  private bytes: Uint8Array;
  readonly geometry: TrdGeometry;
  /** Notes from opening the image (an `.scl` checksum, for example) */
  readonly warnings: string[] = [];

  constructor (image: Uint8Array) {
    if (isSclImage(image)) {
      const conversion = sclToTrd(image);
      this.bytes = conversion.trd;
      this.warnings.push(...conversion.warnings);
    } else {
      this.bytes = new Uint8Array(image);
    }
    if (!readTrdDiskInfo(this.bytes).isTrDos) {
      throw new DiskFsError("unformatted", "The disk has no TR-DOS disk-info sector.");
    }
    this.geometry = trdGeometry(this.bytes);
  }

  info (): DiskFsInfo {
    const info = readTrdDiskInfo(this.bytes);
    const tracks = this.geometry.cylinders * this.geometry.sides;
    return {
      system: "TR-DOS",
      format: `${this.geometry.cylinders} x ${this.geometry.sides}`,
      label: info.label,
      totalBytes: (tracks - 1) * TRD_SECTORS_PER_TRACK * TRD_SECTOR_SIZE,
      freeBytes: info.freeSectors * TRD_SECTOR_SIZE,
      blockSize: TRD_SECTOR_SIZE,
      directoryEntries: TRD_MAX_FILES,
      usedEntries: readTrdCatalog(this.bytes).length
    };
  }

  list (options: { deleted?: boolean } = {}): DiskFileEntry[] {
    return readTrdCatalog(this.bytes)
      .filter((e) => options.deleted || !e.deleted)
      .map((e) => this.entryOf(e));
  }

  read (name: string): Uint8Array {
    const entry = this.find(name);
    const data = readTrdFileData(this.bytes, entry);
    if (entry.type === "B") return data.slice(0, entry.param1);
    if (entry.type === "C") return data.slice(0, entry.param2);
    return data;
  }

  write (file: NewDiskFile): DiskFileEntry {
    const { base, type } = splitTrdName(file.name, file.kind);
    if (readTrdCatalog(this.bytes).some((e) => !e.deleted && e.name === base && e.type === type)) {
      throw new DiskFsError("exists", `A file named ${file.name} is already on the disk.`, { name: file.name });
    }
    const info = readTrdDiskInfo(this.bytes);
    if (readTrdCatalog(this.bytes).length >= TRD_MAX_FILES) {
      throw new DiskFsError("directoryFull", `The catalogue has no room for ${file.name}.`, { name: file.name });
    }
    if (Math.ceil(file.data.length / TRD_SECTOR_SIZE) > info.freeSectors) {
      throw new DiskFsError("diskFull", `The disk has no room for ${file.name}.`, { name: file.name });
    }
    let entry;
    if (file.kind === "basic") {
      entry = trdBasicFile(base, file.data, file.start);
      entry.param2 = file.variablesOffset ?? file.data.length;
    } else if (file.kind === "code") {
      entry = trdCodeFile(base, file.start ?? 0, file.data);
    } else {
      entry = { name: base, type, param1: 0, param2: file.data.length, data: file.data };
    }
    entry.type = type;
    this.bytes = addTrdFile(this.bytes, entry);
    return this.list().find((f) => f.baseName === base && f.extension === type)!;
  }

  delete (name: string): void {
    const entry = this.find(name);
    const at = entry.index * TRD_ENTRY_SIZE;
    this.bytes[at] = 0x01;
    this.bytes[TRD_DELETED_FILES] = (this.bytes[TRD_DELETED_FILES] + 1) & 0xff;
  }

  rename (name: string, newName: string): void {
    const entry = this.find(name);
    const kind = entry.type === "B" ? "basic" : entry.type === "C" ? "code" : "raw";
    const { base, type } = splitTrdName(newName, kind, entry.type);
    if (readTrdCatalog(this.bytes).some((e) => e !== entry && !e.deleted && e.name === base && e.type === type)) {
      throw new DiskFsError("exists", `A file named ${newName} is already on the disk.`, { name: newName });
    }
    const at = entry.index * TRD_ENTRY_SIZE;
    for (let i = 0; i < 8; i++) this.bytes[at + i] = i < base.length ? base.charCodeAt(i) : 0x20;
    this.bytes[at + 8] = type.charCodeAt(0);
  }

  setAttributes (_name: string, _attributes: Partial<DiskFileAttributes>): void {
    throw new DiskFsError("unsupported", "TR-DOS files have no attributes.");
  }

  /** Sets the disk's label (up to 8 characters) */
  setLabel (label: string): void {
    for (let i = 0; i < 8; i++) this.bytes[TRD_LABEL + i] = i < label.length ? label.charCodeAt(i) & 0xff : 0x20;
  }

  /**
   * Lays the files down again without the deleted ones, as TR-DOS's MOVE does: the catalogue loses
   * its deleted entries and the free space becomes one run after the last file
   */
  compact (): void {
    const label = readTrdDiskInfo(this.bytes).label;
    const password = this.bytes.slice(TRD_PASSWORD, TRD_PASSWORD + 9);
    let fresh = createBlankTrd(this.geometry, label);
    fresh.set(password, TRD_PASSWORD);
    for (const entry of readTrdCatalog(this.bytes)) {
      if (entry.deleted) continue;
      fresh = addTrdFile(fresh, {
        name: entry.name,
        type: entry.type,
        param1: entry.param1,
        param2: entry.param2,
        data: readTrdFileData(this.bytes, entry)
      });
    }
    this.bytes = fresh;
  }

  layout (): Map<number, DiskSectorRole> {
    const roles = new Map<number, DiskSectorRole>();
    const tracks = this.geometry.cylinders * this.geometry.sides;
    const info = readTrdDiskInfo(this.bytes);
    const firstFree = info.firstFreeTrack * TRD_SECTORS_PER_TRACK + info.firstFreeSector;
    for (let s = 0; s < tracks * TRD_SECTORS_PER_TRACK; s++) {
      const role: DiskSectorRole =
        s < 8 ? { role: "directory" } : s < TRD_SECTORS_PER_TRACK ? { role: "system" } : s >= firstFree ? { role: "free" } : { role: "unused" };
      roles.set(trdKey(s), role);
    }
    for (const entry of readTrdCatalog(this.bytes)) {
      if (entry.deleted) continue;
      const first = entry.firstTrack * TRD_SECTORS_PER_TRACK + entry.firstSector;
      for (let s = first; s < first + entry.sectors; s++) roles.set(trdKey(s), { role: "file", file: displayName(entry) });
    }
    return roles;
  }

  image (): Uint8Array {
    return new Uint8Array(this.bytes);
  }

  /** The files as an `.scl` container */
  scl (): Uint8Array {
    const live = new TrdosFileSystem(this.bytes);
    live.compact();
    return trdToScl(live.bytes);
  }

  private find (name: string): TrdFileEntry {
    const at = name.lastIndexOf(".");
    const base = (at >= 0 ? name.slice(0, at) : name).trimEnd();
    const type = at >= 0 ? name.slice(at + 1) : undefined;
    const entry = readTrdCatalog(this.bytes).find((e) => !e.deleted && e.name === base && (type === undefined || e.type === type));
    if (!entry) throw new DiskFsError("notFound", `${name} is not on the disk.`, { name });
    return entry;
  }

  private entryOf (e: TrdFileEntry): DiskFileEntry {
    const kind: DiskFileKind = e.type === "B" ? "basic" : e.type === "C" ? "code" : e.type === "D" ? "numberArray" : "raw";
    const first = e.firstTrack * TRD_SECTORS_PER_TRACK + e.firstSector;
    const entry: DiskFileEntry = {
      name: displayName(e),
      baseName: e.name,
      extension: e.type,
      kind,
      size: e.type === "B" ? e.param1 : e.type === "C" ? e.param2 : e.sectors * TRD_SECTOR_SIZE,
      allocated: e.sectors * TRD_SECTOR_SIZE,
      attributes: NO_ATTRIBUTES,
      deleted: e.deleted,
      sectors: Array.from({ length: e.sectors }, (_, i) => trdRef(first + i))
    };
    if (e.type === "B") {
      entry.variablesOffset = e.param2;
      // --- The auto-run line follows the program and variables: $80, $AA, line
      const data = readTrdFileData(this.bytes, e);
      if (data[e.param1] === 0x80 && data[e.param1 + 1] === 0xaa) {
        entry.start = data[e.param1 + 2] | (data[e.param1 + 3] << 8);
      }
    } else if (e.type === "C") {
      entry.start = e.param1;
    }
    return entry;
  }
}

/** A TR-DOS sector (counted from the disk's start) as a layout key: logical track, sector */
function trdKey (sector: number): number {
  const ref = trdRef(sector);
  return ref.trackIndex * 256 + ref.sectorIndex;
}

function trdRef (sector: number) {
  return { trackIndex: Math.floor(sector / TRD_SECTORS_PER_TRACK), sectorIndex: sector % TRD_SECTORS_PER_TRACK };
}

function displayName (e: TrdFileEntry): string {
  // --- A deleted entry's first byte is $01: TR-DOS has lost the name's first letter
  const name = e.deleted ? `?${e.name.slice(1)}` : e.name;
  return `${name}.${e.type}`;
}

/** `NAME.T` → its parts; without a type letter, the kind's */
function splitTrdName (name: string, kind: DiskFileKind, keepType?: string): { base: string; type: string } {
  const at = name.lastIndexOf(".");
  const base = at >= 0 ? name.slice(0, at) : name;
  let type = at >= 0 ? name.slice(at + 1) : keepType ?? (kind === "basic" ? "B" : kind === "code" ? "C" : kind === "raw" ? "#" : "D");
  if (type.length !== 1) type = keepType ?? "C";
  // eslint-disable-next-line no-control-regex
  if (!base || base.length > 8 || /[\x00-\x1f\x80-\xff]/.test(base)) {
    throw new DiskFsError("badName", `"${name}" is not a TR-DOS file name (up to 8 characters and a type letter).`, { name });
  }
  return { base, type };
}

/** Counters the catalogue keeps, for tests */
export function trdCounters (bytes: Uint8Array) {
  return {
    files: bytes[TRD_FILE_COUNT],
    deleted: bytes[TRD_DELETED_FILES],
    freeSectors: bytes[TRD_FREE_SECTORS] | (bytes[TRD_FREE_SECTORS + 1] << 8),
    firstFree: bytes[TRD_FIRST_FREE_TRACK] * TRD_SECTORS_PER_TRACK + bytes[TRD_FIRST_FREE_SECTOR]
  };
}
