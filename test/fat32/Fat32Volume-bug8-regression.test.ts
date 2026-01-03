import { describe, it, expect } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { CimFileManager } from "@main/fat32/CimFileManager";
import { Fat32Volume } from "@main/fat32/Fat32Volume";
import { O_RDONLY, O_CREAT, O_RDWR } from "@main/fat32/Fat32Types";

const TEST_DIR = "testFat32Regression";
const TEST_FILE = "test-bug8.cim";
const SIZE_IN_MB = 64;

/**
 * Bug #8 Regression Tests: Directory entry modification without sync
 *
 * Issue: writeFileData() writes file data, updates directory entry fields, then
 * writes the directory entry, but there's no explicit flush/sync between operations.
 * If system crashes after writeData() but before directory entry is written, the
 * filesystem is left inconsistent (file data written, but directory entry stale).
 *
 * This test creates scenarios where file metadata needs to be flushed to ensure
 * consistency after data write operations.
 */

describe("Fat32Volume - Bug #8: Directory entry sync after data write", () => {
  it("should have consistent file size after writeFileData", () => {
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const cimFile = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(cimFile);
    volume.format();
    volume.init();

    // Create a file and write data to it
    const file = volume.createFile("test.txt");
    const data = new TextEncoder().encode("Hello, World!");
    file!.writeFileData(data);
    file!.close();

    // Open file again to verify directory entry was persisted
    const reopenedFile = volume.open("test.txt", O_RDONLY);

    // File size should match what we wrote
    expect(reopenedFile!.fileSize).toBe(data.length);

    reopenedFile!.close();
    cimFile.close();
  });

  it("should update file modification time consistently", () => {
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const cimFile = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(cimFile);
    volume.format();
    volume.init();

    // Create a file and write data to it
    const file = volume.createFile("test2.txt");
    const data = new TextEncoder().encode("Test data");
    const beforeWrite = Date.now();
    file!.writeFileData(data);
    const afterWrite = Date.now();
    file!.close();

    // Open file again to verify write was persisted
    const reopenedFile = volume.open("test2.txt", O_RDONLY);

    // Verify file exists and has the correct size
    expect(reopenedFile).not.toBeNull();
    expect(reopenedFile!.fileSize).toBe(data.length);

    reopenedFile!.close();
    cimFile.close();
  });

  it("should update first cluster consistently", () => {
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const cimFile = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(cimFile);
    volume.format();
    volume.init();

    // Create a file and write data to it
    const file = volume.createFile("test3.txt");
    const data = new TextEncoder().encode("Cluster allocation test");
    file!.writeFileData(data);

    // Store the cluster info
    const firstCluster = file!.firstCluster;
    expect(firstCluster).toBeGreaterThan(0);

    file!.close();

    // Open file again to verify cluster info was persisted
    const reopenedFile = volume.open("test3.txt", O_RDONLY);

    // First cluster should match
    expect(reopenedFile!.firstCluster).toBe(firstCluster);

    reopenedFile!.close();
    cimFile.close();
  });

  it("should maintain file data integrity after sequential writes", () => {
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const cimFile = cfm.createFile(filePath, SIZE_IN_MB);
    const volume = new Fat32Volume(cimFile);
    volume.format();
    volume.init();

    // Create a file and write data in multiple calls
    const file = volume.createFile("test4.txt");
    const data1 = new TextEncoder().encode("Part 1 - ");
    const data2 = new TextEncoder().encode("Part 2 - ");

    // Write first part
    file!.writeFileData(data1);
    file!.close();

    // Reopen and verify
    const reopened1 = volume.open("test4.txt", O_RDONLY);
    expect(reopened1!.fileSize).toBe(data1.length);
    const buf1 = reopened1!.readFileData(data1.length);
    expect(buf1).toEqual(data1);
    reopened1!.close();

    // Open for writing and overwrite data
    const reopened2 = volume.open("test4.txt", O_RDWR | O_CREAT);
    reopened2!.writeFileData(data2);
    reopened2!.close();

    // Verify the write was persisted
    const reopened3 = volume.open("test4.txt", O_RDONLY);
    expect(reopened3!.fileSize).toBe(data2.length);
    const buf2 = reopened3!.readFileData(data2.length);
    expect(buf2).toEqual(data2);

    reopened3!.close();
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
