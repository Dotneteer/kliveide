import fs from "fs";
import { createHash } from "crypto";

import { SECTOR_SIZE } from "@common/diskfs/blockDevice";
import { FatFileSystem } from "@common/diskfs/fat";
import { DiskFsError } from "@common/diskfs/types";
import { NEXT_ROM_FILES, NEXT_ROM_SETS, type NextRomSetId } from "@common/zxnext/romSets";
import { NEXT_SD_SYSTEM_FILES, type NextSdCardCheck } from "@common/zxnext/nextSdCardCheck";
import { nextProfileOf, romSetOf } from "@emu/machines/zxNext/nextProfiles";
import { CIM_HEADER } from "@main/fat32/CimFileManager";
import { MAX_CLUSTERS } from "@main/fat32/CimHandlers";
import { hardDiskKind, withHardDisk } from "@main/hard-disk-images";

/*
 * The SD card integrity check (`dev/plans/NEXT_SD_CARDS_PLAN.md` D-8): can NextZXOS of a model's ROM set
 * boot this card? Cheap on purpose - the `.cim` header, the partition table, a directory or two and one
 * 32K ROM - so it can run whenever a Next is selected. It never computes the whole card's hash.
 *
 * The card may be the one the running machine uses: a caller that checks it while the machine runs
 * wraps the call in `withSdCardAccess`, so the check never reads between the emulator's sector writes.
 */

/** The `.cim` header's size; the clusters follow it */
const CIM_HEADER_SIZE = 0x1_0000;
/** A `.cim` cluster size is a multiple of 64K */
const CIM_CLUSTER_UNIT = 0x1_0000;
const CIM_CLUSTER_SIZES = new Set([1, 2, 4, 8, 16]);

/**
 * Checks the card a Next model would boot from.
 * @param file The card image (`.cim`, `.img` or `.hdf`)
 * @param modelId The Next model, whose ROM set the card's NextZXOS must be
 */
export function checkNextSdCard(file: string, modelId: string | undefined): NextSdCardCheck {
  let stats: fs.Stats;
  try {
    stats = fs.statSync(file);
  } catch {
    return { status: "missing", file };
  }
  if (!stats.isFile()) return { status: "missing", file };

  // --- 2. The image itself
  try {
    if (hardDiskKind(file) === "cim") {
      const problem = cimHeaderProblem(file, stats.size);
      if (problem) return { status: "unreadable", file, message: problem };
    } else if (stats.size < SECTOR_SIZE) {
      return { status: "unreadable", file, message: "The image is shorter than one sector." };
    }
  } catch (err) {
    return { status: "unreadable", file, message: messageOf(err) };
  }

  try {
    return withHardDisk(file, (device) => {
      if (device.sectorCount <= 0) return { status: "unreadable", file, message: "The image has no sectors." };

      // --- 3. A volume NextZXOS can mount
      let fat: FatFileSystem;
      try {
        fat = FatFileSystem.open(device);
      } catch (err) {
        if (err instanceof DiskFsError) return { status: "noPartition", file, message: err.message };
        throw err;
      }

      // --- 4. The system files
      const missing = NEXT_SD_SYSTEM_FILES.filter((name) => !hasFile(fat, name));
      if (missing.length) return { status: "noSystemFiles", file, missing: [...missing] };

      // --- 5. The release: the card's alternative ROM is its ROM set's
      const expected = romSetOf(nextProfileOf(modelId)).id;
      const altRom = sha256(fat.read(`machines/next/${NEXT_ROM_FILES.altRom}`));
      if (altRom === NEXT_ROM_SETS[expected].files[NEXT_ROM_FILES.altRom]?.sha256) return { status: "ok", file };
      return { status: "wrongRelease", file, expected, found: romSetWithAltRom(altRom) };
    });
  } catch (err) {
    return { status: "unreadable", file, message: messageOf(err) };
  }
}

/**
 * What is wrong with a `.cim` header, if anything: the signature, the geometry, and every allocated
 * cluster inside the file (a copy cut short leaves clusters past its end)
 */
function cimHeaderProblem(file: string, size: number): string | undefined {
  if (size < CIM_HEADER_SIZE) return "The file is shorter than a CIM header.";
  const header = Buffer.alloc(CIM_HEADER_SIZE);
  const fd = fs.openSync(file, "r");
  try {
    fs.readSync(fd, header, 0, CIM_HEADER_SIZE, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (header.toString("latin1", 0, 4) !== CIM_HEADER) return "The file is not a CIM image.";
  const sectorSize = header[6];
  const clusterSize = header[9];
  const maxSizeMb = header.readUInt16LE(12);
  if (!sectorSize || !CIM_CLUSTER_SIZES.has(clusterSize) || !maxSizeMb) return "The CIM header's geometry is invalid.";

  const clusterBytes = clusterSize * CIM_CLUSTER_UNIT;
  const storedClusters = Math.floor((size - CIM_HEADER_SIZE) / clusterBytes);
  const logicalClusters = Math.min(MAX_CLUSTERS, (maxSizeMb * 1024 * 1024) / clusterBytes);
  for (let i = 0; i < logicalClusters; i++) {
    const pointer = header.readUInt16LE(0x10 + i * 2);
    if (pointer !== 0xffff && pointer >= storedClusters) {
      return `Cluster ${i} points past the end of the file: the image is incomplete.`;
    }
  }
  return undefined;
}

function hasFile(fat: FatFileSystem, name: string): boolean {
  const slash = name.lastIndexOf("/");
  const dir = name.substring(0, slash);
  const leaf = name.substring(slash + 1).toUpperCase();
  try {
    // --- A listed name carries the folder as the volume spells it
    return fat
      .list({ dir })
      .some((entry) => entry.name.substring(entry.name.lastIndexOf("/") + 1).toUpperCase() === leaf && !entry.isDirectory);
  } catch (err) {
    if (err instanceof DiskFsError) return false;
    throw err;
  }
}

/** The ROM set whose alternative ROM has this hash */
function romSetWithAltRom(hash: string): NextRomSetId | undefined {
  return (Object.keys(NEXT_ROM_SETS) as NextRomSetId[]).find(
    (id) => NEXT_ROM_SETS[id].files[NEXT_ROM_FILES.altRom]?.sha256 === hash
  );
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
