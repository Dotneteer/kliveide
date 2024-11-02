import { FS_ATTRIB_DIRECTORY } from "@abstractions/Fat32Types";

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
  //  FatVolume* m_vol;     // volume where file is located
  private _dirCluster = 0;
  private _curCluster = 0; // cluster for current file position
  private _curPosition = 0; // current file position
  private _dirSector = 0; // sector for this files directory entry
  private _fileSize = 0; // file size in bytes
  private _firstCluster = 0; // first cluster of file

  // ========================================================================
  // --- Helpers

  addCluster(): boolean {
    // TODO: Implement this method
    return false;
  }

  addDirCluster(): boolean {
    // TODO: Implement this method
    return false;
  }

  openCluster(file: FatFile): boolean {
    // TODO: Implement this method
    return false;
  }
}
