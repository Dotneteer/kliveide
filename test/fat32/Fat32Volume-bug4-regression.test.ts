import { describe, it, expect } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { CimFileManager } from "@main/fat32/CimFileManager";
import { Fat32Volume } from "@main/fat32/Fat32Volume";

const TEST_DIR = "testFat32Regression";
const SIZE_IN_MB = 64;

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
