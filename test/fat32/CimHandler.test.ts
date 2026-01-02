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

  it("REGRESSION: maxClusters header field persists after cluster allocation", () => {
    // --- This test catches Issue #1: CIM Header State Out-of-Sync in CimHandler
    // --- When new clusters are allocated, maxClusters must be persisted to the header
    
    // --- Arrange
    const filePath = createTestFile(99);
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format("MY VOLUME");
    
    // --- Act: Create CimHandler and allocate clusters
    const ch1 = new CimHandler(filePath);
    
    // Initial maxClusters should be 4 (from format operation)
    const initialMaxClusters = ch1.cimInfo.maxClusters;
    expect(initialMaxClusters).toBe(4);

    // Allocate a new cluster by writing to an unallocated sector
    const testData = new Uint8Array(512);
    testData.fill(0xCC);
    ch1.writeSector(500, testData);
    
    // maxClusters should have incremented
    expect(ch1.cimInfo.maxClusters).toBe(initialMaxClusters + 1);

    // --- Critical: Simulate application restart by creating a new CimHandler instance
    // --- This forces a readHeader() call which reads the file from disk
    const ch2 = new CimHandler(filePath);

    // --- Assert: maxClusters must match what was allocated (regression test)
    // --- BEFORE FIX: This would fail because maxClusters was not persisted correctly to offset 0x0c
    // --- AFTER FIX: This passes because maxClusters is written to header offset 0x0c
    expect(ch2.cimInfo.maxClusters).toBe(initialMaxClusters + 1);
    
    // --- Verify data integrity after reload
    const readData = ch2.readSector(500);
    expect(readData[0]).toBe(0xCC);
  });

  it("REGRESSION: Multiple cluster allocations persist all header updates", () => {
    // --- This test catches Issue #2: Missing Header Persistence After Write Operations
    // --- When multiple clusters are allocated in sequence, each allocation must update the header
    
    // --- Arrange
    const filePath = createTestFile(98);
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format("MY VOLUME");
    
    // --- Act: Create CimHandler and allocate multiple clusters in one session
    const ch1 = new CimHandler(filePath);
    const initialMaxClusters = ch1.cimInfo.maxClusters;
    
    // Allocate clusters by writing to sectors that are guaranteed to be in different clusters
    // With clusterSize=1 (64KB), each cluster has 128 sectors (64KB / 512 bytes)
    // So writing to sectors 0, 128, 256, 384, 512 will allocate 5 different clusters
    const allocations = [
      { sector: 0, value: 0x11 },      // Cluster 0, Sector 0
      { sector: 128, value: 0x22 },    // Cluster 1, Sector 0
      { sector: 256, value: 0x33 },    // Cluster 2, Sector 0
      { sector: 384, value: 0x44 },    // Cluster 3, Sector 0
      { sector: 512, value: 0x55 }     // Cluster 4, Sector 0
    ];
    
    for (const alloc of allocations) {
      const testData = new Uint8Array(512);
      testData.fill(alloc.value);
      ch1.writeSector(alloc.sector, testData);
    }
    
    // After 5 allocations, maxClusters should be initial + 5
    // (or initial + 4 if sector 0 was already allocated during format)
    const expectedMaxClusters = ch1.cimInfo.maxClusters;
    expect(expectedMaxClusters).toBeGreaterThanOrEqual(initialMaxClusters + 4);

    // --- Critical: Simulate application restart
    // --- This is the key test: ALL cluster allocations must have persisted correctly
    const ch2 = new CimHandler(filePath);

    // --- Assert: maxClusters must match (regression test for Issue #2)
    // --- BEFORE FIX: This would fail because only some maxClusters updates were persisted
    // --- AFTER FIX: This passes because each allocation writes updated maxClusters to header
    expect(ch2.cimInfo.maxClusters).toBe(expectedMaxClusters);
    
    // --- Verify all data integrity after reload
    for (const alloc of allocations) {
      const readData = ch2.readSector(alloc.sector);
      expect(readData[0]).toBe(alloc.value);
    }
  });

  it("REGRESSION: CimHandler switches to correct file when SD card changes", () => {
    // --- This test catches Issue #3: Stale CimHandler Instance After SD Card Changes
    // --- When the SD card file changes, a new CimHandler should be created for the new file
    
    // --- Arrange: Create two separate CIM files
    const filePath1 = createTestFile(97);
    const filePath2 = createTestFile(96);
    const cfm = new CimFileManager();
    
    const file1 = cfm.createFile(filePath1, SIZE_IN_MB);
    const vol1 = new Fat32Volume(file1);
    vol1.format("VOLUME_1");
    
    const file2 = cfm.createFile(filePath2, SIZE_IN_MB);
    const vol2 = new Fat32Volume(file2);
    vol2.format("VOLUME_2");
    
    // --- Act: Create handler for file 1
    const ch1 = new CimHandler(filePath1);
    
    // Verify it's operating on file 1
    expect(ch1.cimFileName).toBe(filePath1);
    
    // Write data to file 1
    const testData1 = new Uint8Array(512);
    testData1.fill(0xAA);
    ch1.writeSector(100, testData1);
    
    // Verify data was written to file 1
    const readData1 = ch1.readSector(100);
    expect(readData1[0]).toBe(0xAA);
    
    // --- Critical: Create a new handler for file 2
    // --- This simulates the user changing the SD card file in the UI
    const ch2 = new CimHandler(filePath2);
    
    // --- Assert: Handler should be for file 2, not file 1
    // --- BEFORE FIX: ch2 might still be pointing to file 1 due to singleton cache
    // --- AFTER FIX: ch2 correctly points to file 2
    expect(ch2.cimFileName).toBe(filePath2);
    
    // --- Verify file 1 still has its data
    const ch1_verify = new CimHandler(filePath1);
    const readBackFile1 = ch1_verify.readSector(100);
    expect(readBackFile1[0]).toBe(0xAA);
    
    // --- Verify file 2 does NOT have file 1's data
    const testData2 = new Uint8Array(512);
    testData2.fill(0xBB);
    ch2.writeSector(100, testData2);
    
    const readData2 = ch2.readSector(100);
    expect(readData2[0]).toBe(0xBB);
    
    // --- Verify file 1 still has original data (not corrupted by file 2 operations)
    const ch1_final = new CimHandler(filePath1);
    const finalReadFile1 = ch1_final.readSector(100);
    expect(finalReadFile1[0]).toBe(0xAA);  // Should still be 0xAA, not 0xBB
  });

  it("REGRESSION: CimHandler properly propagates write errors when file is read-only", () => {
    // --- This test catches Issue #4: No Error Handling for Failed Writes
    // --- When a write fails (e.g., file is read-only), the error should be propagated
    // --- Not silently caught and logged
    
    // --- Arrange
    const filePath = createTestFile(95);
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format("MY VOLUME");
    
    // --- Act & Assert
    const ch = new CimHandler(filePath);
    
    // Set file as read-only to trigger an error
    ch.setReadOnly(true);
    
    const testData = new Uint8Array(512);
    testData.fill(0xDD);
    
    // --- Critical: Writing to read-only file should throw an error
    // --- BEFORE FIX: Error might be silently caught and logged instead of thrown
    // --- AFTER FIX: Error is properly propagated
    expect(() => {
      ch.writeSector(100, testData);
    }).toThrow("read-only");
  });

  it("REGRESSION: Concurrent read/write operations complete without file handle conflicts", () => {
    // --- This test catches Issue #5: File Handle Lifecycle Risk in Concurrent Operations
    // --- When multiple read/write operations are performed in rapid sequence,
    // --- they should not cause file handle conflicts or data corruption
    
    // --- Arrange
    const filePath = createTestFile(94);
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format("MY VOLUME");
    
    // --- Act: Perform many rapid sequential read/write operations
    const ch = new CimHandler(filePath);
    
    // Rapid write operations with immediate reads
    const iterations = 50;
    for (let i = 0; i < iterations; i++) {
      // Write pattern 0
      const writeData0 = new Uint8Array(512);
      writeData0.fill(0x11);
      ch.writeSector(i * 3, writeData0);
      
      // Immediately read it back
      const readData0 = ch.readSector(i * 3);
      // --- BEFORE FIX: Might read stale/wrong data due to file handle conflicts
      // --- AFTER FIX: Reads correct data immediately
      for (let j = 0; j < 512; j++) {
        expect(readData0[j]).toBe(0x11);
      }
      
      // Write pattern 1
      const writeData1 = new Uint8Array(512);
      writeData1.fill(0x22);
      ch.writeSector(i * 3 + 1, writeData1);
      
      // Read previous write to ensure it wasn't corrupted
      const readData1 = ch.readSector(i * 3 + 1);
      for (let j = 0; j < 512; j++) {
        expect(readData1[j]).toBe(0x22);
      }
      
      // Write pattern 2
      const writeData2 = new Uint8Array(512);
      writeData2.fill(0x33);
      ch.writeSector(i * 3 + 2, writeData2);
      
      // Read back pattern 0 from earlier - should still be intact
      const verifyData0 = ch.readSector(i * 3);
      for (let j = 0; j < 512; j++) {
        expect(verifyData0[j]).toBe(0x11);
      }
    }
    
    // Final verification: re-read all written sectors
    for (let i = 0; i < iterations; i++) {
      const data0 = ch.readSector(i * 3);
      const data1 = ch.readSector(i * 3 + 1);
      const data2 = ch.readSector(i * 3 + 2);
      
      expect(data0[0]).toBe(0x11);
      expect(data1[0]).toBe(0x22);
      expect(data2[0]).toBe(0x33);
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
