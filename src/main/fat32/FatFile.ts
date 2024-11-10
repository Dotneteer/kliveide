import {
  BYTES_PER_SECTOR,
  BYTES_PER_SECTOR_SHIFT,
  Fat32DirEntry,
  Fat32LongFileName,
  FAT_ATTRIB_LONG_NAME,
  FAT_CASE_LC_BASE,
  FAT_CASE_LC_EXT,
  FAT_NAME_DELETED,
  FAT_NAME_FREE,
  FAT_ORDER_LAST_LONG_ENTRY,
  FileEntry,
  FilePosition,
  FNAME_FLAG_LOST_CHARS,
  FNAME_FLAG_NEED_LFN,
  FS_ATTRIB_ARCHIVE,
  FS_ATTRIB_COPY,
  FS_ATTRIB_DIRECTORY,
  FS_ATTRIB_HIDDEN,
  FS_ATTRIB_READ_ONLY,
  FS_ATTRIB_SYSTEM,
  FS_ATTRIB_USER_SETTABLE,
  FS_DIR_SIZE,
  isFat32LongName,
  O_ACCMODE,
  O_APPEND,
  O_AT_END,
  O_CREAT,
  O_EXCL,
  O_RDONLY,
  O_RDWR,
  O_TRUNC,
  O_WRONLY,
  SECTOR_MASK
} from "@abstractions/Fat32Types";
import { FatVolume } from "./FatVolume";
import { FsName, FsPath } from "./FsName";
import {
  dateToNumber,
  isFatFile,
  isFatFileOrSubdir,
  isFatLongName,
  isWriteMode,
  lfnReservedChar,
  timeMsToNumber,
  timeToNumber,
  toFatDirEntry,
  toFatLongName
} from "./fat-utils";
import { CimFile } from "./CimFileManager";
import { CACHE_FOR_READ, CACHE_FOR_WRITE, CACHE_RESERVE_FOR_WRITE } from "./FsCache";
import { calcShortNameCheckSum, convertLongToShortName } from "./file-names";
import { BinaryWriter } from "@common/utils/BinaryWriter";

// --- This file has not been opened
const FILE_ATTR_CLOSED = 0;

// --- Entry for normal data file
const FILE_ATTR_FILE = 0x08;

// --- Entry is for a subdirectory
const FILE_ATTR_SUBDIR = FS_ATTRIB_DIRECTORY;

// --- A FAT12 or FAT16 root directory
const FILE_ATTR_ROOT_FIXED = 0x40;

// --- A FAT32 root directory
const FILE_ATTR_ROOT32 = 0x80;

// --- Entry is for root
const FILE_ATTR_ROOT = FILE_ATTR_ROOT_FIXED | FILE_ATTR_ROOT32;

// --- Directory type bits
const FILE_ATTR_DIR = FILE_ATTR_SUBDIR | FILE_ATTR_ROOT;

const FILE_FLAG_READ = 0x01;
const FILE_FLAG_WRITE = 0x02;
const FILE_FLAG_APPEND = 0x08;

// --- Treat curPosition as valid length.
const FILE_FLAG_PREALLOCATE = 0x20;

// --- File is contiguous
const FILE_FLAG_CONTIGUOUS = 0x40;

// --- Sync of directory entry required
const FILE_FLAG_DIR_DIRTY = 0x80;

// --- Private data
const WRITE_ERROR = 0x1;
const READ_ERROR = 0x2;

export class FatFile {
  private _attributes = FILE_ATTR_CLOSED;
  private _error = 0; // Error bits.
  private _flags = 0; // See above for definition of m_flags bits
  private _lfnOrd = 0;
  private _dirIndex = 0; // index of directory entry in dir file
  private _vol: FatVolume; // volume where file is located
  private _dirCluster = 0;
  private _curCluster = 0; // cluster for current file position
  private _curPosition = 0; // current file position
  private _dirSector = 0; // sector for this files directory entry
  private _fileSize = 0; // file size in bytes
  private _firstCluster = 0; // first cluster of file

  /**
   * Constructor
   * @param path Path to file.
   * @param oflag open flags.
   */
  constructor(
    public readonly cimFile?: CimFile,
    path?: string,
    oflag = O_RDONLY
  ) {
    if (path) {
      this.open(null, path, oflag);
    }
  }

  /**
   * Copy from to this.
   * @param from Source file.
   */
  clone(): FatFile {
    const clone = new FatFile();
    clone._attributes = this._attributes;
    clone._error = this._error;
    clone._flags = this._flags;
    clone._lfnOrd = this._lfnOrd;
    clone._dirIndex = this._dirIndex;
    clone._vol = this._vol;
    clone._dirCluster = this._dirCluster;
    clone._curCluster = this._curCluster;
    clone._curPosition = this._curPosition;
    clone._dirSector = this._dirSector;
    clone._fileSize = this._fileSize;
    clone._firstCluster = this._firstCluster;
    return clone;
  }

  /**
   * Move from to this.
   * @param _from Source file.
   */
  move(_from: FatFile): void {
    throw new Error("Method not implemented.");
  }

  /**
   * @return user settable file attributes for success else -1.
   */
  get attrib(): number {
    return this.isFileOrSubDir() ? this._attributes & FS_ATTRIB_USER_SETTABLE : -1;
  }

  /**
   * Set file attributes
   * @param _bits bit-wise or of selected attributes: FS_ATTRIB_READ_ONLY,
   * FS_ATTRIB_HIDDEN, FS_ATTRIB_SYSTEM, FS_ATTRIB_ARCHIVE.
   * @return true for success or false for failure.
   *
   * Note: attrib() will fail for set read-only if the file is open for write.
   */
  set attrib(_bits: number) {
    throw new Error("Method not implemented.");
  }

  /**
   * @return The number of bytes available from the current position
   * to EOF for normal files. INT_MAX is returned for very large files.
   * available32() is recomended for very large files.
   * Zero is returned for directory files.
   */
  available(): number {
    const n = this.available32();
    return n > Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : n;
  }

  /** \return The number of bytes available from the current position
   * to EOF for normal files.  Zero is returned for directory files.
   */
  available32(): number {
    return this.isFile() ? this.fileSize() - this.curPosition : 0;
  }

  /**
   * Clear all error bits.
   */
  clearError(): void {
    this._error = 0;
  }

  /**
   * Set writeError to zero
   */
  clearWriteError(): void {
    this._error &= ~WRITE_ERROR;
  }

  /**
   * Close a file and force cached data and directory information
   * to be written to the storage device.
   * @return true for success or false for failure.
   */
  close(): boolean {
    const rtn = this.sync();
    this._attributes = FILE_ATTR_CLOSED;
    this._flags = 0;
    return rtn;
  }

  /**
   * Check for contiguous file and return its raw sector range.
   *
   * Set the contiguous flag if the file is contiguous.
   * The parameters may be nullptr to only set the flag.
   * \return true for success or false for failure.
   */
  contiguousRange(): { bgnSector: number; endSector: number; success: boolean } {
    throw new Error("Method not implemented.");
  }

  /**
   * Create and open a new contiguous file of a specified size.
   * @param dirFile The directory where the file will be created.
   * @param path A path with a valid file name.
   * @param size The desired file size.
   * @return true for success or false for failure.
   */
  createContiguous(dirFile: FatFile | undefined, path: string, size: number): boolean {
    throw new Error("Method not implemented.");
  }

  /**
   * @return The current cluster number for a file or directory.
   */
  get curCluster() {
    return this._curCluster;
  }

  /**
   * @return The current position for a file or directory.
   */
  get curPosition() {
    return this._curPosition;
  }

  /**
   * Return a file's directory entry.
   * @return Entry for success or null for failure.
   */
  dirEntry(): Fat32DirEntry | null {
    throw new Error("Method not implemented.");
  }

  /**
   * @return Directory entry index.
   */
  get dirIndex() {
    return this._dirIndex;
  }

  /**
   * @return The number of bytes allocated to a directory or zero
   * if an error occurs.
   */
  dirSize(): number {
    throw new Error("Method not implemented.");
  }

  /**
   * Test for the existence of a file in a directory
   * @param _path Path of the file to be tested for.
   * @return True if the file exists.
   * The calling instance must be an open directory file.
   * dirFile.exists("TOFIND.TXT") searches for "TOFIND.TXT" in the directory
   * dirFile.
   */
  exists(_path: string): boolean {
    throw new Error("Method not implemented.");
  }

  /**
   * Get position for streams
   */
  fgetpos(): FilePosition {
    throw new Error("Method not implemented.");
  }

  /**
   * Get a string from a file.
   *
   * fgets() reads bytes from a file until `num - 1` bytes are read, or a
   * delimiter is read and transferred to `str`, or end-of-file is encountered.
   *
   * fgets() deletes CR, '\\r', from the string.  This insures only a '\\n'
   * terminates the string for Windows text files which use CRLF for newline.
   *
   * @param _num Maximum number of characters to be read.
   * @param _delim Optional set of delimiters. The default is "\n".
   * @return For success fgets() returns the length of the string in \a str.
   * If no data is read, fgets() returns zero for EOF or -1 if an error
   * occurred.
   */
  fgets(_num: number, _delim?: string): string | null {
    throw new Error("Method not implemented.");
  }

  /**
   * @return The total number of bytes in a file.
   */
  fileSize() {
    return this._fileSize;
  }

  /**
   * @return first sector of file or zero for empty file.
   */
  firstBlock() {
    return this.firstSector();
  }

  /**
   * @return Address of first sector or zero for empty file.
   */
  firstSector(): number {
    throw new Error("Method not implemented.");
  }

  flush() {
    this.sync();
  }

  /**
   * Set position for streams
   * @param _pos struct with value for new position
   */
  fsetpos(_pos: FilePosition): void {
    throw new Error("Method not implemented.");
  }

  /**
   * Get a file's access date.
   * @return Packed date for directory entry.
   */
  getAccessDate(): Date | null {
    throw new Error("Method not implemented.");
  }

  /**
   * Get a file's access date and time.
   * @return true for success or false for failure.
   */
  getAccessDateTime(): Date | null {
    throw new Error("Method not implemented.");
  }

  /**
   * Get a file's create date and time.
   * @return Packed date and time for directory entry.
   */
  getCreateDateTime(): Date | null {
    throw new Error("Method not implemented.");
  }

  /**
   * @return All error bits.
   */
  getError() {
    return this._error;
  }

  /**
   * @Get a file's modify date and time.
   * @return Packed date and time for directory entry.
   */
  getModifyDateTime(): Date | null {
    throw new Error("Method not implemented.");
  }

  /**
   * Get a file's name.
   */
  getName(): string {
    throw new Error("Method not implemented.");
  }

  /**
   * Get a file's Short File Name
   */
  getSFN(): string {
    throw new Error("Method not implemented.");
  }

  /**
   * @return value of writeError
   */
  getWriteError() {
    return this.isOpen() ? this._error & WRITE_ERROR : true;
  }

  /**
   * Check for device busy.
   * @return true if busy else false.
   */
  isBusy(): boolean {
    throw new Error("Method not implemented.");
  }

  /**
   * @return True if the file is contiguous.
   */
  isContiguous() {
    return this._flags & FILE_FLAG_CONTIGUOUS;
  }

  /**
   * @return True if this is a directory.
   */
  isDir() {
    return this._attributes & FILE_ATTR_DIR;
  }

  /**
   * @return True if this is a normal file.
   */
  isFile() {
    return this._attributes & FILE_ATTR_FILE;
  }

  /**
   * @return True if this is a normal file or sub-directory.
   */
  isFileOrSubDir() {
    return this.isFile() || this.isSubDir();
  }

  /**
   * @return True if this is a hidden file. */
  isHidden() {
    return this._attributes & FS_ATTRIB_HIDDEN;
  }

  /**
   * @return true if this file has a Long File Name.
   */
  isLFN() {
    return !!this._lfnOrd;
  }

  /**
   * @return True if this is an open file/directory.
   */
  isOpen() {
    return !!this._attributes;
  }

  /**
   * @return True file is readable.
   */
  isReadable() {
    return this._flags & FILE_FLAG_READ;
  }

  /**
   * @return True if file is read-only
   */
  isReadOnly() {
    return this._attributes & FS_ATTRIB_READ_ONLY;
  }

  /**
   * @return True if this is the root directory.
   */
  isRoot() {
    return this._attributes & FILE_ATTR_ROOT;
  }

  /**
   * @return True if this is the FAT32 root directory.
   */
  isRoot32() {
    return this._attributes & FILE_ATTR_ROOT32;
  }

  /**
   * @return True if this is the FAT12 of FAT16 root directory.
   * */
  isRootFixed() {
    return this._attributes & FILE_ATTR_ROOT_FIXED;
  }

  /**
   * @return True if this is a sub-directory.
   */
  isSubDir() {
    return this._attributes & FILE_ATTR_SUBDIR;
  }

  /**
   * @return True if this is a system file.
   */
  isSystem() {
    return this._attributes & FS_ATTRIB_SYSTEM;
  }

  /**
   * @return True file is writable.
   */
  isWritable() {
    return this._flags & FILE_FLAG_WRITE;
  }

  /**
   * List directory contents.
   * @param _flags The inclusive OR of
   * LS_DATE - %Print file modification date
   * LS_SIZE - %Print file size.
   * LS_R - Recursive list of subdirectories.
   * @param _indent Amount of space before file name. Used for recursive
   * list to indicate subdirectory level.
   */
  ls(_flags = 0, _indent = 0): FileEntry[] {
    throw new Error("Method not implemented.");
  }

  /**
   * Make a new directory.
   * @param parent An open FatFile instance for the directory that will
   * contain the new directory.
   * @param path A path with a valid name for the new directory.
   * @param pFlag Create missing parent directories if true.
   * @return true for success or false for failure.
   */
  mkdir(parent: FatFile, path: string, pFlag = true): boolean {
    let tmpDir = new FatFile(this.cimFile);

    if (this.isOpen() || !parent.isDir()) {
      return false;
    }

    let nameIndex = 0;
    if (path.charAt(0) === "/") {
      while (path.charAt(nameIndex) === "/") {
        nameIndex++;
      }
      if (!tmpDir.openRoot(parent._vol)) {
        return false;
      }
      parent = tmpDir;
    }

    const fsPath = this.parsePathToLfn(path);
    for (let i = 0; i < fsPath.segments.length - 1; i++) {
      if (!this.doOpen(parent, fsPath.segments[i], O_RDONLY)) {
        if (!pFlag || !this.mkdir(parent, fsPath.segments[i].name)) {
          return false;
        }
      }
      // tmpDir = *this;
      parent = this.clone();
      close();
    }
    return this.doMkdir(parent, fsPath.segments[fsPath.segments.length - 1]);
  }

  /**
   * Open a file in the volume root directory.
   * @param _vol Volume where the file is located.
   * @param _path with a valid name for a file to be opened.
   * @param _oflag bitwise-inclusive OR of open flags.
   * See see FatFile.open(FatFile, string, number).
   * @return true for success or false for failure.
   */
  openInRoot(_vol: FatVolume, _path: string, _oflag = O_RDONLY): boolean {
    throw new Error("Method not implemented.");
  }

  /**
   * Open a file by index.
   * @param _dirFile An open FatFile instance for the directory.
   * @param _index The index of the directory entry for the file to be
   * opened. The value for index is (directory file position)/32.
   * @param _oflag bitwise-inclusive OR of open flags.
   * See open() by path for definition of flags.
   * @return true for success or false for failure.
   */
  openByIndex(_dirFile: FatFile, _index: number, _oflag = O_RDONLY): boolean {
    throw new Error("Method not implemented.");
  }

  /**
   * Open a file by index in the current working directory.
   * @param _index The \a index of the directory entry for the file to be
   * opened. The value for \a index is (directory file position)/32.
   * @param _oflag bitwise-inclusive OR of open flags.
   * See open() by path for definition of flags.
   * @return true for success or false for failure.
   */
  openByIndexInCwd(_index: number, _oflag = O_RDONLY): boolean {
    throw new Error("Method not implemented.");
  }

  /**
   * Open a file or directory by name.
   * @param dirFile An open FatFile instance for the directory containing
   * the file to be opened.
   * @param path A path with a valid name for a file to be opened.
   * @param oflag Values for `oflag` are constructed by a bitwise-inclusive
   * OR of flags from the following list:
   * Only one of O_RDONLY, O_READ, O_WRONLY, O_WRITE, or O_RDWR is allowed.
   * O_RDONLY - Open for reading.
   * O_READ - Same as O_RDONLY.
   * O_WRONLY - Open for writing.
   * O_WRITE - Same as O_WRONLY.
   * O_RDWR - Open for reading and writing.
   * O_APPEND - If set, the file offset shall be set to the end of the
   * file prior to each write.
   * O_AT_END - Set the initial position at the end of the file.
   * O_CREAT - If the file exists, this flag has no effect except as noted
   * under O_EXCL below. Otherwise, the file shall be created
   * O_EXCL - If O_CREAT and O_EXCL are set, open() shall fail if the file
   * exists.
   * O_TRUNC - If the file exists and is a regular file, and the file is
   * successfully opened and is not read only, its length shall be truncated
   * to 0.
   * WARNING: A given file must not be opened by more than one FatFile object
   * or file corruption may occur.
   * Note: Directory files must be opened read only.  Write and truncation is
   * not allowed for directory files.
   * @return true for success or false for failure.
   */
  open(dirFile: FatFile | null, path: string, oflag = O_RDONLY): boolean {
    const tmpDir = new FatFile();

    // --- Error if already open
    if (this.isOpen() || !dirFile?.isDir()) {
      return false;
    }
    let index = 0;
    if (path.charAt(0) === "/") {
      while (path.charAt(index) === "/") {
        index++;
      }
      if (index >= path.length) {
        return this.openRoot(dirFile._vol);
      }
      if (!tmpDir.openRoot(dirFile._vol)) {
        return false;
      }
      dirFile = tmpDir;
    }

    const fsPath = this.parsePathToLfn(path);
    for (let i = 0; i < fsPath.segments.length - 1; i++) {
      if (!this.doOpen(dirFile, fsPath.segments[i], O_RDONLY)) {
        return false;
      }
      dirFile = this.clone();
      this.close();
    }
    return this.doOpen(dirFile, fsPath.segments[fsPath.segments.length - 1], oflag);
  }

  /**
   * Open a file in the current working volume.
   * @param _path A path with a valid name for a file to be opened.
   * @param _oflag bitwise-inclusive OR of open flags.
   * @return true for success or false for failure.
   */
  openInCwd(_path: string, _oflag = O_RDONLY): boolean {
    throw new Error("Method not implemented.");
  }

  /**
   * Open the current working directory.
   * @return true for success or false for failure.
   */
  openCwd(): boolean {
    throw new Error("Method not implemented.");
  }

  /**
   * Open the next file or subdirectory in a directory.
   * @param _dirFile An open FatFile instance for the directory
   * containing the file to be opened.
   * @param _oflag bitwise-inclusive OR of open flags.
   * @return true for success or false for failure.
   */
  openNext(_dirFile: FatFile, _oflag = O_RDONLY): boolean {
    throw new Error("Method not implemented.");
  }

  /**
   * Open a volume's root directory.
   * @param vol The FAT volume containing the root directory to be opened.
   * @return true for success or false for failure.
   */
  openRoot(vol: FatVolume): boolean {
    if (this.isOpen()) {
      return false;
    }

    this._attributes = FILE_ATTR_ROOT32;
    this._error = 0;
    this._flags = FILE_FLAG_READ;
    this._lfnOrd = 0;
    this._dirIndex = 0;
    this._vol = vol;
    this._dirCluster = 0;
    this._curCluster = 0;
    this._curPosition = 0;
    this._dirSector = 0;
    this._fileSize = 0;
    this._firstCluster = 0;
    return true;
  }

  /**
   * Allocate contiguous clusters to an empty file.
   * The file must be empty with no clusters allocated.
   * The file will contain uninitialized data.
   *
   * @param _length Size of the file in bytes.
   * @return true for success or false for failure.
   */
  preAllocate(_length: number): boolean {
    throw new Error("Method not implemented.");
  }

  /** Read the next byte from a file.
   * @return For success read returns the next byte in the file.
   * If an error occurs or end of file is reached -1 is returned.
   */
  readNext(): number {
    throw new Error("Method not implemented.");
  }

  /**
   * Read data from a file starting at the current position.
   * @param count Maximum number of bytes to read.
   * @return For success read() returns the number of bytes read.
   * A value less than `count`, including zero, will be returned
   * if end of file is reached.
   * If an error occurs, read() returns null.
   */
  read(count: number): Uint8Array | null {
    // --- Error if not open for read
    if (!this.isReadable()) {
      return null;
    }

    // --- Caclulate number of bytes to read
    if (this.isFile()) {
      const tmp32 = this._fileSize - this._curPosition;
      if (count >= tmp32) {
        count = tmp32;
      }
    } else if (this.isRootFixed()) {
      const tmp16 = (FS_DIR_SIZE * this._vol.rootDirEntryCount - this._curPosition) & 0xffff;
      if (count > tmp16) {
        count = tmp16;
      }
    }

    // --- Read data
    let result: Uint8Array;
    let toRead = count;
    let sectorOfCluster = 0;
    let sector: number; // raw device sector number
    while (toRead) {
      let n: number;
      let offset = this._curPosition & SECTOR_MASK; // offset in sector
      if (this.isRootFixed()) {
        sector = this._vol.rootDirStart + (this._curPosition >> BYTES_PER_SECTOR_SHIFT);
      } else {
        sectorOfCluster = this._vol.sectorOfCluster(this._curPosition);
        if (offset === 0 && sectorOfCluster === 0) {
          // --- Start of a new cluster
          if (this._curPosition === 0) {
            // --- Use first cluster in file
            this._curCluster = this.isRoot32() ? this._vol.rootDirStart : this._firstCluster;
          } else if (this.isFile() && this.isContiguous()) {
            this._curCluster++;
          } else {
            // --- Get next cluster from FAT
            const fg = this._vol.fatGet(this._curCluster);
            this._curCluster = fg.next;
            if (fg.status < 0) {
              // --- Error reading FAT.
              return null;
            }
            if (fg.status && fg.next === 0) {
              if (this.isDir()) {
                break;
              }
              return null;
            }
          }
        }
        sector = this._vol.clusterStartSector(this._curCluster) + sectorOfCluster;
      }

      // --- Read the next chunk of data
      if (offset !== 0 || toRead < BYTES_PER_SECTOR || sector === this._vol.cacheSectorNumber) {
        // --- Amount to be read from current sector
        n = BYTES_PER_SECTOR - offset;
        if (n > toRead) {
          n = toRead;
        }

        // --- Read sector to cache and copy data to caller
        const pc = this._vol.dataCachePrepare(sector, CACHE_FOR_READ);
        if (!pc) {
          return null;
        }
        result = new Uint8Array(n);
        result.set(pc.subarray(offset, offset + n));
      } else if (toRead >= 2 * BYTES_PER_SECTOR) {
        // --- Read multiple sectors
        let ns = toRead >> BYTES_PER_SECTOR_SHIFT;
        if (!this.isRootFixed()) {
          const mb = this._vol.sectorsPerCluster - sectorOfCluster;
          if (mb < ns) {
            ns = mb;
          }
        }
        n = ns << BYTES_PER_SECTOR_SHIFT;
        const dst = this._vol.cacheSafeRead(sector, ns);
        const oldResult = result;
        result = new Uint8Array(result.length + n);
        result.set(oldResult);
        result.set(dst, oldResult.length);
      } else {
        // read single sector
        n = BYTES_PER_SECTOR;
        result = this._vol.cacheSafeRead(sector);
      }
      this._curPosition += n;
      toRead -= n;
    }
    return result;
  }

  /**
   * Read next directory entry into the cache.
   * @param skipReadOk If true, skip read if the current position is valid.
   * Assumes file is correctly positioned.
   */
  readDirCache(skipReadOk = false): Fat32DirEntry | null {
    const i = (this._curPosition >> 5) & 0x0f;

    if (i == 0 || !skipReadOk) {
      let buffer = this.read(1);
      if (buffer.length !== 1) {
        if (buffer.length !== 0) {
          return null;
        }
      }
      this._curPosition += FS_DIR_SIZE - 1;
    } else {
      this._curPosition += FS_DIR_SIZE;
    }

    // --- Return the FAT directory entry
    return toFatDirEntry(this._vol.dataCache, i);
  }

  /**
   * Read the next directory entry from a directory file.
   * @return For success readDir() returns the number of bytes read.
   * A value of zero will be returned if end of file is reached.
   * If an error occurs, readDir() returns null.  Possible errors include
   * readDir() called before a directory has been opened, this is not
   * a directory file or an I/O error occurred.
   */
  readDir(): Fat32DirEntry | null {
    throw new Error("Method not implemented.");
  }

  /**
   * Remove a file.
   * @param _path Path for the file to be removed.
   * @return true for success or false for failure.
   * The directory entry and all data for the file are deleted.
   * Note: This function should not be used to delete the 8.3 version of a
   * file that has a long name. For example if a file has the long name
   * "New Text Document.txt" you should not delete the 8.3 name "NEWTEX~1.TXT".
   */
  remove(_path?: string): boolean {
    throw new Error("Method not implemented.");
  }

  /**
   * Rename a file or subdirectory.
   * @param _dirFile Directory for the new path.
   * @param _newPath New path name for the file/directory.
   * @return true for success or false for failure.
   */
  rename(_dirFile: FatFile, _newPath: string): boolean {
    throw new Error("Method not implemented.");
  }

  /**
   * Set the file's current position to zero.
   */
  rewind() {
    this.seekSet(0);
  }

  /**
   * Remove a directory file.
   * The directory file will be removed only if it is empty and is not the
   * root directory.  rmdir() follows DOS and Windows and ignores the
   * read-only attribute for the directory.
   * Note: This function should not be used to delete the 8.3 version of a
   * directory that has a long name. For example if a directory has the
   * long name "New folder" you should not delete the 8.3 name "NEWFOL~1".
   * @return true for success or false for failure.
   */
  rmdir(): boolean {
    throw new Error("Method not implemented.");
  }

  /**
   * Recursively delete a directory and all contained files.
   * This is like the Unix/Linux 'rm -rf *' if called with the root directory
   * hence the name.
   * @return true for success or false for failure.
   *
   * Warning - This will remove all contents of the directory including
   * subdirectories.  The directory will then be removed if it is not root.
   * The read-only attribute for files will be ignored.
   *
   * Note: This function should not be used to delete the 8.3 version of
   * a directory that has a long name.  See remove() and rmdir().
   */
  rmRfStar(): boolean {
    throw new Error("Method not implemented.");
  }

  /**
   * Set the files position to current position + `offset`. See seekSet().
   * @param offset The new position in bytes from the current position.
   * @return true for success or false for failure.
   */
  seekCur(offset: number) {
    return this.seekSet(this._curPosition + offset);
  }

  /**
   * Set the files position to end-of-file. See seekSet().
   * Can't be used for directory files since file size is not defined.
   * @param offset The new position in bytes from end-of-file.
   * \return true for success or false for failure.
   */
  seekEnd(offset = 0) {
    return this.isFile() ? this.seekSet(this._fileSize + offset) : false;
  }

  /**
   * Sets a file's position.
   * @param pos The new position in bytes from the beginning of the file.
   * @return true for success or false for failure.
   */
  seekSet(pos: number): boolean {
    let tmp = this._curCluster;

    // --- Error if file not open
    if (!this.isOpen()) {
      return false;
    }

    // --- Optimize O_APPEND writes.
    if (pos === this._curPosition) {
      return true;
    }

    if (pos === 0) {
      // --- Set position to start of file
      this._curCluster = 0;
      this._curPosition = 0;
      this._flags &= ~FILE_FLAG_PREALLOCATE;
      return true;
    }

    if (this.isFile()) {
      if (pos > this._fileSize) {
        this._curCluster = tmp;
        return false;
      }
    } else if (this.isRootFixed()) {
      if (pos <= FS_DIR_SIZE * this._vol.rootDirEntryCount) {
        this._curPosition = pos;
        this._flags &= ~FILE_FLAG_PREALLOCATE;
        return true;
      }
      this._curCluster = tmp;
      return false;
    }

    // --- Calculate cluster index for new position
    let nNew = (pos - 1) >> this._vol.bytesPerClusterShift;
    if (this.isContiguous()) {
      this._curCluster = this._firstCluster + nNew;
      this._curPosition = pos;
      this._flags &= ~FILE_FLAG_PREALLOCATE;
      return true;
    }

    // --- Calculate cluster index for current position
    let nCur = (this._curPosition - 1) >> this._vol.bytesPerClusterShift;

    if (nNew < nCur || this._curPosition == 0) {
      // must follow chain from first cluster
      this._curCluster = this.isRoot32() ? this._vol.rootDirStart : this._firstCluster;
    } else {
      // advance from curPosition
      nNew -= nCur;
    }
    while (nNew--) {
      const fg = this._vol.fatGet(this._curCluster);
      this._curCluster = fg.next;
      if (fg.status <= 0) {
        this._curCluster = tmp;
        return false;
      }
    }

    // --- Done.
    this._curPosition = pos;
    this._flags &= ~FILE_FLAG_PREALLOCATE;
    return true;
  }

  /**
   * The sync() call causes all modified data and directory fields
   * to be written to the storage device.
   * @return true for success or false for failure.
   */
  sync(): boolean {
    if (!this.isOpen()) {
      return true;
    }
    if (this._flags & FILE_FLAG_DIR_DIRTY) {
      const dir = this.cacheDirEntry(CACHE_FOR_WRITE);
      // --- Check for deleted by another open file object
      if (!dir || dir.DIR_Name.charCodeAt(0) === FAT_NAME_DELETED) {
        this._error |= WRITE_ERROR;
        return false;
      }
      dir.DIR_Attr = this._attributes & FS_ATTRIB_COPY;

      // --- Do not set filesize for dir files
      if (this.isFile()) {
        dir.DIR_FileSize = this._fileSize;
      }

      // --- Update first cluster fields
      dir.DIR_FstClusLO = this._firstCluster & 0xffff;
      dir.DIR_FstClusHI = this._firstCluster >> 16;

      // --- Set modify time if user supplied a callback date/time function
      const date = new Date();
      dir.DIR_WrtDate = dateToNumber(date);
      dir.DIR_WrtTime = timeToNumber(date);

      // --- Clear directory dirty
      this._flags &= ~FILE_FLAG_DIR_DIRTY;
    }
    if (this._vol.cacheSync()) {
      return true;
    }
    this._error |= WRITE_ERROR;
    return false;
  }

  /**
   * Set a file's timestamps in its directory entry.
   * @param flags Values for `flags` are constructed by a bitwise-inclusive
   * OR of flags from the following list
   * T_ACCESS - Set the file's last access date.
   * T_CREATE - Set the file's creation date and time.
   * T_WRITE - Set the file's last write/modification date and time.
   * @param year Valid range 1980 - 2107 inclusive.
   * @param month Valid range 1 - 12 inclusive.
   * @param day Valid range 1 - 31 inclusive.
   * @param hour Valid range 0 - 23 inclusive.
   * @param minute Valid range 0 - 59 inclusive.
   * @param second Valid range 0 - 59 inclusive
   * @return true for success or false for failure.
   * Note: It is possible to set an invalid date since there is no check for
   * the number of days in a month.
   * Note: Modify and access timestamps may be overwritten if a date time callback
   * function has been set by dateTimeCallback().
   */
  timestamp(
    flags: number,
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number
  ): boolean {
    throw new Error("Method not implemented.");
  }

  /**
   * Truncate a file at the current file position.
   * will be maintained if it is less than or equal to `length` otherwise
   * it will be set to end of file.
   * @param _length The desired length for the file.
   * @return true for success or false for failure.
   */
  truncate(_length?: number): boolean {
    throw new Error("Method not implemented.");
  }

  /**
   * Write a string to a file. Used by the Arduino Print class.
   * @param _str Pointer to the string.
   * Use getWriteError to check for errors.
   * @return count of characters written for success or -1 for failure.
   */
  writeString(_str: string) {
    throw new Error("Method not implemented.");
  }

  /**
   * Write a single byte.
   * @param _b The byte to be written.
   * @return +1 for success or -1 for failure.
   */
  writeByte(_b: number) {
    throw new Error("Method not implemented.");
  }

  /**
   * Write data to an open file.
   * @param _buf Bytes to be written to the file
   * @return For success write() returns the number of bytes written
   */
  writeBytes(_buf: Uint8Array): number {
    throw new Error("Method not implemented.");
  }

  cacheDirEntry(action: number): Fat32DirEntry | null {
    let pc = this._vol.dataCachePrepare(this._dirSector, action);
    return pc ? toFatDirEntry(pc, this._dirIndex & 0x0f) : null;
  }

  cacheDir(index: number): Fat32DirEntry | null {
    return this.seekSet(32 * index) ? this.readDirCache() : null;
  }

  setCacheDir(entry: Fat32DirEntry | Fat32LongFileName, index: number): void {
    const writer = new BinaryWriter();
    if (isFat32LongName(entry)) {
      writer.writeByte(entry.LDIR_Ord);
      writer.writeUint16(entry.LDIR_Name1[0]);
      writer.writeUint16(entry.LDIR_Name1[1]);
      writer.writeUint16(entry.LDIR_Name1[2]);
      writer.writeUint16(entry.LDIR_Name1[3]);
      writer.writeUint16(entry.LDIR_Name1[4]);
      writer.writeByte(entry.LDIR_Attr);
      writer.writeByte(entry.LDIR_Type);
      writer.writeByte(entry.LDIR_Chksum);
      writer.writeUint16(entry.LDIR_Name2[0]);
      writer.writeUint16(entry.LDIR_Name2[1]);
      writer.writeUint16(entry.LDIR_Name2[2]);
      writer.writeUint16(entry.LDIR_Name2[3]);
      writer.writeUint16(entry.LDIR_Name2[4]);
      writer.writeUint16(entry.LDIR_Name2[5]);
      writer.writeUint16(entry.LDIR_FstClusLO);
      writer.writeUint16(entry.LDIR_Name3[0]);
      writer.writeUint16(entry.LDIR_Name3[1]);
    } else {
      writer.writeString(entry.DIR_Name, 11);
      writer.writeByte(entry.DIR_Attr);
      writer.writeByte(entry.DIR_NTRes);
      writer.writeByte(entry.DIR_CrtTimeTenth);
      writer.writeUint16(entry.DIR_CrtTime);
      writer.writeUint16(entry.DIR_CrtDate);
      writer.writeUint16(entry.DIR_LstAccDate);
      writer.writeUint16(entry.DIR_FstClusHI);
      writer.writeUint16(entry.DIR_WrtTime);
      writer.writeUint16(entry.DIR_WrtDate);
      writer.writeUint16(entry.DIR_FstClusLO);
      writer.writeUint32(entry.DIR_FileSize);
    }
    this._vol.dataCache.set(writer.buffer, 32 * index);
  }

  getLfnChar(ldir: Fat32LongFileName, i: number): number {
    if (i < 5) {
      return (ldir.LDIR_Name1[2 * i] + (ldir.LDIR_Name1[2 * i + 1] << 8)) & 0xffff;
    } else if (i < 11) {
      return (ldir.LDIR_Name2[2 * (i - 5)] + (ldir.LDIR_Name2[2 * (i - 5) + 1] << 8)) & 0xffff;
    } else if (i < 13) {
      return (ldir.LDIR_Name3[2 * (i - 11)] + (ldir.LDIR_Name3[2 * (i - 11) + 1] << 8)) & 0xffff;
    } else {
      throw new Error("Invalid long name character index");
    }
  }

  putLfnChar(ldir: Fat32LongFileName, i: number, c: number) {
    if (i < 5) {
      ldir.LDIR_Name1[2 * i] = c & 0xff;
      ldir.LDIR_Name1[2 * i + 1] = (c >> 8) & 0xff;
    } else if (i < 11) {
      ldir.LDIR_Name2[2 * (i - 5)] = c & 0xff;
      ldir.LDIR_Name2[2 * (i - 5) + 1] = (c >> 8) & 0xff;
    } else if (i < 13) {
      ldir.LDIR_Name3[2 * (i - 11)] = c & 0xff;
      ldir.LDIR_Name3[2 * (i - 11) + 1] = (c >> 8) & 0xff;
    }
  }

  cmpName(index: number, fname: FsName, lfnOrd: number): boolean {
    const dir = this.clone();
    let nameIndex = 0;
    for (let order = 1; order <= lfnOrd; order++) {
      const ldir = toFatLongName(dir.cacheDir(index - order));
      if (!ldir) {
        return false;
      }
      for (let i = 0; i < 13; i++) {
        const u = this.getLfnChar(ldir, i);
        if (nameIndex >= fname.name.length) {
          return u === 0;
        }
        if (
          u > 0x7f ||
          String.fromCharCode(u).toUpperCase() !== fname.name.charAt(nameIndex++).toUpperCase()
        ) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Opens the specified FAT entry
   */
  openCachedEntry(dirFile: FatFile, dirIndex: number, oflag: number, lfnOrd: number): boolean {
    let firstCluster: number;
    this._attributes = 0;
    this._error = 0;
    this._flags = 0;
    this._lfnOrd = 0;
    this._dirIndex = dirIndex;
    this._vol = dirFile._vol;
    this._dirCluster = dirFile._firstCluster;
    this._curCluster = 0;
    this._curPosition = 0;
    this._dirSector = 0;
    this._fileSize = 0;
    this._firstCluster = 0;
    const dir = toFatDirEntry(this._vol.dataCache, dirIndex & 0x0f);

    // --- Must be file or subdirectory.
    if (!isFatFileOrSubdir(dir)) {
      return false;
    }

    this._attributes = dir.DIR_Attr & FS_ATTRIB_COPY;
    if (isFatFile(dir)) {
      this._attributes |= FILE_ATTR_FILE;
    }
    this._lfnOrd = lfnOrd;

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
      this._attributes |= FS_ATTRIB_ARCHIVE;
    }
    this._flags |= oflag & O_APPEND ? FILE_FLAG_APPEND : 0;
    this._dirSector = this._vol.cacheSectorNumber;

    // --- Copy first cluster number for directory fields
    firstCluster = (dir.DIR_FstClusHI << 16) | dir.DIR_FstClusLO;

    if (oflag & O_TRUNC) {
      if (firstCluster && !this._vol.freeChain(firstCluster)) {
        return false;
      }

      // --- Need to update directory entry
      this._flags |= FILE_FLAG_DIR_DIRTY;
    } else {
      this._firstCluster = firstCluster;
      this._fileSize = dir.DIR_FileSize;
    }
    if (oflag & O_AT_END && !this.seekSet(this._fileSize)) {
      return false;
    }
    return true;
  }

  /**
   * Make a unique file name for the specified long name
   * @param fname The long file name
   * @return
   */
  makeUniqueSfn(fname: string): FsName | null {
    for (let seq = 2; seq < 100; seq++) {
      const sfn = convertLongToShortName(fname, seq);
      this.rewind();
      while (true) {
        const dir = this.readDirCache(true);
        if (!dir) {
          if (!this.getError()) {
            // --- At EOF and name not found if no error.
            return new FsName(fname, seq);
          }
          return null;
        }
        if (dir.DIR_Name.charCodeAt(0) === FAT_NAME_FREE) {
          return new FsName(fname, seq);
        }

        const shortParts = sfn.name.split(".");
        const shortName = shortParts[0].padEnd(8, " ") + shortParts[1].padEnd(3, " ");

        if (isFatFileOrSubdir(dir) && shortName === dir.DIR_Name) {
          // --- Name found - try another.
          break;
        }
      }
    }
    // --- Fail: too many tries.
    return null;
  }

  createLFN(index: number, fname: FsName, lfnOrd: number): Fat32LongFileName | null {
    const dir = this.clone();
    let ldir: Fat32LongFileName;
    const checksum = calcShortNameCheckSum(fname.sfn11);

    let nameIndex = 0;
    for (let order = 1; order <= lfnOrd; order++) {
      ldir = toFatLongName(dir.cacheDir(index - order));
      if (!ldir) {
        return null;
      }
      dir._vol.cacheDirty();
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
      dir.setCacheDir(ldir, index - order);
    }
    return ldir;
  }

  /**
   * Executes the open operation.
   * @param dirFile An open FatFile instance for the directory containing
   * the file to be opened.
   * @param path A path with a valid name for a file to be opened.
   * @param oflag Values for `oflag` are constructed by a bitwise-inclusive
   * @return true for success or false for failure.
   */
  doOpen(dirFile: FatFile | null, fname: FsName, oflag?: number): boolean {
    const fatFile = this;
    let lfnOrd = 0;
    let fnameFound = false;
    let freeFound = 0;
    let freeNeed: number;
    let order = 0;
    let nameOrd: number;
    let curIndex: number;
    let freeIndex = 0;
    let freeTotal: number;

    const vol = dirFile?._vol;
    if (!dirFile?.isDir() || this.isOpen()) {
      return false;
    }

    // --- Number of directory entries needed
    nameOrd = Math.floor((fname.name.length + 12) / 13);

    // --- Number of free directory entries needed
    freeNeed = fname.flags & FNAME_FLAG_NEED_LFN ? 1 + nameOrd : 1;

    // --- Move back to the 0 seek position
    dirFile.rewind();

    let dir: Fat32DirEntry;
    while (true) {
      curIndex = Math.floor(dirFile._curPosition / FS_DIR_SIZE);
      dir = dirFile.readDirCache();
      if (!dir) {
        if (dirFile.getError()) {
          return false;
        }

        // --- At EOF
        return create();
      }

      const firstNameByte = dir.DIR_Name.charCodeAt(0);
      if (firstNameByte === FAT_NAME_DELETED || firstNameByte == FAT_NAME_FREE) {
        if (freeFound === 0) {
          freeIndex = curIndex;
        }
        if (freeFound < freeNeed) {
          freeFound++;
        }
        if (firstNameByte == FAT_NAME_FREE) {
          return create();
        }
      } else {
        if (freeFound < freeNeed) {
          freeFound = 0;
        }
      }

      // --- Skip empty slot or '.' or '..'
      let checksum = 0;
      let ldir: Fat32LongFileName;
      if (firstNameByte == FAT_NAME_DELETED || firstNameByte === ".".charCodeAt(0)) {
        lfnOrd = 0;
      } else if (isFatLongName(dir)) {
        ldir = toFatLongName(dir);
        if (!lfnOrd) {
          order = ldir.LDIR_Ord & 0x1f;
          if (order !== nameOrd || (ldir.LDIR_Ord & FAT_ORDER_LAST_LONG_ENTRY) === 0) {
            continue;
          }
          lfnOrd = nameOrd;
          checksum = ldir.LDIR_Chksum;
        } else if (ldir.LDIR_Ord !== --order || checksum !== ldir.LDIR_Chksum) {
          lfnOrd = 0;
          continue;
        }
        if (order === 1) {
          if (!dirFile.cmpName(curIndex + 1, fname, lfnOrd)) {
            lfnOrd = 0;
          }
        }
      } else if (isFatFileOrSubdir(dir)) {
        if (lfnOrd) {
          if (order == 1 && calcShortNameCheckSum(dir.DIR_Name) === checksum) {
            return found();
          }
          return false;
        }

        if (dir.DIR_Name === fname.sfn11) {
          if (!(fname.flags & FNAME_FLAG_LOST_CHARS)) {
            return found();
          }
          fnameFound = true;
        }
      } else {
        lfnOrd = 0;
      }
    }

    function found() {
      // Don't open if create only.
      if (oflag & O_EXCL) {
        return false;
      }
      return open();
    }

    function create() {
      // --- Don't create unless O_CREAT and write mode
      if (!(oflag & O_CREAT) || !isWriteMode(oflag)) {
        return false;
      }

      // --- Keep found entries or start at current index if no free entries found.
      if (freeFound == 0) {
        freeIndex = curIndex;
      }
      while (freeFound < freeNeed) {
        dir = dirFile.readDirCache();
        if (!dir) {
          if (dirFile.getError()) {
            return false;
          }
          // --- EOF if no error.
          break;
        }
        freeFound++;
      }

      // --- Loop handles the case of huge filename and cluster size one.
      freeTotal = freeFound;
      while (freeTotal < freeNeed) {
        // --- Will fail if FAT16 root.
        if (!dirFile.addDirCluster()) {
          return false;
        }
        // --- 16-bit freeTotal needed for large cluster size.
        freeTotal += vol.dirEntriesPerCluster;
      }
      if (fnameFound) {
        const fsName = dirFile.makeUniqueSfn(fname.name);
        if (fsName === null) {
          return false;
        }
      }

      lfnOrd = freeNeed - 1;
      curIndex = freeIndex + lfnOrd;
      if (!dirFile.createLFN(curIndex, fname, lfnOrd)) {
        return null;
      }
      dir = dirFile.cacheDir(curIndex);
      if (!dir) {
        return false;
      }
      // --- initialize as empty file
      dir.DIR_Name = fname.sfn11;
      dir.DIR_Attr = 0;

      // --- Set base-name and extension lower case bits.
      const now = new Date();
      dir.DIR_NTRes = (FAT_CASE_LC_BASE | FAT_CASE_LC_EXT) & fname.flags;
      dir.DIR_CrtTimeTenth = timeMsToNumber(now);
      dir.DIR_CrtTime = timeToNumber(now);
      dir.DIR_CrtDate = dateToNumber(now);
      dir.DIR_LstAccDate = dateToNumber(now);
      dir.DIR_FstClusHI = 0;
      dir.DIR_WrtTime = timeToNumber(now);
      dir.DIR_WrtDate = dateToNumber(now);
      dir.DIR_FstClusLO = 0;
      dir.DIR_FileSize = 0;
      fatFile.setCacheDir(dir, curIndex);

      // --- Force write of entry to device.
      vol.cacheDirty();
      return open();
    }

    function open() {
      // --- Open entry in cache.
      if (!fatFile.openCachedEntry(dirFile, curIndex, oflag, lfnOrd)) {
        return false;
      }
      return true;
    }
  }

  doMkdir(parent: FatFile, fname: FsName) {
    if (!parent.isDir()) {
      return false;
    }

    // --- Create a normal file
    if (!this.doOpen(parent, fname, O_CREAT | O_EXCL | O_RDWR)) {
      return false;
    }

    // --- Convert file to directory
    this._flags = FILE_FLAG_READ;
    this._attributes = FILE_ATTR_SUBDIR;

    // --- Allocate and zero first cluster
    if (!this.addDirCluster()) {
      return false;
    }

    this._firstCluster = this._curCluster;

    // --- Set to start of dir
    this.rewind();

    // --- force entry to device
    if (!this.sync()) {
      return false;
    }

    // --- Cache entry - should already be in cache due to sync() call
    let dir = this.cacheDirEntry(CACHE_FOR_WRITE);
    if (!dir) {
      return false;
    }

    // --- Change directory entry attribute
    dir.DIR_Attr = FS_ATTRIB_DIRECTORY;
    this.setCacheDir(dir, 0);

    // --- Make entry for '.'
    let dot = { ...dir };
    dot.DIR_Name = ".".padEnd(11, " ");

    // --- Cache sector for '.'  and '..'
    let sector = this._vol.clusterStartSector(this._firstCluster);
    let pc = this._vol.dataCachePrepare(sector, CACHE_FOR_WRITE);
    if (!pc) {
      return false;
    }
    this.setCacheDir(dot, 0);
    dot.DIR_Name = "..".padEnd(11, " ");
    dot.DIR_FstClusLO = parent._firstCluster & 0xffff;
    dot.DIR_FstClusHI = parent._firstCluster >> 16;

    // --- Copy '..' to sector
    this.setCacheDir(dot, 1);

    // --- Write first sector
    return this._vol.cacheSync();
  }

  // ========================================================================
  // --- Helpers

  addCluster(): boolean {
    const cc = this._curCluster;
    if (!(this._curCluster = this._vol.allocateCluster(this._curCluster))) {
      return false;
    }
    if (cc === 0) {
      this._flags |= FILE_FLAG_CONTIGUOUS;
    } else if (this._curCluster !== cc + 1) {
      this._flags &= ~FILE_FLAG_CONTIGUOUS;
    }
    this._flags |= FILE_FLAG_DIR_DIRTY;
    return true;
  }

  addDirCluster(): boolean {
    if (this.isRootFixed()) {
      return false;
    }

    // --- Max folder size
    if (this._curPosition >= 512 * 4095) {
      return false;
    }

    if (!this.addCluster()) {
      return false;
    }

    const sector = this._vol.clusterStartSector(this._curCluster);
    for (let i = 0; i < this._vol.sectorsPerCluster; i++) {
      const pc = this._vol.dataCachePrepare(sector + i, CACHE_RESERVE_FOR_WRITE);
      if (!pc) {
        return false;
      }
      pc.fill(0);
    }
    // Set position to EOF to avoid inconsistent curCluster/curPosition.
    this._curPosition += this._vol.bytesPerCluster;
    return true;
  }

  openCluster(file: FatFile): boolean {
    // TODO: Implement this method
    return false;
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

/**
 * This class represents a file's content
 */
export class FileContent {}
