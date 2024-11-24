export const BYTES_PER_SECTOR = 512;
export const SIGNATURE = 0xaa55;

// --- Size of FAT directory structures
export const FS_DIR_SIZE = 32;

// --- Boot sector
export const JUMP_CODE = 0xeb9058;
export const EXTENDED_BOOT_SIGNATURE = 0x29;

// --- FSInfo signatures
export const FSINFO_LEAD_SIGNATURE = 0x41615252;
export const FSINFO_STRUCT_SIGNATURE = 0x61417272;
export const FSINFO_TRAIL_SIGNATURE = 0xaa550000;

// --- Attributes common to FAT and exFAT
export const FS_ATTRIB_READ_ONLY = 0x01;
export const FS_ATTRIB_HIDDEN = 0x02;
export const FS_ATTRIB_SYSTEM = 0x04;
export const FS_ATTRIB_DIRECTORY = 0x10;

export const FS_ATTRIB_ARCHIVE = 0x20;
// --- Attributes that users can change
export const FS_ATTRIB_USER_SETTABLE =
  FS_ATTRIB_READ_ONLY | FS_ATTRIB_HIDDEN | FS_ATTRIB_SYSTEM | FS_ATTRIB_ARCHIVE;
// --- Attributes to copy when a file is opened.
export const FS_ATTRIB_COPY = FS_ATTRIB_USER_SETTABLE | FS_ATTRIB_DIRECTORY;

// --- Number of FAT tables
export const FAT_TABLE_COUNT = 2;

// --- name[0] value for entry that is free and no allocated entries follow it
export const FAT_NAME_FREE = 0x00;
// --- name[0] value for entry that is free after being "deleted"
export const FAT_NAME_DELETED = 0xe5;
// --- Directory attribute of volume label
export const FAT_ATTRIB_LABEL = 0x08;
export const FAT_ATTRIB_LONG_NAME = 0x0f;
// --- Filename base-name is all lower case
export const FAT_CASE_LC_BASE = 0x08;
// --- Filename extension is all lower case
export const FAT_CASE_LC_EXT = 0x10;

// --- Order mask that indicates the entry is the last long dir entry in a set of long dir entries
export const FAT_ORDER_LAST_LONG_ENTRY = 0x40;
// --- Max long file name length
export const FAT_MAX_LFN_LENGTH = 255;

// -- Derived from a LFN with loss or conversion of characters
export const FNAME_FLAG_LOST_CHARS = 0x01;
// --- Base-name or extension has mixed case
export const FNAME_FLAG_MIXED_CASE = 0x02;

export const FNAME_FLAG_NEED_LFN = FNAME_FLAG_LOST_CHARS | FNAME_FLAG_MIXED_CASE;

export const BYTES_PER_SECTOR_SHIFT = 9;
export const SECTOR_MASK = BYTES_PER_SECTOR - 1;

// --- Open for reading only
export const O_RDONLY = 0x00;

// --- Open for writing only
export const O_WRONLY = 0x01;

// --- Open for reading and writing
export const O_RDWR = 0x02;

// -- Open at EOF
export const O_AT_END = 0x04;

// --- Set append mode
export const O_APPEND = 0x08;

// --- Create file if it does not exist
export const O_CREAT = 0x10;

// --- Truncate file to zero length
export const O_TRUNC = 0x20;

// --- Fail if the file exists.
export const O_EXCL = 0x40;

// --- Synchronized write I/O operations.
export const O_SYNC = 0x80;

// --- Mask for access mode.
export const O_ACCMODE = O_RDONLY | O_WRONLY | O_RDWR;

export type FileEntry = {
  depth?: number;
  name: string;
  attributes: number;
  created: Date;
  lastAccessed: Date;
  lastModified: Date;
  firstCluster: number;
  size: number;
};

export type FilePosition = {
  position: number;
  cluster: number;
};
