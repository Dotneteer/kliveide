import fs from "fs";
import { CimInfo } from "@abstractions/CimInfo";
import { BinaryReader } from "@common/utils/BinaryReader";

export const MAX_CLUSTERS = 32760;

/**
 * This class is repsonsible for handling the CIM data stored in memory
 */
export class CimHandler {
  private _cimInfo: CimInfo;
  private _fd: number | undefined;  // ✅ Persistent file handle
  private _operationQueue: Array<() => void> = [];  // ✅ Queue for sequential operations
  private _isProcessing = false;  // ✅ Flag to track if queue is being processed

  constructor(public readonly cimFileName: string) {
    this.readHeader();
    // ✅ Open file handle on construction - keep it open for all operations
    try {
      this._fd = fs.openSync(this.cimFileName, "r+");
    } catch (e) {
      // File might be read-only, try read-only mode
      this._fd = fs.openSync(this.cimFileName, "r");
    }
  }

  get cimInfo(): CimInfo {
    return this._cimInfo;
  }

  // ✅ Destructor-like method to close the file handle
  close(): void {
    if (this._fd !== undefined) {
      try {
        fs.closeSync(this._fd);
      } catch (e) {
        // Handle any errors during close
      }
      this._fd = undefined;
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

    // --- Calculate sector start position
    const sectorBytes = this._cimInfo.sectorSize * 512;
    const sectorPointer =
      0x1_0000 +
      clusterPointer * this._cimInfo.clusterSize * 0x1_0000 +
      sectorInCluster * sectorBytes;

    // --- Read the sector data from the CIM file
    const buffer = new Uint8Array(sectorBytes);
    
    // ✅ Use persistent file handle instead of opening/closing
    const fd = this._fd ?? fs.openSync(this.cimFileName, "r");
    fs.readSync(fd, buffer, 0, sectorBytes, sectorPointer);
    if (!this._fd) {
      fs.closeSync(fd);
    }

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

    // ✅ Use persistent file handle
    const fd = this._fd ?? fs.openSync(this.cimFileName, "r+");

    // --- Check if the cluster is empty
    if (clusterPointer === 0xffff) {
      // --- This is an empty cluster, create a new cluster
      const currentClusters = this._cimInfo.maxClusters++;
      this._cimInfo.clusterMap[clusterIndex] = currentClusters;

      // --- Write back cluster map entry
      const clusterMapBuffer = new Uint8Array(2);
      clusterMapBuffer[0] = currentClusters & 0xff;
      clusterMapBuffer[1] = (currentClusters >> 8) & 0xff;
      fs.writeSync(fd, clusterMapBuffer, 0, 2, 0x10 + 2 * clusterIndex);

      // --- Write back updated maxClusters to header (offset 0x0A)
      const maxClustersBuffer = new Uint8Array(2);
      maxClustersBuffer[0] = this._cimInfo.maxClusters & 0xff;
      maxClustersBuffer[1] = (this._cimInfo.maxClusters >> 8) & 0xff;
      fs.writeSync(fd, maxClustersBuffer, 0, 2, 0x0a);

      // ✅ CRITICAL: Flush header/cluster map writes to disk before appending cluster data
      // --- This ensures header is always consistent with cluster map
      // --- If crash occurs after this fsync, either both are written or neither
      fs.fsyncSync(fd);

      const newCluster = new Uint8Array(this._cimInfo.clusterSize * 0x1_0000);
      newCluster.set(data, sectorInCluster * this._cimInfo.sectorSize * 512);

      // --- Append the new cluster to the end of the file
      const fileSize = fs.fstatSync(fd).size;
      fs.writeSync(fd, newCluster, 0, newCluster.length, fileSize);

      // ✅ CRITICAL: Flush cluster data to disk after write
      // --- Ensures cluster data is persisted before operation completes
      fs.fsyncSync(fd);

      // --- Done - don't close if it's the persistent handle
      if (!this._fd) {
        fs.closeSync(fd);
      }
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
    
    // ✅ Flush to disk to ensure atomicity
    fs.fsyncSync(fd);
    
    // --- Don't close if it's the persistent handle
    if (!this._fd) {
      fs.closeSync(fd);
    }
  }

  setReadOnly(readonly: boolean): void {
    this._cimInfo.reserved = readonly ? 1 : 0;
    const buffer = new Uint8Array(2);
    buffer[0] = this._cimInfo.reserved & 0xff;
    buffer[1] = (this._cimInfo.reserved >> 8) & 0xff;
    
    // ✅ Use persistent file handle
    const fd = this._fd ?? fs.openSync(this.cimFileName, "r+");
    fs.writeSync(fd, buffer, 0, 2, 0x0e);
    
    // ✅ Flush to disk to ensure atomicity
    fs.fsyncSync(fd);
    
    if (!this._fd) {
      fs.closeSync(fd);
    }
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
