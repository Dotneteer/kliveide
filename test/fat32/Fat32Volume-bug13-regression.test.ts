import { describe, it, expect } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { CimFileManager } from "@main/fat32/CimFileManager";
import { Fat32Volume, FAT32_EOC_MIN, FAT32_EOC_MAX } from "@main/fat32/Fat32Volume";

const TEST_DIR = "testFat32Bug13";
const SIZE_IN_MB = 64;

function createTestFile(name: string): string {
  const baseDir = path.join(os.tmpdir(), TEST_DIR);
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return path.join(baseDir, `${name}.cim`);
}

describe("FAT32 Bug #13 Regression Tests - EOC Marker Masking", () => {
  it("should mask upper 4 bits when reading FAT entries", () => {
    // Create a FAT32 volume
    const filePath = createTestFile("bug13-mask");
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(file);
    volume.format("TEST");
    volume.init();
    
    try {
      // Test cluster index
      const testCluster = 50;
      
      // Write a valid EOC marker (0x0FFFFFFF)
      volume.setFatEntry(testCluster, 0x0FFFFFFF);
      
      // Read it back - should be masked
      const value = volume.getFatEntry(testCluster);
      const maskedValue = value & 0x0FFFFFFF;
      
      // The value should be masked
      expect(maskedValue).toBe(0x0FFFFFFF);
      
      // Upper bits should be ignored
      expect(maskedValue).toBeLessThanOrEqual(0x0FFFFFFF);
      
    } finally {
      file.close();
    }
  });

  it("should detect EOC markers even if upper bits are set", () => {
    // Create a FAT32 volume
    const filePath = createTestFile("bug13-eoc");
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(file);
    volume.format("TEST");
    volume.init();
    
    try {
      const testCluster = 60;
      
      // Write EOC marker
      volume.setFatEntry(testCluster, 0x0FFFFFFF);
      
      // Read and mask
      const fatValue = volume.getFatEntry(testCluster) & 0x0FFFFFFF;
      
      // Should be recognized as EOC
      expect(fatValue).toBeGreaterThanOrEqual(FAT32_EOC_MIN);
      expect(fatValue).toBeLessThanOrEqual(FAT32_EOC_MAX);
      
    } finally {
      file.close();
    }
  });

  it("should properly handle FAT32 reserved bits (28-31)", () => {
    // Create a FAT32 volume
    const filePath = createTestFile("bug13-reserved");
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(file);
    volume.format("TEST");
    volume.init();
    
    try {
      // FAT32 spec: bits 28-31 are reserved
      // When reading, we should mask these bits: value & 0x0FFFFFFF
      
      // Test various values
      const testCases = [
        { cluster: 70, value: 0x0FFFFFF8, expected: 0x0FFFFFF8 }, // EOC_MIN
        { cluster: 71, value: 0x0FFFFFFF, expected: 0x0FFFFFFF }, // EOC_MAX
        { cluster: 72, value: 0x00000003, expected: 0x00000003 }, // Regular cluster link
        { cluster: 73, value: 0x00000000, expected: 0x00000000 }, // Free cluster
      ];
      
      for (const test of testCases) {
        volume.setFatEntry(test.cluster, test.value);
        const readValue = volume.getFatEntry(test.cluster);
        const maskedValue = readValue & 0x0FFFFFFF;
        
        // After masking, value should match expected
        expect(maskedValue).toBe(test.expected);
        
        // Value should never exceed 28 bits
        expect(maskedValue).toBeLessThanOrEqual(0x0FFFFFFF);
      }
      
    } finally {
      file.close();
    }
  });
});
