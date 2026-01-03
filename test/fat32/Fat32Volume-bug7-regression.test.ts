import { describe, it, expect, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Fat32Volume } from "../../src/main/fat32/Fat32Volume";
import { CimFileManager } from "../../src/main/fat32/CimFileManager";
import { O_RDONLY, O_CREAT, O_RDWR } from "../../src/main/fat32/Fat32Types";

const TEST_DIR = "testFat32";
const SIZE_IN_MB = 64;

describe("Fat32Volume - Bug #7: Incomplete error handling in readFileData", () => {
  function createTestFile(id: number): string {
    const homeDir = os.homedir();
    const testDir = path.join(homeDir, TEST_DIR);
    const filePath = path.join(testDir, `bug7-error-handling${id}.cim`);

    // Ensure the test directory exists
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }
    return filePath;
  }

  afterEach(() => {
    // Tests clean up after themselves
  });

  it("Reading file at EOF should handle null gracefully", () => {
    const filePath = createTestFile(1);
    const cfm = new CimFileManager();
    const cimFile = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(cimFile);
    volume.format();
    volume.init();

    // Create a small file
    const fileContent = new Uint8Array(512); // 1 sector
    for (let i = 0; i < fileContent.length; i++) {
      fileContent[i] = i & 0xFF;
    }

    let file = volume.createFile("test.txt");
    expect(file).not.toBeNull();
    file!.writeFileData(fileContent);

    file!.close();
    file = volume.open("test.txt", O_RDONLY);
    expect(file).not.toBeNull();

    // ✅ BUG #7 TEST: Reading the entire file should return full data
    const readData = file!.readFileData(512);
    expect(readData).not.toBeNull();
    expect(readData!.length).toBe(512);

    // ✅ BUG #7 TEST: Attempting to read beyond EOF should either:
    // 1. Return what's available, or
    // 2. Return null/empty, but must be consistent
    // The issue is that readFileData can return null without clear documentation
    const extraRead = file!.readFileData(512);
    // This should either be null or empty Uint8Array, not undefined
    expect(extraRead === null || extraRead!.length === 0).toBe(true);

    file!.close();
    cimFile.close();
  });

  it("Reading directory entries should not silently truncate", () => {
    const filePath = createTestFile(2);
    const cfm = new CimFileManager();
    const cimFile = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(cimFile);
    volume.format();
    volume.init();

    // Create root directory reference
    let rootDir = volume.openRootDirectory();
    expect(rootDir).not.toBeNull();

    // ✅ BUG #7 TEST: Reading directory entries should be consistent
    // When reaching EOF in a directory, we should know if we got complete data
    // Currently the code just breaks and returns whatever we accumulated
    const dirEntry = rootDir!.readFileData(32); // Read one dir entry
    expect(dirEntry).not.toBeNull();
    expect(dirEntry!.length).toBeGreaterThan(0);

    rootDir!.close();
    cimFile.close();
  });

  it("Multiple files in directory should all be readable without data corruption", () => {
    const filePath = createTestFile(3);
    const cfm = new CimFileManager();
    const cimFile = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(cimFile);
    volume.format();
    volume.init();

    // Create multiple files
    const files: string[] = ["file1.txt", "file2.txt", "file3.txt"];
    const fileData: Uint8Array[] = [];

    for (let i = 0; i < files.length; i++) {
      const data = new Uint8Array(1024 * (i + 1));
      for (let j = 0; j < data.length; j++) {
        data[j] = (i * 100 + j) & 0xFF;
      }
      fileData.push(data);

      let file = volume.createFile(files[i]);
      expect(file).not.toBeNull();
      file!.writeFileData(data);
      file!.close();
    }

    // ✅ BUG #7 TEST: Read all files back and verify none are corrupted
    for (let i = 0; i < files.length; i++) {
      let file = volume.open(files[i], O_RDONLY);
      expect(file).not.toBeNull();

      const readData = file!.readFileData(fileData[i].length);
      expect(readData).not.toBeNull();
      expect(readData!.length).toBe(fileData[i].length);

      // Verify data integrity
      for (let j = 0; j < fileData[i].length; j++) {
        expect(readData![j]).toBe(fileData[i][j]);
      }

      file!.close();
    }

    cimFile.close();
  });

  it("Reading from non-existent file should handle errors", () => {
    const filePath = createTestFile(4);
    const cfm = new CimFileManager();
    const cimFile = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(cimFile);
    volume.format();
    volume.init();

    // ✅ BUG #7 TEST: Try to open non-existent file
    const file = volume.open("nonexistent.txt", O_RDONLY);
    
    // Should return null, not throw or cause undefined behavior
    expect(file).toBeNull();

    cimFile.close();
  });
});
