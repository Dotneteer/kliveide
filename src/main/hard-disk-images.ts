import fs from "fs";

import {
  SECTOR_SIZE,
  createHdfHeader,
  readHdfHeader,
  readPartitions,
  partitionDevice,
  FAT_PARTITION_TYPES,
  type BlockDevice,
  type DiskPartition
} from "@common/diskfs/blockDevice";
export type { HardDiskKind, HardDiskView };
import { applyEdit, type DiskEdit } from "@common/diskfs/edit";
import { FatFileSystem, formatFat, type FatType } from "@common/diskfs/fat";
import type { HardDiskKind, HardDiskView } from "@common/diskfs/hardDisk";
import { DiskFsError } from "@common/diskfs/types";
import { CimHandler } from "./fat32/CimHandlers";
import { CimFileManager } from "./fat32/CimFileManager";

/*
 * Hard-disk images in the main process (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, C1/C2): a raw
 * `.img`, a RAMsoft `.hdf` or Klive's `.cim`, opened as a block device and read sector by sector -
 * an SD card image of gigabytes never travels to the renderer whole. The Disk Explorer and the
 * `disk` command ask through MainApi for what they show and send their edits here.
 */

export function hardDiskKind (filePath: string): HardDiskKind {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".cim")) return "cim";
  if (lower.endsWith(".hdf")) return "hdf";
  return "img";
}

/** A device over a file, sectors from `offset`, read and written in place */
export class FileBlockDevice implements BlockDevice {
  readonly sectorCount: number;
  private readonly fd: number;
  readonly readOnly: boolean;

  constructor (readonly filePath: string, readonly offset = 0) {
    let fd: number;
    let readOnly = false;
    try {
      fd = fs.openSync(filePath, "r+");
    } catch {
      fd = fs.openSync(filePath, "r");
      readOnly = true;
    }
    this.fd = fd;
    this.readOnly = readOnly;
    this.sectorCount = Math.floor((fs.fstatSync(fd).size - offset) / SECTOR_SIZE);
  }

  readSector (lba: number): Uint8Array {
    const buffer = new Uint8Array(SECTOR_SIZE);
    fs.readSync(this.fd, buffer, 0, SECTOR_SIZE, this.offset + lba * SECTOR_SIZE);
    return buffer;
  }

  writeSector (lba: number, data: Uint8Array): void {
    if (this.readOnly) throw new DiskFsError("readOnly", `${this.filePath} is read-only.`, { name: this.filePath });
    fs.writeSync(this.fd, data, 0, SECTOR_SIZE, this.offset + lba * SECTOR_SIZE);
  }

  /** Puts what was written on the disk (an emulated card's write is acknowledged only after it) */
  flush (): void {
    if (!this.readOnly) fs.fsyncSync(this.fd);
  }

  close (): void {
    fs.closeSync(this.fd);
  }
}

/** A `.cim` as a device, through the handler the emulator uses */
class CimBlockDevice implements BlockDevice {
  readonly sectorCount: number;
  constructor (private readonly handler: CimHandler) {
    this.sectorCount = (handler.cimInfo.maxSize * 2048) / handler.cimInfo.sectorSize;
  }

  readSector (lba: number): Uint8Array {
    return this.handler.readSector(lba);
  }

  writeSector (lba: number, data: Uint8Array): void {
    this.handler.writeSector(lba, data);
  }

  close (): void {
    this.handler.close();
  }
}

type OpenedDevice = BlockDevice & { close(): void };

/** Opens an image as a block device; close it when done */
export function openHardDiskImage (filePath: string): OpenedDevice {
  const kind = hardDiskKind(filePath);
  if (kind === "cim") return new CimBlockDevice(new CimHandler(filePath));
  if (kind === "hdf") {
    const head = new Uint8Array(0x20);
    const fd = fs.openSync(filePath, "r");
    try {
      fs.readSync(fd, head, 0, head.length, 0);
    } finally {
      fs.closeSync(fd);
    }
    const header = readHdfHeader(head);
    if (!header) throw new DiskFsError("unformatted", `${filePath} is not an HDF image.`, { name: filePath });
    if (header.halved) throw new DiskFsError("unsupported", "Halved (8-bit) HDF images are not supported.", { name: filePath });
    return new FileBlockDevice(filePath, header.dataOffset);
  }
  return new FileBlockDevice(filePath);
}

/** Runs `op` with the image open, and closes it */
export function withHardDisk<T> (filePath: string, op: (device: BlockDevice) => T): T {
  const device = openHardDiskImage(filePath);
  try {
    return op(device);
  } finally {
    device.close();
  }
}

/** The FAT file system of a partition (the first FAT one when none is given) */
function openFat (device: BlockDevice, partition?: number): { fs: FatFileSystem; partitions: DiskPartition[]; chosen: DiskPartition } {
  const partitions = readPartitions(device);
  const chosen =
    partition !== undefined
      ? partitions.find((p) => p.index === partition)
      : partitions.find((p) => p.whole || FAT_PARTITION_TYPES.has(p.type)) ?? partitions[0];
  if (!chosen) throw new DiskFsError("unformatted", "The disk has no partition Klive can read.");
  return { fs: new FatFileSystem(partitionDevice(device, chosen)), partitions, chosen };
}

export function queryHardDisk (filePath: string, options: { partition?: number; dir?: string; deleted?: boolean } = {}): HardDiskView {
  return withHardDisk(filePath, (device) => {
    const view: HardDiskView = {
      kind: hardDiskKind(filePath),
      sizeBytes: device.sectorCount * SECTOR_SIZE,
      partitions: readPartitions(device),
      files: [],
      dir: options.dir ?? ""
    };
    try {
      const { fs: fat, chosen } = openFat(device, options.partition);
      view.partition = chosen.index;
      view.info = fat.info();
      view.regions = fat.regions();
      view.clusterUse = fat.clusterUse(128);
      view.files = fat.list({ dir: options.dir, deleted: options.deleted });
    } catch (err) {
      if (!(err instanceof DiskFsError)) throw err;
      view.fsError = { code: err.code, args: err.args };
    }
    return view;
  });
}

export function readHardDiskFile (filePath: string, name: string, partition?: number): Uint8Array {
  return withHardDisk(filePath, (device) => openFat(device, partition).fs.read(name));
}

/** A file's clusters as sector ranges of the volume (the Layout view) */
export function hardDiskFileClusters (filePath: string, name: string, partition?: number): number[] {
  return withHardDisk(filePath, (device) => openFat(device, partition).fs.fileClusters(name));
}

export function editHardDisk (filePath: string, edit: DiskEdit, partition?: number): void {
  withHardDisk(filePath, (device) => applyEdit(openFat(device, partition).fs, edit));
}

export type NewHardDiskOptions = {
  sizeMb: number;
  fatType: FatType;
  label?: string;
  partitioned?: boolean;
};

/** Creates a formatted image: `.img` (raw), `.hdf` (with its header) or `.cim` (sparse) */
export function createHardDiskImage (filePath: string, options: NewHardDiskOptions): void {
  const kind = hardDiskKind(filePath);
  if (fs.existsSync(filePath)) throw new DiskFsError("exists", `${filePath} already exists.`, { name: filePath });
  const sectors = options.sizeMb * 2048;
  if (kind === "cim") {
    new CimFileManager().createFile(filePath, options.sizeMb).close?.();
  } else {
    const fd = fs.openSync(filePath, "w");
    try {
      if (kind === "hdf") fs.writeSync(fd, createHdfHeader(sectors));
      fs.ftruncateSync(fd, (kind === "hdf" ? 0x216 : 0) + sectors * SECTOR_SIZE);
    } finally {
      fs.closeSync(fd);
    }
  }
  try {
    withHardDisk(filePath, (device) =>
      formatFat(device, { type: options.fatType, label: options.label, partitioned: options.partitioned })
    );
  } catch (err) {
    fs.rmSync(filePath, { force: true });
    throw err;
  }
}

/** Copies a host folder's files (and its folders) into a folder of the image */
export function copyHostFolderToHardDisk (filePath: string, hostFolder: string, targetDir = "", partition?: number): number {
  return withHardDisk(filePath, (device) => {
    const fat = openFat(device, partition).fs;
    let count = 0;
    const copy = (from: string, to: string) => {
      for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;
        const source = `${from}/${entry.name}`;
        const target = to ? `${to}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          fat.mkdir(target);
          copy(source, target);
        } else if (entry.isFile()) {
          const existing = fat.list({ dir: to }).find((f) => f.name.toUpperCase() === target.toUpperCase());
          if (existing) fat.delete(existing.name);
          fat.write({ name: target, kind: "raw", data: new Uint8Array(fs.readFileSync(source)) });
          count++;
        }
      }
    };
    if (targetDir) fat.mkdir(targetDir);
    copy(hostFolder, targetDir);
    return count;
  });
}
