import { describe, it, expect } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { CimFileManager } from "@main/fat32/CimFileManager";
import { Fat32Volume } from "@main/fat32/Fat32Volume";
import { FS_ATTR_LABEL } from "@main/fat32/Fat32Types";

const TEST_DIR = "testFat32Bug14";
const SIZE_IN_MB = 64;

function createTestFile(name: string): string {
  const baseDir = path.join(os.tmpdir(), TEST_DIR);
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return path.join(baseDir, `${name}.cim`);
}

describe("FAT32 Bug #14 Regression Tests - Volume Label Initialization", () => {
  it("should write volume label to root directory during format", () => {
    // Create and format a FAT32 volume with a label
    const filePath = createTestFile("bug14-label");
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(file);
    const testLabel = "TESTLABEL";
    volume.format(testLabel);
    volume.init();
    
    try {
      // Open root directory
      const root = volume.openRootDirectory();
      
      // Read first directory entry (should be the volume label)
      // Root directory starts at position 0, so no seek needed
      const buffer = root.readFileData(32);
      
      expect(buffer).not.toBeNull();
      if (buffer) {
        const labelName = new TextDecoder().decode(buffer.slice(0, 11)).trim();
        const labelAttr = buffer[11];
        
        // Volume label should be present in first entry
        expect(labelName).toBe(testLabel);
        expect(labelAttr & FS_ATTR_LABEL).toBe(FS_ATTR_LABEL);
      }
      
      root.close();
      
    } finally {
      file.close();
    }
  });

  it("should initialize root directory with volume label only", () => {
    // Create and format a FAT32 volume
    const filePath = createTestFile("bug14-init");
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(file);
    const testLabel = "MYLABEL";
    volume.format(testLabel);
    volume.init();
    
    try {
      const root = volume.openRootDirectory();
      
      // First entry should be volume label
      // Root directory starts at position 0, so no seek needed
      const firstEntry = root.readFileData(32);
      expect(firstEntry).not.toBeNull();
      if (firstEntry) {
        const attr = firstEntry[11];
        expect(attr & FS_ATTR_LABEL).toBe(FS_ATTR_LABEL);
      }
      
      // Second entry should be free (0x00 or 0xE5)
      // After reading first 32 bytes, position is already at 32
      const secondEntry = root.readFileData(32);
      expect(secondEntry).not.toBeNull();
      if (secondEntry) {
        const firstByte = secondEntry[0];
        // Free entry markers: 0x00 (never used) or 0xE5 (deleted)
        expect(firstByte === 0x00 || firstByte === 0xE5).toBe(true);
      }
      
      root.close();
      
    } finally {
      file.close();
    }
  });

  it("should format volume label correctly with padding", () => {
    // Test various label lengths
    const testCases = [
      { label: "SHORT", expected: "SHORT      " },    // Short label
      { label: "EXACTLENGTH", expected: "EXACTLENGTH" }, // 11 chars
      { label: "TOOLONGNAME1234", expected: "TOOLONGNAME" }, // Too long, truncated
    ];
    
    for (const test of testCases) {
      const filePath = createTestFile(`bug14-${test.label.toLowerCase()}`);
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, SIZE_IN_MB);
      const volume = new Fat32Volume(file);
      volume.format(test.label);
      volume.init();
      
      try {
        const root = volume.openRootDirectory();
        // Root directory starts at position 0, so no seek needed
        const buffer = root.readFileData(32);
        
        expect(buffer).not.toBeNull();
        if (buffer) {
          // FAT directory entry name is always 11 bytes
          const labelName = new TextDecoder().decode(buffer.slice(0, 11));
          expect(labelName).toBe(test.expected);
        }
        
        root.close();
        
      } finally {
        file.close();
      }
    }
  });
});

