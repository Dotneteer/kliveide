import type { DiskPartition } from "./blockDevice";
import type { FatRegions } from "./fat";
import type { DiskFileEntry, DiskFsInfo } from "./types";

/* What the Disk Explorer shows of a hard-disk image (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, C2) */

export type HardDiskKind = "img" | "hdf" | "cim";

/** Is this file a hard-disk image the explorer reads through the main process? */
export function isHardDiskImage (fileName: string): boolean {
  return /\.(img|hdf|cim)$/i.test(fileName);
}

/** What the Disk Explorer shows of a hard-disk image */
export type HardDiskView = {
  kind: HardDiskKind;
  sizeBytes: number;
  partitions: DiskPartition[];
  partition?: number;
  info?: DiskFsInfo;
  regions?: FatRegions;
  /** Clusters in use, 128 buckets */
  clusterUse?: number[];
  files: DiskFileEntry[];
  dir: string;
  fsError?: { code: string; args: Record<string, string | number> };
};

