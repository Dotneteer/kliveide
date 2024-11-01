import {
  EXTENDED_BOOT_SIGNATURE,
  Fat32BootSector,
  Fat32FSInfo,
  FS_DIR_SIZE,
  FSINFO_LEAD_SIGNATURE,
  FSINFO_STRUCT_SIGNATURE,
  FSINFO_TRAIL_SIGNATURE
} from "@abstractions/Fat32Types";
import { BinaryReader } from "@common/utils/BinaryReader";
import { BinaryWriter } from "@common/utils/BinaryWriter";
import { CimFile } from "@main/fat32/CimFileManager";

/**
 * This class represents a FAT32 file system.
 */
export class Fat32Fs {
  private _bootSectorContent: Fat32BootSector;
  private _firstDataSector: number;
  private _isValidFat32Size: boolean;

  /**
   * Initializes a new instance of the `Fat32Fs` class.
   * @param cimFile The CIM file to manage
   */
  constructor(
    public readonly cimFile: CimFile,
    public readonly volName?: string
  ) {}

  get bootSectorContent(): Fat32BootSector {
    return this._bootSectorContent;
  }

  get firstDataSector(): number {
    return this._firstDataSector;
  }

  get isValidFat32Size(): boolean {
    return this._isValidFat32Size;
  }

  /**
   * Initializes the FAT32 file system
   */
  init(): void {
    const cimInfo = this.cimFile.cimInfo;
    const secPerClus =
      cimInfo.maxSize < 1024 ? 1 : cimInfo.maxSize < 2048 ? 4 : cimInfo.maxSize < 8192 ? 8 : 16;
    const totSec32 = Math.floor((cimInfo.maxSize * 2048) / cimInfo.sectorSize);
    const totalClusters = totSec32 / secPerClus;
    const fatSize = totalClusters * 4;
    const fat32Size = Math.ceil(fatSize / 512);
    const bs = (this._bootSectorContent = {
      BS_JmpBoot: 0xeb5890,
      BS_OEMName: "KLIVEIDE",
      BPB_BytsPerSec: 512,
      BPB_SecPerClus: secPerClus,
      BPB_ResvdSecCnt: FS_DIR_SIZE,
      BPB_NumFATs: 2,
      BPB_RootEntCnt: 0,
      BPB_TotSec16: 0,
      BPB_Media: 0xf8,
      BPB_FATSz16: 0,
      BPB_SecPerTrk: 63,
      BPB_NumHeads: 255,
      BPB_HiddSec: 0,
      BPB_TotSec32: totSec32,
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
      BS_VolLab: (this.volName ?? "NO NAME").substring(0, 11),
      BS_FileSysType: "FAT32   ",
      BootCode: new Uint8Array(420),
      BootSectorSignature: 0xaa55
    });

    // --- Calculate a few attributes
    this._isValidFat32Size = this.checkValidFat32Size(bs);
    this._firstDataSector = bs.BPB_ResvdSecCnt + bs.BPB_NumFATs * bs.BPB_FATSz32;

    // --- Create the boot sector
    const writer = new BinaryWriter();
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
    this.cimFile.writeSector(0, writer.buffer);
    this.cimFile.writeSector(6, writer.buffer);

    // --- Create the FS Information Sector
    const fsInfo: Fat32FSInfo = {
      FSI_LeadSig: FSINFO_LEAD_SIGNATURE,
      FSI_Reserved1: new Uint8Array(480),
      FSI_StrucSig: FSINFO_STRUCT_SIGNATURE,
      FSI_Free_Count: 0xffffffff,
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
    this.cimFile.writeSector(1, writer.buffer);
    this.cimFile.writeSector(7, writer.buffer);
  }

  readBootSector(): Fat32BootSector {
    const data = this.cimFile.readSector(0);
    const reader = new BinaryReader(data);
    const bs = (this._bootSectorContent = {
      BS_JmpBoot: (reader.readByte() << 16) + (reader.readByte() << 8) + reader.readByte(),
      BS_OEMName: reader.readString(8),
      BPB_BytsPerSec: reader.readUint16(),
      BPB_SecPerClus: reader.readByte(),
      BPB_ResvdSecCnt: reader.readUint16(),
      BPB_NumFATs: reader.readByte(),
      BPB_RootEntCnt: reader.readUint16(),
      BPB_TotSec16: reader.readUint16(),
      BPB_Media: reader.readByte(),
      BPB_FATSz16: reader.readUint16(),
      BPB_SecPerTrk: reader.readUint16(),
      BPB_NumHeads: reader.readUint16(),
      BPB_HiddSec: reader.readUint32(),
      BPB_TotSec32: reader.readUint32(),
      BPB_FATSz32: reader.readUint32(),
      BPB_ExtFlags: reader.readUint16(),
      BPB_FSVer: reader.readUint16(),
      BPB_RootClus: reader.readUint32(),
      BPB_FSInfo: reader.readUint16(),
      BPB_BkBootSec: reader.readUint16(),
      BPB_Reserved: Uint8Array.from(reader.readBytes(12)),
      BS_DrvNum: reader.readByte(),
      BS_Reserved1: reader.readByte(),
      BS_BootSig: reader.readByte(),
      BS_VolID: reader.readUint32(),
      BS_VolLab: reader.readString(11),
      BS_FileSysType: reader.readString(8),
      BootCode: Uint8Array.from(reader.readBytes(420)),
      BootSectorSignature: reader.readUint16()
    });
    this._isValidFat32Size = this.checkValidFat32Size(bs);
    return bs;
  }

  readFSInfoSector(): Fat32FSInfo {
    const data = this.cimFile.readSector(1);
    const reader = new BinaryReader(data);
    return {
      FSI_LeadSig: reader.readUint32(),
      FSI_Reserved1: Uint8Array.from(reader.readBytes(480)),
      FSI_StrucSig: reader.readUint32(),
      FSI_Free_Count: reader.readUint32(),
      FSI_Nxt_Free: reader.readUint32(),
      FSI_Reserved2: Uint8Array.from(reader.readBytes(12)),
      FSI_TrailSig: reader.readUint32()
    };
  }

  private checkValidFat32Size(bs: any): boolean {
    const dataSec = bs.BPB_TotSec32 - (bs.BPB_ResvdSecCnt + bs.BPB_NumFATs * bs.BPB_FATSz32);
    const countOfClusters = Math.floor(dataSec / bs.BPB_SecPerClus);
    return countOfClusters >= 65525;
  }

  firstSectorOfCluster(cluster: number): number {
    return (cluster - 2) * this._bootSectorContent.BPB_SecPerClus + this._firstDataSector;
  }
}

