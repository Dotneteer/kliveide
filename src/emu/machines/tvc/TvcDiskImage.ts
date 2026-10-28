/*
 * Videoton TVC floppy images (`.plans/VIDEOTON_TVC_PLAN.md` §9.4): a raw `.dsk` - the sectors in
 * order, cylinder by cylinder, side 0 then side 1 - of an MS-DOS format disk, which VT-DOS uses. The
 * geometry comes from the FAT12 boot sector: 512-byte sectors, 9 a track, one or two sides, and the
 * total sector count (720K: 80 x 2; the single-sided 360K: 80 x 1). The HBF card's controller holds
 * a disk two-sided, cylinder-major (`tvc-hbf.c`); a single-sided image is spread over side 0.
 */

export const TVC_DISK_SECTOR_SIZE = 512;
export const TVC_DISK_SECTORS = 9;
/** The drive's cylinders (`tvc-hbf.c`'s WD1793_MAX_CYLINDERS) */
export const TVC_DISK_MAX_CYLINDERS = 82;

export type TvcDiskGeometry = { cylinders: number; sides: number };

/** Why an image cannot go in a TVC drive */
export type TvcDiskError = "empty" | "notFat" | "sectorSize" | "sectorsPerTrack" | "size";

/**
 * The geometry of a raw image, read from its boot sector
 * @returns the geometry, or why the image is not a TVC disk
 */
export function tvcDiskGeometryOf(bytes: Uint8Array): TvcDiskGeometry | { error: TvcDiskError } {
  if (bytes.length < TVC_DISK_SECTOR_SIZE) return { error: "empty" };
  const word = (offset: number) => bytes[offset] | (bytes[offset + 1] << 8);
  const bytesPerSector = word(0x0b);
  const sectorsPerTrack = word(0x18);
  const heads = word(0x1a);
  const totalSectors = word(0x13);
  // --- A boot sector: a jump (EBh or E9h) and the boot signature, or at least a FAT media byte
  const jump = bytes[0] === 0xeb || bytes[0] === 0xe9;
  if (!jump || (heads !== 1 && heads !== 2) || totalSectors === 0) return { error: "notFat" };
  if (bytesPerSector !== TVC_DISK_SECTOR_SIZE) return { error: "sectorSize" };
  if (sectorsPerTrack !== TVC_DISK_SECTORS) return { error: "sectorsPerTrack" };
  const cylinders = totalSectors / (TVC_DISK_SECTORS * heads);
  if (!Number.isInteger(cylinders) || cylinders > TVC_DISK_MAX_CYLINDERS) return { error: "size" };
  if (bytes.length < totalSectors * TVC_DISK_SECTOR_SIZE) return { error: "size" };
  return { cylinders, sides: heads };
}

/** The canonical (two-sided) sector index of a file sector */
function canonicalIndex(fileSector: number, sides: number): number {
  const track = Math.floor(fileSector / TVC_DISK_SECTORS);
  const sector = fileSector % TVC_DISK_SECTORS;
  const cylinder = sides === 2 ? track >> 1 : track;
  const side = sides === 2 ? track & 1 : 0;
  return (cylinder * 2 + side) * TVC_DISK_SECTORS + sector;
}

/** The image's sectors at their places in the controller's layout */
export function tvcDiskToCanonical(bytes: Uint8Array, geometry: TvcDiskGeometry, capacity: number): Uint8Array {
  const canonical = new Uint8Array(capacity);
  const count = geometry.cylinders * geometry.sides * TVC_DISK_SECTORS;
  for (let i = 0; i < count; i++) {
    const at = canonicalIndex(i, geometry.sides) * TVC_DISK_SECTOR_SIZE;
    canonical.set(bytes.subarray(i * TVC_DISK_SECTOR_SIZE, (i + 1) * TVC_DISK_SECTOR_SIZE), at);
  }
  return canonical;
}

/** The raw image of a disk in the controller's layout */
export function tvcCanonicalToDisk(canonical: Uint8Array, geometry: TvcDiskGeometry): Uint8Array {
  const count = geometry.cylinders * geometry.sides * TVC_DISK_SECTORS;
  const image = new Uint8Array(count * TVC_DISK_SECTOR_SIZE);
  for (let i = 0; i < count; i++) {
    const at = canonicalIndex(i, geometry.sides) * TVC_DISK_SECTOR_SIZE;
    image.set(canonical.subarray(at, at + TVC_DISK_SECTOR_SIZE), i * TVC_DISK_SECTOR_SIZE);
  }
  return image;
}
