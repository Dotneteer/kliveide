import { CimInfo } from "@abstractions/CimInfo";
import { BinaryReader } from "@common/utils/BinaryReader";
import { head } from "lodash";

export const MAX_CLUSTERS = 32760;

/**
 * This class is repsonsible for handling the CIM data stored in memory
 */
export class CimHandler {
  private _cimInfo: CimInfo;
  private _changes: CimChangeInfo;

  constructor(public readonly cimData: Uint8Array) {
    this.readHeader();
    this.resetChanges();
  }

  get cimInfo(): CimInfo {
    return this._cimInfo;
  }

  get changes(): CimChangeInfo {
    return this._changes;
  }

  resetChanges(): void {
    this._changes = {
      clusterAllocations: [],
      sectorChanges: {}
    };
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
    const sectorBytes = this._cimInfo.sectorSize * 512;
    const sectorPointer =
      0x1_0000 +
      clusterPointer * this._cimInfo.clusterSize * 0x1_0000 +
      sectorInCluster * sectorBytes;
    const buffer = this.cimData.slice(sectorPointer, sectorPointer + sectorBytes)

    // --- Done
    return buffer;
  }

  writeSector(sectorIndex: number, data: Uint8Array): void {
    this.checkSectorIndex(sectorIndex);

    // --- Check the data length
    if (data.length !== this._cimInfo.sectorSize * 512) {
      throw new Error("Invalid data length");
    }

    // --- Save the modified sector data
    this._changes.sectorChanges[sectorIndex] = data;

    // --- Calculate the cluster index and the sector in the cluster
    const sectorsPerCluster = (this._cimInfo.clusterSize * 128) / this._cimInfo.sectorSize;
    const clusterIndex = Math.floor(sectorIndex / sectorsPerCluster);
    const sectorInCluster = sectorIndex % sectorsPerCluster;
    const clusterPointer = this._cimInfo.clusterMap[clusterIndex];

    // --- Check if the cluster is empty
    if (clusterPointer === 0xffff) {
      // --- This is an empty cluster, create a new cluster
      const currentClusters = this._cimInfo.maxClusters++;
      this._cimInfo.clusterMap[clusterIndex] = currentClusters;
      
      // --- Save the index of the newly allocated cluster
      this._changes.clusterAllocations.push(clusterIndex);

      const newCluster = new Uint8Array(this._cimInfo.clusterSize * 0x1_0000);
      newCluster.set(data, sectorInCluster * this._cimInfo.sectorSize * 512);
      
      // --- Extend the CIM data with the new cluster
      const extendedArray = new Uint8Array(this.cimData.length + newCluster.length);
      extendedArray.set(this.cimData);
      extendedArray.set(newCluster, this.cimData.length);

      // --- Done.
      return;
    }

    // --- White the modified sector data
    const sectorBytes = this._cimInfo.sectorSize * 512;
    const sectorPointer =
      0x1_0000 +
      clusterPointer * this._cimInfo.clusterSize * 0x1_0000 +
      sectorInCluster * sectorBytes;
    this.cimData.set(data, sectorPointer);
  }

  private readHeader(): void {
    const reader = new BinaryReader(this.cimData);
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
    }
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

/**
 * This type represents the changes in the CIM file
 */
export type CimChangeInfo = {
  /**
   * New cluster indexes (in allocation order)
   */
  clusterAllocations: number[];

  /**
   * Updated sectors with the new sector data
   */
  sectorChanges: { [sectorIndex: number]: Uint8Array };
}
