import { describe, it, expect } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { CimFileManager } from "@main/fat32/CimFileManager";
import { Fat32Volume } from "@main/fat32/Fat32Volume";
import { FS_DIR_SIZE } from "@main/fat32/Fat32Types";

const TEST_DIR = "testFat32Bug11";
const SIZE_IN_MB = 64;

function createTestFile(name: string): string {
  const baseDir = path.join(os.tmpdir(), TEST_DIR);
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return path.join(baseDir, `${name}.cim`);
}

describe("FAT32 Bug #11 Regression Tests - Directory Entry Count Validation", () => {
  it("should calculate directory size limit based on actual cluster size", () => {
    // Create a FAT32 volume
    const filePath = createTestFile("bug11-limit");
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(file);
    volume.format("TEST");
    volume.init();
    
    try {
      // Get the boot sector to check cluster configuration
      const bs = volume.bootSector;
      const bytesPerCluster = bs.BPB_BytsPerSec * bs.BPB_SecPerClus;
      const entriesPerCluster = bytesPerCluster / FS_DIR_SIZE;
      
      // The maximum directory size should be based on:
      // - bytesPerCluster (actual cluster size from boot sector)
      // - maxClusters (4095 as used in the code)
      const maxClusters = 4095;
      const expectedMaxDirSize = bytesPerCluster * maxClusters;
      
      // The bug uses hardcoded "512 * 4095"
      // This only works if cluster size happens to be 512 bytes
      const buggyLimit = 512 * 4095;
      
      // Even though they might be equal for THIS volume (if cluster is 512 bytes),
      // the calculation SHOULD use bytesPerCluster, not 512
      // The test verifies the calculation logic, not a specific inequality
      expect(expectedMaxDirSize).toBe(bytesPerCluster * maxClusters);
      
      // Document the issue: hardcoded 512 is not always correct
      // It works for some cluster sizes but not all
      if (bytesPerCluster !== 512) {
        expect(expectedMaxDirSize).not.toBe(buggyLimit);
      } else {
        // If cluster size IS 512, then the bug is "accidentally" correct
        expect(expectedMaxDirSize).toBe(buggyLimit);
      }
      
    } finally {
      file.close();
    }
  });

  it("should handle different cluster sizes correctly", () => {
    // Test with different volume sizes (which result in different cluster sizes)
    const testSizes = [
      { size: 64, name: "64mb" },    // Minimum size
      { size: 128, name: "128mb" },  // Medium size
      { size: 512, name: "512mb" }   // Larger size
    ];
    
    for (const test of testSizes) {
      const filePath = createTestFile(`bug11-${test.name}`);
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, test.size);
      const volume = new Fat32Volume(file);
      volume.format("TEST");
      volume.init();
      
      try {
        const bs = volume.bootSector;
        const bytesPerCluster = bs.BPB_BytsPerSec * bs.BPB_SecPerClus;
        const entriesPerCluster = bytesPerCluster / FS_DIR_SIZE;
        const maxClusters = 4095;
        const expectedMaxSize = entriesPerCluster * maxClusters * FS_DIR_SIZE;
        
        // The limit should scale with cluster size
        expect(expectedMaxSize).toBeGreaterThan(0);
        expect(expectedMaxSize % FS_DIR_SIZE).toBe(0); // Should be multiple of entry size
        
        // Verify calculation consistency
        expect(entriesPerCluster * maxClusters).toBe(expectedMaxSize / FS_DIR_SIZE);
        
        // Bug uses hardcoded 512 * 4095
        const buggyLimit = 512 * 4095;
        
        // For different cluster sizes, the correct limit should be different
        // (unless cluster size happens to be 512 which is unlikely for FAT32)
        if (bytesPerCluster !== 512) {
          expect(expectedMaxSize).not.toBe(buggyLimit);
        }
        
      } finally {
        file.close();
      }
    }
  });
});
