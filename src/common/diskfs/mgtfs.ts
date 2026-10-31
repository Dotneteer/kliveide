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
 * The MGT +D / DISCiPLE file system (G+DOS) on a `.mgt` image (.plans/FILE_MANAGER_PLAN.md, Phase
 * 9). Written from the format's published description: MGT's DISCiPLE/+D Technical Guide (the
 * directory, the sector address map, the link bytes, the 9-byte header), and the `.mgt` image's
 * track order as MAME's SAM Coupé image format states it (the heads alternate).
 *
 * - 80 cylinders, 2 sides, 10 sectors of 512 bytes. In the image, cylinder `c` head `h` starts at
 *   `(c * 2 + h) * 10 * 512`. A track number on the disk is `c` on side 0 and `128 + c` on side 1.
 * - Tracks 0-3 of side 0 hold the directory: 80 entries of 256 bytes, two to a sector.
 * - A file's sectors hold 510 bytes each and end with the next sector's track and sector; (0, 0)
 *   ends the file. The entry's sector address map has a bit for each data sector: bit 0 of byte 15
 *   is track 4 sector 1, and the bits run on through side 0, then side 1.
 * - A ZX file (BASIC, arrays, CODE, SCREEN$) starts with the 9-byte header the entry also holds at
 *   211-219; its data follows.
 */

const SECTOR = 512;
const SECTORS = 10;
const CYLINDERS = 80;
const DIR_TRACKS = 4;
const DIR_ENTRIES = DIR_TRACKS * SECTORS * 2;
const ENTRY = 256;
const DATA = 510;
const MAP_AT = 15;
const MAP_SECTORS = (CYLINDERS - DIR_TRACKS + CYLINDERS) * SECTORS;
const NAME_LENGTH = 10;
const HEADER = 9;

/** The image's size: 80 cylinders, 2 sides */
export const MGT_IMAGE_SIZE = CYLINDERS * 2 * SECTORS * SECTOR;

/** Directory file types (bits 0-4 of byte 0) */
const DIR_TYPES: Record<number, DiskFileKind> = { 1: "basic", 2: "numberArray", 3: "charArray", 4: "code", 7: "code" };
const TAPE_TYPES: Partial<Record<DiskFileKind, number>> = { basic: 0, numberArray: 1, charArray: 2, code: 3 };
const DIR_TYPE_OF: Partial<Record<DiskFileKind, number>> = { basic: 1, numberArray: 2, charArray: 3, code: 4 };
const SCREEN_TYPE = 7;

type Slot = { index: number; entry: Uint8Array };

export class MgtFileSystem implements DiskFileSystem {
  readonly system = "mgt";
  private readonly bytes: Uint8Array;

  constructor (bytes: Uint8Array) {
    if (bytes.length !== MGT_IMAGE_SIZE) {
      throw new DiskFsError("unformatted", `An MGT image is ${MGT_IMAGE_SIZE} bytes; this one is ${bytes.length}.`);
    }
    this.bytes = bytes.slice();
  }

  /** A blank, formatted disk: an empty directory */
  static blank (): MgtFileSystem {
    return new MgtFileSystem(new Uint8Array(MGT_IMAGE_SIZE));
  }

  info (): DiskFsInfo {
    const used = this.usedSectors();
    const live = this.live();
    return {
      system: "MGT",
      format: "+D/DISCiPLE",
      totalBytes: MAP_SECTORS * DATA,
      freeBytes: (MAP_SECTORS - used.size) * DATA,
      blockSize: DATA,
      directoryEntries: DIR_ENTRIES,
      usedEntries: live.length
    };
  }

  list (): DiskFileEntry[] {
    return this.live().map((s) => this.entryOf(s));
  }

  read (name: string): Uint8Array {
    const slot = this.find(name);
    const raw = this.chainBytes(slot.entry);
    const kind = DIR_TYPES[slot.entry[0] & 0x1f];
    if (!kind) return raw;
    const length = slot.entry[212] | (slot.entry[213] << 8);
    return raw.slice(HEADER, HEADER + length);
  }

  write (file: NewDiskFile): DiskFileEntry {
    const name = file.name.trim();
    if (!name || name.length > NAME_LENGTH) {
      throw new DiskFsError("badName", `"${file.name}" is not an MGT file name (1 to ${NAME_LENGTH} characters).`, { name: file.name });
    }
    if (this.live().some((s) => sameName(readName(s.entry), name))) {
      throw new DiskFsError("exists", `A file named ${name} is already on the disk.`, { name });
    }
    const slot = this.freeSlot();
    if (slot === undefined) throw new DiskFsError("directoryFull", `The directory has no room for ${name}.`, { name });

    // --- A ZX file's header holds a 16-bit length
    if (file.data.length > 0xffff) {
      throw new DiskFsError("unsupported", `${name} is larger than a ZX Spectrum file can be (64K).`, { name });
    }
    const kind = file.kind === "raw" ? "code" : file.kind;
    const header = new Uint8Array(HEADER);
    header[0] = TAPE_TYPES[kind] ?? 3;
    word(header, 1, file.data.length);
    if (kind === "basic") {
      word(header, 3, 0x5ccb);
      word(header, 5, file.variablesOffset ?? file.data.length);
      word(header, 7, file.start ?? 0xffff);
    } else if (kind === "code") {
      word(header, 3, file.start ?? 32768);
      word(header, 5, 0);
      word(header, 7, 0xffff);
    } else {
      const letter = (file.variableName ?? "a").toLowerCase().charCodeAt(0) & 0x1f;
      header[4] = (kind === "charArray" ? 0xc0 : 0x80) | letter;
      word(header, 7, 0xffff);
    }
    const content = new Uint8Array(HEADER + file.data.length);
    content.set(header);
    content.set(file.data, HEADER);

    const count = Math.max(1, Math.ceil(content.length / DATA));
    const used = this.usedSectors();
    const free: number[] = [];
    for (let bit = 0; bit < MAP_SECTORS && free.length < count; bit++) if (!used.has(bit)) free.push(bit);
    if (free.length < count) throw new DiskFsError("diskFull", `The disk has no room for ${name}.`, { name });

    const entry = new Uint8Array(ENTRY);
    const screen = kind === "code" && file.data.length === 6912 && file.start === 16384;
    entry[0] = screen ? SCREEN_TYPE : DIR_TYPE_OF[kind] ?? 4;
    writeName(entry, name);
    entry[11] = (count >> 8) & 0xff;
    entry[12] = count & 0xff;
    const first = sectorOfBit(free[0]);
    entry[13] = first.track;
    entry[14] = first.sector;
    for (let i = 0; i < count; i++) {
      const bit = free[i];
      entry[MAP_AT + (bit >> 3)] |= 1 << (bit & 7);
      const at = sectorOfBit(bit);
      const next = i + 1 < count ? sectorOfBit(free[i + 1]) : { track: 0, sector: 0 };
      const sector = new Uint8Array(SECTOR);
      sector.set(content.subarray(i * DATA, (i + 1) * DATA));
      sector[DATA] = next.track;
      sector[DATA + 1] = next.sector;
      this.bytes.set(sector, offsetOf(at.track, at.sector));
    }
    entry.set(header, 211);
    this.writeEntry(slot, entry);
    return this.entryOf({ index: slot, entry });
  }

  delete (name: string): void {
    const slot = this.find(name);
    const entry = slot.entry.slice();
    entry[0] = 0;
    this.writeEntry(slot.index, entry);
  }

  rename (name: string, newName: string): void {
    const slot = this.find(name);
    const target = newName.trim();
    if (!target || target.length > NAME_LENGTH) {
      throw new DiskFsError("badName", `"${newName}" is not an MGT file name (1 to ${NAME_LENGTH} characters).`, { name: newName });
    }
    if (this.live().some((s) => s.index !== slot.index && sameName(readName(s.entry), target))) {
      throw new DiskFsError("exists", `A file named ${target} is already on the disk.`, { name: target });
    }
    const entry = slot.entry.slice();
    writeName(entry, target);
    this.writeEntry(slot.index, entry);
  }

  setAttributes (_name: string, _attributes: Partial<DiskFileAttributes>): void {
    throw new DiskFsError("unsupported", "MGT files have no attributes Klive changes.");
  }

  layout (): Map<number, DiskSectorRole> {
    return new Map();
  }

  image (): Uint8Array {
    return this.bytes.slice();
  }

  // -----------------------------------------------------------------------------------------------

  private entryAt (index: number): Uint8Array {
    const track = Math.floor(index / (SECTORS * 2));
    const sector = Math.floor((index % (SECTORS * 2)) / 2) + 1;
    const at = offsetOf(track, sector) + (index % 2) * ENTRY;
    return this.bytes.subarray(at, at + ENTRY);
  }

  private writeEntry (index: number, entry: Uint8Array): void {
    this.entryAt(index).set(entry);
  }

  private live (): Slot[] {
    const out: Slot[] = [];
    for (let i = 0; i < DIR_ENTRIES; i++) {
      const entry = this.entryAt(i);
      if ((entry[0] & 0x1f) !== 0) out.push({ index: i, entry });
    }
    return out;
  }

  private freeSlot (): number | undefined {
    for (let i = 0; i < DIR_ENTRIES; i++) if ((this.entryAt(i)[0] & 0x1f) === 0) return i;
    return undefined;
  }

  private find (name: string): Slot {
    const slot = this.live().find((s) => sameName(readName(s.entry), name));
    if (!slot) throw new DiskFsError("notFound", `${name} is not on the disk.`, { name });
    return slot;
  }

  private usedSectors (): Set<number> {
    const used = new Set<number>();
    for (const { entry } of this.live()) {
      for (let byte = 0; byte < Math.ceil(MAP_SECTORS / 8); byte++) {
        const bits = entry[MAP_AT + byte];
        if (!bits) continue;
        for (let b = 0; b < 8; b++) if (bits & (1 << b)) used.add(byte * 8 + b);
      }
    }
    return used;
  }

  private chainBytes (entry: Uint8Array): Uint8Array {
    const count = (entry[11] << 8) | entry[12];
    const out = new Uint8Array(count * DATA);
    let track = entry[13];
    let sector = entry[14];
    let n = 0;
    while ((track !== 0 || sector !== 0) && n < count) {
      if (sector < 1 || sector > SECTORS || (track & 0x7f) >= CYLINDERS) {
        throw new DiskFsError("unformatted", `A file's sector chain points off the disk (track ${track}, sector ${sector}).`);
      }
      const at = offsetOf(track, sector);
      out.set(this.bytes.subarray(at, at + DATA), n * DATA);
      track = this.bytes[at + DATA];
      sector = this.bytes[at + DATA + 1];
      n++;
    }
    return out.subarray(0, n * DATA);
  }

  private entryOf (s: Slot): DiskFileEntry {
    const e = s.entry;
    const dirType = e[0] & 0x1f;
    const kind = DIR_TYPES[dirType] ?? "raw";
    const count = (e[11] << 8) | e[12];
    const zx = kind !== "raw";
    const length = zx ? e[212] | (e[213] << 8) : count * DATA;
    const param = e[214] | (e[215] << 8);
    const autorun = e[218] | (e[219] << 8);
    const name = readName(e);
    return {
      name,
      baseName: name,
      extension: "",
      kind,
      size: length,
      allocated: count * SECTOR,
      start: kind === "basic" ? (autorun < 10000 ? autorun : undefined) : kind === "code" ? param : undefined,
      variablesOffset: kind === "basic" ? e[216] | (e[217] << 8) : undefined,
      variableName: kind === "numberArray" || kind === "charArray" ? String.fromCharCode(0x60 + (e[215] & 0x1f)) : undefined,
      attributes: { readOnly: (e[0] & 0x40) !== 0, system: false, archive: false },
      deleted: false,
      sectors: [],
      hidden: (e[0] & 0x80) !== 0
    };
  }
}

/** The image offset of a sector: `track` is 0-79 on side 0, 128-207 on side 1; `sector` is 1-10 */
function offsetOf (track: number, sector: number): number {
  const head = track & 0x80 ? 1 : 0;
  const cylinder = track & 0x7f;
  return ((cylinder * 2 + head) * SECTORS + (sector - 1)) * SECTOR;
}

/** A sector address map bit's track and sector: side 0 from track 4, then side 1 */
function sectorOfBit (bit: number): { track: number; sector: number } {
  const logical = Math.floor(bit / SECTORS) + DIR_TRACKS;
  const track = logical < CYLINDERS ? logical : 0x80 | (logical - CYLINDERS);
  return { track, sector: (bit % SECTORS) + 1 };
}

function readName (entry: Uint8Array): string {
  return String.fromCharCode(...entry.subarray(1, 1 + NAME_LENGTH)).trimEnd();
}

function writeName (entry: Uint8Array, name: string): void {
  const padded = name.padEnd(NAME_LENGTH, " ").slice(0, NAME_LENGTH);
  for (let i = 0; i < NAME_LENGTH; i++) entry[1 + i] = padded.charCodeAt(i) & 0xff;
}

function sameName (a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function word (bytes: Uint8Array, at: number, v: number): void {
  bytes[at] = v & 0xff;
  bytes[at + 1] = (v >> 8) & 0xff;
}
