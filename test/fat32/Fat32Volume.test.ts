import { describe, it, expect, assert } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import {
  CimFileManager,
} from "@main/fat32/CimFileManager";
import { ERROR_FAT_ENTRY_OUT_OF_RANGE, Fat32Volume } from "@main/fat32/Fat32Volume";

const TEST_DIR = "testFat32";
const TEST_FILE = "test.cim";
const TEST_IMAGE_FILE = "testImage.img";
const SIZE_IN_MB = 64;

describe("FatVolume", () => {
  it("format works #1", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, SIZE_IN_MB);
      const vol = new Fat32Volume(file);

      // --- Act
      vol.format();
      vol.init();

      // --- Assert
      expect(vol.bootSector).not.toBeNull();
      expect(vol.dataStartSector).toBe(2080);
      expect(vol.dataSectors).toBe(128992);
      expect(vol.countOfClusters).toBe(128992);
  });

  it("Invalid FAT index fails #1", () => {
    // --- Arrange
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format();
    vol.init();

    // --- Act/Assert
    expect(() => vol.getFatEntry(1)).toThrowError(ERROR_FAT_ENTRY_OUT_OF_RANGE);
  });

  it("Invalid FAT index fails #2", () => {
    // --- Arrange
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format();
    vol.init();

    // --- Act/Assert
    expect(() => vol.getFatEntry(vol.countOfFatEntries)).toThrowError(ERROR_FAT_ENTRY_OUT_OF_RANGE);
  });

  it("mkdir works #1", () => {
    // --- Arrange
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format();
    vol.init();

    // --- Act
    vol.mkdir("testdir");

    // --- Assert
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

function createImageFile(): string {
  const homeDir = os.homedir();
  const testDir = path.join(homeDir, TEST_DIR);
  const filePath = path.join(testDir, TEST_IMAGE_FILE);

  // Ensure the test directory exists
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }
  return filePath;
}
