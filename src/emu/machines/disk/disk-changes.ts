import type { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";

import { readDiskData } from "./disk-readers";

/**
 * Applies changed sector data to a CPC DSK image held in memory.
 */
export function applySectorChangesToDiskContents(
  contents: Uint8Array,
  changes: SectorChanges
): void {
  const diskInfo = readDiskData(contents);

  for (const [change, data] of changes) {
    const trackIndex = Math.floor(change / 100);
    const sectorIndex = change % 100;
    const track = diskInfo.tracks[trackIndex];
    if (!track) {
      throw Error(`Track #${trackIndex} cannot be found`);
    }

    const sector = track.sectors.find((s) => s.R === sectorIndex);
    if (!sector) {
      throw Error(`Sector with index #${sectorIndex} cannot be found on track #${trackIndex}`);
    }

    if (sector.sectorDataPosition + data.length > contents.length) {
      throw Error(
        `Sector #${sectorIndex} on track #${trackIndex} exceeds the disk image bounds`
      );
    }

    contents.set(data, sector.sectorDataPosition);
  }
}
