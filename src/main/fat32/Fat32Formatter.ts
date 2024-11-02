import {
  BYTES_PER_SECTOR,
  EXTENDED_BOOT_SIGNATURE,
  Fat32BootSector,
  Fat32FSInfo,
  FS_DIR_SIZE,
  FSINFO_LEAD_SIGNATURE,
  FSINFO_STRUCT_SIGNATURE,
  FSINFO_TRAIL_SIGNATURE,
  SIGNATURE
} from "@abstractions/Fat32Types";
import { BinaryWriter } from "@common/utils/BinaryWriter";
import { CimFile } from "@main/fat32/CimFileManager";

export class Fat32Formatter {
  constructor(public readonly file: CimFile) {}

  makeFat32(volumeName = "NO NAME"): void {
    // --- Use the specified file
    const cimInfo = this.file.cimInfo;

    // --- Use this writer for sectors
    const writer = new BinaryWriter();

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
    writer.reset();
    writer.writeBytes(new Uint8Array(446));
    writer.writeByte(0x00); // --- Boot indicator (partition 0)
    writer.writeBytes(new Uint8Array(Buffer.from(beginChs))); // --- Begin CHS (partition 0)
    writer.writeByte(partType); // --- Partition type (FAT32)
    writer.writeBytes(new Uint8Array(Buffer.from(endChs))); // --- End CHS (partition 0)
    writer.writeUint32(relativeSectors); // --- Relative sectors (partition 0)
    writer.writeUint32(totalSectors); // --- Total sectors (partition 0)
    writer.writeBytes(new Uint8Array(16)); // --- Partition 1
    writer.writeBytes(new Uint8Array(16)); // --- Partition 2
    writer.writeBytes(new Uint8Array(16)); // --- Partition 3
    writer.writeUint16(SIGNATURE); // --- Boot sector signature
    this.file.writeSector(0, writer.buffer);

    const bs: Fat32BootSector = {
      BS_JmpBoot: 0x9058eb,
      BS_OEMName: "KLIVEIDE",
      BPB_BytsPerSec: 512,
      BPB_SecPerClus: sectorsPerCluster,
      BPB_ResvdSecCnt: FS_DIR_SIZE,
      BPB_NumFATs: 2,
      BPB_RootEntCnt: 0,
      BPB_TotSec16: 0,
      BPB_Media: 0xf8,
      BPB_FATSz16: 0,
      BPB_SecPerTrk: 63,
      BPB_NumHeads: 255,
      BPB_HiddSec: 0,
      BPB_TotSec32: sectorCount,
      BPB_FATSz32: fat32Size,
      BPB_ExtFlags: 0,
      BPB_FSVer: 0,
      BPB_RootClus: 2,
      BPB_FSInfo: 1,
      BPB_BkBootSec: 6,
      BPB_Reserved: new Uint8Array(12),
      BS_DrvNum: 0x80,
      BS_Reserved1: 0,
      BS_BootSig: EXTENDED_BOOT_SIGNATURE,
      BS_VolID: new Date().valueOf() & 0xffffffff,
      BS_VolLab: volumeName.substring(0, 110).padEnd(11, " "),
      BS_FileSysType: "FAT32   ",
      BootCode: new Uint8Array(420),
      BootSectorSignature: 0xaa55
    };

    // --- Calculate a few attributes
    if (!this.checkValidFat32Size(bs)) {
      throw new Error("The FAT32 size is too small.");
    }

    // --- Create the boot sector
    writer.reset();
    writer.writeByte(bs.BS_JmpBoot >>> 16);
    writer.writeByte(bs.BS_JmpBoot >>> 8);
    writer.writeByte(bs.BS_JmpBoot);
    writer.writeBytes(new Uint8Array(Buffer.from(bs.BS_OEMName.padEnd(8, " "))));
    writer.writeUint16(bs.BPB_BytsPerSec);
    writer.writeByte(bs.BPB_SecPerClus);
    writer.writeUint16(bs.BPB_ResvdSecCnt);
    writer.writeByte(bs.BPB_NumFATs);
    writer.writeUint16(bs.BPB_RootEntCnt);
    writer.writeUint16(bs.BPB_TotSec16);
    writer.writeByte(bs.BPB_Media);
    writer.writeUint16(bs.BPB_FATSz16);
    writer.writeUint16(bs.BPB_SecPerTrk);
    writer.writeUint16(bs.BPB_NumHeads);
    writer.writeUint32(bs.BPB_HiddSec);
    writer.writeUint32(bs.BPB_TotSec32);
    writer.writeUint32(bs.BPB_FATSz32);
    writer.writeUint16(bs.BPB_ExtFlags);
    writer.writeUint16(bs.BPB_FSVer);
    writer.writeUint32(bs.BPB_RootClus);
    writer.writeUint16(bs.BPB_FSInfo);
    writer.writeUint16(bs.BPB_BkBootSec);
    writer.writeBytes(bs.BPB_Reserved);
    writer.writeByte(bs.BS_DrvNum);
    writer.writeByte(bs.BS_Reserved1);
    writer.writeByte(bs.BS_BootSig);
    writer.writeUint32(bs.BS_VolID);
    writer.writeBytes(new Uint8Array(Buffer.from(bs.BS_VolLab.padEnd(11, " "))));
    writer.writeBytes(new Uint8Array(Buffer.from(bs.BS_FileSysType.padEnd(8, " "))));
    writer.writeBytes(bs.BootCode);
    writer.writeUint16(bs.BootSectorSignature);

    // --- Write the boot sector (and its backup)
    this.file.writeSector(relativeSectors, writer.buffer);
    this.file.writeSector(relativeSectors + 6, writer.buffer);

    // --- Write extra boot area and backup
    writer.reset();
    writer.writeBytes(new Uint8Array(508));
    writer.writeUint32(FSINFO_TRAIL_SIGNATURE);
    this.file.writeSector(relativeSectors + 2, writer.buffer);
    this.file.writeSector(relativeSectors + 8, writer.buffer);

    // --- Calculate the number of free clusters
    const dataSectors = sectorCount - (FS_DIR_SIZE + 2 * fat32Size);
    const totalDataClusters = Math.floor(dataSectors / sectorsPerCluster);
    const freeClusters = totalDataClusters - 2;

    // --- Create the FS Information Sector
    const fsInfo: Fat32FSInfo = {
      FSI_LeadSig: FSINFO_LEAD_SIGNATURE,
      FSI_Reserved1: new Uint8Array(480),
      FSI_StrucSig: FSINFO_STRUCT_SIGNATURE,
      FSI_Free_Count: freeClusters,
      FSI_Nxt_Free: 0xffffffff,
      FSI_Reserved2: new Uint8Array(12),
      FSI_TrailSig: FSINFO_TRAIL_SIGNATURE
    };

    writer.reset();
    writer.writeUint32(fsInfo.FSI_LeadSig);
    writer.writeBytes(fsInfo.FSI_Reserved1);
    writer.writeUint32(fsInfo.FSI_StrucSig);
    writer.writeUint32(fsInfo.FSI_Free_Count);
    writer.writeUint32(fsInfo.FSI_Nxt_Free);
    writer.writeBytes(fsInfo.FSI_Reserved2);
    writer.writeUint32(fsInfo.FSI_TrailSig);

    // --- Write the FS Information Sector
    this.file.writeSector(relativeSectors + 1, writer.buffer);
    this.file.writeSector(relativeSectors + 7, writer.buffer);

    // --- Initialize the FAT
    const fatSector = new Uint8Array(BYTES_PER_SECTOR);
    fatSector[0] = 0xf8;
    for (let i = 1; i < 12; i++) {
      fatSector[i] = 0xff;
    }
    this.file.writeSector(fatStart + 0, fatSector);
    this.file.writeSector(fatStart + fatSize, fatSector);
  }

  private checkValidFat32Size(bs: Fat32BootSector): boolean {
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
    return [h, ((c >> 2) & 0xc0) | s, c];
  }
}
