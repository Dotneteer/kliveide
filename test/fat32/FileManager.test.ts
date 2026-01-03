import { describe, it, expect, assert } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import {
  CimFileManager,
  CIM_HEADER,
  MAX_CLUSTERS,
  CLUSTER_BASE_SIZE
} from "@main/fat32/CimFileManager";
import { Fat32Volume } from "@main/fat32/Fat32Volume";
import { FileManager } from "@main/fat32/FileManager";

const TEST_DIR = "testFat32";
const TEST_FILE = "ks2.cim";
const TEST_IMAGE_FILE = "ks2Image.img";
const SIZE_IN_MB = 2048;

interface CimValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    fileSize: number;
    header: {
      version: string;
      sectorSize: number;
      clusterSize: number;
      clusterCount: number;
      maxClusters: number;
      maxSize: number;
    };
    clusterMap: {
      empty: number;
      allocated: number;
      outOfBounds: number;
      duplicates: number;
    };
  };
}

describe("FileManager", () => {
  it("Copy works", async () => {
    // // --- Arrange
    // const filePath = createTestFile();
    // const cfm = new CimFileManager();
    // const file = cfm.createFile(filePath, SIZE_IN_MB);
    // const vol = new Fat32Volume(file);
    // vol.format("KS2");
    // vol.init();
    // const fm = new FileManager(vol);
    // // --- Act
    // try {
    //   await fm.copyFiles(path.join(os.homedir(), "KliveIDE KS2 Image"), "");
    // } catch (e) {
    //   console.log(e);
    // }
    // // --- Close the file to ensure all data is written
    // file.close();
    // // --- Validate CIM file integrity
    // const validation = validateCimFile(filePath);
    // // Log validation results
    // console.log('\n════════════════════════════════════════════════════════════');
    // console.log('CIM FILE VALIDATION REPORT');
    // console.log('════════════════════════════════════════════════════════════');
    // console.log(`File: ${filePath}`);
    // console.log(`Size: ${(validation.stats.fileSize / 1024 / 1024).toFixed(2)} MB`);
    // console.log(`Version: ${validation.stats.header.version}`);
    // console.log(`Cluster Size: ${validation.stats.header.clusterSize} × 64KB`);
    // console.log(`Allocated Clusters: ${validation.stats.clusterMap.allocated}`);
    // console.log(`Empty Clusters: ${validation.stats.clusterMap.empty}`);
    // if (validation.warnings.length > 0) {
    //   console.log('\nWARNINGS:');
    //   validation.warnings.forEach(w => console.log(`  ⚠ ${w}`));
    // }
    // if (validation.errors.length > 0) {
    //   console.log('\nERRORS:');
    //   validation.errors.forEach(e => console.log(`  ✗ ${e}`));
    // }
    // if (validation.valid) {
    //   console.log('\n✓ CIM file validation PASSED');
    // } else {
    //   console.log('\n✗ CIM file validation FAILED');
    // }
    // console.log('════════════════════════════════════════════════════════════\n');
    // // --- Assert validation passed
    // expect(validation.valid, `CIM validation failed:\n${validation.errors.join('\n')}`).toBe(true);
    // expect(validation.stats.clusterMap.outOfBounds, 'Out-of-bounds cluster pointers detected').toBe(0);
    // expect(validation.stats.clusterMap.duplicates, 'Duplicate physical cluster allocations detected').toBe(0);
    // // --- Convert to image file
    // const imgFilePath = createImageFile();
    // cfm.convertToImageFile(file, imgFilePath);
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

function createImageFile(): string {
  const homeDir = os.homedir();
  const testDir = path.join(homeDir, TEST_DIR);
  const filePath = path.join(testDir, TEST_IMAGE_FILE);

  // Ensure the test directory exists
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }
  return filePath;
}

/**
 * Validates the consistency and integrity of a CIM file
 */
function validateCimFile(filePath: string): CimValidationResult {
  const buffer = fs.readFileSync(filePath);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (buffer.length < 16) {
    errors.push("File too small (minimum 16 bytes for header)");
    return {
      valid: false,
      errors,
      warnings,
      stats: null as any
    };
  }

  // Read header
  let offset = 0;
  const header = buffer.toString("utf8", offset, offset + 4);
  offset += 4;

  if (header !== CIM_HEADER) {
    errors.push(`Invalid header: expected '${CIM_HEADER}', got '${header}'`);
    return {
      valid: false,
      errors,
      warnings,
      stats: null as any
    };
  }

  const vMajor = buffer.readUInt8(offset++);
  const vMinor = buffer.readUInt8(offset++);
  const sectorSize = buffer.readUInt8(offset++);
  const clusterCount = buffer.readUInt16LE(offset);
  offset += 2;
  const clusterSize = buffer.readUInt8(offset++);
  const maxClusters = buffer.readUInt16LE(offset);
  offset += 2;
  const maxSize = buffer.readUInt16LE(offset);
  offset += 2;
  const reserved = buffer.readUInt16LE(offset);
  offset += 2;

  // Validate header values
  if (maxClusters > MAX_CLUSTERS) {
    errors.push(`maxClusters (${maxClusters}) exceeds maximum (${MAX_CLUSTERS})`);
  }

  // Note: clusterCount is the total logical capacity (constant)
  // maxClusters is a counter of physical clusters allocated (grows from 0)
  // It's expected that maxClusters <= clusterCount (unless all space is used)
  if (clusterCount > MAX_CLUSTERS) {
    errors.push(`clusterCount (${clusterCount}) exceeds MAX_CLUSTERS (${MAX_CLUSTERS})`);
  }

  if (maxClusters > MAX_CLUSTERS) {
    errors.push(`maxClusters (${maxClusters}) exceeds MAX_CLUSTERS (${MAX_CLUSTERS})`);
  }

  if (maxClusters > clusterCount) {
    errors.push(
      `maxClusters (${maxClusters}) exceeds clusterCount (${clusterCount}) - data corruption`
    );
  }

  // Analyze cluster map
  const clusterMapStart = 16;
  let emptyCount = 0;
  let allocatedCount = 0;
  let outOfBounds = 0;
  const physicalUsage = new Map<number, number[]>();
  const duplicates = new Map<number, number[]>();

  for (let i = 0; i < clusterCount; i++) {
    const ptr = buffer.readUInt16LE(clusterMapStart + i * 2);

    if (ptr === 0xffff) {
      emptyCount++;
    } else if (ptr >= clusterCount) {
      outOfBounds++;
      errors.push(
        `Logical cluster ${i} maps to physical ${ptr} (out of bounds, capacity=${clusterCount})`
      );
    } else {
      allocatedCount++;
      if (!physicalUsage.has(ptr)) {
        physicalUsage.set(ptr, []);
      }
      physicalUsage.get(ptr)!.push(i);
    }
  }

  // Check for duplicate physical cluster allocations
  for (const [phys, logicals] of physicalUsage) {
    if (logicals.length > 1) {
      duplicates.set(phys, logicals);
      errors.push(
        `CRITICAL: Physical cluster ${phys} allocated to multiple logical clusters [${logicals.join(", ")}]`
      );
    }
  }

  // Validate file size
  const expectedSize = CLUSTER_BASE_SIZE + maxClusters * clusterSize * CLUSTER_BASE_SIZE;
  if (buffer.length < expectedSize) {
    warnings.push(
      `File may be truncated: actual=${buffer.length} bytes, expected=${expectedSize} bytes`
    );
  }

  // Check for orphaned physical clusters (allocated in file but not mapped)
  const mappedPhysical = new Set(physicalUsage.keys());
  const expectedPhysical = allocatedCount;
  if (mappedPhysical.size < expectedPhysical) {
    warnings.push(
      `Potential cluster map inconsistency: ${expectedPhysical} allocations but only ${mappedPhysical.size} unique physical clusters`
    );
  }

  // Additional sanity checks
  if (allocatedCount > 0 && maxClusters === 0) {
    errors.push(`Header inconsistency: ${allocatedCount} clusters allocated but maxClusters=0`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      fileSize: buffer.length,
      header: {
        version: `${vMajor}.${vMinor}`,
        sectorSize,
        clusterSize,
        clusterCount,
        maxClusters,
        maxSize
      },
      clusterMap: {
        empty: emptyCount,
        allocated: allocatedCount,
        outOfBounds,
        duplicates: duplicates.size
      }
    }
  };
}
