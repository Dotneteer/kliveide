import type { BlockDevice } from "./blockDevice";
import { FatFileSystem } from "./fat";
import { IDEDOS_PARTITION_BASE, openIdedosPartition } from "./idedos";
import type { DiskFileSystem } from "./types";

/*
 * The file system of a hard-disk image's partition (.plans/FILE_MANAGER_PLAN.md, Phase 9): a FAT
 * partition by its MBR index, or an IDEDOS +3DOS partition by `IDEDOS_PARTITION_BASE` + its table
 * index, so the two kinds never share a number on one image.
 */
export function openHardDiskFs (device: BlockDevice, partition?: number): DiskFileSystem {
  if (partition !== undefined && partition >= IDEDOS_PARTITION_BASE) {
    return openIdedosPartition(device, partition - IDEDOS_PARTITION_BASE);
  }
  return FatFileSystem.open(device, partition);
}
