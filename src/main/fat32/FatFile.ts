import {
  dateToNumber,
  isFatFile,
  isFatFileOrSubdir,
  isFatLongName,
  isWriteMode,
  lfnReservedChar,
  timeMsToNumber,
  timeToNumber
} from "./fat-utils";
import {
  FS_ATTR_ROOT32,
  FS_ATTR_DIRECTORY,
  O_CREAT,
  O_EXCL,
  O_RDWR,
  FILE_FLAG_PREALLOCATE,
  FS_ATTR_LABEL,
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
  O_AT_END,
  FAT_ORDER_LAST_LONG_ENTRY,
  FAT_ATTRIB_LONG_NAME,
  FS_ATTR_FILE
} from "./Fat32Types";
import { Fat32Volume, FAT32_EOC_MIN, FAT32_EOC_MAX } from "./Fat32Volume";
import { FatDirEntry } from "./FatDirEntry";
import { FatLongFileName } from "./FatLongFileName";
import { calcShortNameCheckSum, getLongFileFatEntries } from "./file-names";
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
  private _parent: FatFile | null = null;
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
  private _nameEntries: (FatLongFileName | FatDirEntry)[] = [];
  private _sfnEntry: FatDirEntry | null = null;

  get parent(): FatFile | null {
    return this._parent;
  }

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

  get nameEntries(): (FatLongFileName | FatDirEntry)[] {
    return this._nameEntries;
  }

  get sfnEntry(): FatDirEntry | null {
    return this._sfnEntry;
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
    this._firstCluster = attrs & FS_ATTR_ROOT32 ? 2 : 0;
    this._error = "";
    this._directoryIndex = 0;
    this._directoryCluster = 0;
    this._directorySector = 0;
    this._nameEntries = [];
    this._sfnEntry = null;
  }

  clone(): FatFile {
    const clone = new FatFile(this.volume);
    clone._parent = this._parent;
    clone._attributes = this._attributes;
    clone._flags = this._flags;
    clone._currentCluster = this._currentCluster;
    clone._currentPosition = this._currentPosition;
    clone._fileSize = this._fileSize;
    clone._firstCluster = this._firstCluster;
    clone._error = this._error;
    clone._directoryIndex = this._directoryIndex;
    clone._directoryCluster = this._directoryCluster;
    clone._directorySector = this._directorySector;
    clone._nameEntries = this._nameEntries.slice();
    clone._sfnEntry = this._sfnEntry ? this._sfnEntry.clone() : null;

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
    return !!(this._attributes & FS_ATTR_LABEL);
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
   * @returns True, if the directory is created; otherwise, false
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

    if (path.charAt(0) === "/") {
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
      this.close();
    }
    return this.doMkdir(parent, fsPath.segments[fsPath.segments.length - 1]);
  }

  /**
   * Opens a file or directory
   * @param parent Parent directory
   * @param path Name of the directory
   * @param mode Flags used for opening the file or directory
   * @returns True, if the file or directory is opened; otherwise, false
   */
  open(parent: FatFile, path: string, mode: number): boolean {
    if (this.isOpen()) {
      this._error = ERROR_ALREADY_OPEN;
      return false;
    }
    if (!parent.isDirectory()) {
      this._error = ERROR_NOT_A_DIRECTORY;
      return false;
    }

    if (path.charAt(0) === "/") {
      parent = this.volume.openRootDirectory();
      if (!parent) {
        this._error = ERROR_PARENT_NOT_FOUND;
        return false;
      }
    }

    const fsPath = this.parsePathToLfn(path);
    for (let i = 0; i < fsPath.segments.length - 1; i++) {
      if (!this.doOpen(parent, fsPath.segments[i], O_RDONLY)) {
        return false;
      }
      parent = this.clone();
      this.close();
    }
    return this.doOpen(parent, fsPath.segments[fsPath.segments.length - 1], mode);
  }

  createFile(parent: FatFile, path: string): boolean {
    const file = this.open(parent, path, O_RDONLY);
    if (file) {
      // --- The file already exists, remove it
      this.remove();
    }

    // --- The file does not exist, create it
    if (!this.open(parent, path, O_CREAT | O_RDWR)) {
      return false;
    }

    // --- At this point the file is open for writing
    // --- Convert file to directory
    this._flags = FILE_FLAG_WRITE;
    this._attributes = FS_ATTR_FILE;

    // --- No cluster allocated for the file yet
    this._firstCluster = 0;
    return true;
  }

  getDirectoryEntries(): FatDirEntry[] {
    // --- Position to the beginning of the directory
    this.rewind();

    // --- Loop until the directory entry is found or created.
    const entriesCollected: FatDirEntry[] = [];
    while (true) {
      // --- Read the subsequent directory entry
      const dirEntry = this.readDirectoryEntry();

      // --- Check the first byte of the directory entry to see if it is free, deleted,
      // --- or contains an actual entry name
      const firstByte = dirEntry.buffer.length > 0 ? dirEntry.DIR_Name.charCodeAt(0) : FAT_NAME_FREE;
      if (firstByte === FAT_NAME_FREE) {
        // --- No more FAT entries
        return entriesCollected;
      }

      // --- This is a valid directory entry
      entriesCollected.push(dirEntry);
    }
  }

  rmDir(): boolean {
    // --- Must be open subdirectory
    if (!this.isSubDir()) {
      return false;
    }

    const dirEntries = this.getDirectoryEntries();
    let isEmpty = true;
    for (let i = 0; i < dirEntries.length; i++) {
      const entry = dirEntries[i];
      const firstByte = entry.DIR_Name.charCodeAt(0);
      if (firstByte !== FAT_NAME_DELETED && firstByte !== ".".charCodeAt(0)) {
        isEmpty = false;
        break;
      }
    }

    // --- Only empty directories can be removed
    if (!isEmpty) {
      return false;
    }

    // convert empty directory to normal file for remove
    // this._attributes = FS_ATTR_FILE;
    this._flags |= FILE_FLAG_WRITE;
    return this.remove();
  }

  remove(): boolean {
    // --- Cant' remove not open for write.
    if (!this.isWritable()) {
      return false;
    }

    // --- No parent, can't remove root.
    const parentDir = this.parent;
    if (!parentDir) {
      return false;
    }

    // --- Free any clusters.
    if (this._firstCluster && !this.volume.freeChain(this._firstCluster)) {
      return false;
    }

    // --- Mark all directory entries as deleted
    const checksum = calcShortNameCheckSum(this._sfnEntry.DIR_Name);
    let firstDirIndex = this._directoryIndex - this._nameEntries.length + 1;

    // --- Seek to first directory entry
    parentDir.seekSet(firstDirIndex * FS_DIR_SIZE);

    // --- Mark all entries as deleted
    for (let i = 0; i < this._nameEntries.length; i++) {
      // --- Read the directory entry and prepare for updating it
      const dirEntry = parentDir.readDirectoryEntry();
      parentDir.seekRelative(-FS_DIR_SIZE);

      // --- Make sure the checksum is correct
      if (dirEntry.DIR_Attr & FAT_ATTRIB_LONG_NAME) {
        const lfn = new FatLongFileName(dirEntry.buffer);
        if (lfn.LDIR_Chksum !== checksum) {
          return false;
        }
      }

      // --- Mark the entry as deleted
      dirEntry.DIR_Name = String.fromCharCode(FAT_NAME_DELETED) + dirEntry.DIR_Name.substring(1);
      parentDir.writeData(dirEntry.buffer, true);
    }

    // --- Set this file closed.
    this.close();

    // --- Done
    return true;
  }

  /**
   * Opens a file or directory
   * @param parent Parent directory
   * @param fsName Name of the file or directory
   * @param mode File open mode
   */
  private doOpen(parent: FatFile, fsName: FsName, mode: number): boolean {
    // --- Check potential issues
    if (!parent.isDirectory()) {
      this._error = ERROR_NOT_A_DIRECTORY;
      return false;
    }
    if (this.isOpen()) {
      this._error = ERROR_ALREADY_OPEN;
      return false;
    }

    // --- Find the file in the parent directory
    let { entries, freeEntriesNeed, freeFound, freeIndex, totalEntries, index } =
      parent.searchForEntry(fsName);

    if (entries.length > 0) {
      // --- The file is found. Open it.
      this._nameEntries = entries;
      this._sfnEntry = entries[entries.length - 1] as FatDirEntry;
      return this.openDirectoryEntry(parent, index, mode);
    }

    // --- The file not found, create it
    // --- Don't create unless O_CREAT and write mode
    if (!(mode & O_CREAT) || !isWriteMode(mode)) {
      this._error = ERROR_NO_WRITE;
      return false;
    }

    // ---- Keep found entries or start at current index if no free entries found.
    if (freeFound === 0) {
      freeIndex = totalEntries;
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
      if (!parent.addDirCluster()) {
        return false;
      }
      // --- 16-bit freeTotal needed for large cluster size.
      freeFound += this.volume.dirEntriesPerCluster;
    }

    // --- Handle short file name conflicts
    let newEntries: (FatLongFileName | FatDirEntry)[] = [];
    let conflictCount = 0;
    while (conflictCount < 100) {
      const conflictName = new FsName(fsName.name, conflictCount);
      const { entries: conflictEntries } = parent.searchForEntry(conflictName, true);
      if (conflictEntries.length === 0) {
        newEntries = getLongFileFatEntries(conflictName.name, conflictCount);
        break;
      }
      conflictCount++;
    }
    if (conflictCount === 100) {
      this._error = ERROR_LFN_CANNOT_CREATE;
      return false;
    }

    // --- We are ready to create and save the directory entries (LFN and SFN
    // --- entries) for the new file. `freeIndex` points to the index of the
    // --- first directory entry within the file. Let's create the entries to save.
    this._nameEntries = newEntries;

    // --- Initialize the SFN entry to an empty directory file
    const dir = (this._sfnEntry = newEntries[newEntries.length - 1] as FatDirEntry);
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

    if (fsName.flags & FNAME_FLAG_NEED_LFN) {
      // --- Write back all LFN and SFN entries
      parent.seekSet(freeIndex * FS_DIR_SIZE);
      for (let i = 0; i < newEntries.length; i++) {
        const lfn = newEntries[i] as FatDirEntry;
        parent.writeData(lfn.buffer, true);
      }
    } else {
      // --- Write back the SFN entry
      parent.seekSet(freeIndex * FS_DIR_SIZE);
      parent.writeData(dir.buffer, true);
    }

    // --- Now, open the file
    return this.openDirectoryEntry(parent, freeIndex + newEntries.length - 1, mode);
  }

  private seekRelative(offset: number): void {
    this.seekSet(this._currentPosition + offset);
  }

  /**
   * Sets the current position to the specified offset
   * @param position File offset
   */
  private seekSet(position: number): void {
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

    // --- Calculate cluster index for current position
    // --- Must follow chain from first cluster
    this._currentCluster = this.isRoot()
      ? this.volume.rootDirectoryStartCluster
      : this._firstCluster;
    if (this._currentCluster > 0) {
      while (nNew--) {
        const fatValue = this.volume.getFatEntry(this._currentCluster);
        // ✅ FIX Bug #4: Check for proper FAT32 EOC markers (0xFFFFFFF8-0xFFFFFFFF)
        // instead of comparing with countOfClusters
        if (fatValue >= FAT32_EOC_MIN && fatValue <= FAT32_EOC_MAX) {
          throw new Error(ERROR_SEEK_PAST_EOC);
        }
        this._currentCluster = fatValue;
      }
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
  private doMkdir(parent: FatFile, fname: FsName): boolean {
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

    // --- The parent entry is a directory
    parent.seekRelative(-FS_DIR_SIZE);
    let sfn = this._sfnEntry.clone();
    sfn.DIR_Attr = FS_ATTR_DIRECTORY;
    sfn.DIR_FstClusHI = this._firstCluster >> 16;
    sfn.DIR_FstClusLO = this._firstCluster & 0xffff;
    parent.writeData(sfn.buffer, true);

    // --- Set to start of dir
    this.rewind();

    // --- Make entry for '.'
    let dot = sfn.clone();
    dot.DIR_Attr = FS_ATTR_DIRECTORY;
    dot.DIR_Name = ".".padEnd(11, " ");
    this.writeData(dot.buffer, true);

    // --- Make entry for '..'
    dot.DIR_Name = "..".padEnd(11, " ");
    dot.DIR_FstClusLO = parent._firstCluster & 0xffff;
    dot.DIR_FstClusHI = parent._firstCluster >> 16;
    this.writeData(dot.buffer, true);

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
          // ✅ FIX Bug #4: Check for proper FAT32 EOC markers (0xFFFFFFF8-0xFFFFFFFF)
          // instead of comparing with countOfClusters
          if (fatValue >= FAT32_EOC_MIN && fatValue <= FAT32_EOC_MAX) {
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

  writeFileData(data: Uint8Array): void {
    if (!this.isFile) {
      throw new Error(ERROR_NOT_A_FILE);
    }

    this.writeData(data);

    // --- Update the file size and write time
    const sfn = this._sfnEntry;
    sfn.DIR_FstClusLO = this._firstCluster & 0xffff;
    sfn.DIR_FstClusHI = this._firstCluster >> 16;
    sfn.DIR_FileSize = this._fileSize;
    sfn.DIR_WrtDate = dateToNumber(new Date());
    sfn.DIR_WrtTime = timeToNumber(new Date());
    this.parent.seekSet(this._directoryIndex * FS_DIR_SIZE);
    this.parent.writeData(sfn.buffer, true);
  }

  private writeData(src: Uint8Array, forceWrite = false): void {
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
            // ✅ FIX Bug #4: Check for proper FAT32 EOC markers (0xFFFFFFF8-0xFFFFFFFF)
            // instead of comparing with countOfClusters
            if (fatValue >= FAT32_EOC_MIN && fatValue <= FAT32_EOC_MAX) {
              // --- We are at the end of the cluster chain
              this.addCluster();
            } else {
              this._currentCluster = fatValue;
            }
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
        n = 0;
        for (let i = 0; i < numSectorsToWrite; i++) {
          const sectorContent = src.subarray(0, BYTES_PER_SECTOR);
          this.volume.file.writeSector(sector + i, sectorContent);
          src = src.subarray(BYTES_PER_SECTOR);
          n += BYTES_PER_SECTOR;
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
      // --- update fileSize and insure sync will update dir entry
      this._fileSize = this._currentPosition;
    }
  }

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

  private openDirectoryEntry(parent: FatFile, dirIndex: number, oflag: number): boolean {
    const dir = this._sfnEntry;
    this._parent = parent;
    this._attributes = dir.DIR_Attr & FS_ATTRIB_COPY;
    this._directoryIndex = dirIndex;
    this._directoryCluster = parent._firstCluster;
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
      this._attributes |= FS_ATTR_LABEL;
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

  private getLfnChar(ldir: FatLongFileName, i: number): number {
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

  /**
   * Searches for the specified entry in the directory.
   * @param fsName File name to search for
   * @param flags Flags to used during search
   * @param shortNameOnly Search for short name only
   * @returns A structure with the search result
   */
  private searchForEntry(fsName: FsName, shortNameOnly = false): FileSearchResult {
    // --- Calculate the number of directory entries needed to create thespecified file.
    // --- If the file name is short, we need a single entry. Otherwise, depending on the
    // --- length of the file name, we need several additional entries.
    const nameEntryCount = Math.floor((fsName.name.length + 12) / 13);
    const freeEntriesNeed = fsName.flags & FNAME_FLAG_NEED_LFN ? 1 + nameEntryCount : 1;

    // --- Let's find the file in the parent directory. We start from the first
    // --- entry and loop until we find the file or reach the end of the directory.
    // --- While we search, we collect a reusable range of deleted directory entries
    // --- for the case to create a new file.
    let freeFound = 0;
    let freeIndex = 0;
    let curIndex = 0;

    const listedEntries = this.getDirectoryEntries();
    const totalEntries = listedEntries.length;

    while (curIndex < listedEntries.length) {
      // --- Read the subsequent directory entry
      const dirEntry = listedEntries[curIndex++];

      // --- Check the first byte of the directory entry to see if it is free, deleted,
      // --- or contains an actual entry name
      const firstByte = dirEntry.DIR_Name.charCodeAt(0);
      if (firstByte === FAT_NAME_DELETED) {
        // --- This FAT entry is free or can be reused
        if (freeFound === 0) {
          // --- If this is the first free entry found, we start collecting the range of
          // --- free entries from here
          freeIndex = curIndex - 1;
        }

        // --- Increase the number of free entries found until we have enough
        if (freeFound < freeEntriesNeed) {
          freeFound++;
        }
      } else {
        // --- This FAT entry is not free. If we do not have enough free entries, we have
        // --- to reset the free entry count and start the search again.
        if (freeFound < freeEntriesNeed) {
          freeFound = 0;
        }
      }

      // --- Skip empty (deleted) slot or '.' or '..'
      if (firstByte === FAT_NAME_DELETED || firstByte === ".".charCodeAt(0)) {
        // --- Skip this entry
        continue;
      } else if (isFatLongName(dirEntry)) {
        // --- This is a long file name entry, collect it entirely
        if (!(firstByte & FAT_ORDER_LAST_LONG_ENTRY)) {
          // --- Corrupted long file name entry
          continue;
        }

        let longName = "";
        let order = firstByte & 0x1f;
        let checksum = dirEntry.DIR_CrtTimeTenth;
        let collected = true;
        let collectedEntries: FatDirEntry[] = [];
        let currentEntry = dirEntry;
        let lfnIndex = curIndex - 1;

        // --- Collect the long file name
        while (true) {
          // --- Extract the current long file name entry
          collectedEntries.push(currentEntry);
          let ldir = new FatLongFileName(currentEntry.buffer);
          if ((ldir.LDIR_Ord & 0x1f) !== order || ldir.LDIR_Chksum !== checksum) {
            // --- Corrupted long file name entry
            collected = false;
            break;
          }

          // --- Collect the long file name characters
          let namePart = "";
          for (let j = 0; j < 13; j++) {
            const ch = this.getLfnChar(ldir, j);
            if (ch === 0) {
              break;
            }
            namePart += String.fromCharCode(ch);
          }
          longName = namePart + longName;

          // --- Get the next segment
          order--;
          if (!order) {
            // --- This is the last segment
            break;
          }

          currentEntry = listedEntries[++lfnIndex];
          if (!currentEntry) {
            // --- The long file name is not complete
            collected = false;
            break;
          }
        }

        // --- Check if the long file name is collected correctly
        curIndex = lfnIndex;
        if (!collected) {
          // --- The long file name is not collected correctly
          curIndex++;
          continue;
        }

        // --- The next entry should be the short file name
        currentEntry = listedEntries[++curIndex];
        if (!isFatFileOrSubdir(currentEntry)) {
          // --- The short file name is not found
          continue;
        }
        if (calcShortNameCheckSum(currentEntry.DIR_Name) !== checksum) {
          // --- The short file name is corrupted. Skip it.
          curIndex++;
          continue;
        }

        // --- Ok, we found the last (short file name) entry
        collectedEntries.push(currentEntry);

        // --- Number of entries matches, compare
        if (shortNameOnly) {
          // --- We are looking for a short name only
          if (currentEntry.DIR_Name !== fsName.sfn11) {
            // --- The short name does not match
            curIndex++;
            continue;
          }
        } else {
          // --- Case-insensitive comparison of the long file name
          if (longName.toLowerCase() !== fsName.name.toLowerCase()) {
            // --- The name does not match
            curIndex++;
            continue;
          }
        }

        // --- We found the file
        return {
          freeFound,
          freeIndex,
          freeEntriesNeed,
          totalEntries,
          index: curIndex,
          entries: collectedEntries
        };
      } else if (isFatFileOrSubdir(dirEntry)) {
        // --- We are looking for a short name only
        if (dirEntry.DIR_Name !== fsName.sfn11) {
          // --- The short name does not match
          continue;
        }

        // --- We found the file
        return {
          freeFound,
          freeIndex,
          freeEntriesNeed,
          totalEntries,
          index: curIndex - 1,
          entries: [dirEntry]
        };
      }
    }

    // --- The file not found
    return {
      freeFound,
      freeIndex,
      freeEntriesNeed,
      totalEntries,
      index: -1,
      entries: []
    };
  }
}

type FileSearchResult = {
  freeFound: number;
  freeIndex: number;
  freeEntriesNeed: number;
  totalEntries: number;
  index: number;
  entries: FatDirEntry[];
};
