import { describe, it, expect, assert } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import {
  CimFileManager,
} from "@main/fat32/CimFileManager";
import { Fat32Formatter } from "@main/fat32/Fat32Formatter";
import { FatVolume } from "@main/fat32/FatVolume";

const TEST_DIR = "testFat32";
const TEST_FILE = "test.cim";
const TEST_IMAGE_FILE = "testImage.img";
const SIZE_IN_MB = 64;

describe("FatVolume", () => {
  it("mkdir #1", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, SIZE_IN_MB);
      const fat32 = new Fat32Formatter(file);
      fat32.makeFat32();

      // --- Act
      const fatVolume = new FatVolume(file);
      const result = fatVolume.mkdir("testDir");

      // --- Assert
      expect(result).toBe(true);
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
