import { describe, it, expect, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Fat32Volume } from "../../src/main/fat32/Fat32Volume";
import { CimFileManager } from "../../src/main/fat32/CimFileManager";
import { FS_ATTR_FILE, O_RDONLY } from "../../src/main/fat32/Fat32Types";

const TEST_DIR = "testFat32";
const SIZE_IN_MB = 64;

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
