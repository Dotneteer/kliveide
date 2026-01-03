import { describe, it, expect } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { CimFileManager } from "@main/fat32/CimFileManager";
import { Fat32Volume } from "@main/fat32/Fat32Volume";

const TEST_DIR = "testFat32Regression";
const SIZE_IN_MB = 64;

describe("Fat32Volume - Bug #2 Regression", () => {
  it("should write to both FAT tables when setFatEntry is called", () => {
    // --- Arrange
    const filePath = createTestFile("bug2-mirror");
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format("TEST");
    vol.init();

    // --- Act: Set a FAT entry
    const testCluster = 50;
    const testValue = 0x0FFFFFFF;
    vol.setFatEntry(testCluster, testValue);

    // --- Assert: Verify we can read the same value back (this verifies FAT was written)
    const readValue = vol.getFatEntry(testCluster);
    expect(readValue).toBe(testValue);

    // --- Also verify by directly reading the FAT sectors via the file
    // Read both FAT1 and FAT2 sectors for this cluster
    const [sector1, offset1] = (vol as any).calculateFatEntry(testCluster);
    const buffer1 = file.readSector(sector1);
    const dv1 = new DataView(buffer1.buffer);
    const fat1Value = dv1.getInt32(offset1, true);
    
    const fat2Sector = sector1 + vol.bootSector.BPB_FATSz32;
    const buffer2 = file.readSector(fat2Sector);
    const dv2 = new DataView(buffer2.buffer);
    const fat2Value = dv2.getInt32(offset1, true);
    
    // Both FAT1 and FAT2 should have the same value
    expect(fat1Value).toBe(testValue);
    expect(fat2Value).toBe(testValue);

    // --- Cleanup
    file.close();
  });

  it("should keep FAT1 and FAT2 in sync after allocating clusters", () => {
    // --- Arrange
    const filePath = createTestFile("bug2-sync");
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format("TEST");
    vol.init();

    // --- Act: Allocate some clusters by creating a directory and files
    vol.mkdir("testDir");
    vol.mkdir("testDir/subdir");

    // --- Assert: Verify that cluster allocations are reflected in both FAT1 and FAT2
    // Check several allocated clusters
    const testClusters = [2, 3, 4];  // Clusters that should be allocated after mkdir
    
    for (const clusterIdx of testClusters) {
      const [sector1, offset1] = (vol as any).calculateFatEntry(clusterIdx);
      const buffer1 = file.readSector(sector1);
      const dv1 = new DataView(buffer1.buffer);
      const fat1Value = dv1.getInt32(offset1, true);
      
      const fat2Sector = sector1 + vol.bootSector.BPB_FATSz32;
      const buffer2 = file.readSector(fat2Sector);
      const dv2 = new DataView(buffer2.buffer);
      const fat2Value = dv2.getInt32(offset1, true);
      
      // Both should be identical
      expect(fat1Value).toBe(fat2Value);
    }

    // --- Cleanup
    file.close();
  });
});

function createTestFile(suffix: string): string {
  const homeDir = os.homedir();
  const testDir = path.join(homeDir, TEST_DIR);
  const filePath = path.join(testDir, `${suffix}.cim`);

  // Ensure the test directory exists
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }
  
  // Remove file if it exists
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  return filePath;
}
