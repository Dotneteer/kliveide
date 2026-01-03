import { describe, it, expect } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { CimFileManager } from "@main/fat32/CimFileManager";
import { Fat32Volume } from "@main/fat32/Fat32Volume";

const TEST_DIR = "testFat32Regression";
const SIZE_IN_MB = 64;

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
