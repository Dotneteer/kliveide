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
  BYTES_PER_SECTOR
} from "./Fat32Types";
import { Fat32Volume } from "./Fat32Volume";
import { FatDirEntry } from "./FatDirEntry";
import { FsName } from "./FsName";

export const ERROR_ALREADY_OPEN = "The file is already open.";
export const ERROR_NOT_A_DIRECTORY = "The parent is not a directory.";
export const ERROR_PARENT_NOT_FOUND = "Parent directory not found.";
export const ERROR_NOT_OPEN = "The file is not open.";
export const ERROR_NOT_A_FILE = "The entry is not a file.";
export const ERROR_SEEK_PAST_EOF = "Seek past end of file.";
export const ERROR_SEEK_PAST_EOC = "Seek past end of cluster.";
export const ERROR_NO_READ = "The file is not open for reading.";

export class FatFile {
  private _attributes: number;
  private _flags: number;
  private _currentCluster = 0;
  private _currentPosition = 0;
  private _fileSize = 0;
  private _firstCluster = 0;

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
   * @param name Name of the directory
   * @param createMissingParents True, if missing parent directories should be created
   * @returns The created directory
   */
  mkdir(parent: FatFile, name: string, createMissingParents = true): void {
    if (this.isOpen()) {
      throw new Error(ERROR_ALREADY_OPEN);
    }
    if (!parent.isDirectory()) {
      throw new Error(ERROR_NOT_A_DIRECTORY);
    }

    // --- Check if the name starts with a slash
    if (name.charAt(0) === "/") {
      // --- Remove the leading slash
      while (name.charAt(0) === "/") {
        name = name.substring(1);
      }

      // --- Start from the root directory
      parent = this.volume.openRootDirectory();
    }

    // --- Split the path into segments
    const segments = name.split("/");
    for (let i = 0; i < segments.length - 2; i++) {
      if (!segments[i]) {
        continue;
      }

      // TODO: Open the directory segments in the path
    }

    // --- Create the last directory segment
    this.doMkdir(parent, segments[segments.length - 1]);
  }

  /**
   * Opens a file or directory
   * @param parent Parent directory
   * @param name Name of the file or directory
   * @param flags File open
   */
  open(parent: FatFile, name: string, flags: number): void {
    if (!parent.isDirectory()) {
      throw new Error(ERROR_NOT_A_DIRECTORY);
    }
    if (this.isOpen()) {
      throw new Error(ERROR_ALREADY_OPEN);
    }

    // --- Position to the beginning of the directory
    parent.rewind();
    const fsName = new FsName(name);

    // Number of directory entries needed.
    const nameEntryCount = Math.floor((name.length + 12) / 13);
    const freeEntryNeed = fsName.flags & FNAME_FLAG_NEED_LFN ? 1 + nameEntryCount : 1;
    while (true) {
      const curIndex = Math.floor(parent._currentPosition / FS_DIR_SIZE);
      //   dir = dirFile->readDirCache();
      //   if (!dir) {
      //     if (dirFile->getError()) {
      //       DBG_FAIL_MACRO;
      //       goto fail;
      //     }
      //     // At EOF
      //     goto create;
      //   }
      //   if (dir->name[0] == FAT_NAME_DELETED || dir->name[0] == FAT_NAME_FREE) {
      //     if (freeFound == 0) {
      //       freeIndex = curIndex;
      //     }
      //     if (freeFound < freeNeed) {
      //       freeFound++;
      //     }
      //     if (dir->name[0] == FAT_NAME_FREE) {
      //       goto create;
      //     }
      //   } else {
      //     if (freeFound < freeNeed) {
      //       freeFound = 0;
      //     }
      //   }
      //   // skip empty slot or '.' or '..'
      //   if (dir->name[0] == FAT_NAME_DELETED || dir->name[0] == '.') {
      //     lfnOrd = 0;
      //   } else if (isFatLongName(dir)) {
      //     ldir = reinterpret_cast<DirLfn_t*>(dir);
      //     if (!lfnOrd) {
      //       order = ldir->order & 0X1F;
      //       if (order != nameOrd ||
      //           (ldir->order & FAT_ORDER_LAST_LONG_ENTRY) == 0) {
      //         continue;
      //       }
      //       lfnOrd = nameOrd;
      //       checksum = ldir->checksum;
      //     } else if (ldir->order != --order || checksum != ldir->checksum) {
      //       lfnOrd = 0;
      //       continue;
      //     }
      //     if (order == 1) {
      //       if (!dirFile->cmpName(curIndex + 1, fname, lfnOrd)) {
      //         lfnOrd = 0;
      //       }
      //     }
      //   } else if (isFatFileOrSubdir(dir)) {
      //     if (lfnOrd) {
      //       if (1 == order && lfnChecksum(dir->name) == checksum) {
      //         goto found;
      //       }
      //       DBG_FAIL_MACRO;
      //       goto fail;
      //     }
      //     if (!memcmp(dir->name, fname->sfn, sizeof(fname->sfn))) {
      //       if (!(fname->flags & FNAME_FLAG_LOST_CHARS)) {
      //         goto found;
      //       }
      //       fnameFound = true;
      //     }
      //   } else {
      //     lfnOrd = 0;
      //   }
    }

    // found:
    //   // Don't open if create only.
    //   if (oflag & O_EXCL) {
    //     DBG_FAIL_MACRO;
    //     goto fail;
    //   }
    //   goto open;

    // create:
    //   // don't create unless O_CREAT and write mode
    //   if (!(oflag & O_CREAT) || !isWriteMode(oflag)) {
    //     DBG_WARN_MACRO;
    //     goto fail;
    //   }
    //   // Keep found entries or start at current index if no free entries found.
    //   if (freeFound == 0) {
    //     freeIndex = curIndex;
    //   }
    //   while (freeFound < freeNeed) {
    //     dir = dirFile->readDirCache();
    //     if (!dir) {
    //       if (dirFile->getError()) {
    //         DBG_FAIL_MACRO;
    //         goto fail;
    //       }
    //       // EOF if no error.
    //       break;
    //     }
    //     freeFound++;
    //   }
    //   // Loop handles the case of huge filename and cluster size one.
    //   freeTotal = freeFound;
    //   while (freeTotal < freeNeed) {
    //     // Will fail if FAT16 root.
    //     if (!dirFile->addDirCluster()) {
    //       DBG_FAIL_MACRO;
    //       goto fail;
    //     }
    //     // 16-bit freeTotal needed for large cluster size.
    //     freeTotal += vol->dirEntriesPerCluster();
    //   }
    //   if (fnameFound) {
    //     if (!dirFile->makeUniqueSfn(fname)) {
    //       goto fail;
    //     }
    //   }
    //   lfnOrd = freeNeed - 1;
    //   curIndex = freeIndex + lfnOrd;
    //   if (!dirFile->createLFN(curIndex, fname, lfnOrd)) {
    //     goto fail;
    //   }
    //   dir = dirFile->cacheDir(curIndex);
    //   if (!dir) {
    //     DBG_FAIL_MACRO;
    //     goto fail;
    //   }
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

    // open:
    //   // open entry in cache.
    //   if (!openCachedEntry(dirFile, curIndex, oflag, lfnOrd)) {
    //     DBG_FAIL_MACRO;
    //     goto fail;
    //   }
    //   return true;
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
   * @param name Name of the directory as FsName
   * @returns The created directory
   */
  doMkdir(parent: FatFile, name: string): void {
    if (!parent.isDirectory()) {
      throw new Error(ERROR_NOT_A_DIRECTORY);
    }

    this.open(parent, name, O_CREAT | O_EXCL | O_RDWR);
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
    const toRead = numBytes;

    while (toRead) {
      const offset = this._currentPosition & SECTOR_MASK;
      const sectorOfCluster = this.volume.sectorOfCluster(this._currentPosition);
      if (offset === 0 && sectorOfCluster === 0) {
        // --- Start of new cluster
        if (this._currentPosition === 0) {
          // --- Use first cluster in file
          this._currentCluster = this.isRoot()
            ? this.volume.rootDirectoryStartCluster
            : this._firstCluster;
        } else if (this.isFile() && this.isContiguous()) {
          this._currentCluster++;
        } else {
          // --- Get next cluster from FAT
          const fatValue = this.volume.getFatEntry(this._currentCluster);
          if (fatValue >= this.volume.countOfClusters) {
            if (this.isDirectory()) {
              break;
            }
            throw new Error(ERROR_SEEK_PAST_EOC);
          }
          this._currentCluster = fatValue;
        }
        const sector = this.volume.clusterStartSector(this._currentCluster) + sectorOfCluster;
      }

      if (offset !== 0 || toRead < BYTES_PER_SECTOR || sector === m_vol->cacheSectorNumber()) {
      //   // amount to be read from current sector
      //   n = m_vol->bytesPerSector() - offset;
      //   if (n > toRead) {
      //     n = toRead;
      //   }
      //   // read sector to cache and copy data to caller
      //   pc = m_vol->dataCachePrepare(sector, FsCache::CACHE_FOR_READ);
      //   if (!pc) {
      //     DBG_FAIL_MACRO;
      //     goto fail;
      //   }
      //   uint8_t* src = pc + offset;
      //   memcpy(dst, src, n);
      // } else if (toRead >= 2 * m_vol->bytesPerSector()) {
      //   uint32_t ns = toRead >> m_vol->bytesPerSectorShift();
      //   if (!isRootFixed()) {
      //     uint32_t mb = m_vol->sectorsPerCluster() - sectorOfCluster;
      //     if (mb < ns) {
      //       ns = mb;
      //     }
      //   }
      //   n = ns << m_vol->bytesPerSectorShift();
      //   if (!m_vol->cacheSafeRead(sector, dst, ns)) {
      //     DBG_FAIL_MACRO;
      //     goto fail;
      //   }
      // } else {
      //   // read single sector
      //   n = m_vol->bytesPerSector();
      //   if (!m_vol->cacheSafeRead(sector, dst)) {
      //     DBG_FAIL_MACRO;
      //     goto fail;
      //   }
      // }
      // dst += n;
      // m_curPosition += n;
      // toRead -= n;
    }
  }

  /**
   * Set the current position to the beginning of the file entry
   */
  private rewind(): void {
    this.seekSet(0);
  }

  private readDirectoryEntry(skipReadOk = false): FatDirEntry | null {
    throw new Error("Not implemented");
    //     const index = (this._currentPosition >> 5) & 0x0f;
    //     if (!index || !skipReadOk) {
    //       int8_t n = read(&n, 1);
    //       if (n != 1) {
    //         if (n != 0) {
    //           DBG_FAIL_MACRO;
    //         }
    //         goto fail;
    //       }
    //       m_curPosition += FS_DIR_SIZE - 1;
    //     } else {
    //       m_curPosition += FS_DIR_SIZE;
    //     }
    //     // return pointer to entry
    //     return reinterpret_cast<DirFat_t*>(m_vol->cacheAddress()) + i;
    //   fail:
    //     return nullptr;
    //   }
  }
}
