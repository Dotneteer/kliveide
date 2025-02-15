import { describe, it, expect, assert } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { CimFileManager } from "@main/fat32/CimFileManager";
import { Fat32Volume } from "@main/fat32/Fat32Volume";
import { CimHandler } from "@main/fat32/CimHandlers";

const TEST_DIR = "testFat32";
const TEST_FILE = "test.cim";
const SIZE_IN_MB = 64;

describe("CimHandler", () => {
  it("CimHandler initialization works", () => {
    // --- Arrange
    const filePath = createTestFile(1);
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format("MY VOLUME");
    
    // --- Act
    const ch = new CimHandler(filePath);

    // --- Assert
    const ci = ch.cimInfo;
    expect(ci).toBeDefined();
    expect(ci.header).toBe("CIMF");
    expect(ci.versionMajor).toBe(1);
    expect(ci.versionMinor).toBe(0);
    expect(ci.sectorSize).toBe(1);
    expect(ci.clusterCount).toBe(1024);
    expect(ci.clusterSize).toBe(1);
    expect(ci.maxClusters).toBe(4);
    expect(ci.maxSize).toBe(SIZE_IN_MB);
    expect(ci.reserved).toBe(0);
    expect(ci.clusterMap[0]).toBe(0x0000);
    expect(ci.clusterMap[1]).toBe(0xffff);
    expect(ci.clusterMap[2]).toBe(0xffff);
    expect(ci.clusterMap[3]).toBe(0xffff);
    expect(ci.clusterMap[8]).toBe(0x0001);
    expect(ci.clusterMap[16]).toBe(0x0002);
    expect(ci.clusterMap[24]).toBe(0x0003);
    for (let i = 4; i < 32760; i++) {
      if (i === 8 || i === 16 || i === 24) {
        continue;
      }
      expect(ci.clusterMap[i]).toBe(0xffff);
    }
  });

  it("setReadOnly works #1", () => {
    // --- Arrange
    const filePath = createTestFile(1);
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format("MY VOLUME");
    const ch = new CimHandler(filePath);
    
    // --- Act
    ch.setReadOnly(true);

    // --- Assert
    try {
      ch.writeSector(0, new Uint8Array(512));
    } catch (e) {
      expect(e.message).toContain("read-only");
      return;
    }
    assert.fail("Expected exception not thrown");
  });

  it("setReadOnly works #2", () => {
    // --- Arrange
    const filePath = createTestFile(1);
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format("MY VOLUME");
    const ch = new CimHandler(filePath);
    
    // --- Act
    ch.setReadOnly(false);
    const data = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      data[i] = i & 0xff;
    }
    ch.writeSector(10_000, data);

    // --- Assert
    const sector = ch.readSector(10_000);
    expect(sector).toBeDefined();
    expect(sector.length).toBe(512);
    for (let i = 0; i < 512; i++) {
      expect(sector[i]).toBe(data[i]);
    }
  });
});

function createTestFile(id: number): string {
  const homeDir = os.homedir();
  const testDir = path.join(homeDir, TEST_DIR);
  const filePath = path.join(testDir, `${TEST_FILE}${id}`);

  // Ensure the test directory exists
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }
  return filePath;
}
