import { describe, it, expect } from "vitest";
import { FatDirEntry } from "@main/fat32/FatDirEntry";
import { FS_DIR_SIZE } from "@main/fat32/Fat32Types";

describe("FatDirEntry - Bug #1 Regression", () => {
  it("should correctly read/write DIR_Name at offset 0x00", () => {
    // --- Arrange: Create a buffer with a known pattern
    // We'll set the DIR_Name bytes (0-10) to specific values
    const buffer = new Uint8Array(FS_DIR_SIZE);
    
    // Write known values at the correct offset (0x00-0x0A)
    // DIR_Name is 11 bytes, so we need 11 characters
    const testName = "TEST FILE  ";
    for (let i = 0; i < testName.length; i++) {
      buffer[i] = testName.charCodeAt(i);
    }
    
    // --- Act: Read via FatDirEntry
    const entry = new FatDirEntry(buffer);
    const name = entry.DIR_Name;
    
    // --- Assert: Should read from offset 0x00, not 0x20 (FS_DIR_SIZE)
    expect(name).toBe("TEST FILE  ");
  });

  it("should correctly read/write DIR_Attr at offset 0x0B", () => {
    // --- Arrange: Create a buffer with a known pattern
    const buffer = new Uint8Array(FS_DIR_SIZE);
    buffer[11] = 0x20; // Set DIR_Attr at correct offset
    
    // --- Act: Read via FatDirEntry
    const entry = new FatDirEntry(buffer);
    const attr = entry.DIR_Attr;
    
    // --- Assert: Should read from offset 0x0B, not beyond buffer
    expect(attr).toBe(0x20);
  });

  it("should correctly write DIR_Name", () => {
    // --- Arrange
    const buffer = new Uint8Array(FS_DIR_SIZE);
    const entry = new FatDirEntry(buffer);
    
    // --- Act: Write via FatDirEntry
    entry.DIR_Name = "NEWFILE~TXT";
    
    // --- Assert: Should write to offset 0x00-0x0A, not beyond
    expect(buffer[0]).toBe("N".charCodeAt(0));
    expect(buffer[1]).toBe("E".charCodeAt(0));
    expect(buffer[2]).toBe("W".charCodeAt(0));
    expect(buffer[10]).toBe("T".charCodeAt(0));
    // Verify offset 32 (FS_DIR_SIZE) wasn't touched if buffer was larger
    const largerBuffer = new Uint8Array(64);
    largerBuffer.fill(0xAA, 32); // Fill offset 32+ with 0xAA
    const entry2 = new FatDirEntry(largerBuffer.subarray(0, 32));
    entry2.DIR_Name = "TESTFILENAME";
    // After the fix, offset 32 should still be 0xAA (untouched)
    expect(largerBuffer[32]).toBe(0xAA);
  });

  it("should correctly read DIR_FstClusHI at offset 0x14 (20)", () => {
    // --- Arrange: Create a buffer with a known pattern
    const buffer = new Uint8Array(FS_DIR_SIZE);
    buffer[20] = 0x12;
    buffer[21] = 0x34;
    
    // --- Act: Read via FatDirEntry
    const entry = new FatDirEntry(buffer);
    const cluster = entry.DIR_FstClusHI;
    
    // --- Assert: Should read little-endian value from offset 0x14
    expect(cluster).toBe(0x3412);
  });

  it("should correctly write DIR_FileSize at offset 0x1C (28)", () => {
    // --- Arrange
    const buffer = new Uint8Array(FS_DIR_SIZE);
    const entry = new FatDirEntry(buffer);
    
    // --- Act: Write file size
    entry.DIR_FileSize = 0x12345678;
    
    // --- Assert: Should write to offset 0x1C, little-endian
    expect(buffer[28]).toBe(0x78);
    expect(buffer[29]).toBe(0x56);
    expect(buffer[30]).toBe(0x34);
    expect(buffer[31]).toBe(0x12);
  });
});
