import { buildDisk, sectorRun } from "./disk-builder";
import { writeDiskData } from "./disk-writer";

/*
 * Blank +3DOS disks for the Create Disk dialog and the `crd` command
 * (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, A2).
 *
 * Every type is 9 sectors of 512 bytes per track (IDs 1..9), filled with $E5 - an empty CP/M
 * directory and free data blocks. The single-sided types are exactly what the +3's own FORMAT lays
 * down on drive A (checked by `test/sp128-hw/plus3-disk/write-back.test.ts`): no disk specification,
 * since +3DOS takes an all-$E5 first sector as its own format. The double-sided types carry a +3DOS
 * disk specification in the first 10 bytes of track 0's sector 1, the layout Amstrad's +3 manual
 * gives for it:
 *
 *   0  format (0: +3 single-sided, 3: double-sided)   5  reserved tracks
 *   1  sidedness (0 single, 1 alternate) | $80 for     6  log2(block size) - 7
 *      double-track (80-track) drives                  7  directory blocks
 *   2  tracks per side                                 8  gap length (read/write)
 *   3  sectors per track                               9  gap length (format)
 *   4  log2(sector size) - 7                          10-14 reserved (0), 15 checksum fiddle byte
 *
 * The +3 boots a disk whose sector 1 sums to 3 (mod 256), so the rest of the sector stays $E5 and
 * the fiddle byte keeps the sum away from 3: a blank disk must not look bootable.
 */
export type BlankDskType = "ss" | "ds" | "sse" | "dse" | "dse80";

export const BLANK_DSK_TYPES: BlankDskType[] = ["ss", "ds", "sse", "dse", "dse80"];

type BlankDskGeometry = { extended: boolean; cylinders: number; sides: 1 | 2; spec?: number[] };

const GEOMETRIES: Record<BlankDskType, BlankDskGeometry> = {
  // --- 40 x 1: the +3's own format (173K free)
  ss: { extended: false, cylinders: 40, sides: 1 },
  sse: { extended: true, cylinders: 40, sides: 1 },
  // --- 40 x 2, sides alternating, 1K blocks
  ds: { extended: false, cylinders: 40, sides: 2, spec: [0x03, 0x01, 0x28, 0x09, 0x02, 0x01, 0x03, 0x02, 0x2a, 0x52] },
  dse: { extended: true, cylinders: 40, sides: 2, spec: [0x03, 0x01, 0x28, 0x09, 0x02, 0x01, 0x03, 0x02, 0x2a, 0x52] },
  // --- 80 x 2, sides alternating, 2K blocks, 256 directory entries: the 720K drive B format
  dse80: { extended: true, cylinders: 80, sides: 2, spec: [0x03, 0x81, 0x50, 0x09, 0x02, 0x01, 0x04, 0x04, 0x2a, 0x52] }
};

export function isBlankDskType (type: string): type is BlankDskType {
  return (BLANK_DSK_TYPES as string[]).includes(type);
}

/** A blank, +3DOS-formatted DSK image of the given type */
export function createBlankDsk (type: BlankDskType, creator = "Klive IDE"): Uint8Array {
  const geometry = GEOMETRIES[type];
  return writeDiskData(
    buildDisk({
      extended: geometry.extended,
      cylinders: geometry.cylinders,
      sides: geometry.sides,
      creator,
      track: (cylinder, side) => ({
        sectors: sectorRun(1, 9).map((s) =>
          geometry.spec && cylinder === 0 && side === 0 && s.r === 1 ? { ...s, data: specSector(geometry.spec) } : s
        )
      })
    })
  );
}

// --- Track 0's sector 1: the specification, then $E5
function specSector (spec: number[]): Uint8Array {
  const sector = new Uint8Array(512).fill(0xe5);
  sector.set(spec, 0);
  sector.fill(0x00, 10, 16);
  const sum = sector.reduce((a, b) => (a + b) & 0xff, 0);
  if (sum === 3) sector[15] = 1;
  return sector;
}
