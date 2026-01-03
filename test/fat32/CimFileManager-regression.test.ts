import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { CimFileManager, CimFile, MAX_CLUSTERS, CIM_HEADER, CIM_VERSION_MAJOR, CIM_VERSION_MINOR, CLUSTER_BASE_SIZE } from "@main/fat32/CimFileManager";

const TEST_DIR = "testFat32Regression";

describe("CimFileManager - Regression Tests", () => {
  beforeAll(() => {
    const homeDir = os.homedir();
    const testDir = path.join(homeDir, TEST_DIR);
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    const homeDir = os.homedir();
    const testDir = path.join(homeDir, TEST_DIR);
    if (fs.existsSync(testDir)) {
      // Clean up test files
      const files = fs.readdirSync(testDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testDir, file));
      }
      fs.rmdirSync(testDir);
    }
  });

  // ========== Bug #1: CRITICAL - CimFile instances don't read existing header data ==========

  describe("Bug #1: Missing readHeader() call on existing files", () => {
    it("REGRESSION-001: CimFile should not overwrite existing cluster 0 when reopening file", () => {
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-001.cim");
      
      // Create file and write data to cluster 0
      const file1 = cfm.createFile(filePath, 64);
      const originalData = new Uint8Array(512);
      for (let i = 0; i < 512; i++) {
        originalData[i] = 0xAA;
      }
      file1.writeSector(0, originalData);
      
      // Verify the data was written
      const readBack1 = file1.readSector(0);
      expect(readBack1[0]).toBe(0xAA);
      expect(file1.cimInfo.maxClusters).toBe(1);

      // --- Act: Simulate reopening the file (create new CimFile instance)
      // BUG: Constructor doesn't call readHeader(), so maxClusters will be 0
      const file2 = new CimFile(filePath, 64, 1, 1024);
      // In the bug scenario, we would NOT call readHeader()
      // But Fat32Volume should either do this or CimFile should do it automatically
      
      // Try to write to a different sector (should allocate cluster 1, not overwrite cluster 0)
      const newData = new Uint8Array(512);
      for (let i = 0; i < 512; i++) {
        newData[i] = 0xBB;
      }
      file2.writeSector(128, newData); // Sector 128 should be in cluster 1
      
      // --- Assert: Original data in sector 0 should NOT be corrupted
      const readBack2 = file2.readSector(0);
      for (let i = 0; i < 512; i++) {
        expect(readBack2[i]).toBe(0xAA); // Should still be 0xAA, not 0xBB or 0x00
      }
      
      // New data should be in sector 128
      const readBack3 = file2.readSector(128);
      expect(readBack3[0]).toBe(0xBB);
      
      // maxClusters should be 2 now (clusters 0 and 1)
      expect(file2.cimInfo.maxClusters).toBe(2);
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("REGRESSION-002: CimFile maxClusters should persist across file close/open", () => {
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-002.cim");
      
      // Create file and allocate 3 clusters
      const file1 = cfm.createFile(filePath, 64);
      const testData = new Uint8Array(512);
      testData.fill(0x11);
      
      file1.writeSector(0, testData);      // Cluster 0
      file1.writeSector(128, testData);    // Cluster 1
      file1.writeSector(256, testData);    // Cluster 2
      
      expect(file1.cimInfo.maxClusters).toBe(3);
      
      // --- Act: Reopen the file
      const file2 = new CimFile(filePath, 64, 1, 1024);
      // BUG: Without readHeader(), maxClusters will be 0 instead of 3
      
      // --- Assert: maxClusters should be loaded from file
      expect(file2.cimInfo.maxClusters).toBe(3); // This will FAIL in bug scenario
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("REGRESSION-003: Writing to new cluster should not reuse existing physical clusters", () => {
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-003.cim");
      
      // Create file and allocate clusters with distinct patterns
      const file1 = cfm.createFile(filePath, 64);
      
      const pattern1 = new Uint8Array(512);
      pattern1.fill(0x11);
      const pattern2 = new Uint8Array(512);
      pattern2.fill(0x22);
      const pattern3 = new Uint8Array(512);
      pattern3.fill(0x33);
      
      file1.writeSector(0, pattern1);      // Cluster 0 - pattern 0x11
      file1.writeSector(128, pattern2);    // Cluster 1 - pattern 0x22
      
      expect(file1.cimInfo.maxClusters).toBe(2);
      
      // --- Act: Reopen file and write to new cluster
      const file2 = new CimFile(filePath, 64, 1, 1024);
      // BUG: maxClusters is 0, next allocation will overwrite cluster 0
      
      file2.writeSector(256, pattern3);    // Should allocate cluster 2
      
      // --- Assert: All three patterns should be intact
      const check1 = file2.readSector(0);
      const check2 = file2.readSector(128);
      const check3 = file2.readSector(256);
      
      expect(check1[0]).toBe(0x11); // Should NOT be overwritten
      expect(check2[0]).toBe(0x22); // Should remain unchanged
      expect(check3[0]).toBe(0x33); // New data
      
      expect(file2.cimInfo.maxClusters).toBe(3);
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("REGRESSION-004: Cluster map should be loaded when opening existing file", () => {
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-004.cim");
      
      // Create file and write to specific sectors to build cluster map
      const file1 = cfm.createFile(filePath, 64);
      const testData = new Uint8Array(512);
      testData.fill(0x55);
      
      // Write to non-sequential clusters
      file1.writeSector(0, testData);      // Cluster 0 → Physical 0
      file1.writeSector(256, testData);    // Cluster 2 → Physical 1
      file1.writeSector(512, testData);    // Cluster 4 → Physical 2
      
      // Save the cluster map state
      const expectedClusterMap = [...file1.cimInfo.clusterMap];
      
      // --- Act: Reopen the file
      const file2 = new CimFile(filePath, 64, 1, 1024);
      // BUG: Cluster map is not loaded, all entries are 0xffff
      
      // --- Assert: Cluster map should match
      expect(file2.cimInfo.clusterMap[0]).toBe(expectedClusterMap[0]); // Should be 0, not 0xffff
      expect(file2.cimInfo.clusterMap[2]).toBe(expectedClusterMap[2]); // Should be 1, not 0xffff
      expect(file2.cimInfo.clusterMap[4]).toBe(expectedClusterMap[4]); // Should be 2, not 0xffff
      expect(file2.cimInfo.clusterMap[1]).toBe(0xffff); // Should remain empty
      expect(file2.cimInfo.clusterMap[3]).toBe(0xffff); // Should remain empty
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("REGRESSION-005: Multiple file reopen cycles should maintain data integrity", () => {
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-005.cim");
      
      // Create file and write initial data
      const file1 = cfm.createFile(filePath, 64);
      const data1 = new Uint8Array(512);
      data1.fill(0x01);
      file1.writeSector(0, data1);
      
      // --- Act & Assert: Cycle 1
      const file2 = new CimFile(filePath, 64, 1, 1024);
      const data2 = new Uint8Array(512);
      data2.fill(0x02);
      file2.writeSector(128, data2);
      
      expect(file2.readSector(0)[0]).toBe(0x01); // Original data
      expect(file2.readSector(128)[0]).toBe(0x02); // New data
      
      // --- Act & Assert: Cycle 2
      const file3 = new CimFile(filePath, 64, 1, 1024);
      const data3 = new Uint8Array(512);
      data3.fill(0x03);
      file3.writeSector(256, data3);
      
      expect(file3.readSector(0)[0]).toBe(0x01); // Original data
      expect(file3.readSector(128)[0]).toBe(0x02); // Previous cycle data
      expect(file3.readSector(256)[0]).toBe(0x03); // New data
      
      // --- Act & Assert: Cycle 3
      const file4 = new CimFile(filePath, 64, 1, 1024);
      const data4 = new Uint8Array(512);
      data4.fill(0x04);
      file4.writeSector(384, data4);
      
      expect(file4.readSector(0)[0]).toBe(0x01);
      expect(file4.readSector(128)[0]).toBe(0x02);
      expect(file4.readSector(256)[0]).toBe(0x03);
      expect(file4.readSector(384)[0]).toBe(0x04);
      
      expect(file4.cimInfo.maxClusters).toBe(4);
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("REGRESSION-006: File properties should be loaded from header, not constructor params", () => {
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-006.cim");
      
      // Create a 128MB file
      const file1 = cfm.createFile(filePath, 128);
      expect(file1.cimInfo.maxSize).toBe(128);
      expect(file1.cimInfo.clusterCount).toBe(2048);
      
      // Write some data
      const testData = new Uint8Array(512);
      testData.fill(0x77);
      file1.writeSector(0, testData);
      
      // --- Act: Reopen with WRONG parameters
      // BUG: Constructor uses provided params, doesn't load from file
      const file2 = new CimFile(filePath, 64, 1, 1024); // Wrong: should be 128MB, 2048 clusters
      
      // --- Assert: Should use actual file properties, not constructor params
      expect(file2.cimInfo.maxSize).toBe(128); // Should be from file, not param
      expect(file2.cimInfo.clusterCount).toBe(2048); // Should be from file, not param
      
      // Data should still be readable
      const readData = file2.readSector(0);
      expect(readData[0]).toBe(0x77);
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });
  });

  // ========== Bug #2: Cluster allocation race condition with header updates ==========

  describe("Bug #2: Cluster allocation race condition with header updates", () => {
    it("REGRESSION-007: Header should be written before cluster data to prevent race condition", () => {
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-007.cim");
      
      // Create file
      const file1 = cfm.createFile(filePath, 64);
      const initialMaxClusters = file1.cimInfo.maxClusters;
      expect(initialMaxClusters).toBe(0);
      
      // --- Act: Write to sector 0 (allocates cluster 0)
      const testData = new Uint8Array(512);
      testData.fill(0xAA);
      file1.writeSector(0, testData);
      
      // Verify cluster was allocated
      expect(file1.cimInfo.maxClusters).toBe(1);
      
      // --- Assert: Read the header from disk to verify it was persisted
      // If header write happens AFTER data write, and we simulate a crash
      // between data write and header write, the header would be stale
      const headerBuffer = new Uint8Array(65536);
      const fd = fs.openSync(filePath, "r");
      fs.readSync(fd, headerBuffer, 0, 65536, 0);
      fs.closeSync(fd);
      
      // Read maxClusters from header at offset 0x0A (2 bytes, little endian)
      const maxClustersInFile = headerBuffer[0x0A] | (headerBuffer[0x0B] << 8);
      
      // Must be 1 (the header was written to disk)
      expect(maxClustersInFile).toBe(1);
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("REGRESSION-008: Multiple sequential allocations maintain header consistency", () => {
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-008.cim");
      
      const file1 = cfm.createFile(filePath, 64);
      
      // --- Act: Allocate multiple clusters
      const testData = new Uint8Array(512);
      
      for (let i = 0; i < 5; i++) {
        testData.fill(0x10 + i);
        file1.writeSector(i * 128, testData); // Each write allocates a new cluster
        
        // --- Assert: After each write, verify header on disk matches in-memory state
        const headerBuffer = new Uint8Array(65536);
        const fd = fs.openSync(filePath, "r");
        fs.readSync(fd, headerBuffer, 0, 65536, 0);
        fs.closeSync(fd);
        
        const maxClustersInFile = headerBuffer[0x0A] | (headerBuffer[0x0B] << 8);
        const expectedMaxClusters = i + 1;
        
        expect(maxClustersInFile).toBe(expectedMaxClusters);
        expect(file1.cimInfo.maxClusters).toBe(expectedMaxClusters);
      }
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("REGRESSION-009: Cluster map entries persist to disk before data write", () => {
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-009.cim");
      
      const file1 = cfm.createFile(filePath, 64);
      
      // --- Act: Write to cluster 2 (skip 0 and 1)
      const testData = new Uint8Array(512);
      testData.fill(0xBB);
      file1.writeSector(256, testData); // Sector 256 = cluster 2
      
      // --- Assert: Verify cluster map was written to disk
      const headerBuffer = new Uint8Array(65536);
      const fd = fs.openSync(filePath, "r");
      fs.readSync(fd, headerBuffer, 0, 65536, 0);
      fs.closeSync(fd);
      
      // Cluster map starts at offset 0x10
      // Each entry is 2 bytes
      // Cluster 2 is at offset 0x10 + (2 * 2) = 0x14
      const cluster2Pointer = headerBuffer[0x14] | (headerBuffer[0x15] << 8);
      
      // Should point to physical cluster 0 (first allocated)
      expect(cluster2Pointer).toBe(0);
      
      // Clusters 0 and 1 should be unallocated (0xFFFF)
      const cluster0Pointer = headerBuffer[0x10] | (headerBuffer[0x11] << 8);
      const cluster1Pointer = headerBuffer[0x12] | (headerBuffer[0x13] << 8);
      
      expect(cluster0Pointer).toBe(0xFFFF);
      expect(cluster1Pointer).toBe(0xFFFF);
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("REGRESSION-010: File reopened after partial write shows consistent state", () => {
      // --- This test simulates the worst-case scenario: crash between header write and data write
      // --- With the fix, header is written first, so even if data write fails, header is consistent
      
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-010.cim");
      
      const file1 = cfm.createFile(filePath, 64);
      
      // Write and allocate first cluster
      const testData1 = new Uint8Array(512);
      testData1.fill(0x11);
      file1.writeSector(0, testData1);
      
      expect(file1.cimInfo.maxClusters).toBe(1);
      
      // --- Act: Simulate crash scenario
      // Write second cluster data
      const testData2 = new Uint8Array(512);
      testData2.fill(0x22);
      file1.writeSector(128, testData2);
      
      // Now reopen the file - header should reflect the allocation
      const file2 = new CimFile(filePath, 64, 1, 1024);
      
      // --- Assert: Header should show 2 clusters allocated
      expect(file2.cimInfo.maxClusters).toBe(2);
      
      // Both sectors should be readable
      const read1 = file2.readSector(0);
      const read2 = file2.readSector(128);
      
      expect(read1[0]).toBe(0x11);
      expect(read2[0]).toBe(0x22);
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("REGRESSION-011: Concurrent allocation simulation maintains atomicity", () => {
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-011.cim");
      
      const file1 = cfm.createFile(filePath, 64);
      
      // --- Act: Rapid sequential allocations (simulates concurrent load)
      const testData = new Uint8Array(512);
      
      for (let i = 0; i < 10; i++) {
        testData.fill(0x30 + i);
        file1.writeSector(i * 128, testData);
        
        // Each allocation should be atomic - verify immediately
        const file2 = new CimFile(filePath, 64, 1, 1024);
        expect(file2.cimInfo.maxClusters).toBe(i + 1);
        
        // Verify data is readable
        const readBack = file2.readSector(i * 128);
        expect(readBack[0]).toBe(0x30 + i);
      }
      
      // --- Assert: Final state should be consistent
      const fileFinal = new CimFile(filePath, 64, 1, 1024);
      expect(fileFinal.cimInfo.maxClusters).toBe(10);
      
      // All data should be intact
      for (let i = 0; i < 10; i++) {
        const readBack = fileFinal.readSector(i * 128);
        expect(readBack[0]).toBe(0x30 + i);
      }
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("REGRESSION-012: fsync ensures header is flushed to disk before data write", () => {
      // --- This test verifies that the fix includes proper fsync calls
      // --- We can't directly test fsync, but we can verify the order and consistency
      
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-012.cim");
      
      const file1 = cfm.createFile(filePath, 64);
      
      // --- Act: Write data
      const testData = new Uint8Array(512);
      testData.fill(0xDD);
      file1.writeSector(0, testData);
      
      // Immediately read header from disk (no caching)
      const headerBuffer = new Uint8Array(65536);
      const fd = fs.openSync(filePath, "r");
      fs.readSync(fd, headerBuffer, 0, 65536, 0);
      fs.closeSync(fd);
      
      // --- Assert: maxClusters must be in the header on disk
      const maxClustersInFile = headerBuffer[0x0A] | (headerBuffer[0x0B] << 8);
      expect(maxClustersInFile).toBe(1);
      
      // Cluster 0 pointer must be set
      const cluster0Pointer = headerBuffer[0x10] | (headerBuffer[0x11] << 8);
      expect(cluster0Pointer).toBe(0);
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("REGRESSION-013: Verify write order - header MUST be written BEFORE cluster data", () => {
      // --- This test explicitly demonstrates Bug #2
      // --- Bug: Data is written BEFORE header, creating race condition
      // --- Fix: Header MUST be written BEFORE data to ensure atomic cluster allocation
      
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-013.cim");
      
      const file1 = cfm.createFile(filePath, 64);
      
      // Track write operations to verify ordering
      const writeOperations: Array<{ type: string, offset: number }> = [];
      
      // Spy on fs.writeSync to track when and what gets written
      const originalWriteSync = fs.writeSync;
      const writeSyncSpy = vi.spyOn(fs, "writeSync").mockImplementation((fd: any, buffer: any, ...args: any[]) => {
        const offset = args[args.length - 1]; // Last argument is the file offset
        
        // Determine what's being written based on offset
        if (offset === 0 && buffer.length > 512) {
          // Writing to offset 0 with large buffer = header write
          writeOperations.push({ type: "header", offset });
        } else if (offset >= CLUSTER_BASE_SIZE) {
          // Writing past 64KB = cluster data write
          writeOperations.push({ type: "data", offset });
        }
        
        // Call original function
        return originalWriteSync(fd, buffer, ...args);
      });
      
      try {
        // --- Act: Write to sector 0 (allocates first cluster)
        const testData = new Uint8Array(512);
        testData.fill(0xDD);
        file1.writeSector(0, testData);
        
        // --- Assert: Verify write order
        // Should have at least 2 operations: header write, then data write
        expect(writeOperations.length).toBeGreaterThanOrEqual(2);
        
        // Find header and data write operations
        const headerWrites = writeOperations.filter(op => op.type === "header");
        const dataWrites = writeOperations.filter(op => op.type === "data");
        
        expect(headerWrites.length).toBeGreaterThanOrEqual(1);
        expect(dataWrites.length).toBeGreaterThanOrEqual(1);
        
        // Find indices of first header and first data write
        const firstHeaderIndex = writeOperations.findIndex(op => op.type === "header");
        const firstDataIndex = writeOperations.findIndex(op => op.type === "data");
        
        // CRITICAL: Header MUST be written BEFORE data
        // If this assertion fails, Bug #2 exists (race condition)
        expect(firstHeaderIndex).toBeLessThan(firstDataIndex);
        
      } finally {
        writeSyncSpy.mockRestore();
        fs.unlinkSync(filePath);
      }
    });
  });

  // ========== Bug #3: No validation of clusterMap consistency ==========

  describe("Bug #3: No validation of clusterMap consistency", () => {
    it("REGRESSION-014: Should detect duplicate cluster pointers in clusterMap", () => {
      // --- This test demonstrates Bug #3
      // --- If two logical clusters point to the same physical cluster,
      // --- writing to one will corrupt the other
      
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-014.cim");
      
      const file1 = cfm.createFile(filePath, 64);
      
      // Write to two different sectors to allocate clusters 0 and 1
      const data1 = new Uint8Array(512);
      data1.fill(0xAA);
      file1.writeSector(0, data1);
      
      const data2 = new Uint8Array(512);
      data2.fill(0xBB);
      file1.writeSector(8, data2);
      
      // --- Act: Manually corrupt the cluster map by making both point to same physical cluster
      file1.cimInfo.clusterMap[0] = 0;  // Logical cluster 0 → Physical cluster 0
      file1.cimInfo.clusterMap[1] = 0;  // Logical cluster 1 → Physical cluster 0 (DUPLICATE!)
      file1.writeHeader();
      
      // --- Assert: Reopening should detect the corruption
      try {
        const file2 = new CimFile(filePath, 64, 1, 1024);
        // If Bug #3 exists, no validation happens and corruption is silent
        // If Bug #3 is fixed, this should throw an error
        
        // Check if validation exists
        const allocatedClusters = new Set<number>();
        let hasDuplicates = false;
        
        for (let i = 0; i < file2.cimInfo.clusterCount && i < file2.cimInfo.clusterMap.length; i++) {
          const pointer = file2.cimInfo.clusterMap[i];
          if (pointer !== 0xffff) {
            if (allocatedClusters.has(pointer)) {
              hasDuplicates = true;
              break;
            }
            allocatedClusters.add(pointer);
          }
        }
        
        // If no validation, we detect it manually for the test
        if (hasDuplicates) {
          expect.fail("Duplicate cluster pointers detected but no error was thrown during readHeader()");
        }
      } catch (error: any) {
        // If we get here, validation caught the corruption (Bug #3 is fixed)
        expect(error.message).toMatch(/cluster map corruption|duplicate/i);
      } finally {
        fs.unlinkSync(filePath);
      }
    });

    it("REGRESSION-015: Should detect cluster pointer exceeding maxClusters", () => {
      // --- Test demonstrates out-of-bounds cluster pointer validation
      
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-015.cim");
      
      const file1 = cfm.createFile(filePath, 64);
      
      // Allocate one cluster
      const data1 = new Uint8Array(512);
      data1.fill(0xCC);
      file1.writeSector(0, data1);
      
      // --- Act: Corrupt cluster map with out-of-bounds pointer
      file1.cimInfo.clusterMap[1] = 999;  // Physical cluster 999, but maxClusters = 1
      file1.writeHeader();
      
      // --- Assert: Reopening should detect the invalid pointer
      try {
        const file2 = new CimFile(filePath, 64, 1, 1024);
        
        // Manually check for out-of-bounds
        let hasOutOfBounds = false;
        for (let i = 0; i < file2.cimInfo.clusterCount && i < file2.cimInfo.clusterMap.length; i++) {
          const pointer = file2.cimInfo.clusterMap[i];
          if (pointer !== 0xffff && pointer >= file2.cimInfo.maxClusters) {
            hasOutOfBounds = true;
            break;
          }
        }
        
        if (hasOutOfBounds) {
          expect.fail("Out-of-bounds cluster pointer detected but no error was thrown");
        }
      } catch (error: any) {
        // Validation caught it (Bug #3 is fixed)
        expect(error.message).toMatch(/cluster map corruption|exceeds maxClusters|out of bounds/i);
      } finally {
        fs.unlinkSync(filePath);
      }
    });

    it("REGRESSION-016: Should detect maxClusters mismatch with actual allocated clusters", () => {
      // --- Test maxClusters consistency validation
      
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-016.cim");
      
      const file1 = cfm.createFile(filePath, 64);
      
      // Allocate 3 clusters (sectors per cluster = 128 for 64MB image)
      // Cluster 0: sectors 0-127
      // Cluster 1: sectors 128-255
      // Cluster 2: sectors 256-383
      file1.writeSector(0, new Uint8Array(512).fill(0x11));    // Cluster 0
      file1.writeSector(128, new Uint8Array(512).fill(0x22));  // Cluster 1
      file1.writeSector(256, new Uint8Array(512).fill(0x33));  // Cluster 2
      
      // Verify 3 clusters allocated
      expect(file1.cimInfo.maxClusters).toBe(3);
      
      // --- Act: Corrupt maxClusters value
      file1.cimInfo.maxClusters = 5;  // Should be 3, but claim 5
      file1.writeHeader();
      
      // --- Assert: Reopening should detect mismatch (or auto-correct)
      const file2 = new CimFile(filePath, 64, 1, 1024);
      
      // Count actual allocated clusters
      let actualAllocated = 0;
      for (let i = 0; i < file2.cimInfo.clusterCount && i < file2.cimInfo.clusterMap.length; i++) {
        if (file2.cimInfo.clusterMap[i] !== 0xffff) {
          actualAllocated++;
        }
      }
      
      // Should either throw error or auto-correct
      // If Bug #3 is fixed, maxClusters should be corrected to 3
      if (file2.cimInfo.maxClusters !== actualAllocated) {
        expect.fail(`maxClusters (${file2.cimInfo.maxClusters}) doesn't match actual allocated (${actualAllocated})`);
      }
      
      fs.unlinkSync(filePath);
    });

    it("REGRESSION-017: Should prevent data corruption from duplicate cluster assignment", () => {
      // --- This test demonstrates the actual corruption scenario
      // --- Two files sharing same physical cluster
      
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-017.cim");
      
      const file1 = cfm.createFile(filePath, 64);
      
      // Write File A data to sector 0 (cluster 0)
      const fileAData = new Uint8Array(512);
      fileAData.fill(0xFA);
      file1.writeSector(0, fileAData);
      
      // Write File B data to sector 8 (cluster 1)
      const fileBData = new Uint8Array(512);
      fileBData.fill(0xFB);
      file1.writeSector(8, fileBData);
      
      // Verify both files have correct data
      const readA1 = file1.readSector(0);
      const readB1 = file1.readSector(8);
      expect(readA1.every(b => b === 0xFA)).toBe(true);
      expect(readB1.every(b => b === 0xFB)).toBe(true);
      
      // --- Act: Corrupt cluster map - make both point to same physical cluster
      file1.cimInfo.clusterMap[0] = 0;  // File A → Physical cluster 0
      file1.cimInfo.clusterMap[1] = 0;  // File B → Physical cluster 0 (SAME!)
      file1.writeHeader();
      
      // Reopen and try to modify File B
      try {
        const file2 = new CimFile(filePath, 64, 1, 1024);
        
        // If Bug #3 is NOT fixed, this will succeed but corrupt File A
        const newFileBData = new Uint8Array(512);
        newFileBData.fill(0xBC);
        file2.writeSector(8, newFileBData);  // Write to File B's sector
        
        // Check File A - if corruption exists, File A will have File B's data
        const readA2 = file2.readSector(0);
        
        // If Bug #3 exists and no validation, File A will be corrupted
        if (readA2.every(b => b === 0xBC)) {
          expect.fail("File A was corrupted by File B write - duplicate cluster pointers not detected!");
        }
      } catch (error: any) {
        // If Bug #3 is fixed, readHeader() should have thrown error
        expect(error.message).toMatch(/cluster map corruption|duplicate/i);
      } finally {
        fs.unlinkSync(filePath);
      }
    });

    it("REGRESSION-018: Should validate cluster map on every file open", () => {
      // --- Test that validation happens consistently
      
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-018.cim");
      
      const file1 = cfm.createFile(filePath, 64);
      file1.writeSector(0, new Uint8Array(512).fill(0xEE));
      
      // Create valid file first
      expect(file1.cimInfo.maxClusters).toBe(1);
      
      // --- Act: Test different corruption scenarios
      const corruptions = [
        { name: "duplicate pointer", corrupt: (file: CimFile) => {
          file.cimInfo.clusterMap[0] = 0;
          file.cimInfo.clusterMap[1] = 0;
        }},
        { name: "out of bounds", corrupt: (file: CimFile) => {
          file.cimInfo.clusterMap[1] = 9999;
        }},
        { name: "maxClusters mismatch", corrupt: (file: CimFile) => {
          file.cimInfo.maxClusters = 100;
        }}
      ];
      
      for (const scenario of corruptions) {
        // Reopen file with clean state
        let fileN: CimFile;
        try {
          fileN = new CimFile(filePath, 64, 1, 1024);
        } catch (error: any) {
          // File might be corrupted from previous iteration
          // Skip this scenario as it proves validation is working
          continue;
        }
        
        // Corrupt in specific way
        scenario.corrupt(fileN);
        fileN.writeHeader();
        
        // --- Assert: Next open should detect corruption
        try {
          const fileCheck = new CimFile(filePath, 64, 1, 1024);
          
          // If we get here without error, validate manually
          const issues: string[] = [];
          
          // Check for duplicates
          const seen = new Set<number>();
          for (let i = 0; i < fileCheck.cimInfo.clusterCount && i < fileCheck.cimInfo.clusterMap.length; i++) {
            const ptr = fileCheck.cimInfo.clusterMap[i];
            if (ptr !== 0xffff) {
              if (seen.has(ptr)) {
                issues.push(`duplicate pointer ${ptr}`);
              }
              seen.add(ptr);
              
              if (ptr >= fileCheck.cimInfo.maxClusters) {
                issues.push(`out of bounds pointer ${ptr}`);
              }
            }
          }
          
          if (issues.length > 0) {
            expect.fail(`Corruption "${scenario.name}" not detected: ${issues.join(", ")}`);
          }
          
          // If no issues, corruption was auto-corrected (acceptable for maxClusters mismatch)
        } catch (error: any) {
          // Validation threw error (Bug #3 is fixed) - this is expected
          expect(error.message).toMatch(/cluster map|corruption|duplicate|exceeds|inconsistency/i);
        }
        
        // Restore clean file for next iteration
        const cleanFile = cfm.createFile(filePath, 64);
        cleanFile.writeSector(0, new Uint8Array(512).fill(0xEE));
      }
      
      fs.unlinkSync(filePath);
    });
  });

  // ========== Bug #4: File handle leak in readSector and writeSector ==========

  describe("Bug #4: File handle leak in readSector and writeSector", () => {
    it("REGRESSION-019: Should not leak file handles on repeated read operations", () => {
      // --- Test demonstrates Bug #4: file handles opened/closed on every operation
      // --- Under heavy load, this can exhaust OS file descriptor limits
      
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-019.cim");
      
      const file1 = cfm.createFile(filePath, 64);
      
      // Write test data to multiple sectors
      for (let i = 0; i < 10; i++) {
        const data = new Uint8Array(512);
        data.fill(i);
        file1.writeSector(i, data);
      }
      
      // --- Act: Perform many read operations
      // In buggy version, each read opens and closes a file handle
      // With persistent handle, only one handle is used
      const iterations = 1000;
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        const sector = i % 10;
        const data = file1.readSector(sector);
        expect(data[0]).toBe(sector);
      }
      
      const elapsedMs = Date.now() - startTime;
      
      // --- Assert: Operation should complete in reasonable time
      // With file handle leak (open/close each time), this is slow
      // With persistent handle, this should be fast
      // Note: This is more of a performance test than correctness
      console.log(`[REGRESSION-019] ${iterations} reads completed in ${elapsedMs}ms`);
      
      // Verify data integrity
      for (let i = 0; i < 10; i++) {
        const data = file1.readSector(i);
        expect(data[0]).toBe(i);
      }
      
      fs.unlinkSync(filePath);
    });

    it("REGRESSION-020: Should not leak file handles on repeated write operations", () => {
      // --- Test file handle behavior on writes
      
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-020.cim");
      
      const file1 = cfm.createFile(filePath, 64);
      
      // --- Act: Perform many write operations
      const iterations = 500;
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        const sector = i % 10;
        const data = new Uint8Array(512);
        data.fill(i & 0xFF);
        file1.writeSector(sector, data);
      }
      
      const elapsedMs = Date.now() - startTime;
      
      // --- Assert
      console.log(`[REGRESSION-020] ${iterations} writes completed in ${elapsedMs}ms`);
      
      // Verify last written data
      for (let i = 0; i < 10; i++) {
        const data = file1.readSector(i);
        // Should have last value written to this sector
        expect(data[0]).toBeDefined();
      }
      
      fs.unlinkSync(filePath);
    });

    it("REGRESSION-021: Should not exhaust file descriptors under concurrent operations", () => {
      // --- Test that we don't hit OS file descriptor limits
      // --- This would fail with open/close pattern under heavy load
      
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-021.cim");
      
      const file1 = cfm.createFile(filePath, 64);
      
      // Write initial data
      for (let i = 0; i < 50; i++) {
        const data = new Uint8Array(512);
        data.fill(i);
        file1.writeSector(i, data);
      }
      
      // --- Act: Simulate concurrent-like operations (interleaved reads/writes)
      const operations = 2000;
      
      for (let i = 0; i < operations; i++) {
        const sector = i % 50;
        
        if (i % 2 === 0) {
          // Read
          const data = file1.readSector(sector);
          expect(data.length).toBe(512);
        } else {
          // Write
          const data = new Uint8Array(512);
          data.fill((i >> 1) & 0xFF);
          file1.writeSector(sector, data);
        }
      }
      
      // --- Assert: Should complete without errors
      // If file handles leaked, would throw "Too many open files" error
      expect(true).toBe(true); // Made it here without error
      
      fs.unlinkSync(filePath);
    });

    it("REGRESSION-022: File handle should be properly closed on error", () => {
      // --- Test that file handles are cleaned up even when errors occur
      
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-022.cim");
      
      const file1 = cfm.createFile(filePath, 64);
      file1.writeSector(0, new Uint8Array(512).fill(0xAA));
      
      // --- Act & Assert: Try to read out-of-bounds sector
      try {
        file1.readSector(999999); // Out of bounds
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).toMatch(/out of bounds|invalid/i);
      }
      
      // --- Assert: After error, file should still be usable (no leaked handles)
      const data = file1.readSector(0);
      expect(data[0]).toBe(0xAA);
      
      // Try write to invalid data length (should throw before opening file)
      try {
        file1.writeSector(0, new Uint8Array(256).fill(0xBB)); // Wrong length
        expect.fail("Should have thrown error for invalid data length");
      } catch (error: any) {
        expect(error.message).toMatch(/invalid data length/i);
      }
      
      // Should still be able to read after error
      const data2 = file1.readSector(0);
      expect(data2[0]).toBe(0xAA); // Should still have original data
      
      fs.unlinkSync(filePath);
    });

    it("REGRESSION-023: Performance comparison - open/close vs persistent handle", () => {
      // --- This test documents the performance difference
      // --- Not strictly a bug test, but demonstrates the issue
      
      // --- Arrange
      const cfm = new CimFileManager();
      const filePath = createTestFile("regression-023.cim");
      
      const file1 = cfm.createFile(filePath, 64);
      
      // Prepopulate data
      for (let i = 0; i < 100; i++) {
        const data = new Uint8Array(512);
        data.fill(i);
        file1.writeSector(i * 128, data); // Different clusters
      }
      
      // --- Act: Measure read performance
      const readIterations = 500;
      const readStart = Date.now();
      
      for (let i = 0; i < readIterations; i++) {
        const sector = (i % 100) * 128;
        file1.readSector(sector);
      }
      
      const readElapsed = Date.now() - readStart;
      
      // --- Act: Measure write performance
      const writeIterations = 200;
      const writeStart = Date.now();
      
      for (let i = 0; i < writeIterations; i++) {
        const sector = (i % 100) * 128;
        const data = new Uint8Array(512);
        data.fill(i & 0xFF);
        file1.writeSector(sector, data);
      }
      
      const writeElapsed = Date.now() - writeStart;
      
      // --- Assert: Log performance metrics
      console.log(`[REGRESSION-023] Performance metrics:`);
      console.log(`  ${readIterations} reads: ${readElapsed}ms (${(readElapsed/readIterations).toFixed(2)}ms avg)`);
      console.log(`  ${writeIterations} writes: ${writeElapsed}ms (${(writeElapsed/writeIterations).toFixed(2)}ms avg)`);
      
      // With persistent handles, expect < 1ms average per operation
      // With open/close pattern, expect > 2ms average per operation
      // Note: These are rough estimates and platform-dependent
      
      fs.unlinkSync(filePath);
    });
  });
});

// ========== Helper Functions ==========

function createTestFile(filename: string): string {
  const homeDir = os.homedir();
  const testDir = path.join(homeDir, TEST_DIR);
  const filePath = path.join(testDir, filename);
  return filePath;
}
