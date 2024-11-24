import {
  BYTES_PER_SECTOR,
  EXTENDED_BOOT_SIGNATURE,
  FS_DIR_SIZE,
  FSINFO_LEAD_SIGNATURE,
  FSINFO_STRUCT_SIGNATURE,
  FSINFO_TRAIL_SIGNATURE,
  JUMP_CODE,
  SIGNATURE
} from "@abstractions/Fat32Types";
import { CimFile } from "@main/fat32/CimFileManager";
import { FatMasterBootRecord } from "./FatMasterBootRecord";
import { FatPartitionEntry } from "./FatPartitionEntry";
import { FatBootSector } from "./FatBootSector";
import { FatFsInfo } from "./FatFsInfo";

export class Fat32Formatter {
  constructor(public readonly file: CimFile) {}

  makeFat32(volumeName = "NO NAME"): void {
    // --- Use the specified file
    const cimInfo = this.file.cimInfo;

    // --- Calculate some initial values
    const sectorCount = Math.floor((cimInfo.maxSize * 1024 * 1024) / BYTES_PER_SECTOR);
    const sectorsPerCluster =
      cimInfo.maxSize < 1024 ? 1 : cimInfo.maxSize < 2048 ? 4 : cimInfo.maxSize < 8192 ? 8 : 16;
    const totalClusters = sectorCount / sectorsPerCluster;
    const fat32Size = Math.ceil((totalClusters * 4) / 512);

    const BU32 = 8192;
    const relativeSectors = BU32;
    let nc = 0;
    let dataStart: number;
    let fatSize = 0;
    for (dataStart = 2 * BU32; ; dataStart += BU32) {
      nc = (sectorCount - dataStart) / sectorsPerCluster;
      fatSize = Math.floor((nc + 2 + BYTES_PER_SECTOR / 4 - 1) / (BYTES_PER_SECTOR / 4));
      if (dataStart >= relativeSectors + 9 + 2 * fatSize) {
        break;
      }
    }

    // --- Error if too few clusters in FAT32 volume
    if (nc < 65525) {
      throw new Error("Invalid cluster count");
    }

    const reservedSectorCount = dataStart - relativeSectors - 2 * fatSize;
    const fatStart = relativeSectors + reservedSectorCount;
    const totalSectors = nc * sectorsPerCluster + dataStart - relativeSectors;
    let partType = 0x0c;
    if (relativeSectors + totalSectors <= 16450560) {
      // --- FAT32 with CHS and LBA
      partType = 0x0b;
    }

    // --- Create the MBR
    const beginChs = this.lbaToMbrChs(relativeSectors);
    const endChs = this.lbaToMbrChs(relativeSectors + totalSectors - 1);

    // --- Write the MBR information
    const mbr = new FatMasterBootRecord(new Uint8Array(512));
    const part1 = new FatPartitionEntry(new Uint8Array(16));
    part1.bootIndicator = 0x00;
    part1.beginChs = beginChs;
    part1.partType = partType;
    part1.endChs = endChs;
    part1.relativeSectors = relativeSectors;
    part1.totalSectors = totalSectors;
    mbr.partition1 = part1;
    mbr.bootSignature = SIGNATURE;
    this.file.writeSector(0, mbr.buffer);

    // --- Write the boot sector
    const bs = new FatBootSector(new Uint8Array(BYTES_PER_SECTOR));
    bs.BS_JmpBoot = JUMP_CODE;
    bs.BS_OEMName = "KLIVEIDE";
    bs.BPB_BytsPerSec = BYTES_PER_SECTOR;
    bs.BPB_SecPerClus = sectorsPerCluster;
    bs.BPB_ResvdSecCnt = FS_DIR_SIZE;
    bs.BPB_NumFATs = 2;
    bs.BPB_RootEntCnt = 0;
    bs.BPB_TotSec16 = 0;
    bs.BPB_Media = 0xf8;
    bs.BPB_FATSz16 = 0;
    bs.BPB_SecPerTrk = 63;
    bs.BPB_NumHeads = 255;
    bs.BPB_HiddSec = 0;
    bs.BPB_TotSec32 = sectorCount;
    bs.BPB_FATSz32 = fat32Size;
    bs.BPB_ExtFlags = 0;
    bs.BPB_FSVer = 0;
    bs.BPB_RootClus = 2;
    bs.BPB_FSInfo = 1;
    bs.BPB_BkBootSec = 6;
    bs.BPB_Reserved = new Uint8Array(12);
    bs.BS_DrvNum = 0x80;
    bs.BS_Reserved1 = 0;
    bs.BS_BootSig = EXTENDED_BOOT_SIGNATURE;
    bs.BS_VolID = new Date().valueOf() & 0xffffffff;
    bs.BS_VolLab = volumeName.substring(0, 11).padEnd(11, " ");
    bs.BS_FileSysType = "FAT32".substring(0,8).padEnd(8, " ");
    bs.BootCode = new Uint8Array(420);
    bs.BootSectorSignature = SIGNATURE;

    // --- Calculate a few attributes
    if (!this.checkValidFat32Size(bs)) {
      throw new Error("The FAT32 size is too small.");
    }

    this.file.writeSector(relativeSectors, bs.buffer);
    this.file.writeSector(relativeSectors + 6, bs.buffer);

    // --- Write extra boot area and backup
    const extraBoot = new Uint8Array(BYTES_PER_SECTOR);
    const extraDv = new DataView(extraBoot.buffer);
    extraDv.setUint32(508, FSINFO_TRAIL_SIGNATURE);
    this.file.writeSector(relativeSectors + 2, extraBoot);
    this.file.writeSector(relativeSectors + 8, extraBoot);

    // --- Calculate the number of free clusters
    const dataSectors = sectorCount - (FS_DIR_SIZE + 2 * fat32Size);
    const totalDataClusters = Math.floor(dataSectors / sectorsPerCluster);
    const freeClusters = totalDataClusters - 2;

    // --- Create the FS Information Sector
    const fsInfo = new FatFsInfo(new Uint8Array(BYTES_PER_SECTOR));
    fsInfo.FSI_LeadSig = FSINFO_LEAD_SIGNATURE;
    fsInfo.FSI_Reserved1 = new Uint8Array(480);
    fsInfo.FSI_StrucSig = FSINFO_STRUCT_SIGNATURE;
    fsInfo.FSI_Free_Count = freeClusters;
    fsInfo.FSI_Nxt_Free = 0xffffffff;
    fsInfo.FSI_Reserved2 = new Uint8Array(12);
    fsInfo.FSI_TrailSig = FSINFO_TRAIL_SIGNATURE;

    // --- Write the FS Information Sector
    this.file.writeSector(relativeSectors + 1, fsInfo.buffer);
    this.file.writeSector(relativeSectors + 7, fsInfo.buffer);

    // --- Initialize the FAT
    const fatSector = new Uint8Array(BYTES_PER_SECTOR);
    fatSector[0] = 0xf8;
    for (let i = 1; i < 12; i++) {
      fatSector[i] = 0xff;
    }
    this.file.writeSector(fatStart + 0, fatSector);
    this.file.writeSector(fatStart + fatSize, fatSector);
  }

  private checkValidFat32Size(bs: FatBootSector): boolean {
    const dataSec = bs.BPB_TotSec32 - (bs.BPB_ResvdSecCnt + bs.BPB_NumFATs * bs.BPB_FATSz32);
    const countOfClusters = Math.floor(dataSec / bs.BPB_SecPerClus);
    return countOfClusters >= 65525;
  }

  private lbaToMbrChs(lba: number): [number, number, number] {
    let numberOfHeads = 0;
    const capacityMB = this.file.cimInfo.maxSize;
    let sectorsPerTrack = capacityMB <= 256 ? 32 : 63;
    if (capacityMB <= 16) {
      numberOfHeads = 2;
    } else if (capacityMB <= 32) {
      numberOfHeads = 4;
    } else if (capacityMB <= 128) {
      numberOfHeads = 8;
    } else if (capacityMB <= 504) {
      numberOfHeads = 16;
    } else if (capacityMB <= 1008) {
      numberOfHeads = 32;
    } else if (capacityMB <= 2016) {
      numberOfHeads = 64;
    } else if (capacityMB <= 4032) {
      numberOfHeads = 128;
    } else {
      numberOfHeads = 255;
    }
    let c = Math.floor(lba / (numberOfHeads * sectorsPerTrack));
    let h = 0;
    let s = 0;
    if (c <= 1023) {
      h = lba % Math.floor((numberOfHeads * sectorsPerTrack) / sectorsPerTrack);
      s = (lba % sectorsPerTrack) + 1;
    } else {
      c = 1023;
      h = 254;
      s = 63;
    }
    return [h & 0xff, (((c >> 2) & 0xc0) | s) & 0xff, c & 0xff];
  }
}
