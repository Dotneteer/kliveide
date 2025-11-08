import fs from "fs";
import { CimInfo } from "@abstr/CimInfo";
import { BinaryReader } from "@common/utils/BinaryReader";

export const MAX_CLUSTERS = 32760;

/**
 * This class is repsonsible for handling the CIM data stored in memory
 */
export class CimHandler {
  private _cimInfo: CimInfo;

  constructor(public readonly cimFileName: string) {
    this.readHeader();
  }

  get cimInfo(): CimInfo {
    return this._cimInfo;
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

    // --- Calculate sector start position
    const sectorBytes = this._cimInfo.sectorSize * 512;
    const sectorPointer =
      0x1_0000 +
      clusterPointer * this._cimInfo.clusterSize * 0x1_0000 +
      sectorInCluster * sectorBytes;

    // --- Read the sector data from the CIM file
    const buffer = new Uint8Array(sectorBytes);
    const fd = fs.openSync(this.cimFileName, "r");
    fs.readSync(fd, buffer, 0, sectorBytes, sectorPointer);
    fs.closeSync(fd);

    // --- Done
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
    const clusterPointer = this._cimInfo.clusterMap[clusterIndex];

    // --- Open the file for write
    const fd = fs.openSync(this.cimFileName, "r+");

    // --- Check if the cluster is empty
    if (clusterPointer === 0xffff) {
      // --- This is an empty cluster, create a new cluster
      const currentClusters = this._cimInfo.maxClusters++;
      this._cimInfo.clusterMap[clusterIndex] = currentClusters;

      // --- Write back currentClusters
      const buffer = new Uint8Array(2);
      buffer[0] = currentClusters & 0xff;
      buffer[1] = (currentClusters >> 8) & 0xff;
      fs.writeSync(fd, buffer, 0, 2, 0x10 + 2 * clusterIndex);
      fs.writeSync(fd, buffer, 0, 2, 0x0c);

      const newCluster = new Uint8Array(this._cimInfo.clusterSize * 0x1_0000);
      newCluster.set(data, sectorInCluster * this._cimInfo.sectorSize * 512);

      // --- Append the new cluster to the end of the file
      const fileSize = fs.fstatSync(fd).size;
      fs.writeSync(fd, newCluster, 0, newCluster.length, fileSize);

      // --- Done.
      fs.closeSync(fd);
      return;
    }

    // --- Calculate the sector start position
    const sectorBytes = this._cimInfo.sectorSize * 512;
    const sectorPointer =
      0x1_0000 +
      clusterPointer * this._cimInfo.clusterSize * 0x1_0000 +
      sectorInCluster * sectorBytes;

    // --- Write the sector data to the CIM file
    fs.writeSync(fd, data, 0, data.length, sectorPointer);
    fs.closeSync(fd);
  }

  setReadOnly(readonly: boolean): void {
    this._cimInfo.reserved = readonly ? 1 : 0;
    const buffer = new Uint8Array(2);
    buffer[0] = this._cimInfo.reserved & 0xff;
    buffer[1] = (this._cimInfo.reserved >> 8) & 0xff;
    const fd = fs.openSync(this.cimFileName, "r+");
    fs.writeSync(fd, buffer, 0, 2, 0x0e);
    fs.closeSync(fd);
  }

  private readHeader(): void {
    const buffer = new Uint8Array(0x1_0000);
    const fd = fs.openSync(this.cimFileName, "r");
    fs.readSync(fd, buffer, 0, 0x1_0000, 0);
    fs.closeSync(fd);

    const reader = new BinaryReader(buffer);
    this._cimInfo = {
      header: reader.readString(4),
      versionMajor: reader.readByte(),
      versionMinor: reader.readByte(),
      sectorSize: reader.readByte(),
      clusterCount: reader.readUint16(),
      clusterSize: reader.readByte(),
      maxClusters: reader.readUint16(),
      maxSize: reader.readUint16(),
      reserved: reader.readUint16(),
      clusterMap: []
    };
    for (let i = 0; i < MAX_CLUSTERS; i++) {
      this._cimInfo.clusterMap[i] = reader.readUint16();
    }
  }

  private checkSectorIndex(sectorIndex: number): void {
    const maxSectors = (this._cimInfo.maxSize * 2048) / this._cimInfo.sectorSize;
    if (sectorIndex < 0 || sectorIndex >= maxSectors) {
      throw new Error(`Invalid sector index: ${sectorIndex}`);
    }
  }
}
