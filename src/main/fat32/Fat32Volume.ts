import { CimFile } from "./CimFileManager";
import { timeToNumber, dateToNumber } from "./fat-utils";
import {
  BYTES_PER_SECTOR,
  EXTENDED_BOOT_SIGNATURE,
  FS_ATTR_ROOT32,
  FILE_FLAG_READ,
  FS_DIR_SIZE,
  FSINFO_LEAD_SIGNATURE,
  FSINFO_STRUCT_SIGNATURE,
  FSINFO_TRAIL_SIGNATURE,
  JUMP_CODE,
  SIGNATURE,
  FS_ATTR_DIRECTORY,
  BYTES_PER_SECTOR_SHIFT,
  FS_ATTR_LABEL,
  FS_ATTR_ARCHIVE,
  O_RDWR,
  O_RDONLY
} from "./Fat32Types";
import { FatBootSector } from "./FatBootSector";
import { FatDirEntry } from "./FatDirEntry";
import { FatFile } from "./FatFile";
import { FatFsInfo } from "./FatFsInfo";

export const ERROR_INVALID_FAT32_SIZE = "Invalid FAT32 size.";
export const ERROR_FAT_ENTRY_OUT_OF_RANGE = "FAT entry index out of range.";

/**
 * This class represents a FAT32 volume
 */

export class Fat32Volume {
  private _bootSector: FatBootSector | null = null;
  private _dataStartSector = 0;
  private _dataSectors = 0;
  private _countOfClusters = 0;
  private _countOfFatEntries = 0;
  private _sectorsPerClusterShift = 0;
  private _bytesPerClusterShift = 0;
  private _rootDirectoryStartCluster = 0;
  private _allocSearchStart = 0;
  private _lastCluster = 0;

  constructor(public readonly file: CimFile) {}

  get bootSector(): FatBootSector {
    return this._bootSector ?? (this._bootSector = new FatBootSector(this.file.readSector(0)));
  }

  get dataStartSector(): number {
    return this._dataStartSector;
  }

  get dataSectors(): number {
    return this._dataSectors;
  }

  get countOfClusters(): number {
    return this._countOfClusters;
  }

  get countOfFatEntries(): number {
    return this._countOfFatEntries;
  }

  get sectorsPerClusterShift(): number {
    return this._sectorsPerClusterShift;
  }

  get bytesPerClusterShift(): number {
    return this._bytesPerClusterShift;
  }

  get rootDirectoryStartCluster(): number {
    return this._rootDirectoryStartCluster;
  }

  get allocSearchStart(): number {
    return this._allocSearchStart;
  }

  get lastCluster(): number {
    return this._lastCluster;
  }

  get dirEntriesPerCluster(): number {
    return this.bootSector.BPB_SecPerClus * Math.floor(BYTES_PER_SECTOR / FS_DIR_SIZE);
  }

  /**
   * Format the volume
   * @param volumeName The name of the volume
   */
  format(volumeName = "NO NAME"): void {
    // --- Use the specified file
    const cimInfo = this.file.cimInfo;

    // --- Calculate some initial values
    const sectorCount = Math.floor((cimInfo.maxSize * 1024 * 1024) / BYTES_PER_SECTOR);
    const sectorsPerCluster =
      cimInfo.maxSize < 1024 ? 1 : cimInfo.maxSize < 2048 ? 4 : cimInfo.maxSize < 8192 ? 8 : 16;
    const totalClusters = sectorCount / sectorsPerCluster;
    const fat32Size = Math.ceil((totalClusters * 4) / 512);

    // --- Create the boot sector
    const bs = new FatBootSector(new Uint8Array(BYTES_PER_SECTOR));
    bs.BS_JmpBoot = JUMP_CODE;
    bs.BS_OEMName = "KLIVEIDE";
    bs.BPB_BytsPerSec = BYTES_PER_SECTOR;
    bs.BPB_SecPerClus = sectorsPerCluster;
    bs.BPB_ResvdSecCnt = 32;
    bs.BPB_NumFATs = 2;
    bs.BPB_RootEntCnt = 0;
    bs.BPB_TotSec16 = 0;
    bs.BPB_Media = 0xf8;
    bs.BPB_FATSz16 = 0;
    bs.BPB_SecPerTrk = 63;
    bs.BPB_NumHeads = 255;
    bs.BPB_HiddSec = 0;
    bs.BPB_TotSec32 = sectorCount;
    bs.BPB_FATSz32 = fat32Size;
    bs.BPB_FATSz32 = 0x000003f0;
    bs.BPB_ExtFlags = 0;
    bs.BPB_FSVer = 0;
    bs.BPB_RootClus = 2;
    bs.BPB_FSInfo = 1;
    bs.BPB_BkBootSec = 6;
    bs.BPB_Reserved = new Uint8Array(12);
    bs.BS_DrvNum = 0x80;
    bs.BS_Reserved1 = 0;
    bs.BS_BootSig = EXTENDED_BOOT_SIGNATURE;
    bs.BS_VolID = new Date().valueOf() & 0xffffffff;
    bs.BS_VolLab = volumeName.substring(0, 11).padEnd(11, " ");
    bs.BS_FileSysType = "FAT32".substring(0, 8).padEnd(8, " ");
    bs.BootCode = new Uint8Array(420);
    bs.BootSectorSignature = SIGNATURE;

    // --- Write the boot sector and its backup
    this.file.writeSector(0, bs.buffer);
    this.file.writeSector(6, bs.buffer);

    // --- Write extra boot area and backup
    const extraBoot = new Uint8Array(BYTES_PER_SECTOR);
    const extraDv = new DataView(extraBoot.buffer);
    extraDv.setUint32(508, FSINFO_TRAIL_SIGNATURE);
    this.file.writeSector(1, extraBoot);
    this.file.writeSector(7, extraBoot);

    // --- Calculate the number of free clusters
    const dataSectors = sectorCount - (FS_DIR_SIZE + 2 * fat32Size);
    const totalDataClusters = Math.floor(dataSectors / sectorsPerCluster);
    const freeClusters = totalDataClusters - 2;

    // --- Create the FS Information Sector
    const fsInfo = new FatFsInfo(new Uint8Array(BYTES_PER_SECTOR));
    fsInfo.FSI_LeadSig = FSINFO_LEAD_SIGNATURE;
    fsInfo.FSI_Reserved1 = new Uint8Array(480);
    fsInfo.FSI_StrucSig = FSINFO_STRUCT_SIGNATURE;
    fsInfo.FSI_Free_Count = freeClusters;
    fsInfo.FSI_Nxt_Free = 0xffffffff;
    fsInfo.FSI_Reserved2 = new Uint8Array(12);
    fsInfo.FSI_TrailSig = FSINFO_TRAIL_SIGNATURE;

    // --- Write the FS Information Sector
    this.file.writeSector(1, fsInfo.buffer);
    this.file.writeSector(7, fsInfo.buffer);

    // --- Initialize the FAT
    const fatStart = 32;
    const fatSector = new Uint8Array(BYTES_PER_SECTOR);
    for (let i = 0; i < 3; i++) {
      fatSector[4 * i + 0] = 0xff;
      fatSector[4 * i + 1] = 0xff;
      fatSector[4 * i + 2] = 0xff;
      fatSector[4 * i + 3] = 0x0f;
    }
    fatSector[0] = 0xf0;
    this.file.writeSector(fatStart + 0, fatSector);
    this.file.writeSector(fatStart + fat32Size, fatSector);

    // --- Initialize the volume entry
    const dataStartSector = bs.BPB_ResvdSecCnt + bs.BPB_FATSz32 * bs.BPB_NumFATs;
    const rootEntry = new FatDirEntry(new Uint8Array(FS_DIR_SIZE));
    rootEntry.DIR_Name = volumeName.substring(0, 11).padEnd(11, " ");
    rootEntry.DIR_Attr = FS_ATTR_LABEL | FS_ATTR_ARCHIVE;
    const now = new Date();
    rootEntry.DIR_WrtTime = timeToNumber(now);
    rootEntry.DIR_WrtDate = dateToNumber(now);
    const rootBuffer = new Uint8Array(BYTES_PER_SECTOR);
    rootBuffer.set(rootEntry.buffer);
    this.file.writeSector(dataStartSector, rootBuffer);
  }

  /**
   * Initialize the volume
   */
  init(): void {
    // --- Read the boot sector
    const bs = this.bootSector;
    this._dataStartSector = bs.BPB_ResvdSecCnt + bs.BPB_FATSz32 * bs.BPB_NumFATs;
    this._dataSectors = bs.BPB_TotSec32 - this._dataStartSector;
    this._countOfClusters = Math.floor(this._dataSectors / bs.BPB_SecPerClus);
    this._countOfFatEntries = bs.BPB_FATSz32 * (bs.BPB_BytsPerSec >> 2);
    this._sectorsPerClusterShift = Math.floor(Math.log2(bs.BPB_SecPerClus));
    this._bytesPerClusterShift = this._sectorsPerClusterShift + BYTES_PER_SECTOR_SHIFT;
    this._rootDirectoryStartCluster = bs.BPB_RootClus;
    this._allocSearchStart = 1;
    this._lastCluster = this._countOfClusters + 1;

    if (this._countOfClusters < 65525) {
      throw new Error(ERROR_INVALID_FAT32_SIZE);
    }
  }

  openRootDirectory(): FatFile {
    const root = new FatFile(this, FS_ATTR_ROOT32 | FS_ATTR_DIRECTORY, FILE_FLAG_READ);
    return root;
  }

  /**
   * Creates a directory directly in the root directory
   * @param filePath full file name, including path
   * @param createMissingParents True, if missing parent directories should be created
   */
  mkdir(filePath: string, createMissingParents = true): void {
    const parent = this.openRootDirectory();
    const file = new FatFile(this);
    file.mkdir(parent, filePath, createMissingParents);
  }

  open(filePath: string, mode: number): FatFile | null {
    const parent = this.openRootDirectory();
    const file = new FatFile(this);
    const result = file.open(parent, filePath, mode);
    return result ? file : null;
  }

  createFile(filePath: string): FatFile | null {
    const parent = this.openRootDirectory();
    const file = new FatFile(this);
    const result = file.createFile(parent, filePath);
    return result ? file : null;
  }

  rmDir(filePath: string): boolean {
    const parent = this.openRootDirectory();
    const file = new FatFile(this);
    const result = file.open(parent, filePath, O_RDONLY);
    return result ? file.rmDir() : false;
  }

  remove(filePath: string): boolean {
    const parent = this.openRootDirectory();
    const file = new FatFile(this);
    const result = file.open(parent, filePath, O_RDWR);
    return result ? file.remove() : false;
  }

  /**
   * Gets the FAT entry at the specified index
   * @param index FAT entry index
   */
  getFatEntry(index: number): number {
    const [sector, offset] = this.calculateFatEntry(index);
    return new DataView(this.file.readSector(sector).buffer).getInt32(offset, true);
  }

  /**
   * Sets the FAT entry at the specified index
   * @param index FAT entry index
   * @param value Value to set
   */
  setFatEntry(index: number, value: number): void {
    const [sector, offset] = this.calculateFatEntry(index);
    const buffer = this.file.readSector(sector);
    const dv = new DataView(buffer.buffer);
    dv.setInt32(offset, value, true);
    this.file.writeSector(sector, buffer);
  }

  /**
   * Gets the first sector of the specified cluster
   * @param cluster Cluster index
   */
  firstSectorOfCluster(cluster: number): number {
    return (cluster - 2) * this.bootSector.BPB_SecPerClus + this.dataStartSector;
  }

  sectorOfCluster(position: number): number {
    return (position >> BYTES_PER_SECTOR_SHIFT) & (this.bootSector.BPB_SecPerClus - 1);
  }

  clusterStartSector(cluster: number): number {
    return this._dataStartSector + ((cluster - 2) << this._sectorsPerClusterShift);
  }

  /**
   * Allocates a cluster for a file.
   * @param current Current cluster number
   * @returns Allocate cluster number or null if allocation failed
   */
  allocateCluster(current: number): number | null {
    let found: number;
    let setStart: boolean;

    // --- We should start searching the FAT chain
    if (this._allocSearchStart < current) {
      // --- Try to keep file contiguous. Start just after current cluster.
      found = current;
      setStart = false;
    } else {
      // --- Start at the beginning of the FAT.
      found = this._allocSearchStart;
      setStart = true;
    }

    // --- Iterate while we find a free cluster
    while (true) {
      found++;
      if (found > this._lastCluster) {
        if (setStart) {
          // --- Can't find space, checked all clusters.
          return null;
        }

        // --- We found a sector to check
        found = this._allocSearchStart;
        setStart = true;
        continue;
      }

      if (found === current) {
        // --- Can't find space, already searched clusters after current.
        return null;
      }

      const fatValue = this.getFatEntry(found);
      if (fatValue === 0) {
        break;
      }
    }

    if (setStart) {
      this._allocSearchStart = found;
    }

    // --- Mark end of chain.
    this.setFatEntry(found, 0x0fffffff);

    if (current) {
      // --- Link clusters
      this.setFatEntry(current, found);
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
      const fatValue = this.getFatEntry(endCluster);
      if (fatValue || fatValue >= this._countOfClusters) {
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
    this.setFatEntry(endCluster, 0x0fffffff);

    // --- Link clusters
    while (endCluster > bgnCluster) {
      this.setFatEntry(endCluster - 1, endCluster);
      endCluster--;
    }

    // --- Maintain count of free clusters
    this.updateFreeClusterCount(-count);

    // --- return first cluster number to caller
    return bgnCluster;
  }

  updateFreeClusterCount(change: number) {
    const fsInfo = this.readFsInfoSector();
    fsInfo.FSI_Free_Count += change;
    this.writeFsInfoSector(fsInfo);
  }

  freeChain(cluster: number): boolean {
    let fatEntry: number;
    do {
      fatEntry = this.getFatEntry(cluster);

      // --- Free the cluster
      this.setFatEntry(cluster, 0x00000000);

      // --- Add one to count of free clusters.
      this.updateFreeClusterCount(1);
      if (cluster < this._allocSearchStart) {
        this._allocSearchStart = cluster - 1;
      }

      // --- Move to next cluster
      cluster = fatEntry;
    } while (fatEntry <= this._countOfClusters);

    return true;
  }

  private calculateFatEntry(index: number): [number, number] {
    if (index < 2 || index >= this._countOfFatEntries) {
      throw new Error(ERROR_FAT_ENTRY_OUT_OF_RANGE);
    }
    const bps = this.bootSector.BPB_BytsPerSec;
    const sector = this.bootSector.BPB_ResvdSecCnt + Math.floor((index * 4) / bps);
    const offset = (index * 4) % bps;
    return [sector, offset];
  }

  private readFsInfoSector(): FatFsInfo {
    return new FatFsInfo(this.file.readSector(1));
  }

  private writeFsInfoSector(fsInfo: FatFsInfo) {
    this.file.writeSector(1, fsInfo.buffer);
    this.file.writeSector(7, fsInfo.buffer);
  }
}
