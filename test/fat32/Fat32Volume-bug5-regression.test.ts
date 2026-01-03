import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Fat32Volume } from "../../src/main/fat32/Fat32Volume";
import { CimFileManager } from "../../src/main/fat32/CimFileManager";

const TEST_DIR = "testFat32";
const SIZE_IN_MB = 64;

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
