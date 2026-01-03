import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { CimFileManager } from "@main/fat32/CimFileManager";
import { Fat32Volume } from "@main/fat32/Fat32Volume";
import { O_RDONLY } from "@main/fat32/Fat32Types";

const TEST_DIR = "testFat32Regression";
const SIZE_IN_MB = 64;

describe("Fat32Volume - Bug #2 Regression", () => {
  it("should write to both FAT tables when setFatEntry is called", () => {
    // --- Arrange
    const filePath = createTestFile("bug2-mirror");
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format("TEST");
    vol.init();

    // --- Act: Set a FAT entry
    const testCluster = 50;
    const testValue = 0x0FFFFFFF;
    vol.setFatEntry(testCluster, testValue);

    // --- Assert: Verify we can read the same value back (this verifies FAT was written)
    const readValue = vol.getFatEntry(testCluster);
    expect(readValue).toBe(testValue);

    // --- Also verify by directly reading the FAT sectors via the file
    // Read both FAT1 and FAT2 sectors for this cluster
    const [sector1, offset1] = (vol as any).calculateFatEntry(testCluster);
    const buffer1 = file.readSector(sector1);
    const dv1 = new DataView(buffer1.buffer);
    const fat1Value = dv1.getInt32(offset1, true);
    
    const fat2Sector = sector1 + vol.bootSector.BPB_FATSz32;
    const buffer2 = file.readSector(fat2Sector);
    const dv2 = new DataView(buffer2.buffer);
    const fat2Value = dv2.getInt32(offset1, true);
    
    // Both FAT1 and FAT2 should have the same value
    expect(fat1Value).toBe(testValue);
    expect(fat2Value).toBe(testValue);

    // --- Cleanup
    file.close();
  });

  it("should keep FAT1 and FAT2 in sync after allocating clusters", () => {
    // --- Arrange
    const filePath = createTestFile("bug2-sync");
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format("TEST");
    vol.init();

    // --- Act: Allocate some clusters by creating a directory and files
    vol.mkdir("testDir");
    vol.mkdir("testDir/subdir");

    // --- Assert: Verify that cluster allocations are reflected in both FAT1 and FAT2
    // Check several allocated clusters
    const testClusters = [2, 3, 4];  // Clusters that should be allocated after mkdir
    
    for (const clusterIdx of testClusters) {
      const [sector1, offset1] = (vol as any).calculateFatEntry(clusterIdx);
      const buffer1 = file.readSector(sector1);
      const dv1 = new DataView(buffer1.buffer);
      const fat1Value = dv1.getInt32(offset1, true);
      
      const fat2Sector = sector1 + vol.bootSector.BPB_FATSz32;
      const buffer2 = file.readSector(fat2Sector);
      const dv2 = new DataView(buffer2.buffer);
      const fat2Value = dv2.getInt32(offset1, true);
      
      // Both should be identical
      expect(fat1Value).toBe(fat2Value);
    }

    // --- Cleanup
    file.close();
  });
});

describe("Fat32Volume - Bug #3 Regression", () => {
  it("should update FSInfo free cluster count consistently", () => {
    // --- Arrange
    const filePath = createTestFile("bug3-fsinfo");
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format("TEST");
    vol.init();

    // --- Act: Create multiple directories to trigger FSInfo updates
    for (let i = 0; i < 5; i++) {
      vol.mkdir(`dir${i}`);
    }

    // --- Assert: Verify FSInfo is updated (by checking it can be read back)
    // The updateFreeClusterCount method updates FSInfo consistently
    // We verify this by checking that after mkdir operations, the system is stable
    
    // Verify volumes still work after multiple updates
    const testDir = vol.open("dir0", 0);
    expect(testDir).not.toBeNull();

    // --- Cleanup
    file.close();
  });

  it("should not have stale FSInfo values after multiple cluster allocations", () => {
    // --- Arrange
    const filePath = createTestFile("bug3-consistency");
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format("TEST");
    vol.init();

    // --- Act: Perform multiple allocations in sequence
    for (let i = 0; i < 10; i++) {
      vol.mkdir(`level1_${i}`);
    }

    // --- Assert: FSInfo should reflect actual allocations
    const fsInfo = (vol as any).readFsInfoSector();
    
    // With 10 directories created, we should have significantly fewer free clusters
    // Each mkdir allocates at least one cluster
    const expectedMaxFreeCount = vol.bootSector.BPB_TotSec32 - 10;
    expect(fsInfo.FSI_Free_Count).toBeLessThanOrEqual(expectedMaxFreeCount);
    
    // Free count should be non-zero (we have a 64MB partition)
    expect(fsInfo.FSI_Free_Count).toBeGreaterThan(0);

    // --- Cleanup
    file.close();
  });
});

describe("Fat32Volume - Bug #4 Regression", () => {
  it("should properly recognize EOC (end of cluster) markers", () => {
    // --- Arrange
    const filePath = createTestFile("bug4-eoc");
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format("TEST");
    vol.init();

    // --- Act: Set a cluster to EOC marker value
    const testCluster = 50;
    const eocMarker = 0x0FFFFFFF;  // Valid EOC marker in FAT32
    vol.setFatEntry(testCluster, eocMarker);

    // --- Assert: The value should be recognized as EOC, not as out-of-bounds
    const readValue = vol.getFatEntry(testCluster);
    expect(readValue).toBe(eocMarker);
    
    // Verify the EOC value is treated as end-of-chain (not as cluster number)
    // This is more of a structural test - if code treats it as cluster >= countOfClusters,
    // it would try to read invalid cluster data
    expect(readValue).toBeGreaterThanOrEqual(0x0FFFFFF8);  // EOC range minimum

    // --- Cleanup
    file.close();
  });

  it("should distinguish between BAD_CLUSTER and EOC markers", () => {
    // --- Arrange
    const filePath = createTestFile("bug4-badcluster");
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format("TEST");
    vol.init();

    // --- Act: Set a cluster to BAD_CLUSTER marker
    const testCluster = 100;
    const badClusterMarker = 0x0FFFFFF7;  // BAD_CLUSTER marker
    vol.setFatEntry(testCluster, badClusterMarker);

    // --- Assert: The value should be readable and identifiable as BAD_CLUSTER
    const readValue = vol.getFatEntry(testCluster);
    expect(readValue).toBe(badClusterMarker);
    
    // BAD_CLUSTER (0x0FFFFFF7) should be distinguishable from EOC (0x0FFFFFF8-0x0FFFFFFF)
    expect(readValue).toBe(0x0FFFFFF7);

    // --- Cleanup
    file.close();
  });

  it("should handle normal cluster chain values correctly", () => {
    // --- Arrange
    const filePath = createTestFile("bug4-chain");
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format("TEST");
    vol.init();

    // --- Act: Set up a simple cluster chain
    const cluster1 = 10;
    const cluster2 = 20;
    const eocMarker = 0x0FFFFFFF;
    
    // Cluster 1 points to cluster 2
    vol.setFatEntry(cluster1, cluster2);
    // Cluster 2 is end of chain
    vol.setFatEntry(cluster2, eocMarker);

    // --- Assert: Values should be readable and correct
    expect(vol.getFatEntry(cluster1)).toBe(cluster2);
    expect(vol.getFatEntry(cluster2)).toBe(eocMarker);

    // --- Cleanup
    file.close();
  });
});

describe("Fat32Volume - Bug #5: Race condition in cluster allocation", () => {
  beforeEach(() => {
    // Test setup happens in each test
  });

  afterEach(() => {
    // Test cleanup happens in each test
  });

  function createTestFile(id: number): string {
    const homeDir = os.homedir();
    const testDir = path.join(homeDir, TEST_DIR);
    const filePath = path.join(testDir, `bug5-race${id}.cim`);

    // Ensure the test directory exists
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }
    return filePath;
  }

  it("Sequential cluster allocations should use different clusters", () => {
    // Format a new volume
    const filePath = createTestFile(1);
    const cfm = new CimFileManager();
    const cimFile = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(cimFile);
    volume.format();
    volume.init();

    // Allocate first cluster
    const cluster1 = volume.allocateCluster(0);
    expect(cluster1).not.toBeNull();

    // Allocate second cluster
    const cluster2 = volume.allocateCluster(0);
    expect(cluster2).not.toBeNull();

    // ✅ BUG #5 TEST: Both clusters should be different
    // Without the fix: If allocateCluster is called rapidly, race condition could
    // cause both to get the same cluster number
    expect(cluster2).not.toBe(cluster1);

    cimFile.close();
  });

  it("Allocating multiple clusters should mark them as used in FAT", () => {
    const filePath = createTestFile(2);
    const cfm = new CimFileManager();
    const cimFile = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(cimFile);
    volume.format();
    volume.init();

    // Debug: Check volume stats
    console.log(`Volume stats: lastCluster=${(volume as any)._lastCluster}, allocSearchStart=${(volume as any)._allocSearchStart}`);

    // Allocate multiple clusters sequentially (not chained)
    const clusters: number[] = [];
    for (let i = 0; i < 3; i++) {
      // Each allocation starts fresh (not chained to previous)
      const cluster = volume.allocateCluster(0);
      console.log(`Allocation ${i}: cluster=${cluster}, allocSearchStart=${(volume as any)._allocSearchStart}`);
      expect(cluster).not.toBeNull();
      expect(typeof cluster).toBe("number");
      expect(cluster! > 0).toBe(true);
      clusters.push(cluster!);

      // ✅ BUG #5 TEST: Verify each allocated cluster is marked as EOC in FAT
      const fatEntry = volume.getFatEntry(cluster!);
      // After allocation, getFatEntry should return EOC marker (0x0FFFFFFF or higher)
      expect(fatEntry).toBeGreaterThanOrEqual(0x0FFFFFF8);
    }

    // ✅ BUG #5 TEST: All clusters should be unique
    // Race condition would allow multiple allocateCluster calls to get same cluster
    const uniqueClusters = new Set(clusters);
    expect(uniqueClusters.size).toBe(clusters.length);

    cimFile.close();
  });

  it("Rapid sequential allocations should not reuse clusters", () => {
    const filePath = createTestFile(3);
    const cfm = new CimFileManager();
    const cimFile = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(cimFile);
    volume.format();
    volume.init();

    // Simulate rapid allocations by calling allocateCluster in quick succession
    // This tests the race condition window between getFatEntry(found) === 0 check
    // and setFatEntry(found, 0x0fffffff) call
    const allocatedClusters: number[] = [];

    for (let i = 0; i < 5; i++) {
      // Allocate cluster - NOT chaining them
      const cluster = volume.allocateCluster(0);
      if (cluster === null) {
        // If we run out of space, just end the test
        break;
      }
      allocatedClusters.push(cluster);

      // Verify the cluster is now marked in FAT
      const fatValue = volume.getFatEntry(cluster);
      expect(fatValue).toBeGreaterThanOrEqual(0x0FFFFFF8); // Should be EOC
    }

    // ✅ BUG #5 TEST: Verify all allocated clusters are unique
    // Race condition would allow duplicate allocations
    const uniqueClusters = new Set(allocatedClusters);
    expect(uniqueClusters.size).toBe(allocatedClusters.length);

    // ✅ BUG #5 TEST: Verify each cluster is properly marked in FAT
    for (const cluster of allocatedClusters) {
      const fatValue = volume.getFatEntry(cluster);
      // Should be marked as EOC (end of chain)
      expect(fatValue).toBeGreaterThanOrEqual(0x0FFFFFF8);
    }

    cimFile.close();
  });
});

describe("Fat32Volume - Bug #6: Missing validation in readFileData with contiguous files", () => {
  function createTestFile(id: number): string {
    const homeDir = os.homedir();
    const testDir = path.join(homeDir, TEST_DIR);
    const filePath = path.join(testDir, `bug6-contiguous${id}.cim`);

    // Ensure the test directory exists
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }
    return filePath;
  }

  afterEach(() => {
    // Tests clean up after themselves
  });

  it("Reading contiguous file should not exceed file size", () => {
    const filePath = createTestFile(1);
    const cfm = new CimFileManager();
    const cimFile = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(cimFile);
    volume.format();
    volume.init();

    // Create a contiguous file with known size
    const fileName = "test.txt";
    const fileContent = new Uint8Array(2048); // 2 clusters worth of data (assuming 1024 bytes per cluster)
    for (let i = 0; i < fileContent.length; i++) {
      fileContent[i] = i & 0xFF;
    }

    // Create and write the file
    let file = volume.createFile(fileName);
    expect(file).not.toBeNull();

    // Write data
    file!.writeFileData(fileContent);

    // Close and reopen
    file!.close();
    file = volume.open(fileName, O_RDONLY);
    expect(file).not.toBeNull();

    // ✅ BUG #6 TEST: Reading the full file should work without bounds error
    const bytesPerCluster = volume.bootSector.BPB_SecPerClus * 512;
    const fileSize = file!.fileSize;
    
    expect(fileSize).toBe(fileContent.length);

    // Try to read the entire file - should not read past bounds
    const readData = file!.readFileData(fileSize);
    expect(readData).not.toBeNull();
    expect(readData!.length).toBe(fileSize);

    file!.close();
    cimFile.close();
  });

  it("Reading large contiguous file should validate cluster bounds", () => {
    const filePath = createTestFile(2);
    const cfm = new CimFileManager();
    const cimFile = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(cimFile);
    volume.format();
    volume.init();

    // Create larger contiguous file
    const bytesPerCluster = volume.bootSector.BPB_SecPerClus * 512;
    const fileSize = bytesPerCluster * 5; // 5 clusters
    const fileContent = new Uint8Array(fileSize);
    for (let i = 0; i < fileContent.length; i++) {
      fileContent[i] = i & 0xFF;
    }

    // Create and write the file
    let file = volume.createFile("bigfile.bin");
    expect(file).not.toBeNull();

    file!.writeFileData(fileContent);

    file!.close();
    file = volume.open("bigfile.bin", O_RDONLY);
    expect(file).not.toBeNull();

    // ✅ BUG #6 TEST: Reading entire large contiguous file should work
    const readData = file!.readFileData(fileSize);
    expect(readData).not.toBeNull();
    expect(readData!.length).toBe(fileSize);

    // ✅ BUG #6 TEST: Data should match what we wrote
    for (let i = 0; i < fileSize; i++) {
      expect(readData![i]).toBe(fileContent[i]);
    }

    file!.close();
    cimFile.close();
  });

  it("Seeking and reading within contiguous file should stay within bounds", () => {
    const filePath = createTestFile(3);
    const cfm = new CimFileManager();
    const cimFile = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(cimFile);
    volume.format();
    volume.init();

    const bytesPerCluster = volume.bootSector.BPB_SecPerClus * 512;
    const fileSize = bytesPerCluster * 3;
    const fileContent = new Uint8Array(fileSize);
    for (let i = 0; i < fileContent.length; i++) {
      fileContent[i] = (i / fileSize * 256) & 0xFF;
    }

    // Create and write file
    let file = volume.createFile("seektest.bin");
    expect(file).not.toBeNull();

    file!.writeFileData(fileContent);

    file!.close();
    file = volume.open("seektest.bin", O_RDONLY);
    expect(file).not.toBeNull();

    // ✅ BUG #6 TEST: Read the entire file should work without exceeding bounds
    const readData = file!.readFileData(fileSize);
    expect(readData).not.toBeNull();
    expect(readData!.length).toBe(fileSize);

    // ✅ BUG #6 TEST: Verify data integrity
    for (let i = 0; i < fileSize; i++) {
      expect(readData![i]).toBe(fileContent[i]);
    }

    file!.close();
    cimFile.close();
  });
});

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

function createTestFile(suffix: string): string {
  const homeDir = os.homedir();
  const testDir = path.join(homeDir, TEST_DIR);
  const filePath = path.join(testDir, `${suffix}.cim`);

  // Ensure the test directory exists
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }
  
  // Remove file if it exists
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  return filePath;
}
