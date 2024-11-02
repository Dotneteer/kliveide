import { describe, it, expect } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { CimFileManager } from "@main/fat32/CimFileManager";
import { EXTENDED_BOOT_SIGNATURE, FSINFO_LEAD_SIGNATURE, FSINFO_STRUCT_SIGNATURE } from "@abstractions/Fat32Types";
import { Fat32Formatter } from "@main/fat32/Fat32Formatter";
import { FatPartition } from "@main/fat32/FatPartition";

const TEST_DIR = "testFat32";
const TEST_FILE = "test.cim";

describe("FatFormatter", () => {
  const sizesInMB = [64, 128, 256, 512, 1024, 2048, 4196, 8192, 16384];

  sizesInMB.forEach((sizeInMB) => {
    it(`makeFat32 works with size ${sizeInMB}`, () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, sizeInMB);

      // --- Act
      const fat32 = new Fat32Formatter(file);
      fat32.makeFat32();

      // --- Assert
      const fatPart = new FatPartition(file);
      fatPart.init(1);

      const mbr = fatPart.readMasterBootRecord();
      expect(mbr.bootCode).toBeInstanceOf(Uint8Array);
      expect(mbr.bootCode.length).toBe(446);
      expect(mbr.partitions.length).toBe(4);
      expect(mbr.partitions[0].bootIndicator).toBe(0x00);
      expect(mbr.signature).toBe(0xaa55);

      const bs = fatPart.readBootSector();
      expect(bs.BS_JmpBoot).toBe(0xeb5890);
      expect(bs.BS_OEMName).toBe("KLIVEIDE");
      expect(bs.BPB_BytsPerSec).toBe(512);
      expect(bs.BPB_SecPerClus).toBe(
        sizeInMB < 1024 ? 1 : sizeInMB < 2048 ? 4 : sizeInMB < 8192 ? 8 : 16
      );
      expect(bs.BPB_ResvdSecCnt).toBe(32);
      expect(bs.BPB_NumFATs).toBe(2);
      expect(bs.BPB_RootEntCnt).toBe(0);
      expect(bs.BPB_TotSec16).toBe(0);
      expect(bs.BPB_Media).toBe(0xf8);
      expect(bs.BPB_FATSz16).toBe(0);
      expect(bs.BPB_SecPerTrk).toBe(63);
      expect(bs.BPB_NumHeads).toBe(255);
      expect(bs.BPB_HiddSec).toBe(0);
      expect(bs.BPB_TotSec32).toBe(
        Math.floor((file.cimInfo.maxSize * 2048) / file.cimInfo.sectorSize)
      );
      expect(bs.BPB_FATSz32).toBe(Math.ceil(((bs.BPB_TotSec32 / bs.BPB_SecPerClus) * 4) / 512));
      expect(bs.BPB_ExtFlags).toBe(0);
      expect(bs.BPB_FSVer).toBe(0);
      expect(bs.BPB_RootClus).toBe(2);
      expect(bs.BPB_FSInfo).toBe(1);
      expect(bs.BPB_BkBootSec).toBe(6);
      expect(bs.BPB_Reserved).toBeInstanceOf(Uint8Array);
      expect(bs.BPB_Reserved.length).toBe(12);
      expect(bs.BS_DrvNum).toBe(0x80);
      expect(bs.BS_Reserved1).toBe(0);
      expect(bs.BS_BootSig).toBe(EXTENDED_BOOT_SIGNATURE);
      expect(bs.BS_VolID).not.toBe(0);
      expect(bs.BS_VolLab).toBe("NO NAME    ");
      expect(bs.BS_FileSysType).toBe("FAT32   ");
      expect(bs.BootCode).toBeInstanceOf(Uint8Array);
      expect(bs.BootCode.length).toBe(420);
      expect(bs.BootSectorSignature).toBe(0xaa55);

      const fs = fatPart.readFSInfoSector();
      
      const dataSectors = bs.BPB_TotSec32 - (bs.BPB_ResvdSecCnt + 2 * bs.BPB_FATSz32);
      const totalDataClusters = Math.floor(dataSectors / bs.BPB_SecPerClus);
      const freeClusters = totalDataClusters - 2;
  
      expect(fs.FSI_LeadSig).toBe(FSINFO_LEAD_SIGNATURE);
      expect(fs.FSI_Reserved1).toBeInstanceOf(Uint8Array);
      expect(fs.FSI_Reserved1.length).toBe(480);
      expect(fs.FSI_StrucSig).toBe(FSINFO_STRUCT_SIGNATURE);
      expect(fs.FSI_Free_Count).toBe(freeClusters);
      expect(fs.FSI_Nxt_Free).toBe(-1);
      expect(fs.FSI_Reserved2).toBeInstanceOf(Uint8Array);
      expect(fs.FSI_Reserved2.length).toBe(12);
      expect(fs.FSI_TrailSig).toBe(0xaa550000 - 0x1_0000_0000);
    });

  });
});

function createTestFile(): string {
  const homeDir = os.homedir();
  const testDir = path.join(homeDir, TEST_DIR);
  const filePath = path.join(testDir, TEST_FILE);

  // Ensure the test directory exists
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }
  return filePath;
}
