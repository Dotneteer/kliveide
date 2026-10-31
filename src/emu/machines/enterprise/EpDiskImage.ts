/*
 * Enterprise floppy images for the EXDOS card (`.plans/ENTERPRISE_PLAN.md` §10): a raw `.img`/`.dsk` -
 * the sectors in order, cylinder by cylinder, side 0 then side 1 - of an MS-DOS format (FAT12) disk,
 * which EXDOS uses. The geometry comes from the boot sector: 512-byte sectors, nine a track, one or
 * two sides, and the total sector count (720K: 80 x 2; 360K: 40 x 2 or 80 x 1; 180K: 40 x 1).
 *
 * The card's controller holds a disk in one layout for every disk, nine sectors a track
 * (`ep-exdos.c`'s WD1793_SECTORS), so 8- and 10-sector disks are refused; a single-sided image is
 * spread over side 0.
 */

export const EP_DISK_SECTOR_SIZE = 512;
export const EP_DISK_SECTORS = 9;
/** The drive's cylinders (`ep-exdos.c`'s WD1793_MAX_CYLINDERS) */
export const EP_DISK_MAX_CYLINDERS = 82;

export type EpDiskGeometry = { cylinders: number; sides: number };

/** Why an image cannot go in an EXDOS drive */
export type EpDiskError = "empty" | "notFat" | "sectorSize" | "sectorsPerTrack" | "size";

/**
 * The geometry of a raw image, read from its boot sector
 * @returns the geometry, or why the image is not an EXDOS disk
 */
export function epDiskGeometryOf(bytes: Uint8Array): EpDiskGeometry | { error: EpDiskError } {
  if (bytes.length < EP_DISK_SECTOR_SIZE) return { error: "empty" };
  const word = (offset: number) => bytes[offset] | (bytes[offset + 1] << 8);
  const bytesPerSector = word(0x0b);
  const sectorsPerTrack = word(0x18);
  const heads = word(0x1a);
  const totalSectors = word(0x13);
  // --- A boot sector: a jump (EBh or E9h), or at least a FAT media byte (F0h, F8h-FFh)
  const media = bytes[0x15];
  const looksFat = bytes[0] === 0xeb || bytes[0] === 0xe9 || media === 0xf0 || media >= 0xf8;
  if (!looksFat || (heads !== 1 && heads !== 2) || totalSectors === 0) return { error: "notFat" };
  if (bytesPerSector !== EP_DISK_SECTOR_SIZE) return { error: "sectorSize" };
  if (sectorsPerTrack !== EP_DISK_SECTORS) return { error: "sectorsPerTrack" };
  const cylinders = totalSectors / (EP_DISK_SECTORS * heads);
  if (!Number.isInteger(cylinders) || cylinders > EP_DISK_MAX_CYLINDERS) return { error: "size" };
  if (bytes.length < totalSectors * EP_DISK_SECTOR_SIZE) return { error: "size" };
  return { cylinders, sides: heads };
}

/** The canonical (two-sided) sector index of a file sector */
function canonicalIndex(fileSector: number, sides: number): number {
  const track = Math.floor(fileSector / EP_DISK_SECTORS);
  const sector = fileSector % EP_DISK_SECTORS;
  const cylinder = sides === 2 ? track >> 1 : track;
  const side = sides === 2 ? track & 1 : 0;
  return (cylinder * 2 + side) * EP_DISK_SECTORS + sector;
}

/** The image's sectors at their places in the controller's layout */
export function epDiskToCanonical(bytes: Uint8Array, geometry: EpDiskGeometry, capacity: number): Uint8Array {
  const canonical = new Uint8Array(capacity);
  const count = geometry.cylinders * geometry.sides * EP_DISK_SECTORS;
  for (let i = 0; i < count; i++) {
    const at = canonicalIndex(i, geometry.sides) * EP_DISK_SECTOR_SIZE;
    canonical.set(bytes.subarray(i * EP_DISK_SECTOR_SIZE, (i + 1) * EP_DISK_SECTOR_SIZE), at);
  }
  return canonical;
}

/** The raw image of a disk in the controller's layout */
export function epCanonicalToDisk(canonical: Uint8Array, geometry: EpDiskGeometry): Uint8Array {
  const count = geometry.cylinders * geometry.sides * EP_DISK_SECTORS;
  const image = new Uint8Array(count * EP_DISK_SECTOR_SIZE);
  for (let i = 0; i < count; i++) {
    const at = canonicalIndex(i, geometry.sides) * EP_DISK_SECTOR_SIZE;
    image.set(canonical.subarray(at, at + EP_DISK_SECTOR_SIZE), i * EP_DISK_SECTOR_SIZE);
  }
  return image;
}
