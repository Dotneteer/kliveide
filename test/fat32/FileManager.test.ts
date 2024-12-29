import { describe, it, expect, assert } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { CimFileManager } from "@main/fat32/CimFileManager";
import { Fat32Volume } from "@main/fat32/Fat32Volume";
import { FileManager } from "@main/fat32/FileManager";

const TEST_DIR = "testFat32";
const TEST_FILE = "test.cim";
const TEST_IMAGE_FILE = "testImage.img";
const SIZE_IN_MB = 128;

describe("FileManager", () => {
  it("Copy works", async () => {
    // // --- Arrange
    // const filePath = createTestFile();
    // const cfm = new CimFileManager();
    // const file = cfm.createFile(filePath, SIZE_IN_MB);
    // const vol = new Fat32Volume(file);
    // vol.format("TESTVOL");
    // vol.init();
    // const fm = new FileManager(vol);

    // // --- Act
    // await fm.copyFiles(path.join(os.homedir(), 'zxbasic'), "");
    // const imgFilePath = createImageFile();
    // cfm.convertToImageFile(file, imgFilePath);

    // // --- Assert
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
