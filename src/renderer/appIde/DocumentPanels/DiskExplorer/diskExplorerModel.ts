import type { DiskInformation } from "@emu/machines/disk/DiskInformation";
import { readDiskData } from "@emu/machines/disk/disk-readers";
import { DiskImageError } from "@emu/machines/disk/DiskImageError";
import { TRD_SECTOR_SIZE, TRD_SECTORS_PER_TRACK } from "@emu/machines/disk/trd/trdImage";
import { diskImageKind, openDiskFileSystem, type DiskImageKind } from "@common/diskfs/open";
import { TrdosFileSystem } from "@common/diskfs/trdos";
import {
  DiskFsError,
  type DiskFileEntry,
  type DiskFileSystem,
  type DiskFsInfo,
  type DiskSectorRole
} from "@common/diskfs/types";

/*
 * The Disk Explorer's model (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, B4/B5), React-free: an
 * image read into its files (the Files view) and its tracks and sectors with what each holds (the
 * Layout view); its edits are `@common/diskfs/edit`'s.
 */

/** One sector, as the Layout view shows it */
export type ExplorerSector = {
  sectorIndex: number;
  c: number;
  h: number;
  r: number;
  n: number;
  st1: number;
  st2: number;
  /** Stored bytes per copy */
  length: number;
  copies: number;
  role: DiskSectorRole;
  data: Uint8Array;
};

/** One track: a cylinder on one side */
export type ExplorerTrack = {
  trackIndex: number;
  cylinder: number;
  side: number;
  unformatted: boolean;
  sectors: ExplorerSector[];
};

export type DiskExplorerModel = {
  kind: DiskImageKind;
  fileName: string;
  /** The file system's info, when the disk has one Klive reads */
  info?: DiskFsInfo;
  system?: "+3dos" | "trdos" | "fat";
  /** Why the disk's files cannot be shown (an unformatted disk, for example) */
  fsError?: DiskFsError;
  files: DiskFileEntry[];
  deletedFiles: DiskFileEntry[];
  tracks: ExplorerTrack[];
  cylinders: number;
  sides: number;
  /** The DSK model (for the surface view) */
  disk?: DiskInformation;
  /** Notes from reading the image (an `.scl` checksum) */
  warnings: string[];
};

/** Reads an image for the explorer; a DSK container error is the only thing that stops it */
export function analyzeDiskImage (bytes: Uint8Array, fileName: string): DiskExplorerModel {
  const kind = diskImageKind(fileName, bytes);
  let fs: DiskFileSystem | undefined;
  let fsError: DiskFsError | undefined;
  try {
    fs = openDiskFileSystem(bytes, fileName);
  } catch (err) {
    if (err instanceof DiskImageError) throw err;
    fsError = err instanceof DiskFsError ? err : new DiskFsError("unformatted", String((err as Error)?.message ?? err));
  }
  const roles = fs?.layout() ?? new Map<number, DiskSectorRole>();
  const unused: DiskSectorRole = { role: "unused" };
  const model: DiskExplorerModel = {
    kind,
    fileName,
    info: fs?.info(),
    system: fs?.system,
    fsError,
    files: fs?.list() ?? [],
    deletedFiles: fs?.list({ deleted: true }).filter((f) => f.deleted) ?? [],
    tracks: [],
    cylinders: 0,
    sides: 1,
    warnings: fs instanceof TrdosFileSystem ? fs.warnings : []
  };

  if (kind === "dsk") {
    const disk = readDiskData(bytes);
    model.disk = disk;
    model.cylinders = disk.numTracks;
    model.sides = disk.numSides;
    model.tracks = disk.tracks.map((track, t) => ({
      trackIndex: t,
      cylinder: Math.floor(t / disk.numSides),
      side: t % disk.numSides,
      unformatted: track.unformatted,
      sectors: track.sectors.map((s, i) => {
        const copies = Math.max(1, s.copies ?? 1);
        return {
          sectorIndex: i,
          c: s.C,
          h: s.H,
          r: s.R,
          n: s.N,
          st1: s.SR1,
          st2: s.SR2,
          length: s.actualLength / copies,
          copies,
          role: roles.get(t * 256 + i) ?? unused,
          data: s.sectorData
        };
      })
    }));
    return model;
  }

  // --- TR-DOS: 16 sectors of 256 bytes per logical track, numbered 1..16
  const trd = fs instanceof TrdosFileSystem ? fs.image() : bytes;
  const geometry = fs instanceof TrdosFileSystem ? fs.geometry : { cylinders: Math.floor(trd.length / 8192), sides: 2 };
  model.cylinders = geometry.cylinders;
  model.sides = geometry.sides;
  const tracks = geometry.cylinders * geometry.sides;
  for (let t = 0; t < tracks; t++) {
    model.tracks.push({
      trackIndex: t,
      cylinder: Math.floor(t / geometry.sides),
      side: t % geometry.sides,
      unformatted: false,
      sectors: Array.from({ length: TRD_SECTORS_PER_TRACK }, (_, i) => {
        const at = (t * TRD_SECTORS_PER_TRACK + i) * TRD_SECTOR_SIZE;
        return {
          sectorIndex: i,
          c: Math.floor(t / geometry.sides),
          h: t % geometry.sides,
          r: i + 1,
          n: 1,
          st1: 0,
          st2: 0,
          length: TRD_SECTOR_SIZE,
          copies: 1,
          role: roles.get(t * 256 + i) ?? unused,
          data: trd.subarray(at, at + TRD_SECTOR_SIZE)
        };
      })
    });
  }
  return model;
}

/** How the explorer previews a file */
export type FilePreviewKind = "basic" | "screen" | "code" | "hex";

export function previewKindOf (file: DiskFileEntry): FilePreviewKind {
  if (file.kind === "basic") return "basic";
  if (file.kind === "code" && file.start === 16384 && file.size === 6912) return "screen";
  if (file.kind === "code") return "code";
  return "hex";
}

/** The fields the explorer shows for a sector's status bytes */
export function sectorFlags (sector: ExplorerSector): ("crc" | "deleted" | "noData" | "weak")[] {
  const flags: ("crc" | "deleted" | "noData" | "weak")[] = [];
  if ((sector.st1 & 0x20) !== 0 || (sector.st2 & 0x20) !== 0) flags.push("crc");
  if ((sector.st2 & 0x40) !== 0) flags.push("deleted");
  if ((sector.st2 & 0x01) !== 0 || (sector.st1 & 0x04) !== 0) flags.push("noData");
  if (sector.copies > 1) flags.push("weak");
  return flags;
}
