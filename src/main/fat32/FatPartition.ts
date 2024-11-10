import {
  BYTES_PER_SECTOR,
  BYTES_PER_SECTOR_SHIFT,
  Fat32BootSector,
  Fat32FSInfo,
  Fat32MasterBootRecord,
  FS_DIR_SIZE,
  SECTOR_MASK
} from "@abstractions/Fat32Types";
import { CimFile } from "./CimFileManager";
import { BinaryReader } from "@common/utils/BinaryReader";
import { toBootSector, toFsInfoSector } from "./fat-utils";
import { BinaryWriter } from "@common/utils/BinaryWriter";
import { CACHE_STATUS_MIRROR_FAT, FsCache } from "./FsCache";

export class FatPartition {
  // --- Cluster size in sectors
  private _sectorsPerCluster = 0;

  // --- Mask to extract sector of cluster
  private _clusterSectorMask = 0;

  // --- Cluster count to sector count shift
  private _sectorsPerClusterShift = 0;

  // --- Number of entries in FAT16 root dir
  private _rootDirEntryCount = 0;

  // --- Start cluster for alloc search
  private _allocSearchStart = 0;

  // --- FAT size in sectors
  private _sectorsPerFat = 0;

  // ---First data sector number
  private _dataStartSector = 0;

  // --- Start sector for first FAT
  private _fatStartSector = 0;

  // --- Last cluster number in FAT.
  private _lastCluster = 0;

  // --- Start sector FAT16, cluster FAT32.
  private _rootDirStart = 0;

  // --- Start of the volume.
  private _volumeStart = 0;

  private _cache: FsCache;

  constructor(public readonly cimFile: CimFile) {
    this._cache = new FsCache(cimFile);
  }

  // --- The shift count required to multiply by bytesPerCluster
  get bytesPerClusterShift() {
    return this._sectorsPerClusterShift + BYTES_PER_SECTOR_SHIFT;
  }

  // --- Number of bytes in a cluster.
  get bytesPerCluster() {
    return BYTES_PER_SECTOR << this._sectorsPerClusterShift;
  }

  // --- Number of directory entries per cluster
  get dirEntriesPerCluster() {
    return this._sectorsPerCluster * Math.floor(BYTES_PER_SECTOR / FS_DIR_SIZE);
  }

  // --- Mask for sector offset
  get sectorMask() {
    return SECTOR_MASK;
  }

  // --- The volume's cluster size in sectors
  get sectorsPerCluster() {
    return this._sectorsPerCluster;
  }

  // --- The number of sectors in one FAT
  get sectorsPerFat() {
    return this._sectorsPerFat;
  }

  // --- The total number of clusters in the volume
  get clusterCount() {
    return this._lastCluster - 1;
  }

  // --- The shift count required to multiply by sectorsPerCluster
  get sectorsPerClusterShift() {
    return this._sectorsPerClusterShift;
  }

  // --- The logical sector number for the start of file data
  get dataStartSector() {
    return this._dataStartSector;
  }

  // --- The logical sector number for the start of the first FAT
  get fatStartSector() {
    return this._fatStartSector;
  }

  // --- The number of entries in the root directory for FAT16 volumes
  get rootDirEntryCount() {
    return this._rootDirEntryCount;
  }

  // --- The logical sector number for the start of the root directory on FAT16 volumes
  // --- or the first cluster number on FAT32 volumes
  get rootDirStart() {
    return this._rootDirStart;
  }

  // --- The number of sectors in the volume
  get volumeSectorCount() {
    return this._sectorsPerCluster * this.clusterCount;
  }

  // --- The current data cache
  get dataCache() {
    return this._cache.cacheBuffer;
  }

  /** Initialize a FAT partition.
   * @param part The partition to be used. Legal values for \a part are 1-4 to use the 
   * corresponding partition on a device formatted with a MBR, Master Boot Record, 
   * or zero if the device is formatted as a super floppy with the FAT boot sector in sector volStart.
   * @param volStart location of volume if part is zero.
   * @return true for success or false for failure.
   */
  init(part = 1, volStart = 0): boolean {
    let totalSectors: number;
    this._volumeStart = volStart;
    this._allocSearchStart = 1;
    this._cache.init();
    
    // --- if part == 0 assume super floppy with FAT boot sector in sector zero
    // --- if part > 0 assume mbr volume with partition table
    if (part) {
      if (part > 4) {
        return false;
      }
      const mbr = this.cimFile.readMbr();
      const mp = mbr.partitions[part - 1];
      if (mp.partType === 0 || (mp.bootIndicator !== 0 && mp.bootIndicator !== 0x80)) {
        return false;
      }
      this._volumeStart = mp.relativeSectors;
    }

    // --- Read the boot sector
    const pbs = this.readBootSector();
    if (pbs.BPB_NumFATs !== 2 || (pbs.BPB_BytsPerSec) !== BYTES_PER_SECTOR) {
      return false;
    }
    this._sectorsPerCluster = pbs.BPB_SecPerClus;
    this._clusterSectorMask = this._sectorsPerCluster - 1;
    
    // --- Determine shift that is same as multiply by m_sectorsPerCluster
    this._sectorsPerClusterShift = 0;
    for (let tmp = 1; this._sectorsPerCluster !== tmp; tmp <<= 1) {
      if (tmp === 0) {
        return false;
      }
      this._sectorsPerClusterShift++;
    }
    this._sectorsPerFat = pbs.BPB_FATSz32;
    this._fatStartSector = volStart + pbs.BPB_ResvdSecCnt;
  
    // --- Count for FAT16 zero for FAT32
    this._rootDirEntryCount = pbs.BPB_RootEntCnt;
  
    // --- Directory start for FAT16 dataStart for FAT32
    this._rootDirStart = this._fatStartSector + 2 * this._sectorsPerFat;

    // --- Data start for FAT16 and FAT32
    this._dataStartSector =
        this._rootDirStart +
        Math.floor((FS_DIR_SIZE * this._rootDirEntryCount + BYTES_PER_SECTOR - 1) /
         BYTES_PER_SECTOR);
  
    // --- Total sectors for FAT16 or FAT32
    totalSectors = pbs.BPB_TotSec32;

    // --- Total data sectors
    let countOfClusters = totalSectors - (this._dataStartSector - volStart);
  
    // --- Divide by cluster size to get cluster count
    countOfClusters >>= this._sectorsPerClusterShift;
    this._lastCluster = countOfClusters + 1;
  
    // --- Indicate unknown number of free clusters.
    this.setFreeClusterCount(-1);
    
    // --- FAT type is determined by cluster count
    if (countOfClusters < 65525) {
      throw new Error("Cluster count is too low for FAT32");
    } else {
      this._rootDirStart = pbs.BPB_RootClus;
    }

    // --- Done
    return true;
  };

  /** 
   * Clear the cache and returns a pointer to the cache. Not for normal apps.
   * @return The cache buffer or null if an error occurs.
   */
  cacheClear() { return this._cache.clear(); }

  cacheSafeRead(sector: number, count?: number): Uint8Array | null {
    return this._cache.cacheSafeRead(sector, count);
  }

  cacheSafeWrite(sector: number, src: Uint8Array, count?: number) {
    return this._cache.cacheSafeWrite(sector, src, count);
  }

  fatCachePrepare(sector: number, options: number): Uint8Array | null {
    options |= CACHE_STATUS_MIRROR_FAT;
    return this.dataCachePrepare(sector, options);
  }
  
  cacheSync() { return this._cache.sync() && this.syncDevice(); }

  dataCachePrepare(sector: number, options: number): Uint8Array | null {
    return this._cache.prepare(sector, options);
  }

  cacheSyncData() { return this._cache.sync(); }

  get cacheSectorNumber() { return this._cache.sector; }

  cacheDirty() { this._cache.dirty(); }


  readMasterBootRecord(): Fat32MasterBootRecord {
    return this.cimFile.readMbr();
  }
  
  readBootSector(): Fat32BootSector {
    return toBootSector(this.cimFile.readSector(this._volumeStart));
  }

  readFSInfoSector(): Fat32FSInfo {
    return toFsInfoSector(this.cimFile.readSector(this._volumeStart + 1));
  }

  // --- Synchronizes the block device with the volume
  syncDevice() {
    // TODO: Implement this
    return true;
  }

  setFreeClusterCount(value: number): void {
    const fsInfo = this.readFSInfoSector();
    fsInfo.FSI_Free_Count = value;
    this.writeFsInfoSector(fsInfo);
  }

  updateFreeClusterCount(change: number) {
    const fsInfo = this.readFSInfoSector();
    fsInfo.FSI_Free_Count += change;
    this.writeFsInfoSector(fsInfo);
  }

  /**
   * Allocates a cluster for a file.
   * @param current Current cluster number
   * @returns Allocate cluster number or null if allocation failed
   */
  allocateCluster(current: number): number | null {
    let found: number;
    let setStart: boolean;
    if (this._allocSearchStart < current) {
      // --- Try to keep file contiguous. Start just after current cluster.
      found = current;
      setStart = false;
    } else {
      found = this._allocSearchStart;
      setStart = true;
    }
    while (true) {
      found++;
      if (found > this._lastCluster) {
        if (setStart) {
          // --- Can't find space, checked all clusters.
          return null;
        }
        found = this._allocSearchStart;
        setStart = true;
        continue;
      }

      if (found === current) {
        // --- Can't find space, already searched clusters after current.
        return null;
      }

      const fg = this.fatGet(found);
      if (fg.status < 0) {
        // --- Error reading FAT.
        return null;
      }
      if (fg.status && fg.next === 0) {
        break;
      }
    }
    if (setStart) {
      this._allocSearchStart = found;
    }

    // --- Mark end of chain.
    if (!this.fatPutEOC(found)) {
      return null;
    }

    if (current) {
      // Link clusters.
      if (!this.fatPut(current, found)) {
        return null;
      }
    }
    this.updateFreeClusterCount(-1);
    return found;
  }

  /**
   * Allocates contiguous clusters for a file.
   * @param count Number of clusters to allocate
   * @returns First cluster number or null if allocation failed
   */
  allocContiguous(count: number): number | null {
    // --- Flag to save place to start next search
    let setStart = true;
    // --- Start of group
    let bgnCluster: number;
    // --- End of group
    let endCluster = (bgnCluster = this._allocSearchStart + 1);

    // --- Search the FAT for free clusters
    while (1) {
      if (endCluster > this._lastCluster) {
        // --- Can't find space.
        return null;
      }
      const fg = this.fatGet(endCluster);
      if (fg.status < 0) {
        return null;
      }
      if (fg.next || fg.status === 0) {
        // --- Don't update search start if unallocated clusters before endCluster.
        if (bgnCluster !== endCluster) {
          setStart = false;
        }

        // --- Cluster in use try next cluster as bgnCluster
        bgnCluster = endCluster + 1;
      } else if (endCluster - bgnCluster + 1 === count) {
        // done - found space
        break;
      }
      endCluster++;
    }

    // --- Remember possible next free cluster.
    if (setStart) {
      this._allocSearchStart = endCluster;
    }

    // --- Mark end of chain
    if (!this.fatPutEOC(endCluster)) {
      return null;
    }

    // --- Link clusters
    while (endCluster > bgnCluster) {
      if (!this.fatPut(endCluster - 1, endCluster)) {
        return null;
      }
      endCluster--;
    }

    // --- Maintain count of free clusters
    this.updateFreeClusterCount(-count);

    // --- return first cluster number to caller
    return bgnCluster;
  }

  sectorOfCluster(position: number) {
    return (position >> BYTES_PER_SECTOR_SHIFT) & this._clusterSectorMask;
  }

  clusterStartSector(cluster: number) {
    return this._dataStartSector + ((cluster - 2) << this._sectorsPerClusterShift);
  }

  // --- Fetches a FAT entry
  fatGet(cluster: number): { next: number; status: number } {
 
    // --- Error if reserved cluster of beyond FAT
    if (cluster < 2 || cluster > this._lastCluster) {
      return { next: 0, status: -1 };
    }
  
    const sector = this._fatStartSector + (cluster >> (BYTES_PER_SECTOR_SHIFT - 2));
    const reader = new BinaryReader(this.cimFile.readSector(sector));
    reader.seek((cluster << 2) & SECTOR_MASK);
    const next = reader.readUint32();
    if (this.isEOC(next)) {
      return { next, status: 0 };
    }
    return { next, status: 1 };
  }

  fatPut(cluster: number, value: number): boolean {
    //uint8_t* pc;
  
    // --- Error if reserved cluster of beyond FAT
    if (cluster < 2 || cluster > this._lastCluster) {
      return false;
    }
  
    let sector = this._fatStartSector + (cluster >> (BYTES_PER_SECTOR_SHIFT - 2));
    const content = this.cimFile.readSector(sector);
    const writer = new BinaryWriter();
    const offset = (cluster << 2) & SECTOR_MASK;
    writer.writeBytes(content.subarray(0, offset));
    writer.writeUint32(value);
    writer.writeBytes(content.subarray(offset + 4));
    this.cimFile.writeSector(sector, writer.buffer);
    return true;
  }

  fatPutEOC(cluster: number) {
    return this.fatPut(cluster, 0x0fffffff);
  }

  freeChain(cluster: number): boolean {
    let fg: { next: number; status: number };
    do {
      fg = this.fatGet(cluster);
      if (fg.status < 0) {
        return false;
      }
      // --- Free cluster
      if (!this.fatPut(cluster, 0)) {
        return false;
      }

      // --- Add one to count of free clusters.
      this.updateFreeClusterCount(1);
      if (cluster < this._allocSearchStart) {
        this._allocSearchStart = cluster - 1;
      }
      cluster = fg.next;
    } while (fg);
  
    return true;
  }

  isEOC(cluster: number) {
    return cluster > this._lastCluster;
  }

  private writeFsInfoSector(fsInfo: Fat32FSInfo) {
    const writer = new BinaryWriter();
    writer.writeUint32(fsInfo.FSI_LeadSig);
    writer.writeBytes(fsInfo.FSI_Reserved1);
    writer.writeUint32(fsInfo.FSI_StrucSig);
    writer.writeUint32(fsInfo.FSI_Free_Count);
    writer.writeUint32(fsInfo.FSI_Nxt_Free);
    writer.writeBytes(fsInfo.FSI_Reserved2);
    writer.writeUint32(fsInfo.FSI_TrailSig);
    this.cimFile.writeSector(this._volumeStart + 1, writer.buffer);
    this.cimFile.writeSector(this._volumeStart + 7, writer.buffer);
  }
}
