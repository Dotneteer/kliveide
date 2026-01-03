import fs from "fs";
import path from "path";

const CIM_HEADER = "CIMF";
const MAX_CLUSTERS = 32760;
const CLUSTER_BASE_SIZE = 0x1_0000; // 64 KB

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  details: {
    header: string;
    versionMajor: number;
    versionMinor: number;
    sectorSize: number;
    clusterCount: number;
    clusterSize: number;
    maxClusters: number;
    maxSize: number;
    reserved: number;
    fileSize: number;
  };
  clusterMapAnalysis: {
    emptyCount: number;
    allocatedCount: number;
    outOfBoundsCount: number;
    duplicateAllocations: Map<number, number[]>;
    gaps: Array<{ start: number; end: number; reason: string }>;
  };
}

function validateCimFile(filePath: string): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    details: {
      header: "",
      versionMajor: 0,
      versionMinor: 0,
      sectorSize: 0,
      clusterCount: 0,
      clusterSize: 0,
      maxClusters: 0,
      maxSize: 0,
      reserved: 0,
      fileSize: 0,
    },
    clusterMapAnalysis: {
      emptyCount: 0,
      allocatedCount: 0,
      outOfBoundsCount: 0,
      duplicateAllocations: new Map(),
      gaps: [],
    },
  };

  try {
    // --- Read the entire file
    const buffer = fs.readFileSync(filePath);
    result.details.fileSize = buffer.length;

    if (buffer.length < 16) {
      result.errors.push(`File too small: ${buffer.length} bytes (expected at least 16 bytes for header)`);
      result.isValid = false;
      return result;
    }

    // --- Parse header (16 bytes)
    let offset = 0;
    result.details.header = buffer.toString("utf8", offset, offset + 4);
    offset += 4;

    if (result.details.header !== CIM_HEADER) {
      result.errors.push(`Invalid header: expected "${CIM_HEADER}", got "${result.details.header}"`);
      result.isValid = false;
      return result;
    }

    result.details.versionMajor = buffer.readUInt8(offset++);
    result.details.versionMinor = buffer.readUInt8(offset++);
    result.details.sectorSize = buffer.readUInt8(offset++);
    result.details.clusterCount = buffer.readUInt16LE(offset);
    offset += 2;
    result.details.clusterSize = buffer.readUInt8(offset++);
    result.details.maxClusters = buffer.readUInt16LE(offset);
    offset += 2;
    result.details.maxSize = buffer.readUInt16LE(offset);
    offset += 2;
    result.details.reserved = buffer.readUInt16LE(offset);
    offset += 2;

    // --- Validate header values
    if (result.details.sectorSize !== 1) {
      result.errors.push(`Invalid sector size: ${result.details.sectorSize} (expected 1)`);
      result.isValid = false;
    }

    if (result.details.clusterSize < 1 || result.details.clusterSize > 16) {
      result.errors.push(
        `Invalid cluster size multiplier: ${result.details.clusterSize} (expected 1-16)`
      );
      result.isValid = false;
    }

    if (result.details.clusterCount > MAX_CLUSTERS) {
      result.errors.push(
        `Cluster count exceeds max: ${result.details.clusterCount} > ${MAX_CLUSTERS}`
      );
      result.isValid = false;
    }

    if (result.details.maxSize < 64 || result.details.maxSize > 16384) {
      result.warnings.push(
        `Max size out of typical range: ${result.details.maxSize} MB (expected 64-16384)`
      );
    }

    // --- Parse cluster map (65520 bytes = 32760 uint16 entries)
    const clusterMapStart = 16;
    const clusterMapSize = MAX_CLUSTERS * 2;

    if (buffer.length < clusterMapStart + clusterMapSize) {
      result.errors.push(
        `File too small for complete cluster map: expected ${clusterMapStart + clusterMapSize}, got ${buffer.length}`
      );
      result.isValid = false;
      return result;
    }

    const clusterMap: number[] = [];
    for (let i = 0; i < MAX_CLUSTERS; i++) {
      const clusterPointer = buffer.readUInt16LE(clusterMapStart + i * 2);
      clusterMap[i] = clusterPointer;
    }

    // --- Analyze cluster map
    const physicalClusterUsage = new Map<number, number[]>();

    for (let logicalCluster = 0; logicalCluster < result.details.clusterCount; logicalCluster++) {
      const physicalCluster = clusterMap[logicalCluster];

      if (physicalCluster === 0xffff) {
        result.clusterMapAnalysis.emptyCount++;
      } else if (physicalCluster >= result.details.maxClusters) {
        result.clusterMapAnalysis.outOfBoundsCount++;
        result.errors.push(
          `Logical cluster ${logicalCluster} points to out-of-bounds physical cluster ${physicalCluster} (maxClusters=${result.details.maxClusters})`
        );
        result.isValid = false;
      } else {
        result.clusterMapAnalysis.allocatedCount++;

        // --- Track physical cluster usage for duplicate detection
        if (!physicalClusterUsage.has(physicalCluster)) {
          physicalClusterUsage.set(physicalCluster, []);
        }
        physicalClusterUsage.get(physicalCluster)!.push(logicalCluster);
      }
    }

    // --- Detect duplicate allocations
    for (const [physicalCluster, logicalClusters] of physicalClusterUsage) {
      if (logicalClusters.length > 1) {
        result.clusterMapAnalysis.duplicateAllocations.set(physicalCluster, logicalClusters);
        result.errors.push(
          `CRITICAL: Physical cluster ${physicalCluster} is allocated to multiple logical clusters: ${logicalClusters.join(", ")}`
        );
        result.isValid = false;
      }
    }

    // --- Calculate expected file size
    const expectedFileSize =
      CLUSTER_BASE_SIZE +
      result.details.maxClusters * result.details.clusterSize * CLUSTER_BASE_SIZE;
    if (buffer.length < expectedFileSize) {
      result.warnings.push(
        `File may be truncated: actual size ${buffer.length} < expected size ${expectedFileSize} (based on maxClusters=${result.details.maxClusters})`
      );
    }

    // --- Check for gaps in allocated clusters
    const allocatedPhysicalClusters = Array.from(physicalClusterUsage.keys()).sort((a, b) => a - b);
    for (let i = 1; i < allocatedPhysicalClusters.length; i++) {
      const prev = allocatedPhysicalClusters[i - 1];
      const curr = allocatedPhysicalClusters[i];
      if (curr - prev > 1) {
        result.clusterMapAnalysis.gaps.push({
          start: prev + 1,
          end: curr - 1,
          reason: `Gap in physical cluster allocation (${curr - prev - 1} clusters)`,
        });
      }
    }

    // --- Check for unallocated but referenced clusters beyond maxClusters
    for (let i = result.details.clusterCount; i < MAX_CLUSTERS; i++) {
      if (clusterMap[i] !== 0xffff) {
        result.warnings.push(
          `Logical cluster ${i} beyond clusterCount (${result.details.clusterCount}) is allocated to physical cluster ${clusterMap[i]}`
        );
      }
    }

    return result;
  } catch (error) {
    result.errors.push(`Error reading file: ${(error as Error).message}`);
    result.isValid = false;
    return result;
  }
}

// --- Main execution
const cimFilePath = process.argv[2] || "/Users/dotneteer/source/kliveide/ks2-to-review.cim";

if (!fs.existsSync(cimFilePath)) {
  console.error(`File not found: ${cimFilePath}`);
  process.exit(1);
}

const result = validateCimFile(cimFilePath);

console.log("\n════════════════════════════════════════════════════════════");
console.log("CIM FILE VALIDATION REPORT");
console.log("════════════════════════════════════════════════════════════\n");

console.log(`File: ${cimFilePath}`);
console.log(`Status: ${result.isValid ? "✓ VALID" : "✗ INVALID"}\n`);

console.log("HEADER DETAILS:");
console.log(`  Header Magic: ${result.details.header}`);
console.log(`  Version: ${result.details.versionMajor}.${result.details.versionMinor}`);
console.log(`  Sector Size: ${result.details.sectorSize} (512 bytes per sector)`);
console.log(`  Cluster Size: ${result.details.clusterSize} × 64KB = ${result.details.clusterSize * 64}KB`);
console.log(`  Logical Clusters: ${result.details.clusterCount}`);
console.log(`  Physical Clusters Allocated: ${result.clusterMapAnalysis.allocatedCount}`);
console.log(`  Max Clusters: ${result.details.maxClusters}`);
console.log(`  Max Size: ${result.details.maxSize} MB`);
console.log(`  Reserved: ${result.details.reserved}`);
console.log(`  File Size: ${result.details.fileSize} bytes (${(result.details.fileSize / 1024 / 1024).toFixed(2)} MB)\n`);

console.log("CLUSTER MAP ANALYSIS:");
console.log(`  Empty Clusters (0xffff): ${result.clusterMapAnalysis.emptyCount}`);
console.log(`  Allocated Clusters: ${result.clusterMapAnalysis.allocatedCount}`);
console.log(`  Out-of-Bounds References: ${result.clusterMapAnalysis.outOfBoundsCount}`);
console.log(`  Duplicate Allocations: ${result.clusterMapAnalysis.duplicateAllocations.size}\n`);

if (result.clusterMapAnalysis.duplicateAllocations.size > 0) {
  console.log("DUPLICATE ALLOCATIONS (DATA CORRUPTION RISK):");
  for (const [physicalCluster, logicalClusters] of result.clusterMapAnalysis.duplicateAllocations) {
    console.log(`  Physical Cluster ${physicalCluster}: mapped from logical clusters [${logicalClusters.join(", ")}]`);
  }
  console.log();
}

if (result.clusterMapAnalysis.gaps.length > 0) {
  console.log("ALLOCATION GAPS:");
  for (const gap of result.clusterMapAnalysis.gaps) {
    console.log(`  Physical Clusters ${gap.start}-${gap.end}: ${gap.reason}`);
  }
  console.log();
}

if (result.errors.length > 0) {
  console.log("ERRORS:");
  for (const error of result.errors) {
    console.log(`  ✗ ${error}`);
  }
  console.log();
}

if (result.warnings.length > 0) {
  console.log("WARNINGS:");
  for (const warning of result.warnings) {
    console.log(`  ⚠ ${warning}`);
  }
  console.log();
}

if (result.isValid) {
  console.log("✓ No consistency errors detected.\n");
} else {
  console.log("✗ Consistency errors detected. Data corruption may have occurred.\n");
}

console.log("════════════════════════════════════════════════════════════\n");
