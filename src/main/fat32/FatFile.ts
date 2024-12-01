import {
  dateToNumber,
  isFatFile,
  isFatFileOrSubdir,
  isWriteMode,
  lfnReservedChar,
  timeMsToNumber,
  timeToNumber,
} from "./fat-utils";
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
  O_RDONLY,
  FS_ATTR_SUBDIR,
  FAT_CASE_LC_BASE,
  FAT_CASE_LC_EXT,
  FILE_FLAG_WRITE,
  FILE_FLAG_APPEND,
  FILE_FLAG_DIR_DIRTY,
  FS_ATTRIB_COPY,
  O_ACCMODE,
  O_TRUNC,
  O_WRONLY,
  FS_ATTR_READ_ONLY,
  FS_ATTR_ARCHIVE,
  O_APPEND,
  O_AT_END
} from "./Fat32Types";
import { Fat32Volume } from "./Fat32Volume";
import { FatDirEntry } from "./FatDirEntry";
import { FatLongFileName } from "./FatLongFileName";
import { getLongFileFatEntries } from "./file-names";
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
export const ERROR_MAX_FILE_SIZE = "File size exceeds maximum.";

export class FatFile {
  private _attributes: number;
  private _flags: number;
  private _currentCluster = 0;
  private _currentPosition = 0;
  private _fileSize = 0;
  private _firstCluster = 0;
  private _error = "";
  private _directoryIndex = 0;
  private _directoryCluster = 0;
  private _directorySector = 0;
  private _directoryEntries: (FatLongFileName | FatDirEntry)[] = [];
  private _sfnDirectoryEntry: FatDirEntry | null = null;

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

  get directoryIndex(): number {
    return this._directoryIndex;
  }

  get directoryCluster(): number {
    return this._directoryCluster;
  }

  get directorySector(): number {
    return this._directorySector;
  }

  get directoryEntries(): (FatLongFileName |FatDirEntry)[] {
    return this._directoryEntries;
  }

  get sfnDirectoryEntry(): FatDirEntry | null {
    return this._sfnDirectoryEntry;
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
    this._directoryIndex = 0;
    this._directoryCluster = 0;
    this._directorySector = 0;
    this._directoryEntries = [];
    this._sfnDirectoryEntry = null;
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

  isWritable(): boolean {
    return !!(this._flags & FILE_FLAG_WRITE);
  }

  isSubDir(): boolean {
    return !!(this._attributes & FS_ATTR_SUBDIR);
  }

  isReadOnly(): boolean {
    return !!(this._attributes & FS_ATTR_READ_ONLY);
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

    // --- Check potential issues
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

    // --- Calculate the number of directory entries needed to create the 
    // --- specified file. If the file name is short, we need a single entry. 
    // --- Otherwise, depending on the length of the file name, we need several 
    // --- additional entries. 
    const nameEntryCount = Math.floor((fsName.name.length + 12) / 13);
    const freeEntriesNeed = fsName.flags & FNAME_FLAG_NEED_LFN ? 1 + nameEntryCount : 1;

    // --- Let's find the file in the parent directory. We start from the first 
    // --- entry and loop until we find the file or reach the end of the directory. 
    // --- While we search, we collect a reusable range of deleted directory entries 
    // --- for the case to create a new file.
    let freeFound = 0;
    let freeIndex = 0;
    let curIndex = 0;

    // --- Loop until the directory entry is found or created.
    while (true) {
      // --- Calculate the current index of the directory entry from the current position
      curIndex = Math.floor(parent._currentPosition / FS_DIR_SIZE);

      // --- Read the subsequent directory entry
      const dirEntry = parent.readDirectoryEntry();

      // --- Check the first byte of the directory entry to see if it is free, deleted, 
      // --- or contains an actual entry name
      const firstByte = dirEntry.DIR_Name.charCodeAt(0);
      if (firstByte === FAT_NAME_DELETED || firstByte === FAT_NAME_FREE) {
        // --- This FAT entry is free or can be reused
        if (freeFound === 0) {
          // --- If this is the first free entry found, we start collecting the range of 
          // --- free entries from here
          freeIndex = curIndex;
        }

        // --- Increase the number of free entries found until we have enough
        if (freeFound < freeEntriesNeed) {
          freeFound++;
        }

        // --- If the directory entry is free, we have reached the end of the 
        // --- directory file. Let's create the new directory entry and open that.
        if (firstByte === FAT_NAME_FREE) {
          return create();
        }
      } else {
        // --- This FAT entry is not free. If we do not have enough free entries, we have 
        // --- to reset the free entry count and start the search again.
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
      //       // Don't open if create only.
      //       if (oflag & O_EXCL) {
      //         DBG_FAIL_MACRO;
      //         goto fail;
      //       }
      //       return fatFile.openDirectoryEntry(parent, curIndex, flags, lfnOrd);en;
      //     }
      //     DBG_FAIL_MACRO;
      //     goto fail;
      //   }
      //   if (!memcmp(dir->name, fname->sfn, sizeof(fname->sfn))) {
      //     if (!(fname->flags & FNAME_FLAG_LOST_CHARS)) {
      //       // Don't open if create only.
      //       if (oflag & O_EXCL) {
      //         DBG_FAIL_MACRO;
      //         goto fail;
      //       }
      //       return fatFile.openDirectoryEntry(parent, curIndex, flags, lfnOrd);en;
      //     }
      //     fnameFound = true;
      //   }
      // } else {
      //   lfnOrd = 0;
      // }
    }

    function create(): boolean {
      // --- Don't create unless O_CREAT and write mode
      if (!(flags & O_CREAT) || !isWriteMode(flags)) {
        fatFile._error = ERROR_NO_WRITE;
        return false;
      }

      // ---- Keep found entries or start at current index if no free entries found.
      if (freeFound === 0) {
        freeIndex = curIndex;
      }

      // --- We advance in the directory file until we read all the entries needed 
      // --- to create the new file.
      while (freeFound < freeEntriesNeed) {
        const buffer = parent.readFileData(FS_DIR_SIZE);

        // --- We reached the end of the FAT cluster chain without finding enough 
        // --- free entries in the directory file
        if (!buffer) {
          break;
        }
        freeFound++;
      }

      // --- Allocate new clusters for this directory file until we have 
      // --- enough space to save the entries.
      while (freeFound < freeEntriesNeed) {
        //     if (!dirFile->addDirCluster()) {
        //       DBG_FAIL_MACRO;
        //       goto fail;
        //     }
        //     // 16-bit freeTotal needed for large cluster size.
        //     freeFound += vol->dirEntriesPerCluster();
      }

      // --- Earlier, we may have found a similar short name while searching for 
      // --- the long-named directory entry. To avoid the conflict, generate a 
      // --- unique short name.
      if (filenameFound) {
        // if (!dirFile->makeUniqueSfn(fname)) {
        //   goto fail;
        // }
      }

      // --- We are ready to create and save the directory entries (LFN and SFN 
      // --- entries) for the new file. `freeIndex` points to the index of the 
      // --- first directory entry within the file. Let's create the entries to save.
      const entries = fatFile._directoryEntries = getLongFileFatEntries(fsName.name);

      // --- Initialize the SFN entry to an empty directory file
      const dir = fatFile._sfnDirectoryEntry = entries[entries.length - 1] as FatDirEntry;
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

      // --- Write back all LFN and SFN entries
      parent.seekSet(freeIndex * FS_DIR_SIZE);
      for (let i = 0; i < entries.length; i++) {
        const lfn = entries[i] as FatDirEntry;
        parent.writeFileData(lfn.buffer, true);
      }

      // --- Now, open the file
      return fatFile.openDirectoryEntry(parent, curIndex, flags);
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
    if (!this.addDirCluster()) {
      return false;
    }

    this._firstCluster = this._currentCluster;

    // --- Set to start of dir
    this.rewind();

    // --- Make entry for '.'
    let dot = this._sfnDirectoryEntry.clone();
    dot.DIR_Attr = FS_ATTR_DIRECTORY;
    dot.DIR_Name = ".".padEnd(11, " ");
    this.writeFileData(dot.buffer, true);

    // --- Make entry for '..'
    dot.DIR_Name = "..".padEnd(11, " ");
    dot.DIR_FstClusLO = parent._firstCluster & 0xffff;
    dot.DIR_FstClusHI = parent._firstCluster >> 16;
    this.writeFileData(dot.buffer, true);

    // --- Write first sector
    return true;
  }

  /**
   * Read data from the file
   * @param numBytes Number of bytes to read
   * @returns The bytes read from the file
   */
  readFileData(numBytes: number, forceRead = false): Uint8Array {
    if (!forceRead && !this.isReadable()) {
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
            // --- We are at the end of the cluster chain
            return null;
          }
          this._currentCluster = fatValue;
        }
      }

      // --- At this point we have the current cluster set up, let's calculate the sector to read
      const sector = this.volume.clusterStartSector(this._currentCluster) + sectorOfCluster;

      // --- We are going to read n bytes from the current cluster
      let n: number;
      if (offset !== 0 || toRead < BYTES_PER_SECTOR) {
        // --- Amount to be read from the current sector is less than a full sector
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
        // --- Read more than two sectors, but not more than remains in the cluster
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

  writeFileData(src: Uint8Array, forceWrite = false): void {
    // uint8_t* pc;
    // uint8_t cacheOption;
    // // number of bytes left to write  -  must be before goto statements
    // size_t nToWrite = nbyte;
    // size_t n;
    // --- Error if not a normal file or is read-only
    if (!forceWrite && !this.isWritable()) {
      throw new Error(ERROR_NO_WRITE);
    }

    // --- Seek to end of file if append flag
    if (this._flags & FILE_FLAG_APPEND) {
      this.seekSet(this._fileSize);
    }

    // --- Don't exceed max fileSize.
    let toWrite = src.length;
    if (toWrite > 0xffffffff - this._currentPosition) {
      throw new Error(ERROR_MAX_FILE_SIZE);
    }

    // --- Write data to the file in chunks
    while (toWrite) {
      // --- As we iteratively write the file, we are at a particular cluster within the file.
      // --- In one iteration, we write data to the current cluster.

      // --- Calculate the offset within the current sector from the current position
      const offset = this._currentPosition & SECTOR_MASK;

      // --- Calculate the sector within its cluster from the current position
      const sectorOfCluster = this.volume.sectorOfCluster(this._currentPosition);

      // --- Determine the current cluster
      if (sectorOfCluster === 0 && offset === 0) {
        // --- We are at the beginning of the file
        if (this._currentCluster !== 0) {
          // --- This file already has a cluster
          if (this.isContiguous() && this._fileSize > this._currentPosition) {
            // --- We are in a contiguous file and the current position is within
            // --- the file size, so move to the next cluster
            this._currentCluster++;
          } else {
            // --- We are in a non-contiguous file or in a directory,
            // --- so we need to follow the cluster chain
            const fatValue = this.volume.getFatEntry(this._currentCluster);
            if (fatValue >= this.volume.countOfClusters) {
              // --- We are at the end of the cluster chain
              this.addCluster();
            }
            this._currentCluster = fatValue;
          }
        } else {
          // --- This file has no cluster yet
          if (this._firstCluster === 0) {
            // --- Allocate first cluster of file
            this.addCluster();
            this._firstCluster = this._currentCluster;
          } else {
            // --- Follow chain from first cluster
            this._currentCluster = this._firstCluster;
          }
        }
      }

      // --- At this point we have the current cluster set up, let's calculate the sector to write
      const sector = this.volume.clusterStartSector(this._currentCluster) + sectorOfCluster;

      // --- We are going to write n bytes to the current cluster
      let n: number;

      if (offset != 0 || toWrite < BYTES_PER_SECTOR) {
        // --- Amount to be write to the current sector is less than a full sector
        n = BYTES_PER_SECTOR - offset;
        if (n > toWrite) {
          n = toWrite;
        }

        // --- Read sector, copy the data, write it out
        const sectorContent = this.volume.file.readSector(sector);
        sectorContent.set(src.subarray(0, n), offset);
        this.volume.file.writeSector(sector, sectorContent);
        src = src.subarray(n);
      } else if (toWrite >= 2 * BYTES_PER_SECTOR) {
        // --- Write more than two sectors, but not more than remains in the cluster
        let numSectorsToWrite = toWrite >> BYTES_PER_SECTOR_SHIFT;
        const remainingSectors = this.volume.bootSector.BPB_SecPerClus - sectorOfCluster;
        if (remainingSectors < numSectorsToWrite) {
          numSectorsToWrite = remainingSectors;
        }

        // --- Write the sectors
        for (let i = 0; i < numSectorsToWrite; i++) {
          const sectorContent = src.subarray(0, BYTES_PER_SECTOR);
          this.volume.file.writeSector(sector + i, sectorContent);
          src = src.subarray(BYTES_PER_SECTOR);
        }
      } else {
        // --- Write a single sector
        n = BYTES_PER_SECTOR;
        const sectorContent = src.subarray(0, BYTES_PER_SECTOR);
        this.volume.file.writeSector(sector, sectorContent);
        src = src.subarray(BYTES_PER_SECTOR);
      }

      // --- Update the position and the remaining bytes
      this._currentPosition += n;
      toWrite -= n;
    }

    // --- Update fileSize if needed
    if (this._currentPosition > this._fileSize) {
      // update fileSize and insure sync will update dir entry
      this._fileSize = this._currentPosition;
    }
    this.synchronizeDirectory();
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

  private readDirectoryEntry(): FatDirEntry {
    const buffer = this.readFileData(FS_DIR_SIZE);
    return new FatDirEntry(buffer);
  }

  private writeDirectoryEntry(index: number, dir: FatDirEntry): void {
    this.seekSet(index * FS_DIR_SIZE);
    this.writeFileData(dir.buffer, true);
  }

  private synchronizeDirectory(): void {
    // TODO: Implement this method
    // --- Update last write time
  }

  private addDirCluster(): boolean {
    // --- Check for the maximum folder size
    if (this._currentPosition >= 512 * 4095) {
      return false;
    }

    // --- Allocate a new cluster to this file
    if (!this.addCluster()) {
      return false;
    }

    // --- Zero the newly allocated cluster
    const sector = this.volume.clusterStartSector(this._currentCluster);
    for (let i = 0; i < this.volume.bootSector.BPB_SecPerClus; i++) {
      this.volume.file.writeSector(sector + i, new Uint8Array(BYTES_PER_SECTOR));
    }

    // --- Set position to EOF to avoid inconsistent curCluster/curPosition.
    this._currentPosition += this.volume.bootSector.BPB_SecPerClus * BYTES_PER_SECTOR;
    return true;
  }

  private addCluster(): boolean {
    const currentCluster = this._currentCluster;
    const newCluster = this.volume.allocateCluster(currentCluster);
    if (newCluster === null) {
      // --- No more available cluster
      return false;
    }

    // --- Let make the newly allocated cluster the next cluster of the current one
    this._currentCluster = newCluster;
    if (currentCluster === 0) {
      // --- This is the first cluster, let's use contiguous allocation
      this._flags |= FILE_FLAG_CONTIGUOUS;
    } else if (this._currentCluster !== currentCluster + 1) {
      // --- Not contiguous
      this._flags &= ~FILE_FLAG_CONTIGUOUS;
    }

    // --- Sign that this file has been modified
    this._flags |= FILE_FLAG_DIR_DIRTY;
    return true;
  }

  private openDirectoryEntry(
    dirFile: FatFile,
    dirIndex: number,
    oflag: number
  ): boolean {
    const dir = this._sfnDirectoryEntry;
    this._attributes = dir.DIR_Attr & FS_ATTRIB_COPY;
    this._directoryIndex = dirIndex + this._directoryEntries.length - 1;
    this._directoryCluster = dirFile._firstCluster;
    this._directorySector = this.volume.sectorOfCluster(this._currentPosition);
    this._currentCluster = 0;
    this._currentPosition = 0;
    this._error = "";
    this._flags = 0;
    this._fileSize = 0;
    this._firstCluster = 0;

    // --- Must be file or subdirectory.
    if (!isFatFileOrSubdir(dir)) {
      return false;
    }

    if (isFatFile(dir)) {
      this._attributes |= FS_ATTR_FILE;
    }

    switch (oflag & O_ACCMODE) {
      case O_RDONLY:
        if (oflag & O_TRUNC) {
          return false;
        }
        this._flags = FILE_FLAG_READ;
        break;

      case O_RDWR:
        this._flags = FILE_FLAG_READ | FILE_FLAG_WRITE;
        break;

      case O_WRONLY:
        this._flags = FILE_FLAG_WRITE;
        break;

      default:
        return false;
    }

    if (this._flags & FILE_FLAG_WRITE) {
      if (this.isSubDir() || this.isReadOnly()) {
        return false;
      }
      this._attributes |= FS_ATTR_ARCHIVE;
    }
    this._flags |= oflag & O_APPEND ? FILE_FLAG_APPEND : 0;

    // --- Copy first cluster number for directory fields
    const firstCluster = (dir.DIR_FstClusHI << 16) | dir.DIR_FstClusLO;

    if (oflag & O_TRUNC) {
      if (firstCluster && !this.volume.freeChain(firstCluster)) {
        return false;
      }

      // --- Need to update directory entry
      this._flags |= FILE_FLAG_DIR_DIRTY;
    } else {
      this._firstCluster = firstCluster;
      this._fileSize = dir.DIR_FileSize;
    }
    if (oflag & O_AT_END) {
      this.seekSet(this._fileSize);
    }
    return true;
  }

  private parsePathToLfn(path: string): FsPath {
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
