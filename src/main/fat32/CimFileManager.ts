import fs from "fs";
import { CimInfo } from "@abstractions/CimInfo";
import { BinaryWriter } from "@common/utils/BinaryWriter";
import { BinaryReader } from "@common/utils/BinaryReader";
import { isInteger } from "lodash";

export const CIM_VERSION_MAJOR = 1;
export const CIM_VERSION_MINOR = 0;
export const MAX_CLUSTERS = 32760;
export const CIM_HEADER = "CIMF";
export const SECTOR_SIZE = 1;  // Fixed at 512 bytes (1 × 512)
export const CLUSTER_BASE_SIZE = 0x1_0000;  // 64 KB
export const SECTOR_SIZE_BYTES = SECTOR_SIZE * 512;  // 512 bytes

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

    const cimFile = new CimFile(name, sizeInMegaByte, selectedClusterSize, clusterCount, isReadonly);

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
  constructor(filename: string, maxSize: number, clusterSize: number, clusterCount: number, isReadOnly = false) {
    this._filename = filename;
    this._cimInfo = {
      header: CIM_HEADER,
      versionMajor: CIM_VERSION_MAJOR,
      versionMinor: CIM_VERSION_MINOR,
      sectorSize: SECTOR_SIZE,
      clusterCount,
      clusterSize,
      maxClusters: 0,
      maxSize,
      reserved: isReadOnly ? 1 : 0,
      clusterMap: []
    };

    // --- Sign empty clusters
    for (let i = 0; i < MAX_CLUSTERS; i++) {
      this._cimInfo.clusterMap[i] = 0xffff;
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
      throw new Error(`Invalid sector size in file: expected ${SECTOR_SIZE}, got ${this._cimInfo.sectorSize}`);
    }
    
    this._cimInfo.clusterCount = reader.readUint16();
    this._cimInfo.clusterSize = reader.readByte();
    this._cimInfo.maxClusters = reader.readUint16();
    this._cimInfo.maxSize = reader.readUint16();
    this._cimInfo.reserved = reader.readUint16();
    for (let i = 0; i < MAX_CLUSTERS; i++) {
      this._cimInfo.clusterMap[i] = reader.readUint16();
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

    // --- Open the file and seek to the sector
    const fd = fs.openSync(this._filename, "r");
    try {
      const sectorBytes = this._cimInfo.sectorSize * 512;
      const sectorPointer =
        CLUSTER_BASE_SIZE +
        clusterPointer * this._cimInfo.clusterSize * CLUSTER_BASE_SIZE +
        sectorInCluster * sectorBytes;
      const buffer = new Uint8Array(sectorBytes);
      fs.readSync(fd, buffer, 0, 512, sectorPointer);
      return buffer;
    } finally {
      fs.closeSync(fd);
    }
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
      const newClusterPointer = CLUSTER_BASE_SIZE + currentClusters * this._cimInfo.clusterSize * CLUSTER_BASE_SIZE;
      this._cimInfo.clusterMap[clusterIndex] = currentClusters;
      const cluster = new Uint8Array(this._cimInfo.clusterSize * CLUSTER_BASE_SIZE);
      cluster.set(data, sectorInCluster * this._cimInfo.sectorSize * 512);

      const fd = fs.openSync(this._filename, "r+");
      try {
        fs.writeSync(fd, cluster, 0, cluster.length, newClusterPointer);
      } finally {
        fs.closeSync(fd);
      }
      this.writeHeader();
      return;
    }

    // --- Open the file and seek to the sector
    const fd = fs.openSync(this._filename, "r+");
    try {
      const sectorBytes = this._cimInfo.sectorSize * 512;
      const sectorPointer =
        CLUSTER_BASE_SIZE +
        clusterPointer * this._cimInfo.clusterSize * CLUSTER_BASE_SIZE +
        sectorInCluster * sectorBytes;
      fs.writeSync(fd, data, 0, data.length, sectorPointer);
    } finally {
      fs.closeSync(fd);
    }
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
