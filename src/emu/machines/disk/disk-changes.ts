import type { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";
import type { DiskInformation } from "./DiskInformation";

import { readDiskData } from "./disk-readers";
import { DiskImageError } from "./DiskImageError";
import { TRD_SECTOR_SIZE } from "./trd/trdImage";

/*
 * The write-back contract for disk images (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, D2/A2).
 *
 * A DSK change is keyed by the sector's **physical position**: its track's index in the file
 * (cylinder * sides + side) and its index within that track's sector list, as `dskSectorKey` packs
 * them. Never by the sector's ID: IDs repeat on protected disks, and the CPC formats use IDs of
 * 100 and above, so the old `track * 100 + R` key landed on the wrong sector.
 *
 * When the guest changed the disk's layout (formatted a track, rewrote a data mark), a change set
 * carries the whole new image under `DSK_WHOLE_IMAGE_KEY` instead.
 *
 * A TR-DOS (`.trd`) change is keyed by the file sector (256 bytes each), as the Beta 128 publishes it.
 */

/** The key of a change set's whole new DSK image (the layout changed, so sectors cannot be patched) */
export const DSK_WHOLE_IMAGE_KEY = -1;

/** The SectorChanges key of the sector at `sectorIndex` in the file's track `trackIndex` */
export function dskSectorKey (trackIndex: number, sectorIndex: number): number {
  return trackIndex * 256 + sectorIndex;
}

/** The track index and in-track sector index a DSK SectorChanges key stands for */
export function splitDskSectorKey (key: number): { trackIndex: number; sectorIndex: number } {
  return { trackIndex: Math.floor(key / 256), sectorIndex: key % 256 };
}

/** A byte range of the image file to overwrite */
export type DiskFileWrite = { position: number; data: Uint8Array };

/**
 * Where each changed sector goes in a DSK file.
 *
 * A sector is written in place, at its stored length: the file's layout never changes, so the main
 * process can patch the file without rewriting it. A sector the dump stored short keeps only its
 * stored bytes; a weak sector (several stored copies) gets the new data in every copy, so it reads
 * the same each time from then on, as the real disk would after a write.
 */
export function dskSectorWrites (disk: DiskInformation, changes: SectorChanges): DiskFileWrite[] {
  const writes: DiskFileWrite[] = [];
  for (const [key, data] of changes) {
    if (key === DSK_WHOLE_IMAGE_KEY) continue;
    const { trackIndex, sectorIndex } = splitDskSectorKey(key);
    const sector = disk.tracks[trackIndex]?.sectors[sectorIndex];
    if (!sector) {
      throw new DiskImageError(
        "noSector",
        `The disk image has no sector #${sectorIndex} on track #${trackIndex}.`,
        { track: trackIndex, sector: sectorIndex }
      );
    }
    const copies = Math.max(1, sector.copies ?? 1);
    const copyLength = Math.floor(sector.actualLength / copies);
    const length = Math.min(copyLength, data.length);
    for (let copy = 0; copy < copies; copy++) {
      writes.push({ position: sector.sectorDataPosition + copy * copyLength, data: data.subarray(0, length) });
    }
  }
  return writes;
}

/** Where each changed sector goes in a `.trd` file */
export function trdSectorWrites (changes: SectorChanges): DiskFileWrite[] {
  return [...changes].map(([fileSector, data]) => ({
    position: fileSector * TRD_SECTOR_SIZE,
    data: data.subarray(0, TRD_SECTOR_SIZE)
  }));
}

/** Is this a DSK image (standard or extended)? */
export function isDskImage (contents: Uint8Array): boolean {
  const prefix = String.fromCharCode(...contents.subarray(0, 12));
  return prefix.startsWith("MV - CPC") || prefix === "EXTENDED CPC";
}

/**
 * Applies changed sector data to a disk image held in memory: a DSK by physical sector position,
 * anything else as a `.trd` by file sector (the Beta 128's images).
 * @returns The image after the changes: `contents` itself, patched in place - or, for a whole new
 * image of another size, that image (an array cannot change its length)
 */
export function applySectorChangesToDiskContents (contents: Uint8Array, changes: SectorChanges): Uint8Array {
  const whole = changes.get(DSK_WHOLE_IMAGE_KEY);
  if (whole) {
    if (whole.length !== contents.length) return whole;
    if (whole !== contents) contents.set(whole);
    return contents;
  }
  const writes = isDskImage(contents) ? dskSectorWrites(readDiskData(contents), changes) : trdSectorWrites(changes);
  for (const { position, data } of writes) {
    if (position + data.length > contents.length) {
      throw new DiskImageError(
        "truncated",
        `A changed sector at byte ${position} lies beyond the disk image's ${contents.length} bytes.`,
        { needed: position + data.length, length: contents.length }
      );
    }
    contents.set(data, position);
  }
  return contents;
}
