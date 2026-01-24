import fs from "fs";
import { CimInfo } from "@abstractions/CimInfo";
import { BinaryWriter } from "@common/utils/BinaryWriter";
import { BinaryReader } from "@common/utils/BinaryReader";
import { isInteger } from "lodash";

export const CIM_VERSION_MAJOR = 1;
export const CIM_VERSION_MINOR = 0;
export const MAX_CLUSTERS = 32760;
export const CIM_HEADER = "CIMF";
export const SECTOR_SIZE = 1; // Fixed at 512 bytes (1 × 512)
export const CLUSTER_BASE_SIZE = 0x1_0000; // 64 KB
export const SECTOR_SIZE_BYTES = SECTOR_SIZE * 512; // 512 bytes

/**
 * This class is responsible for managing the file system of the CIM.
 */
export class CimFileManager {
  createFile(name: string, sizeInMegaByte: number, isReadonly = false): CimFile {
    // --- Name must not be empty or whitespace only
    if (!name || name.trim() === "") {
      throw new Error("Invalid name");
    }

    // --- Size must be between 64MB and 16GB
    if (sizeInMegaByte < 64) {
      throw new Error(`Invalid size: minimum 64 MB required, got ${sizeInMegaByte} MB`);
    }
    if (sizeInMegaByte > 16384) {
      throw new Error(`Invalid size: maximum 16 GB (16384 MB) allowed, got ${sizeInMegaByte} MB`);
    }

    // --- Calculate the cluster size
    let selectedClusterSize = 0;
    let clusterCount = 0;
    for (let clusterSize of availableClusterSizes) {
      clusterCount = (sizeInMegaByte * 1024) / clusterSize / 64;
      if (clusterCount <= MAX_CLUSTERS) {
        selectedClusterSize = clusterSize;
        break;
      }
    }

    // ✅ Delete existing file if it exists to ensure clean slate
    // This prevents the CimFile constructor from loading stale header data
    if (fs.existsSync(name)) {
      fs.unlinkSync(name);
    }

    const cimFile = new CimFile(
      name,
      sizeInMegaByte,
      selectedClusterSize,
      clusterCount,
      isReadonly
    );

    // --- Create the file with 64KB header
    fs.writeFileSync(name, new Uint8Array(CLUSTER_BASE_SIZE));
    cimFile.writeHeader();
    return cimFile;
  }

  convertToImageFile(cimFile: CimFile, imageFilename: string): void {
    const fd = fs.openSync(imageFilename, "w");
    for (let i = 0; i < cimFile.cimInfo.clusterCount; i++) {
      const cluster = cimFile.readCluster(i);
      fs.writeSync(fd, cluster, 0, cluster.length);
    }
    fs.closeSync(fd);
  }

  convertImageFileToCim(imageFilename: string, cimFilename: string): CimFile {
    // --- Check the image file size
    const stats = fs.statSync(imageFilename);
    const length = stats.size;
    const sizeInMegaByte = length / 1024 / 1024;
    if (!isInteger(sizeInMegaByte)) {
      throw new Error("Invalid image file size");
    }

    // --- Create the file
    const cimFile = this.createFile(cimFilename, sizeInMegaByte);
    const sectors = sizeInMegaByte * 2048;
    const fd = fs.openSync(imageFilename, "r");
    try {
      const sector = new Uint8Array(512);
      for (let i = 0; i < sectors; i++) {
        fs.readSync(fd, sector, 0, 512, i * 512);
        let sum = 0;
        for (let j = 0; j < 512; j++) {
          sum += sector[j];
        }
        if (sum !== 0) {
          cimFile.writeSector(i, sector);
        }
      }
    } finally {
      fs.closeSync(fd);
    }

    return cimFile;
  }
}

// --- Multiply with 64K
// Available cluster size multipliers. Each is multiplied by CLUSTER_BASE_SIZE (64KB)
const availableClusterSizes = [1, 2, 4, 8, 16];

/**
 * This class represents a CIM file.
 */
export class CimFile {
  private _filename: string;
  private _cimInfo: CimInfo;
  private _fd: number | null = null; // ✅ FIX Bug #4: Persistent file handle
  private _fileMode: string; // Track if file is read-only or read-write

  constructor(
    filename: string,
    maxSize?: number,
    clusterSize?: number,
    clusterCount?: number,
    isReadOnly = false
  ) {
    this._filename = filename;

    // ✅ FIX Bug #1: Check if file exists and load header automatically
    if (fs.existsSync(filename)) {
      // File exists - load metadata from file
      // Initialize with temporary structure that will be overwritten by readHeader()
      this._cimInfo = {
        header: "",
        versionMajor: 0,
        versionMinor: 0,
        sectorSize: 0,
        clusterCount: 0,
        clusterSize: 0,
        maxClusters: 0,
        maxSize: 0,
        reserved: 0,
        clusterMap: []
      };

      // Load actual metadata from file
      this.readHeader();

      // ✅ FIX Bug #4: Open persistent file handle
      this._fileMode = this._cimInfo.reserved ? "r" : "r+";
      this._fd = fs.openSync(filename, this._fileMode);

      // Validate constructor parameters match file header
      if (maxSize !== undefined && this._cimInfo.maxSize !== maxSize) {
        console.warn(
          `[CimFile] Warning: Constructor parameter maxSize (${maxSize}) differs from file header (${this._cimInfo.maxSize}). Using file header value.`
        );
      }
      if (clusterCount !== undefined && this._cimInfo.clusterCount !== clusterCount) {
        console.warn(
          `[CimFile] Warning: Constructor parameter clusterCount (${clusterCount}) differs from file header (${this._cimInfo.clusterCount}). Using file header value.`
        );
      }
    } else {
      if (maxSize === undefined || clusterSize === undefined || clusterCount === undefined) {
        throw new Error(
          "File does not exist, maxSize, clusterSize, and clusterCount must be provided to create a new file"
        );
      }
      // New file - initialize structure
      this._cimInfo = {
        header: CIM_HEADER,
        versionMajor: CIM_VERSION_MAJOR,
        versionMinor: CIM_VERSION_MINOR,
        sectorSize: SECTOR_SIZE,
        clusterCount,
        clusterSize,
        maxClusters: 0, // Counter for physical clusters allocated (grows from 0)
        maxSize,
        reserved: isReadOnly ? 1 : 0,
        clusterMap: []
      };

      // --- Sign empty clusters
      for (let i = 0; i < MAX_CLUSTERS; i++) {
        this._cimInfo.clusterMap[i] = 0xffff;
      }

      // ✅ FIX Bug #4: Set file mode for new files
      // File handle will be opened lazily on first read/write
      this._fileMode = isReadOnly ? "r" : "r+";
    }
  }

  /**
   * ✅ FIX Bug #4: Close persistent file handle
   * Should be called when done with the CimFile to release resources
   */
  close(): void {
    if (this._fd !== null) {
      try {
        fs.closeSync(this._fd);
      } catch (error) {
        console.error(`[CimFile] Error closing file ${this._filename}:`, error);
      }
      this._fd = null;
    }
  }

  get filename(): string {
    return this._filename;
  }

  get cimInfo(): CimInfo {
    return this._cimInfo;
  }

  writeHeader(): void {
    const writer = new BinaryWriter();

    writer.writeBytes(new Uint8Array(Buffer.from(this._cimInfo.header)));
    writer.writeByte(this._cimInfo.versionMajor);
    writer.writeByte(this._cimInfo.versionMinor);
    writer.writeByte(this._cimInfo.sectorSize);
    writer.writeUint16(this._cimInfo.clusterCount);
    writer.writeByte(this._cimInfo.clusterSize);
    writer.writeUint16(this._cimInfo.maxClusters);
    writer.writeUint16(this._cimInfo.maxSize);
    writer.writeUint16(this._cimInfo.reserved);
    for (let i = 0; i < MAX_CLUSTERS; i++) {
      writer.writeUint16(this._cimInfo.clusterMap[i]);
    }

    const fd = fs.openSync(this._filename, "r+");
    fs.writeSync(fd, writer.buffer, 0, writer.buffer.length, 0);
    fs.closeSync(fd);
  }

  readHeader(): void {
    const buffer = fs.readFileSync(this._filename);
    const reader = new BinaryReader(new Uint8Array(buffer));
    this._cimInfo.header = reader.readString(4);
    this._cimInfo.versionMajor = reader.readByte();
    this._cimInfo.versionMinor = reader.readByte();
    this._cimInfo.sectorSize = reader.readByte();

    // --- Validate sector size matches expected constant
    if (this._cimInfo.sectorSize !== SECTOR_SIZE) {
      throw new Error(
        `Invalid sector size in file: expected ${SECTOR_SIZE}, got ${this._cimInfo.sectorSize}`
      );
    }

    this._cimInfo.clusterCount = reader.readUint16();
    this._cimInfo.clusterSize = reader.readByte();
    this._cimInfo.maxClusters = reader.readUint16();
    this._cimInfo.maxSize = reader.readUint16();
    this._cimInfo.reserved = reader.readUint16();
    for (let i = 0; i < MAX_CLUSTERS; i++) {
      this._cimInfo.clusterMap[i] = reader.readUint16();
    }

    // ✅ FIX Bug #3: Validate cluster map consistency to prevent data corruption
    // This detects corrupted headers that could cause one file to overwrite another
    this.validateClusterMap();
  }

  /**
   * Validates the integrity of the cluster map to detect corruption
   * @throws Error if corruption is detected
   */
  private validateClusterMap(): void {
    const allocatedClusters = new Set<number>();
    let actualAllocatedCount = 0;

    for (let logicalIndex = 0; logicalIndex < this._cimInfo.clusterCount; logicalIndex++) {
      const physicalCluster = this._cimInfo.clusterMap[logicalIndex];

      // Skip unallocated clusters
      if (physicalCluster === 0xffff) {
        continue;
      }

      actualAllocatedCount++;

      // ✅ Check for duplicate physical cluster assignment
      // If two logical clusters point to same physical cluster, writes will corrupt data
      if (allocatedClusters.has(physicalCluster)) {
        throw new Error(
          `Cluster map corruption detected: Multiple logical clusters map to physical cluster ${physicalCluster}. ` +
            `This will cause data corruption where writing to one file overwrites another. ` +
            `File integrity compromised - recovery may be needed.`
        );
      }
      allocatedClusters.add(physicalCluster);

      // ✅ Check physical cluster pointer is within bounds
      // Pointer must be less than maxClusters (the count of allocated physical clusters)
      if (physicalCluster >= this._cimInfo.maxClusters) {
        throw new Error(
          `Cluster map corruption detected: Logical cluster ${logicalIndex} points to physical cluster ${physicalCluster}, ` +
            `but maxClusters is only ${this._cimInfo.maxClusters}. Out-of-bounds access will cause corruption.`
        );
      }
    }

    // ✅ Check maxClusters consistency
    // maxClusters should match the highest physical cluster + 1, or the count of allocated clusters
    // If mismatch detected, log warning and auto-correct to prevent corruption
    if (actualAllocatedCount !== this._cimInfo.maxClusters) {
      console.warn(
        `[CimFile] Cluster map inconsistency detected in ${this._filename}: ` +
          `maxClusters=${this._cimInfo.maxClusters} but ${actualAllocatedCount} clusters are actually allocated. ` +
          `Auto-correcting to prevent cluster reuse and data corruption.`
      );
      this._cimInfo.maxClusters = actualAllocatedCount;

      // Write corrected header back to disk
      this.writeHeader();
    }
  }

  readSector(sectorIndex: number): Uint8Array {
    this.checkSectorIndex(sectorIndex);

    // --- Calculate the cluster index and the sector in the cluster
    const sectorsPerCluster = (this._cimInfo.clusterSize * 128) / this._cimInfo.sectorSize;
    const clusterIndex = Math.floor(sectorIndex / sectorsPerCluster);
    const sectorInCluster = sectorIndex % sectorsPerCluster;

    // --- Defensive: Validate cluster index is within bounds (mathematically guaranteed but defensive check)
    if (clusterIndex < 0 || clusterIndex >= this._cimInfo.clusterCount) {
      throw new Error(`Cluster index out of bounds: ${clusterIndex}`);
    }

    const clusterPointer = this._cimInfo.clusterMap[clusterIndex];

    // --- Check if the cluster is empty
    if (clusterPointer === 0xffff) {
      // --- This is an empty cluster
      return new Uint8Array(SECTOR_SIZE_BYTES);
    }

    // ✅ FIX Bug #4: Use persistent file handle instead of open/close each time
    // Lazy-open file if handle doesn't exist yet
    if (this._fd === null) {
      this._fd = fs.openSync(this._filename, this._fileMode);
    }

    const sectorBytes = this._cimInfo.sectorSize * 512;
    const sectorPointer =
      CLUSTER_BASE_SIZE +
      clusterPointer * this._cimInfo.clusterSize * CLUSTER_BASE_SIZE +
      sectorInCluster * sectorBytes;
    const buffer = new Uint8Array(sectorBytes);
    fs.readSync(this._fd, buffer, 0, 512, sectorPointer);
    return buffer;
  }

  writeSector(sectorIndex: number, data: Uint8Array): void {
    if (this._cimInfo.reserved) {
      throw new Error("The file is read-only");
    }

    this.checkSectorIndex(sectorIndex);

    // --- Check the data length
    if (data.length !== this._cimInfo.sectorSize * 512) {
      throw new Error("Invalid data length");
    }

    // --- Calculate the cluster index and the sector in the cluster
    const sectorsPerCluster = (this._cimInfo.clusterSize * 128) / this._cimInfo.sectorSize;
    const clusterIndex = Math.floor(sectorIndex / sectorsPerCluster);
    const sectorInCluster = sectorIndex % sectorsPerCluster;

    // --- Defensive: Validate cluster index is within bounds (mathematically guaranteed but defensive check)
    if (clusterIndex < 0 || clusterIndex >= this._cimInfo.clusterCount) {
      throw new Error(`Cluster index out of bounds: ${clusterIndex}`);
    }

    const clusterPointer = this._cimInfo.clusterMap[clusterIndex];

    // --- Check if the cluster is empty
    if (clusterPointer === 0xffff) {
      // --- This is an empty cluster, create a new cluster
      const currentClusters = this._cimInfo.maxClusters++;
      const newClusterPointer =
        CLUSTER_BASE_SIZE + currentClusters * this._cimInfo.clusterSize * CLUSTER_BASE_SIZE;
      this._cimInfo.clusterMap[clusterIndex] = currentClusters;

      // ✅ FIX Bug #2: Write header FIRST to allocate cluster in metadata atomically
      // This ensures that if a crash occurs, the header reflects the allocation
      // before any data is written to the cluster
      this.writeHeader();

      // ✅ FIX Bug #4: Use persistent file handle instead of open/close
      // Lazy-open file if handle doesn't exist yet
      if (this._fd === null) {
        this._fd = fs.openSync(this._filename, this._fileMode);
      }

      // ✅ Flush header to disk before writing cluster data
      fs.fsyncSync(this._fd);

      // Now write the cluster data
      const cluster = new Uint8Array(this._cimInfo.clusterSize * CLUSTER_BASE_SIZE);
      cluster.set(data, sectorInCluster * this._cimInfo.sectorSize * 512);
      fs.writeSync(this._fd, cluster, 0, cluster.length, newClusterPointer);

      // ✅ Flush cluster data to disk
      fs.fsyncSync(this._fd);

      return;
    }

    // ✅ FIX Bug #4: Use persistent file handle instead of open/close each time
    // Lazy-open file if handle doesn't exist yet
    if (this._fd === null) {
      this._fd = fs.openSync(this._filename, this._fileMode);
    }

    const sectorBytes = this._cimInfo.sectorSize * 512;
    const sectorPointer =
      CLUSTER_BASE_SIZE +
      clusterPointer * this._cimInfo.clusterSize * CLUSTER_BASE_SIZE +
      sectorInCluster * sectorBytes;
    fs.writeSync(this._fd, data, 0, data.length, sectorPointer);
  }

  readCluster(clusterIndex: number): Uint8Array {
    this.checkClusterIndex(clusterIndex);

    const clusterPointer = this._cimInfo.clusterMap[clusterIndex];
    const clusterBytes = this._cimInfo.clusterSize * CLUSTER_BASE_SIZE;
    const buffer = new Uint8Array(clusterBytes);

    if (clusterPointer !== 0xffff) {
      const fd = fs.openSync(this._filename, "r");
      const clusterPointerBytes = CLUSTER_BASE_SIZE + clusterPointer * clusterBytes;
      fs.readSync(fd, buffer, 0, buffer.length, clusterPointerBytes);
      fs.closeSync(fd);
    }
    return buffer;
  }

  setReadonly(readOnly: boolean): void {
    this._cimInfo.reserved = readOnly ? 1 : 0;
    this.writeHeader();

    // ✅ FIX Bug #4: Close and reopen file handle with correct mode
    // when readonly flag changes
    const newMode = readOnly ? "r" : "r+";
    if (this._fileMode !== newMode) {
      this._fileMode = newMode;

      // Close existing handle if open
      if (this._fd !== null) {
        try {
          fs.closeSync(this._fd);
        } catch (error) {
          console.error(`[CimFile] Error closing file during setReadonly:`, error);
        }
        this._fd = null;
      }

      // File handle will be reopened lazily on next read/write with new mode
    }
  }

  private checkSectorIndex(sectorIndex: number): void {
    const maxSectors = (this._cimInfo.maxSize * 2048) / this._cimInfo.sectorSize;
    if (sectorIndex < 0 || sectorIndex >= maxSectors) {
      throw new Error(`Invalid sector index: ${sectorIndex}`);
    }
  }

  private checkClusterIndex(clusterIndex: number): void {
    if (clusterIndex < 0 || clusterIndex >= this._cimInfo.clusterCount) {
      throw new Error(`Invalid cluster index: ${clusterIndex}`);
    }
  }
}
