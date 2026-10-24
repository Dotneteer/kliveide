/*
 * Block devices (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, C1): what a hard-disk file system
 * reads and writes, 512-byte sectors by LBA, whatever the image's container - a raw `.img`, a
 * RAMsoft `.hdf`, Klive's own `.cim`, or bytes in memory. A partition is a device too, a window onto
 * its disk.
 */

export const SECTOR_SIZE = 512;

export interface BlockDevice {
  readonly sectorCount: number;
  readSector(lba: number): Uint8Array;
  writeSector(lba: number, data: Uint8Array): void;
}

/** A device over bytes held in memory (tests, small images) */
export class MemoryBlockDevice implements BlockDevice {
  readonly sectorCount: number;
  constructor (readonly bytes: Uint8Array, readonly offset = 0) {
    this.sectorCount = Math.floor((bytes.length - offset) / SECTOR_SIZE);
  }

  readSector (lba: number): Uint8Array {
    checkLba(this, lba);
    const at = this.offset + lba * SECTOR_SIZE;
    return this.bytes.slice(at, at + SECTOR_SIZE);
  }

  writeSector (lba: number, data: Uint8Array): void {
    checkLba(this, lba);
    this.bytes.set(data.subarray(0, SECTOR_SIZE), this.offset + lba * SECTOR_SIZE);
  }
}

/** A window onto a device: a partition */
export class PartitionDevice implements BlockDevice {
  constructor (readonly device: BlockDevice, readonly firstLba: number, readonly sectorCount: number) {}

  readSector (lba: number): Uint8Array {
    checkLba(this, lba);
    return this.device.readSector(this.firstLba + lba);
  }

  writeSector (lba: number, data: Uint8Array): void {
    checkLba(this, lba);
    this.device.writeSector(this.firstLba + lba, data);
  }
}

function checkLba (device: BlockDevice, lba: number): void {
  if (!Number.isInteger(lba) || lba < 0 || lba >= device.sectorCount) {
    throw new RangeError(`Sector ${lba} is outside the device's ${device.sectorCount} sectors`);
  }
}

// -------------------------------------------------------------------------------------------------
// Partitions

/** A partition of an MBR disk, or the whole disk when it has none (a "superfloppy") */
export type DiskPartition = {
  index: number;
  type: number;
  firstLba: number;
  sectorCount: number;
  /** The whole disk, formatted without a partition table */
  whole: boolean;
};

/** Partition types a FAT file system lives in */
export const FAT_PARTITION_TYPES = new Set([0x01, 0x04, 0x06, 0x0b, 0x0c, 0x0e]);

/**
 * The disk's partitions: the MBR's four primary entries, or - when sector 0 is itself a FAT boot
 * sector - the whole disk
 */
export function readPartitions (device: BlockDevice): DiskPartition[] {
  if (device.sectorCount === 0) return [];
  const sector0 = device.readSector(0);
  if (looksLikeBootSector(sector0)) {
    return [{ index: 0, type: 0, firstLba: 0, sectorCount: device.sectorCount, whole: true }];
  }
  if (sector0[510] !== 0x55 || sector0[511] !== 0xaa) return [];
  const partitions: DiskPartition[] = [];
  for (let i = 0; i < 4; i++) {
    const at = 446 + i * 16;
    const type = sector0[at + 4];
    const firstLba = readU32(sector0, at + 8);
    const sectorCount = readU32(sector0, at + 12);
    if (type === 0 || sectorCount === 0 || firstLba >= device.sectorCount) continue;
    partitions.push({ index: i, type, firstLba, sectorCount: Math.min(sectorCount, device.sectorCount - firstLba), whole: false });
  }
  return partitions;
}

/** Is a sector a FAT boot sector (a jump, 512 bytes a sector, a power-of-two cluster size)? */
export function looksLikeBootSector (sector: Uint8Array): boolean {
  const jump = sector[0] === 0xeb || sector[0] === 0xe9;
  const bytesPerSector = sector[11] | (sector[12] << 8);
  const spc = sector[13];
  return jump && bytesPerSector === 512 && spc > 0 && (spc & (spc - 1)) === 0 && sector[16] > 0 && sector[510] === 0x55 && sector[511] === 0xaa;
}

/** The device a partition is */
export function partitionDevice (device: BlockDevice, partition: DiskPartition): BlockDevice {
  return partition.whole ? device : new PartitionDevice(device, partition.firstLba, partition.sectorCount);
}

// -------------------------------------------------------------------------------------------------
// RAMsoft HDF

/**
 * A RAMsoft `.hdf` hard-disk image (the format the Spectrum emulators share for IDE and DivMMC
 * disks): "RS-IDE", $1A, the version, flags (bit 0: only the low byte of each word is stored, a
 * "halved" 8-bit image), the data's offset (2 bytes) and the drive's IDENTIFY block; the sectors
 * follow at that offset.
 */
export type HdfHeader = { version: number; halved: boolean; dataOffset: number };

export function readHdfHeader (bytes: Uint8Array): HdfHeader | undefined {
  const signature = "RS-IDE";
  for (let i = 0; i < signature.length; i++) if (bytes[i] !== signature.charCodeAt(i)) return undefined;
  if (bytes[6] !== 0x1a) return undefined;
  return { version: bytes[7], halved: (bytes[8] & 0x01) !== 0, dataOffset: bytes[9] | (bytes[10] << 8) };
}

/** A minimal `.hdf` header (version 1.1) for an image of `sectorCount` 512-byte sectors */
export function createHdfHeader (sectorCount: number): Uint8Array {
  const dataOffset = 0x216;
  const header = new Uint8Array(dataOffset);
  header.set(Array.from("RS-IDE", (c) => c.charCodeAt(0)), 0);
  header[6] = 0x1a;
  header[7] = 0x11;
  header[8] = 0x00;
  header[9] = dataOffset & 0xff;
  header[10] = dataOffset >> 8;
  // --- The IDENTIFY block from offset 0x16: a geometry that covers the sectors (16 heads, 63 sectors)
  const identify = 0x16;
  const cylinders = Math.min(65535, Math.ceil(sectorCount / (16 * 63)));
  const word = (index: number, value: number) => {
    header[identify + index * 2] = value & 0xff;
    header[identify + index * 2 + 1] = (value >> 8) & 0xff;
  };
  word(1, cylinders);
  word(3, 16);
  word(6, 63);
  word(49, 0x0200);
  word(60, sectorCount & 0xffff);
  word(61, (sectorCount >>> 16) & 0xffff);
  return header;
}

export function readU32 (bytes: Uint8Array, at: number): number {
  return (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;
}

export function writeU32 (bytes: Uint8Array, at: number, value: number): void {
  bytes[at] = value & 0xff;
  bytes[at + 1] = (value >>> 8) & 0xff;
  bytes[at + 2] = (value >>> 16) & 0xff;
  bytes[at + 3] = (value >>> 24) & 0xff;
}

export function readU16 (bytes: Uint8Array, at: number): number {
  return bytes[at] | (bytes[at + 1] << 8);
}

export function writeU16 (bytes: Uint8Array, at: number, value: number): void {
  bytes[at] = value & 0xff;
  bytes[at + 1] = (value >> 8) & 0xff;
}
