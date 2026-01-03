const fs = require('fs');

const CIM_HEADER = 'CIMF';
const MAX_CLUSTERS = 32760;
const CLUSTER_BASE_SIZE = 0x1_0000;

function validateCim(filePath) {
  const buffer = fs.readFileSync(filePath);
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('CIM FILE VALIDATION REPORT');
  console.log('════════════════════════════════════════════════════════════\n');
  console.log(`File: ${filePath}`);
  console.log(`File Size: ${buffer.length} bytes (${(buffer.length / 1024 / 1024).toFixed(2)} MB)\n`);

  if (buffer.length < 16) {
    console.log('✗ INVALID: File too small');
    return;
  }

  let offset = 0;
  const header = buffer.toString('utf8', offset, offset + 4);
  offset += 4;

  if (header !== CIM_HEADER) {
    console.log(`✗ INVALID: Bad header '${header}'`);
    return;
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

  console.log('HEADER DETAILS:');
  console.log(`  Version: ${vMajor}.${vMinor}`);
  console.log(`  Sector Size: ${sectorSize}`);
  console.log(`  Cluster Size: ${clusterSize} × 64KB`);
  console.log(`  Logical Clusters: ${clusterCount}`);
  console.log(`  Max Clusters: ${maxClusters}`);
  console.log(`  Max Size: ${maxSize} MB`);
  console.log(`  Reserved: ${reserved}\n`);

  const clusterMapStart = 16;
  let emptyCount = 0, allocatedCount = 0, outOfBounds = 0;
  const physicalUsage = new Map();
  const duplicates = new Map();
  const errors = [];

  for (let i = 0; i < clusterCount; i++) {
    const ptr = buffer.readUInt16LE(clusterMapStart + i * 2);

    if (ptr === 0xffff) {
      emptyCount++;
    } else if (ptr >= maxClusters) {
      outOfBounds++;
      errors.push(`Logical cluster ${i} -> physical ${ptr} (out of bounds, max=${maxClusters})`);
    } else {
      allocatedCount++;
      if (!physicalUsage.has(ptr)) {
        physicalUsage.set(ptr, []);
      }
      physicalUsage.get(ptr).push(i);
    }
  }

  for (const [phys, logicals] of physicalUsage) {
    if (logicals.length > 1) {
      duplicates.set(phys, logicals);
      errors.push(`CRITICAL: Physical cluster ${phys} maps from logical [${logicals.join(', ')}]`);
    }
  }

  console.log('CLUSTER MAP ANALYSIS:');
  console.log(`  Empty: ${emptyCount}`);
  console.log(`  Allocated: ${allocatedCount}`);
  console.log(`  Out-of-Bounds: ${outOfBounds}`);
  console.log(`  Duplicate Allocations: ${duplicates.size}\n`);

  if (errors.length > 0) {
    console.log('ERRORS DETECTED:');
    errors.forEach(err => console.log(`  ✗ ${err}`));
    console.log();
  }

  const expectedSize = CLUSTER_BASE_SIZE + maxClusters * clusterSize * CLUSTER_BASE_SIZE;
  console.log(`Expected file size: ${expectedSize} bytes (${(expectedSize / 1024 / 1024).toFixed(2)} MB)`);
  if (buffer.length < expectedSize) {
    console.log(`⚠ File may be truncated (actual: ${buffer.length}, expected: ${expectedSize})\n`);
  } else {
    console.log(`✓ File size adequate\n`);
  }

  if (outOfBounds === 0 && duplicates.size === 0) {
    console.log('✓ No consistency errors detected\n');
  } else {
    console.log('✗ Consistency errors detected. Data corruption likely.\n');
  }

  console.log('════════════════════════════════════════════════════════════\n');
}

const filePath = process.argv[2] || '/Users/dotneteer/source/kliveide/ks2-to-review.cim';
validateCim(filePath);
