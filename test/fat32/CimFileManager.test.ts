import { describe, it, expect, assert } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import {
  CIM_HEADER,
  CIM_VERSION_MAJOR,
  CIM_VERSION_MINOR,
  CimFileManager,
  MAX_CLUSTERS
} from "@main/fat32/CimFileManager";

const TEST_DIR = "testFat32";
const TEST_FILE = "test.cim";
const TEST_IMAGE_FILE = "testImage.img";

describe("CimFileManager", () => {
  it("constructor fails with invalid name #1", () => {
    try {
      const cfm = new CimFileManager();
      cfm.createFile("", 1);
    } catch (err) {
      expect(err.message).includes("Invalid name");
      return;
    }
    assert.fail("Exception expected");
  });

  it("constructor fails with invalid name #2", () => {
    try {
      const cfm = new CimFileManager();
      cfm.createFile("    ", 1);
    } catch (err) {
      expect(err.message).includes("Invalid name");
      return;
    }
    assert.fail("Exception expected");
  });

  it("constructor fails with invalid size #1", () => {
    try {
      const cfm = new CimFileManager();
      cfm.createFile("cimfile", 0);
    } catch (err) {
      expect(err.message).includes("Invalid size");
      return;
    }
    assert.fail("Exception expected");
  });

  it("constructor fails with invalid size #2", () => {
    try {
      const cfm = new CimFileManager();
      cfm.createFile("cimfile", 16385);
    } catch (err) {
      expect(err.message).includes("Invalid size");
      return;
    }
    assert.fail("Exception expected");
  });

  it("constructor works with valid size #1", () => {
    const cfm = new CimFileManager();
    const file = cfm.createFile("cimfile", 64);
    expect(file).toBeDefined();
  });

  it("constructor works with valid size #2", () => {
    const cfm = new CimFileManager();
    const file = cfm.createFile("cimfile", 16384);
    expect(file).toBeDefined();
  });

  const createFileCases = [
    {
      sizeInMegaByte: 64,
      clusterCount: 1024,
      clusterSize: 1
    },
    {
      sizeInMegaByte: 128,
      clusterCount: 2048,
      clusterSize: 1
    },
    {
      sizeInMegaByte: 256,
      clusterCount: 4096,
      clusterSize: 1
    },
    {
      sizeInMegaByte: 512,
      clusterCount: 8192,
      clusterSize: 1
    },
    {
      sizeInMegaByte: 1024,
      clusterCount: 16384,
      clusterSize: 1
    },
    {
      sizeInMegaByte: 2048,
      clusterCount: 16384,
      clusterSize: 2
    },
    {
      sizeInMegaByte: 4096,
      clusterCount: 16384,
      clusterSize: 4
    },
    {
      sizeInMegaByte: 8192,
      clusterCount: 16384,
      clusterSize: 8
    },
    {
      sizeInMegaByte: 16384,
      clusterCount: 16384,
      clusterSize: 16
    }
  ];

  createFileCases.forEach((c) => {
    it(`createFile works (${c.sizeInMegaByte})`, () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();

      // --- Act
      const file = cfm.createFile(filePath, c.sizeInMegaByte);

      // --- Assert
      expect(file).toBeDefined();
      expect(fs.existsSync(filePath)).toBe(true);

      const header = file.readHeader();
      const cinfo = file.cimInfo;
      expect(cinfo.header).toBe(CIM_HEADER);
      expect(cinfo.versionMajor).toBe(CIM_VERSION_MAJOR);
      expect(cinfo.versionMinor).toBe(CIM_VERSION_MINOR);
      expect(cinfo.sectorSize).toBe(1);
      expect(cinfo.clusterCount).toBe(c.clusterCount);
      expect(cinfo.clusterSize).toBe(c.clusterSize);
      expect(cinfo.maxClusters).toBe(0);
      expect(cinfo.maxSize).toBe(c.sizeInMegaByte);
      expect(cinfo.reserved).toBe(0);
      expect(cinfo.clusterMap.length).toBe(MAX_CLUSTERS);
      let clusterSum = 0;
      for (let i = 0; i < MAX_CLUSTERS; i++) {
        clusterSum += cinfo.clusterMap[i];
      }
      expect(clusterSum).toBe(0xffff * MAX_CLUSTERS);

      // --- Clean up the created file after the test
      fs.unlinkSync(filePath);
    });
  });

  it("readSector fails with invalid sector index #1", () => {
    // --- Arrange
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, 64);

    // --- Act
    try {
      file.readSector(-1);
    } catch (err) {
      expect(err.message).includes("Invalid sector");
      return;
    }
    assert.fail("Exception expected");
  });

  it("readSector fails with invalid sector index #2", () => {
    // --- Arrange
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, 64);

    // --- Act
    try {
      file.readSector(2048 * 64);
    } catch (err) {
      expect(err.message).includes("Invalid sector");
      return;
    }
    assert.fail("Exception expected");
  });

  it("writeSector fails with invalid sector index #1", () => {
    // --- Arrange
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, 64);

    // --- Act
    try {
      file.writeSector(-1, new Uint8Array(512));
    } catch (err) {
      expect(err.message).includes("Invalid sector");
      return;
    }
    assert.fail("Exception expected");
  });

  it("writeSector fails with invalid sector index #2", () => {
    // --- Arrange
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, 64);

    // --- Act
    try {
      file.writeSector(2048 * 64, new Uint8Array(512));
    } catch (err) {
      expect(err.message).includes("Invalid sector");
      return;
    }
    assert.fail("Exception expected");
  });

  it("writeSector fails with invalid data length #1", () => {
    // --- Arrange
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, 64);

    // --- Act
    try {
      file.writeSector(0, new Uint8Array(511));
    } catch (err) {
      expect(err.message).includes("Invalid data length");
      return;
    }
    assert.fail("Exception expected");
  });

  it("writeSector fails with invalid data length #2", () => {
    // --- Arrange
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, 64);

    // --- Act
    try {
      file.writeSector(0, new Uint8Array(513));
    } catch (err) {
      expect(err.message).includes("Invalid data length");
      return;
    }
    assert.fail("Exception expected");
  });

  it("writeSector works with new cluster #1", () => {
    // --- Arrange
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, 64);

    // --- Act
    const newData = new Uint8Array(512);
    newData.fill(0x34);
    file.writeSector(0, newData);

    // --- Assert
    const data = file.readSector(0);
    expect(data.length).toBe(512);
    let sumData = 0;
    for (let i = 0; i < 512; i++) {
      sumData += data[i];
    }
    expect(sumData).toBe(0x34 * 512);

    const cinfo = file.cimInfo;
    expect(cinfo.maxClusters).toBe(1);
    expect(cinfo.clusterMap[0]).toBe(0);
  });

  it("writeSector works with new cluster #2", () => {
    // --- Arrange
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, 64);

    // --- Act
    const newData = new Uint8Array(512);
    newData.fill(0x34);
    file.writeSector(1, newData);

    // --- Assert
    const data = file.readSector(1);
    expect(data.length).toBe(512);
    let sumData = 0;
    for (let i = 0; i < 512; i++) {
      sumData += data[i];
    }
    expect(sumData).toBe(0x34 * 512);

    const cinfo = file.cimInfo;
    expect(cinfo.maxClusters).toBe(1);
    expect(cinfo.clusterMap[0]).toBe(0);
  });

  it("writeSector works with new cluster #3", () => {
    // --- Arrange
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, 64);

    // --- Act
    const newData = new Uint8Array(512);
    newData.fill(0x34);
    file.writeSector(1, newData);
    file.writeSector(130, newData);

    // --- Assert
    const data = file.readSector(130);
    expect(data.length).toBe(512);
    let sumData = 0;
    for (let i = 0; i < 512; i++) {
      sumData += data[i];
    }
    expect(sumData).toBe(0x34 * 512);

    const cinfo = file.cimInfo;
    expect(cinfo.maxClusters).toBe(2);
    expect(cinfo.clusterMap[0]).toBe(0);
    expect(cinfo.clusterMap[1]).toBe(1);
  });

  it("convert to CimFile", () => {
    // --- Arrange
    const homeDir = os.homedir();
    const testDir = path.join(homeDir, TEST_DIR);
    const filePath = path.join(homeDir, "Desktop", "ks2.img");
    const outPath = path.join(testDir, "ks2converted.cim");
    const cfm = new CimFileManager();
    const file = cfm.convertImageFileToCim(filePath, outPath);
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
