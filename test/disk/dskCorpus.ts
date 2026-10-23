import { buildDisk, sectorRun, type SectorSpec } from "@emu/machines/disk/disk-builder";
import type { DiskInformation } from "@emu/machines/disk/DiskInformation";

/*
 * The DSK test corpus (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, A0 and D9): awkward disks made
 * in code, so no third-party image is needed. Every sector's bytes say where they belong
 * (`pattern`), so a sector read, written or uploaded to the wrong place shows up as wrong bytes.
 */

/** Bytes that identify a sector: cylinder, side, record ID and copy */
export function pattern (c: number, h: number, r: number, length: number, copy = 0): Uint8Array {
  const data = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    data[i] = (c * 7 + h * 101 + r * 13 + copy * 59 + i) & 0xff;
  }
  return data;
}

/** A sector of `128 << n` bytes holding its own pattern */
function patterned (c: number, h: number, r: number, n = 2, extra: Partial<SectorSpec> = {}): SectorSpec {
  return { r, n, data: pattern(c, h, r, 0x80 << n), ...extra };
}

/** Weak-sector copies: `copies` different versions of one sector, back to back */
function weak (c: number, h: number, r: number, n: number, copies: number): Uint8Array {
  const length = 0x80 << n;
  const data = new Uint8Array(length * copies);
  for (let k = 0; k < copies; k++) data.set(pattern(c, h, r, length, k), k * length);
  return data;
}

export type CorpusDisk = { name: string; disk: () => DiskInformation; note: string };

export const DSK_CORPUS: CorpusDisk[] = [
  {
    name: "plus3-format0",
    note: "+3 format 0: 40 tracks, one side, 9 x 512, R = 1..9",
    disk: () =>
      buildDisk({
        cylinders: 40,
        sides: 1,
        track: (c, h) => ({ sectors: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((r) => patterned(c, h, r)) })
      })
  },
  {
    name: "plus3-format0-standard",
    note: "The same in the standard (non-extended) container",
    disk: () =>
      buildDisk({
        extended: false,
        cylinders: 40,
        sides: 1,
        track: (c, h) => ({ sectors: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((r) => patterned(c, h, r)) })
      })
  },
  {
    name: "cpc-data",
    note: "CPC data format: R = $C1..$C9 (keys of track * 100 + R collide)",
    disk: () =>
      buildDisk({
        cylinders: 40,
        sides: 1,
        track: (c, h) => ({ sectors: sectorRun(0xc1, 9).map((s) => patterned(c, h, s.r)) })
      })
  },
  {
    name: "cpc-system",
    note: "CPC system format: R = $41..$49",
    disk: () =>
      buildDisk({
        cylinders: 40,
        sides: 1,
        track: (c, h) => ({ sectors: sectorRun(0x41, 9).map((s) => patterned(c, h, s.r)) })
      })
  },
  {
    name: "ds80",
    note: "80 tracks, two sides (a 720K drive B disk)",
    disk: () =>
      buildDisk({
        cylinders: 80,
        sides: 2,
        track: (c, h) => ({ sectors: sectorRun(1, 9).map((s) => patterned(c, h, s.r)) })
      })
  },
  {
    name: "interleaved",
    note: "Sectors in a skewed physical order (1, 6, 2, 7, ...)",
    disk: () =>
      buildDisk({
        cylinders: 40,
        sides: 1,
        track: (c, h) => ({ sectors: [1, 6, 2, 7, 3, 8, 4, 9, 5].map((r) => patterned(c, h, r)) })
      })
  },
  {
    name: "mixed-sizes",
    note: "Track 1 mixes 256, 512, 1024 and 128-byte sectors; the rest are format 0",
    disk: () =>
      buildDisk({
        cylinders: 40,
        sides: 1,
        track: (c, h) =>
          c === 1
            ? {
                n: 2,
                sectors: [patterned(c, h, 1, 1), patterned(c, h, 2, 2), patterned(c, h, 3, 3), patterned(c, h, 4, 0)]
              }
            : { sectors: sectorRun(1, 9).map((s) => patterned(c, h, s.r)) }
      })
  },
  {
    name: "big-sector",
    note: "Track 2 holds one 6K sector (N = 6, stored as $1800 bytes) in the standard container",
    disk: () =>
      buildDisk({
        extended: false,
        cylinders: 3,
        sides: 1,
        track: (c, h) =>
          c === 2
            ? { n: 6, sectors: [{ r: 1, n: 6, data: pattern(c, h, 1, 0x1800) }] }
            : { n: 6, sectors: [{ r: 1, n: 6, data: pattern(c, h, 1, 0x1800) }] }
      })
  },
  {
    name: "short-sector",
    note: "A 512-byte sector that stores only 256 bytes (an incomplete read when dumped)",
    disk: () =>
      buildDisk({
        cylinders: 40,
        sides: 1,
        track: (c, h) => ({
          sectors: sectorRun(1, 9).map((s) =>
            c === 3 && s.r === 5 ? { r: 5, n: 2, data: pattern(c, h, 5, 256) } : patterned(c, h, s.r)
          )
        })
      })
  },
  {
    name: "weak-sectors",
    note: "Track 4 sector 2 stores 2 copies, sector 3 stores 3 copies",
    disk: () =>
      buildDisk({
        cylinders: 40,
        sides: 1,
        track: (c, h) => ({
          sectors: sectorRun(1, 9).map((s) =>
            c === 4 && (s.r === 2 || s.r === 3)
              ? { r: s.r, n: 2, data: weak(c, h, s.r, 2, s.r === 2 ? 2 : 3), st1: 0x20, st2: 0x20 }
              : patterned(c, h, s.r)
          )
        })
      })
  },
  {
    name: "duplicate-ids",
    note: "Track 5 has two sectors with R = 3 (a protection trick)",
    disk: () =>
      buildDisk({
        cylinders: 40,
        sides: 1,
        track: (c, h) =>
          c === 5
            ? { sectors: [1, 2, 3, 3, 4].map((r, i) => ({ r, n: 2, data: pattern(c, h, r, 512, i === 3 ? 1 : 0) })) }
            : { sectors: sectorRun(1, 9).map((s) => patterned(c, h, s.r)) }
      })
  },
  {
    name: "status-bytes",
    note: "Track 6: a deleted-data sector (ST2 bit 6) and a data CRC error (ST1 bit 5, ST2 bit 5)",
    disk: () =>
      buildDisk({
        cylinders: 40,
        sides: 1,
        track: (c, h) => ({
          sectors: sectorRun(1, 9).map((s) =>
            c !== 6
              ? patterned(c, h, s.r)
              : s.r === 4
                ? patterned(c, h, 4, 2, { st2: 0x40 })
                : s.r === 7
                  ? patterned(c, h, 7, 2, { st1: 0x20, st2: 0x20 })
                  : patterned(c, h, s.r)
          )
        })
      })
  },
  {
    name: "unformatted-tracks",
    note: "Tracks 38 and 39 unformatted (a 38-track disk in a 40-track image)",
    disk: () =>
      buildDisk({
        cylinders: 40,
        sides: 1,
        track: (c, h) => (c >= 38 ? "unformatted" : { sectors: sectorRun(1, 9).map((s) => patterned(c, h, s.r)) })
      })
  },
  {
    name: "many-sectors",
    note: "Track 0 holds 32 sectors of 128 bytes: the Track-Info runs past 256 bytes",
    disk: () =>
      buildDisk({
        cylinders: 2,
        sides: 1,
        track: (c, h) =>
          c === 0
            ? { n: 0, sectors: sectorRun(1, 32).map((s) => patterned(c, h, s.r, 0)) }
            : { sectors: sectorRun(1, 9).map((s) => patterned(c, h, s.r)) }
      })
  },
  {
    name: "offset-info",
    note: "An EDSK v5 Offset-Info block after the last track",
    disk: () =>
      buildDisk({
        cylinders: 2,
        sides: 1,
        trailer: new TextEncoder().encode("Offset-Info\r\n\u0000\u0001\u0002\u0003"),
        track: (c, h) => ({ sectors: sectorRun(1, 9).map((s) => patterned(c, h, s.r)) })
      })
  },
  {
    name: "foreign-ids",
    note: "Track 7's sectors carry cylinder 9 and head 1 in their IDs (a protection trick)",
    disk: () =>
      buildDisk({
        cylinders: 40,
        sides: 1,
        track: (c, h) => ({
          sectors: sectorRun(1, 9).map((s) => (c === 7 ? patterned(c, h, s.r, 2, { c: 9, h: 1 }) : patterned(c, h, s.r)))
        })
      })
  }
];

export function corpusDisk (name: string): DiskInformation {
  const entry = DSK_CORPUS.find((d) => d.name === name);
  if (!entry) throw new Error(`No corpus disk ${name}`);
  return entry.disk();
}
