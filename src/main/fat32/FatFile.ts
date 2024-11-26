import { dateToNumber, isWriteMode, lfnReservedChar, timeMsToNumber, timeToNumber, toFatLongName } from "./fat-utils";
import {
  FS_ATTR_ROOT32,
  FS_ATTR_DIRECTORY,
  O_CREAT,
  O_EXCL,
  O_RDWR,
  FILE_FLAG_PREALLOCATE,
  FS_ATTR_FILE,
  FILE_FLAG_CONTIGUOUS,
  FNAME_FLAG_NEED_LFN,
  FS_DIR_SIZE,
  FILE_FLAG_READ,
  SECTOR_MASK,
  BYTES_PER_SECTOR,
  BYTES_PER_SECTOR_SHIFT,
  FAT_NAME_DELETED,
  FAT_NAME_FREE,
  FAT_ORDER_LAST_LONG_ENTRY,
  FAT_ATTRIB_LONG_NAME,
  O_RDONLY,
  FS_ATTR_SUBDIR,
  FAT_CASE_LC_BASE,
  FAT_CASE_LC_EXT
} from "./Fat32Types";
import { Fat32Volume } from "./Fat32Volume";
import { FatDirEntry } from "./FatDirEntry";
import { FatLongFileName } from "./FatLongFileName";
import { calcShortNameCheckSum } from "./file-names";
import { FsName, FsPath } from "./FsName";

export const ERROR_ALREADY_OPEN = "The file is already open.";
export const ERROR_NOT_A_DIRECTORY = "The parent is not a directory.";
export const ERROR_PARENT_NOT_FOUND = "Parent directory not found.";
export const ERROR_NOT_OPEN = "The file is not open.";
export const ERROR_NOT_A_FILE = "The entry is not a file.";
export const ERROR_SEEK_PAST_EOF = "Seek past end of file.";
export const ERROR_SEEK_PAST_EOC = "Seek past end of cluster.";
export const ERROR_NO_READ = "The file is not open for reading.";
export const ERROR_NO_WRITE = "The file is not open for writing.";
export const ERROR_LFN_CANNOT_CREATE = "Long filename entry cannot be created.";

export class FatFile {
  private _attributes: number;
  private _flags: number;
  private _currentCluster = 0;
  private _currentPosition = 0;
  private _fileSize = 0;
  private _firstCluster = 0;
  private _error = "";

  get attributes(): number {
    return this._attributes;
  }

  get flags(): number {
    return this._flags;
  }

  get currentCluster(): number {
    return this._currentCluster;
  }

  get currentPosition(): number {
    return this._currentPosition;
  }

  get fileSize(): number {
    return this._fileSize;
  }

  get firstCluster(): number {
    return this._firstCluster;
  }

  get error(): string { 
    return this._error;
  }

  constructor(
    public readonly volume: Fat32Volume,
    attrs = 0,
    flags = 0
  ) {
    // --- The file is closed
    this._attributes = attrs;
    this._flags = flags;
    this._currentCluster = 0;
    this._currentPosition = 0;
    this._fileSize = 0;
    this._firstCluster = 0;
    this._error = "";
  }

  clone(): FatFile {
    const clone = new FatFile(this.volume);
    clone._attributes = this._attributes;
    clone._flags = this._flags;
    clone._currentCluster = this._currentCluster;
    clone._currentPosition = this._currentPosition;
    clone._fileSize = this._fileSize;
    clone._firstCluster = this._firstCluster;
    clone._error = this._error;
    return clone;
  }

  isOpen(): boolean {
    return !!this._attributes;
  }

  isRoot(): boolean {
    return !!(this._attributes & FS_ATTR_ROOT32);
  }

  isDirectory(): boolean {
    return !!(this._attributes & FS_ATTR_DIRECTORY);
  }

  isFile(): boolean {
    return !!(this._attributes & FS_ATTR_FILE);
  }

  isContiguous(): boolean {
    return !!(this._flags & FILE_FLAG_CONTIGUOUS);
  }

  isReadable(): boolean {
    return !!(this._flags & FILE_FLAG_READ);
  }

  close(): void {
    this._attributes = 0;
  }

  /**
   * Creates a directory
   * @param parent Parent directory
   * @param path Name of the directory
   * @param createMissingParents True, if missing parent directories should be created
   * @returns The created directory
   */
  mkdir(parent: FatFile, path: string, createMissingParents = true): boolean {
    if (this.isOpen()) {
      this._error = ERROR_ALREADY_OPEN;
      return false;
    }
    if (!parent.isDirectory()) {
      this._error = ERROR_NOT_A_DIRECTORY;
      return false;
    }

    let nameIndex = 0;
    if (path.charAt(0) === "/") {
      while (path.charAt(nameIndex) === "/") {
        nameIndex++;
      }
      parent = this.volume.openRootDirectory();
      if (!parent) {
        this._error = ERROR_PARENT_NOT_FOUND;
        return false;
      }
    }

    const fsPath = this.parsePathToLfn(path);
    for (let i = 0; i < fsPath.segments.length - 1; i++) {
      if (!this.doOpen(parent, fsPath.segments[i], O_RDONLY)) {
        if (!createMissingParents || !this.mkdir(parent, fsPath.segments[i].name)) {
          return false;
        }
      }
      parent = this.clone();
      close();
    }
    return this.doMkdir(parent, fsPath.segments[fsPath.segments.length - 1]);
  }

  /**
   * Opens a file or directory
   * @param parent Parent directory
   * @param fsName Name of the file or directory
   * @param flags File open
   */
  doOpen(parent: FatFile, fsName: FsName, flags: number): boolean {
    const fatFile = this;
    let filenameFound = false;

    if (!parent.isDirectory()) {
      this._error = ERROR_NOT_A_DIRECTORY;
      return false;
    }
    if (this.isOpen()) {
      this._error = ERROR_ALREADY_OPEN;
      return false;
    }

    // --- Position to the beginning of the directory
    parent.rewind();

    // --- Number of directory entries needed.
    const nameEntryCount = Math.floor((fsName.name.length + 12) / 13);
    const freeEntriesNeed = fsName.flags & FNAME_FLAG_NEED_LFN ? 1 + nameEntryCount : 1;

    // --- Find the number of free entries needed to create this directory entry
    let freeFound = 0;
    let freeIndex = 0;
    let curIndex = 0;
    while (true) {
      curIndex = Math.floor(parent._currentPosition / FS_DIR_SIZE);
      const dirEntry = parent.readDirectoryEntry();
      if (!dirEntry) {
        return create();
      }

      const firstByte = dirEntry.DIR_Name.charCodeAt(0);
      if (firstByte === FAT_NAME_DELETED || firstByte === FAT_NAME_FREE) {
        // --- This FAT entry is free (or can be reused)
        if (freeFound === 0) {
          freeIndex = curIndex;
        }
        if (freeFound < freeEntriesNeed) {
          freeFound++;
        }
        if (firstByte == FAT_NAME_FREE) {
          return create();
        }
      } else {
        if (freeFound < freeEntriesNeed) {
          freeFound = 0;
        }
      }

      // // skip empty slot or '.' or '..'
      // if (dir->name[0] == FAT_NAME_DELETED || dir->name[0] == '.') {
      //   lfnOrd = 0;
      // } else if (isFatLongName(dir)) {
      //   ldir = reinterpret_cast<DirLfn_t*>(dir);
      //   if (!lfnOrd) {
      //     order = ldir->order & 0X1F;
      //     if (order != nameOrd ||
      //         (ldir->order & FAT_ORDER_LAST_LONG_ENTRY) == 0) {
      //       continue;
      //     }
      //     lfnOrd = nameOrd;
      //     checksum = ldir->checksum;
      //   } else if (ldir->order != --order || checksum != ldir->checksum) {
      //     lfnOrd = 0;
      //     continue;
      //   }
      //   if (order == 1) {
      //     if (!dirFile->cmpName(curIndex + 1, fname, lfnOrd)) {
      //       lfnOrd = 0;
      //     }
      //   }
      // } else if (isFatFileOrSubdir(dir)) {
      //   if (lfnOrd) {
      //     if (1 == order && lfnChecksum(dir->name) == checksum) {
      //       goto found;
      //     }
      //     DBG_FAIL_MACRO;
      //     goto fail;
      //   }
      //   if (!memcmp(dir->name, fname->sfn, sizeof(fname->sfn))) {
      //     if (!(fname->flags & FNAME_FLAG_LOST_CHARS)) {
      //       goto found;
      //     }
      //     fnameFound = true;
      //   }
      // } else {
      //   lfnOrd = 0;
      // }
    }

    // found:
    //   // Don't open if create only.
    //   if (oflag & O_EXCL) {
    //     DBG_FAIL_MACRO;
    //     goto fail;
    //   }
    //   goto open;

    function create(): boolean {
      // --- Don't create unless O_CREAT and write mode
      if (!(flags & O_CREAT) || !isWriteMode(flags)) {
        fatFile._error = ERROR_NO_WRITE;
        return false;
      }

      // ---- Keep found entries or start at current index if no free entries found.
      if (freeFound == 0) {
        freeIndex = curIndex;
      }
      while (freeFound < freeEntriesNeed) {
        const dirEntry = parent.readDirectoryEntry();
        if (!dirEntry) {
          break;
        }
        freeFound++;
      }
      // --- Loop handles the case of huge filename and cluster size one.
      let freeTotal = freeFound;
      while (freeTotal < freeEntriesNeed) {
        //     if (!dirFile->addDirCluster()) {
        //       DBG_FAIL_MACRO;
        //       goto fail;
        //     }
        //     // 16-bit freeTotal needed for large cluster size.
        //     freeTotal += vol->dirEntriesPerCluster();
      }
      if (filenameFound) {
        // if (!dirFile->makeUniqueSfn(fname)) {
        //   goto fail;
        // }
      }
      let lfnOrd = freeEntriesNeed - 1;
      curIndex = freeIndex + lfnOrd;

      parent.createLFN(curIndex, fsName, lfnOrd);
      parent.seekSet(curIndex * FS_DIR_SIZE);
      const dir = parent.readDirectoryEntry();
      if (!dir) {
        return null;
      }
      // --- initialize as empty file
      dir.DIR_Name = fsName.sfn11;
      dir.DIR_Attr = 0;

      // --- Set base-name and extension lower case bits.
      const now = new Date();
      dir.DIR_NTRes = (FAT_CASE_LC_BASE | FAT_CASE_LC_EXT) & fsName.flags;
      dir.DIR_CrtTimeTenth = timeMsToNumber(now);
      dir.DIR_CrtTime = timeToNumber(now);
      dir.DIR_CrtDate = dateToNumber(now);
      dir.DIR_LstAccDate = dateToNumber(now);
      dir.DIR_FstClusHI = 0;
      dir.DIR_WrtTime = timeToNumber(now);
      dir.DIR_WrtDate = dateToNumber(now);
      dir.DIR_FstClusLO = 0;
      dir.DIR_FileSize = 0;

      // --- Force write of entry to device.
      //vol.cacheDirty();



      //   // initialize as empty file
      //   memset(dir, 0, sizeof(DirFat_t));
      //   memcpy(dir->name, fname->sfn, 11);

      //   // Set base-name and extension lower case bits.
      //   dir->caseFlags = (FAT_CASE_LC_BASE | FAT_CASE_LC_EXT) & fname->flags;

      //   // Set timestamps.
      //   if (FsDateTime::callback) {
      //     // call user date/time function
      //     FsDateTime::callback(&date, &time, &ms10);
      //     setLe16(dir->createDate, date);
      //     setLe16(dir->createTime, time);
      //     dir->createTimeMs = ms10;
      //   } else {
      //     setLe16(dir->createDate, FS_DEFAULT_DATE);
      //     setLe16(dir->modifyDate, FS_DEFAULT_DATE);
      //     setLe16(dir->accessDate, FS_DEFAULT_DATE);
      //     if (FS_DEFAULT_TIME) {
      //       setLe16(dir->createTime, FS_DEFAULT_TIME);
      //       setLe16(dir->modifyTime, FS_DEFAULT_TIME);
      //     }
      //   }
      //   // Force write of entry to device.
      //   vol->cacheDirty();
      return open();
    }

    function open(): boolean {
      //   // open entry in cache.
      //   if (!openCachedEntry(dirFile, curIndex, oflag, lfnOrd)) {
      //     DBG_FAIL_MACRO;
      //     goto fail;
      //   }
      return true;
    }
  }

  /**
   * Sets the current position to the specified offset
   * @param position File offset
   */
  seekSet(position: number): void {
    if (!this.isOpen()) {
      throw new Error(ERROR_NOT_OPEN);
    }

    // --- Optimize O_APPEND writes.
    if (position === this._currentPosition) {
      return;
    }

    // --- Set position to start of file
    if (position === 0) {
      this._currentCluster = 0;
      this._currentPosition = position;
      this._flags &= ~FILE_FLAG_PREALLOCATE;
      return;
    }

    // --- Check if the position is within the file size
    if (this.isFile()) {
      if (position > this._fileSize) {
        throw new Error(ERROR_SEEK_PAST_EOF);
      }
    }

    // --- Calculate cluster index for new position
    let nNew = (position - 1) >> this.volume.bytesPerClusterShift;
    if (this.isContiguous()) {
      this._currentCluster = this._firstCluster + nNew;
      this._currentPosition = position;
      this._flags &= ~FILE_FLAG_PREALLOCATE;
      return;
    }

    // --- calculate cluster index for current position
    let nCur = (this._currentPosition - 1) >> this.volume.bytesPerClusterShift;

    if (nNew < nCur || this._currentPosition === 0) {
      // --- Must follow chain from first cluster
      this._currentCluster = this.isRoot()
        ? this.volume.rootDirectoryStartCluster
        : this._firstCluster;
    } else {
      // advance from curPosition
      nNew -= nCur;
    }
    while (nNew--) {
      const fatValue = this.volume.getFatEntry(this._currentCluster);
      if (fatValue >= this.volume.countOfClusters) {
        throw new Error(ERROR_SEEK_PAST_EOC);
      }
      this._currentCluster = fatValue;
    }

    this._currentPosition = position;
    this._flags &= ~FILE_FLAG_PREALLOCATE;
  }

  /**
   * Creates a directory
   * @param parent Parent directory
   * @param fname Name of the directory as FsName
   * @returns The created directory
   */
  doMkdir(parent: FatFile, fname: FsName): boolean {
    if (!parent.isDirectory()) {
      this._error = ERROR_NOT_A_DIRECTORY;
      return false;
    }

    // --- Create a normal file
    if (!this.doOpen(parent, fname, O_CREAT | O_EXCL | O_RDWR)) {
      return false;
    }

    // --- Convert file to directory
    this._flags = FILE_FLAG_READ;
    this._attributes = FS_ATTR_SUBDIR;

    // --- Allocate and zero first cluster
    // if (!this.addDirCluster()) {
    //   return false;
    // }

    // this._firstCluster = this._currentCluster;

    // // --- Set to start of dir
    // this.rewind();

    // // --- force entry to device
    // // TODO

    // // --- Cache entry - should already be in cache due to sync() call
    // let dir = this.cacheDirEntry(CACHE_FOR_WRITE);
    // if (!dir) {
    //   return false;
    // }

    // // --- Change directory entry attribute
    // dir.DIR_Attr = FS_ATTR_DIRECTORY;

    // // --- Make entry for '.'
    // let dot = dir.clone();
    // dot.DIR_Name = ".".padEnd(11, " ");

    // // --- Cache sector for '.'  and '..'
    // let sector = this.volume.clusterStartSector(this._firstCluster);
    // let pc = this._vol.dataCachePrepare(sector, CACHE_FOR_WRITE);
    // if (!pc) {
    //   return false;
    // }

    // // --- Copy '.' dir to sector
    // pc.set(dot.buffer.slice(0, FS_DIR_SIZE), 0);

    // // --- Make entry for '..'
    // dot.DIR_Name = "..".padEnd(11, " ");
    // dot.DIR_FstClusLO = parent._firstCluster & 0xffff;
    // dot.DIR_FstClusHI = parent._firstCluster >> 16;

    // // --- Copy '..' to sector
    // pc.set(dot.buffer.slice(0, FS_DIR_SIZE), FS_DIR_SIZE);

    // --- Write first sector
    return true;
  }

  /**
   * Read data from the file
   * @param numBytes Number of bytes to read
   * @returns The bytes read from the file
   */
  readFileData(numBytes: number): Uint8Array {
    if (!this.isReadable()) {
      throw new Error(ERROR_NO_READ);
    }

    // --- Calculate the number of bytes to read
    if (this.isFile()) {
      const tmp = this._fileSize - this._currentPosition;
      if (numBytes >= tmp) {
        numBytes = tmp;
      }
    }

    // --- Data bytes left to read
    let toRead = numBytes;

    // --- Read data from the file
    let buffer = new Uint8Array(0);

    // --- Read all data is chunks
    while (toRead) {
      // --- As we iteratively read the file, we are at a particular cluster within the file.
      // --- In one iteration, we read data from the current cluster.

      // --- Calculate the offset within the current sector from the current position
      const offset = this._currentPosition & SECTOR_MASK;

      // --- Calculate the sector within its cluster from the current position
      const sectorOfCluster = this.volume.sectorOfCluster(this._currentPosition);

      // --- Determine the current cluster
      if (offset === 0 && sectorOfCluster === 0) {
        // --- We are at the beginning of the cluster
        if (this._currentPosition === 0) {
          // --- We are at the beginning of the file
          this._currentCluster = this.isRoot()
            ? this.volume.rootDirectoryStartCluster
            : this._firstCluster;
        } else if (this.isFile() && this.isContiguous()) {
          // --- We are at the beginning of a cluster in a contiguous file,
          // --- so we can calculate the next cluster
          this._currentCluster++;
        } else {
          // --- We are at the beginning of a cluster in a non-contiguous file or in a directory
          // --- We need to follow the cluster chain
          const fatValue = this.volume.getFatEntry(this._currentCluster);
          if (fatValue >= this.volume.countOfClusters) {
            if (this.isDirectory()) {
              break;
            }
            throw new Error(ERROR_SEEK_PAST_EOC);
          }
          this._currentCluster = fatValue;
        }
      }

      // --- At this point we have the current cluster set up, let's calculate the sector to read
      const sector = this.volume.clusterStartSector(this._currentCluster) + sectorOfCluster;

      // --- We are going to read n bytes from the current cluster
      let n: number;
      if (offset !== 0 || toRead < BYTES_PER_SECTOR) {
        // --- Amount to be read from current sector is less than a full sector
        n = BYTES_PER_SECTOR - offset;
        if (n > toRead) {
          n = toRead;
        }
        // --- Read sector and copy the data
        const sectorContent = this.volume.file.readSector(sector);
        const oldBuffer = buffer;
        buffer = new Uint8Array(oldBuffer.length + n);
        buffer.set(oldBuffer);
        buffer.set(sectorContent.subarray(offset, offset + n), oldBuffer.length);
      } else if (toRead >= 2 * BYTES_PER_SECTOR) {
        // --- Read more than two sectors, but not more that remains in the cluster
        let numSectorsToRead = toRead >> BYTES_PER_SECTOR_SHIFT;
        const remainingSectors = this.volume.bootSector.BPB_SecPerClus - sectorOfCluster;
        if (remainingSectors < numSectorsToRead) {
          numSectorsToRead = remainingSectors;
        }
        n = numSectorsToRead << BYTES_PER_SECTOR_SHIFT;
        const oldBuffer = buffer;
        buffer = new Uint8Array(oldBuffer.length + n);
        buffer.set(oldBuffer);
        for (let i = 0; i < numSectorsToRead; i++) {
          const sectorContent = this.volume.file.readSector(sector + i);
          buffer.set(sectorContent, oldBuffer.length + i * BYTES_PER_SECTOR);
        }
      } else {
        // --- Read a single sector
        n = BYTES_PER_SECTOR;
        const sectorContent = this.volume.file.readSector(sector);
        const oldBuffer = buffer;
        buffer = new Uint8Array(oldBuffer.length + n);
        buffer.set(oldBuffer);
        buffer.set(sectorContent.subarray(offset, offset + n), oldBuffer.length);
      }

      // --- Update the position and the remaining bytes
      this._currentPosition += n;
      toRead -= n;
    }

    // --- Done.
    return buffer;
  }

  createLFN(index: number, fname: FsName, lfnOrd: number): FatLongFileName | null {
    let ldir: FatLongFileName | null = null;
    const checksum = calcShortNameCheckSum(fname.sfn11);

    let nameIndex = 0;
    for (let order = 1; order <= lfnOrd; order++) {
      // --- Position to the long name entry
      this.seekSet((index - order) * FS_DIR_SIZE);
      const dirEntryBuffer = this.readDirectoryEntry();
      if (!dirEntryBuffer) {
        return null;
      }

      ldir = toFatLongName(dirEntryBuffer);
      if (!ldir) {
        return null;
      }
      ldir.LDIR_Ord = order == lfnOrd ? FAT_ORDER_LAST_LONG_ENTRY | order : order;
      ldir.LDIR_Attr = FAT_ATTRIB_LONG_NAME;
      ldir.LDIR_Type = 0;
      ldir.LDIR_Chksum = checksum;
      ldir.LDIR_FstClusLO = 0;

      let fc = 0;
      for (let i = 0; i < 13; i++) {
        let cp: number;
        if (nameIndex >= fname.name.length) {
          cp = fc++ ? 0xffff : 0;
        } else {
          cp = fname.name.charCodeAt(nameIndex++);
        }
        this.putLfnChar(ldir, i, cp);
      }
    }
    return ldir;
  }

  getLfnChar(ldir: FatLongFileName, i: number): number {
    if (i < 5) {
      return ldir.LDIR_Name1[i] & 0xffff;
    } else if (i < 11) {
      return ldir.LDIR_Name2[i - 5] & 0xffff;
    } else if (i < 13) {
      return ldir.LDIR_Name3[i - 11] & 0xffff;
    } else {
      throw new Error("Invalid long name character index");
    }
  }

  putLfnChar(ldir: FatLongFileName, i: number, c: number) {
    if (i < 5) {
      const tmp = ldir.LDIR_Name1;
      tmp[i] = c;
      ldir.LDIR_Name1 = tmp;
    } else if (i < 11) {
      const tmp = ldir.LDIR_Name2;
      tmp[i - 5] = c;
      ldir.LDIR_Name2 = tmp;
    } else if (i < 13) {
      const tmp = ldir.LDIR_Name3;
      tmp[i - 11] = c;
      ldir.LDIR_Name3 = tmp;
    }
  }

  // cmpName(index: number, fname: FsName, lfnOrd: number): boolean {
  //   const dir = this.clone();
  //   let nameIndex = 0;
  //   for (let order = 1; order <= lfnOrd; order++) {
  //     const ldir = toFatLongName(dir.cacheDir(index - order));
  //     if (!ldir) {
  //       return false;
  //     }
  //     for (let i = 0; i < 13; i++) {
  //       const u = this.getLfnChar(ldir, i);
  //       if (nameIndex >= fname.name.length) {
  //         return u === 0;
  //       }
  //       if (
  //         u > 0x7f ||
  //         String.fromCharCode(u).toUpperCase() !== fname.name.charAt(nameIndex++).toUpperCase()
  //       ) {
  //         return false;
  //       }
  //     }
  //   }
  //   return true;
  // }

  /**
   * Set the current position to the beginning of the file entry
   */
  private rewind(): void {
    this.seekSet(0);
  }

  private readDirectoryEntry(): FatDirEntry | null {
    const buffer = this.readFileData(FS_DIR_SIZE);
    if (!buffer || buffer.length < FS_DIR_SIZE) {
      return null;
    }
    return new FatDirEntry(buffer);
  }

  parsePathToLfn(path: string): FsPath {
    const result: FsPath = { segments: [] };
    const parts = path.split("/");
    parts.forEach((part) => {
      // --- Check for emptyness
      part = part.trim();
      if (!part) {
        throw new Error("Path segment cannot be empty");
      }

      // --- Check for reserved characters
      for (let i = 0; i < part.length; i++) {
        if (lfnReservedChar(part[i])) {
          throw new Error("Path segment contains reserved characters");
        }
      }

      // --- Trim trailing dot
      part = part.replace(/\.$/, "");

      // --- Add the segment
      result.segments.push(new FsName(part));
    });

    // --- Done
    return result;
  }
}
