import fs from "fs";
import { CimInfo } from "@abstractions/CimInfo";
import { BinaryWriter } from "@common/utils/BinaryWriter";
import { BinaryReader } from "@common/utils/BinaryReader";

export const CIM_VERSION_MAJOR = 1;
export const CIM_VERSION_MINOR = 0;
export const MAX_CLUSTERS = 32760;
export const CIM_HEADER = "CIMF";

/**
 * This class is responsible for managing the file system of the CIM.
 */
export class CimFileManager {
  createFile(name: string, sizeInMegaByte: number): CimFile {
    // --- Name must not be empty or whitespace only
    if (!name || name.trim() === "") {
      throw new Error("Invalid name");
    }

    // --- Size must be between 1MB and 16GB
    if (sizeInMegaByte < 64 || sizeInMegaByte > 16384) {
      throw new Error("Invalid size");
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

    const cimFile = new CimFile(name, sizeInMegaByte, selectedClusterSize, clusterCount);

    // --- Create the file
    fs.writeFileSync(name, new Uint8Array(0x1_0000));
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
}

// --- Multiply with 64K
const availableClusterSizes = [1, 2, 4, 8, 16];

/**
 * This class represents a CIM file.
 */
export class CimFile {
  private _filename: string;
  private _cimInfo: CimInfo;
  constructor(filename: string, maxSize: number, clusterSize: number, clusterCount: number) {
    this._filename = filename;
    this._cimInfo = {
      header: CIM_HEADER,
      versionMajor: CIM_VERSION_MAJOR,
      versionMinor: CIM_VERSION_MINOR,
      sectorSize: 1,
      clusterCount,
      clusterSize,
      maxClusters: 0,
      maxSize,
      reserved: 0,
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
    const clusterPointer = this._cimInfo.clusterMap[clusterIndex];

    // --- Check if the cluster is empty
    if (clusterPointer === 0xffff) {
      // --- This is an empty cluster
      return new Uint8Array(this._cimInfo.sectorSize * 512);
    }

    // --- Open the file and seek to the sector
    const fd = fs.openSync(this._filename, "r");
    const sectorBytes = this._cimInfo.sectorSize * 512;
    const sectorPointer =
      0x1_0000 +
      clusterPointer * this._cimInfo.clusterSize * 0x1_0000 +
      sectorInCluster * sectorBytes;
    const buffer = new Uint8Array(sectorBytes);
    fs.readSync(fd, buffer, 0, 512, sectorPointer);
    fs.closeSync(fd);

    // --- Done
    return buffer;
  }

  writeSector(sectorIndex: number, data: Uint8Array): void {
    this.checkSectorIndex(sectorIndex);

    // --- Check the data length
    if (data.length !== this._cimInfo.sectorSize * 512) {
      throw new Error("Invalid data length");
    }

    // --- Calculate the cluster index and the sector in the cluster
    const sectorsPerCluster = (this._cimInfo.clusterSize * 128) / this._cimInfo.sectorSize;
    const clusterIndex = Math.floor(sectorIndex / sectorsPerCluster);
    const sectorInCluster = sectorIndex % sectorsPerCluster;
    const clusterPointer = this._cimInfo.clusterMap[clusterIndex];

    // --- Check if the cluster is empty
    if (clusterPointer === 0xffff) {
      // --- This is an empty cluster, create a new cluster
      const currentClusters = this._cimInfo.maxClusters++;
      const newClusterPointer = 0x1_0000 + currentClusters * this._cimInfo.clusterSize * 0x1_0000;
      this._cimInfo.clusterMap[clusterIndex] = currentClusters;
      const cluster = new Uint8Array(this._cimInfo.clusterSize * 0x1_0000);
      cluster.set(data, sectorInCluster * this._cimInfo.sectorSize * 512);

      const fd = fs.openSync(this._filename, "r+");
      fs.writeSync(fd, cluster, 0, cluster.length, newClusterPointer);
      fs.closeSync(fd);
      this.writeHeader();
      return;
    }

    // --- Open the file and seek to the sector
    const fd = fs.openSync(this._filename, "r+");
    const sectorBytes = this._cimInfo.sectorSize * 512;
    const sectorPointer =
      0x1_0000 +
      clusterPointer * this._cimInfo.clusterSize * 0x1_0000 +
      sectorInCluster * sectorBytes;
    fs.writeSync(fd, data, 0, data.length, sectorPointer);
    fs.closeSync(fd);
  }

  readCluster(clusterIndex: number): Uint8Array {
    this.checkClusterIndex(clusterIndex);

    const clusterPointer = this._cimInfo.clusterMap[clusterIndex];
    const clusterBytes = this._cimInfo.clusterSize * 0x1_0000;
    const buffer = new Uint8Array(clusterBytes);

    if (clusterPointer !== 0xffff) {
      const fd = fs.openSync(this._filename, "r");
      const clusterPointerBytes = 0x1_0000 + clusterPointer * clusterBytes;
      fs.readSync(fd, buffer, 0, buffer.length, clusterPointerBytes);
      fs.closeSync(fd);
    }
    return buffer;
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
