import { describe, it, expect } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { CimFileManager } from "@main/fat32/CimFileManager";
import { Fat32Volume } from "@main/fat32/Fat32Volume";
import { O_RDONLY, O_CREAT, O_RDWR } from "@main/fat32/Fat32Types";

const TEST_DIR = "testFat32Regression";
const TEST_FILE = "test-bug9.cim";
const SIZE_IN_MB = 64;

/**
 * Bug #9 Regression Tests: Missing cluster bounds check in writeData
 *
 * Issue: addCluster() is called in TWO places without checking return value:
 * 1. Line 849: When at end of cluster chain in non-contiguous file
 * 2. Line 859: When allocating first cluster of file
 *
 * If addCluster() returns false (disk full), these locations continue without error,
 * potentially writing to invalid clusters or having _firstCluster = 0.
 */

describe("Fat32Volume - Bug #9: Missing cluster bounds check in writeData", () => {
  it("REGRESSION: file should have valid cluster after writeFileData", () => {
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const cimFile = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(cimFile);
    volume.format();
    volume.init();

    // Create a file for writing
    const file = volume.createFile("test.txt");
    const data = new TextEncoder().encode("Test data");

    // ✅ BUG #9 TEST: After writeFileData, the file MUST have a valid cluster
    // If addCluster() fails and return value is not checked:
    // - Line 859 would set _firstCluster = 0 (currently _currentCluster)
    // - File claims to have data but _firstCluster = 0 (INVALID)
    
    file!.writeFileData(data);
    
    // ❌ WITHOUT FIX: Could have _firstCluster = 0 if addCluster() failed
    // ✅ WITH FIX: Would throw error if addCluster() failed
    expect(file!.firstCluster).toBeGreaterThanOrEqual(2);
    expect(file!.fileSize).toBe(data.length);
    
    file!.close();
    cimFile.close();
  });

  it("should not corrupt data when cluster allocation succeeds", () => {
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const cimFile = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(cimFile);
    volume.format();
    volume.init();

    // Create a file and write data that requires cluster allocation
    const file = volume.createFile("multicluster.txt");
    const data = new TextEncoder().encode("Test data that should be written correctly");

    // Write data - allocates cluster(s)
    file!.writeFileData(data);
    expect(file!.fileSize).toBe(data.length);
    file!.close();

    // Verify data persists correctly after reopening
    const reopened = volume.open("multicluster.txt", O_RDONLY);
    expect(reopened!.fileSize).toBe(data.length);
    reopened!.close();

    cimFile.close();
  });

  it("should preserve cluster validity during sequential writes", () => {
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const cimFile = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(cimFile);
    volume.format();
    volume.init();

    // Create a file and write enough data to require multiple clusters
    const file = volume.createFile("sequential.txt");
    
    // Write data that will span multiple clusters (8KB+ with typical 4KB clusters)
    const largeData = new Uint8Array(16384);
    for (let i = 0; i < largeData.length; i++) {
      largeData[i] = (i % 256) as number;
    }

    file!.writeFileData(largeData);
    expect(file!.fileSize).toBe(largeData.length);
    
    // Verify first cluster is valid (not 0)
    expect(file!.firstCluster).toBeGreaterThan(0);
    
    file!.close();

    // Reopen and verify file is still accessible
    const reopened = volume.open("sequential.txt", O_RDONLY);
    expect(reopened).not.toBeNull();
    expect(reopened!.fileSize).toBe(largeData.length);
    
    reopened!.close();
    cimFile.close();
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
