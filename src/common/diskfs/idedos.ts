import type { BlockDevice } from "./blockDevice";
import { SECTOR_SIZE } from "./blockDevice";
import { Plus3DosFileSystem, type Plus3BlockStore, type Plus3DosSpec } from "./plus3dos";
import { DiskFsError } from "./types";

/*
 * IDEDOS hard disks, the +3e's (.plans/FILE_MANAGER_PLAN.md, Phase 9): the partition table and its
 * +3DOS partitions, each a +3DOS file system on the disk's sectors, read and written in place.
 *
 * Written from the format's description on the Sinclair Wiki (IDEDOS) and the +3DOS XDPB of the +3
 * manual:
 *
 * - The system partition starts at cylinder 0 head 0 sector 1 (or head 1, to leave an MBR); its first
 *   sectors are the partition table, 64-byte entries, the first being the system partition itself,
 *   named `PLUSIDEDOS` and padded with spaces.
 * - An entry: name (16), type (+$10), start cylinder (+$11, word), start head (+$13), end cylinder
 *   (+$14, word), end head (+$16), largest logical sector (+$17, long), type-specific data.
 * - The system partition's data: cylinders (+$20, word), heads (+$22), sectors per track (+$23),
 *   sectors per cylinder (+$24, word), the largest partition number (+$26, word).
 * - A +3DOS partition (type 3) holds its XDPB at +$20: SPT (word), BSH, BLM, EXM, DSM (word), DRM
 *   (word), AL0, AL1, CKS (word), OFF (word), PSH, PHM.
 * - Logical sectors are 512 bytes. A halved (8-bit) image is refused before it gets here.
 */

const ENTRY = 64;
const SYSTEM_NAME = "PLUSIDEDOS      ";
const TYPE_SYSTEM = 1;
export const TYPE_PLUS3DOS = 3;

export type IdedosGeometry = { cylinders: number; heads: number; sectorsPerTrack: number };

export type IdedosPartition = {
  /** The entry's place in the table (0 is the system partition) */
  index: number;
  name: string;
  type: number;
  firstLba: number;
  sectorCount: number;
  /** A +3DOS partition's XDPB */
  xdpb?: Uint8Array;
};

export type IdedosDisk = {
  systemLba: number;
  geometry: IdedosGeometry;
  partitions: IdedosPartition[];
};

function isSystemEntry (sector: Uint8Array): boolean {
  for (let i = 0; i < 16; i++) if (sector[i] !== SYSTEM_NAME.charCodeAt(i)) return false;
  return sector[0x10] === TYPE_SYSTEM;
}

const word = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const long = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

/** The IDEDOS partition table of a disk, if it has one (at LBA 0, or at head 1 behind an MBR) */
export function readIdedos (device: BlockDevice): IdedosDisk | undefined {
  if (device.sectorCount === 0) return undefined;
  let systemLba = -1;
  // --- Head 1 sector 1 is LBA `sectors per track`: at most 63
  for (let lba = 0; lba < Math.min(64, device.sectorCount); lba++) {
    if (isSystemEntry(device.readSector(lba))) {
      systemLba = lba;
      break;
    }
  }
  if (systemLba < 0) return undefined;
  const system = device.readSector(systemLba);
  const geometry = { cylinders: word(system, 0x20), heads: system[0x22], sectorsPerTrack: system[0x23] };
  if (!geometry.heads || !geometry.sectorsPerTrack) return undefined;
  const tableSectors = long(system, 0x17) + 1;
  const maxEntries = Math.min(word(system, 0x26) + 1, (tableSectors * SECTOR_SIZE) / ENTRY, 4096);
  const partitions: IdedosPartition[] = [];
  let cached = -1;
  let sector = system;
  for (let i = 0; i < maxEntries; i++) {
    const s = systemLba + Math.floor((i * ENTRY) / SECTOR_SIZE);
    if (s !== cached) {
      if (s >= device.sectorCount) break;
      sector = device.readSector(s);
      cached = s;
    }
    const e = sector.subarray((i * ENTRY) % SECTOR_SIZE, (i * ENTRY) % SECTOR_SIZE + ENTRY);
    const type = e[0x10];
    if (type === 0 || type === 0xff) continue;
    const firstLba = (word(e, 0x11) * geometry.heads + e[0x13]) * geometry.sectorsPerTrack;
    partitions.push({
      index: i,
      name: String.fromCharCode(...e.subarray(0, 16)).trimEnd(),
      type,
      firstLba,
      sectorCount: long(e, 0x17) + 1,
      xdpb: type === TYPE_PLUS3DOS ? e.slice(0x20, 0x3c) : undefined
    });
  }
  return { systemLba, geometry, partitions };
}

/** A +3DOS partition's blocks, on the disk's sectors */
export class IdedosPlus3Store implements Plus3BlockStore {
  readonly spec: Plus3DosSpec;
  readonly totalBlocks: number;
  readonly directoryEntries: number;
  private readonly base: number;

  constructor (private readonly device: BlockDevice, private readonly partition: IdedosPartition) {
    const x = partition.xdpb;
    if (!x) throw new DiskFsError("unsupported", `${partition.name} is not a +3DOS partition.`, { name: partition.name });
    const spt = word(x, 0);
    const bsh = x[2];
    const dsm = word(x, 5);
    const drm = word(x, 7);
    const al = (x[9] << 8) | x[10];
    const off = word(x, 13);
    let dirBlocks = 0;
    for (let b = 15; b >= 0 && al & (1 << b); b--) dirBlocks++;
    const blockSize = 128 << bsh;
    if (bsh < 3 || bsh > 7 || !dirBlocks) {
      throw new DiskFsError("unformatted", `${partition.name} has no +3DOS file system Klive can read.`, { name: partition.name });
    }
    this.spec = {
      name: "+3e partition",
      sidedness: 0,
      tracks: 0,
      sectorsPerTrack: 0,
      sectorSize: SECTOR_SIZE,
      firstSectorId: 0,
      reservedTracks: off,
      blockSize,
      directoryBlocks: dirBlocks
    };
    this.totalBlocks = dsm + 1;
    this.directoryEntries = drm + 1;
    // --- The reserved tracks' records come first; SPT counts 128-byte records
    this.base = off * spt * 128;
    if (this.base + this.totalBlocks * blockSize > partition.sectorCount * SECTOR_SIZE) {
      throw new DiskFsError("unformatted", `${partition.name}'s file system is larger than the partition.`, { name: partition.name });
    }
  }

  readBlock (block: number): Uint8Array {
    return this.readBytes(this.base + block * this.spec.blockSize, this.spec.blockSize);
  }

  writeBlock (block: number, data: Uint8Array): void {
    this.writeBytes(this.base + block * this.spec.blockSize, data.subarray(0, this.spec.blockSize));
  }

  private readBytes (at: number, length: number): Uint8Array {
    const out = new Uint8Array(length);
    for (let done = 0; done < length; ) {
      const pos = at + done;
      const lba = Math.floor(pos / SECTOR_SIZE);
      const within = pos % SECTOR_SIZE;
      const n = Math.min(SECTOR_SIZE - within, length - done);
      out.set(this.device.readSector(this.partition.firstLba + lba).subarray(within, within + n), done);
      done += n;
    }
    return out;
  }

  private writeBytes (at: number, data: Uint8Array): void {
    for (let done = 0; done < data.length; ) {
      const pos = at + done;
      const lba = this.partition.firstLba + Math.floor(pos / SECTOR_SIZE);
      const within = pos % SECTOR_SIZE;
      const n = Math.min(SECTOR_SIZE - within, data.length - done);
      const sector = n === SECTOR_SIZE ? new Uint8Array(SECTOR_SIZE) : this.device.readSector(lba).slice();
      sector.set(data.subarray(done, done + n), within);
      this.device.writeSector(lba, sector);
      done += n;
    }
  }
}

/** Partition indexes offset so they never meet an MBR partition's on the same image */
export const IDEDOS_PARTITION_BASE = 1000;

/** The +3DOS file system of an IDEDOS partition (`index` is the table's, from `readIdedos`) */
export function openIdedosPartition (device: BlockDevice, index: number): Plus3DosFileSystem {
  const disk = readIdedos(device);
  const partition = disk?.partitions.find((p) => p.index === index);
  if (!partition) throw new DiskFsError("notFound", `The disk has no IDEDOS partition ${index}.`, { name: String(index) });
  return new Plus3DosFileSystem(new IdedosPlus3Store(device, partition));
}

// -------------------------------------------------------------------------------------------------
// Formatting (tests, and new +3e disks)

export type IdedosFormatOptions = {
  geometry?: IdedosGeometry;
  partitions: { name: string; sizeKb: number }[];
};

/**
 * Formats a disk for IDEDOS: the system partition on cylinder 0, then the +3DOS partitions asked
 * for, each from a cylinder boundary, 4K blocks and a 512-entry directory
 */
export function formatIdedos (device: BlockDevice, options: IdedosFormatOptions): IdedosDisk {
  const g = options.geometry ?? { heads: 4, sectorsPerTrack: 32, cylinders: Math.floor(device.sectorCount / 128) };
  const perCylinder = g.heads * g.sectorsPerTrack;
  const table = new Uint8Array(perCylinder * SECTOR_SIZE);
  const writeEntry = (i: number, name: string, type: number, firstCyl: number, cylinders: number, sectors: number) => {
    const e = table.subarray(i * ENTRY, (i + 1) * ENTRY);
    const padded = name.padEnd(16, " ").slice(0, 16);
    for (let k = 0; k < 16; k++) e[k] = padded.charCodeAt(k);
    e[0x10] = type;
    e[0x11] = firstCyl & 0xff;
    e[0x12] = firstCyl >> 8;
    e[0x13] = 0;
    const lastCyl = firstCyl + cylinders - 1;
    e[0x14] = lastCyl & 0xff;
    e[0x15] = lastCyl >> 8;
    e[0x16] = g.heads - 1;
    const ls = sectors - 1;
    e[0x17] = ls & 0xff;
    e[0x18] = (ls >> 8) & 0xff;
    e[0x19] = (ls >> 16) & 0xff;
    e[0x1a] = (ls >> 24) & 0xff;
    return e;
  };
  const sys = writeEntry(0, "PLUSIDEDOS", TYPE_SYSTEM, 0, 1, perCylinder);
  sys[0x20] = g.cylinders & 0xff;
  sys[0x21] = g.cylinders >> 8;
  sys[0x22] = g.heads;
  sys[0x23] = g.sectorsPerTrack;
  sys[0x24] = perCylinder & 0xff;
  sys[0x25] = perCylinder >> 8;
  const maxPartition = table.length / ENTRY - 1;
  sys[0x26] = maxPartition & 0xff;
  sys[0x27] = maxPartition >> 8;

  let cylinder = 1;
  options.partitions.forEach((p, n) => {
    const cylinders = Math.max(1, Math.ceil((p.sizeKb * 1024) / (perCylinder * SECTOR_SIZE)));
    if (cylinder + cylinders > g.cylinders) throw new DiskFsError("diskFull", `The disk has no room for ${p.name}.`, { name: p.name });
    const sectors = cylinders * perCylinder;
    const e = writeEntry(n + 1, p.name, TYPE_PLUS3DOS, cylinder, cylinders, sectors);
    // --- The XDPB: 128 records a "track", 4K blocks, 512 directory entries in 4 blocks, nothing reserved
    const blockSize = 4096;
    const dsm = Math.floor((sectors * SECTOR_SIZE) / blockSize) - 1;
    const x = e.subarray(0x20, 0x3c);
    x[0] = 128;
    x[1] = 0;
    x[2] = 5;
    x[3] = 31;
    x[4] = dsm > 255 ? 1 : 3;
    x[5] = dsm & 0xff;
    x[6] = dsm >> 8;
    x[7] = 511 & 0xff;
    x[8] = 511 >> 8;
    x[9] = 0xf0;
    x[10] = 0;
    x[15] = 2;
    x[16] = 3;
    // --- The directory, empty
    const firstLba = cylinder * perCylinder;
    const empty = new Uint8Array(SECTOR_SIZE).fill(0xe5);
    for (let s = 0; s < (4 * blockSize) / SECTOR_SIZE; s++) device.writeSector(firstLba + s, empty);
    cylinder += cylinders;
  });
  for (let s = 0; s < perCylinder; s++) device.writeSector(s, table.subarray(s * SECTOR_SIZE, (s + 1) * SECTOR_SIZE));
  return readIdedos(device)!;
}
