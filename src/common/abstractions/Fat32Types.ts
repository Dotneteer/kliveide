export const BYTES_PER_SECTOR = 512;
export const SIGNATURE = 0xAA55;


// --- Size of FAT directory structures
export const FS_DIR_SIZE = 32;

// --- Boot sector signature
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

// --- name[0] value for entry that is free and no allocated entries follow it
export const FAT_NAME_FREE = 0X00;
// --- name[0] value for entry that is free after being "deleted"
export const FAT_NAME_DELETED = 0XE5;
// --- Directory attribute of volume label
export const FAT_ATTRIB_LABEL = 0x08;
export const FAT_ATTRIB_LONG_NAME = 0X0F;
// --- Filename base-name is all lower case
export const FAT_CASE_LC_BASE = 0X08;
// --- Filename extension is all lower case
export const FAT_CASE_LC_EXT = 0X10;

// --- Order mask that indicates the entry is the last long dir entry in a set of long dir entries
export const FAT_ORDER_LAST_LONG_ENTRY = 0X40;
// --- Max long file name length
export const FAT_MAX_LFN_LENGTH = 255;

export type Fat32PartitionEntry = {
  // Boot indicator
  // Offset: 0x00, 1 byte
  bootIndicator: number;
  // Starting CHS address
  // Offset: 0x01, 3 bytes
  beginChs: [number, number, number];
  // Partition type
  // Offset: 0x04, 1 byte
  partType: number;
  // Ending CHS address
  // Offset: 0x05, 3 bytes
  endChs: [number, number, number];
  // Starting LBA address
  // Offset: 0x08, 4 bytes
  relativeSectors: number;
  // Total sectors in partition
  // Offset: 0x0c, 4 bytes
  totalSectors: number;
}

export type Fat32MasterBootRecord = {
  // Boot code
  // Offset: 0x00, 446 bytes
  bootCode: Uint8Array;
  // Disk signature
  // Offset: 0x1b8, 4*16 bytes
  parts: Fat32PartitionEntry[];
  // Boot sector signature
  // Offset: 0x1fe, 2 bytes
  signature: number;
};

export type Fat32BootSector = {
  // Jump instruction
  // Offset: 0x00, 3 bytes
  BS_JmpBoot: number;
  // OEM name
  // Offset: 0x03, 8 bytes
  BS_OEMName: string;
  // Bytes per sector
  // Offset: 0x0b, 2 bytes
  BPB_BytsPerSec: number;
  // Sectors per cluster
  // Offset: 0x0d, 1 byte
  BPB_SecPerClus: number;
  // Reserved sectors count
  // Offset: 0x0e, 2 bytes
  BPB_ResvdSecCnt: number;
  // Number of FATs
  // Offset: 0x10, 1 byte
  BPB_NumFATs: number;
  // Maximum number of root directory entries
  // Offset: 0x11, 2 bytes
  BPB_RootEntCnt: number;
  // Total sectors in the file system
  // Offset: 0x13, 2 bytes
  BPB_TotSec16: number;
  // Media descriptor
  // Offset: 0x15, 1 byte
  BPB_Media: number;
  // Sectors per FAT
  // Offset: 0x16, 2 bytes
  BPB_FATSz16: number;
  // Sectors per track
  // Offset: 0x18, 2 bytes
  BPB_SecPerTrk: number;
  // Number of heads
  // Offset: 0x1a, 2 bytes
  BPB_NumHeads: number;
  // Hidden sectors
  // Offset: 0x1c, 4 bytes
  BPB_HiddSec: number;
  // Total sectors in the file system
  // Offset: 0x20, 4 bytes
  BPB_TotSec32: number;
  // FAT32 sectors
  // Offset: 0x24, 4 byte
  BPB_FATSz32: number;
  // Flags
  // Offset: 0x28, 2 bytes
  BPB_ExtFlags: number;
  // File system version
  // Offset: 0x2a, 2 bytes
  BPB_FSVer: number;
  // Cluster number of the root directory
  // Offset: 0x2c, 4 bytes
  BPB_RootClus: number;
  // Sector number of the FS Information Sector
  // Offset: 0x30, 2 bytes
  BPB_FSInfo: number;
  // Sector number of the Backup Boot Sector
  // Offset: 0x32, 2 bytes
  BPB_BkBootSec: number;
  // Reserved
  // Offset: 0x34, 12 bytes
  BPB_Reserved: Uint8Array;
  // Logical drive number
  // Offset: 0x40, 1 byte
  BS_DrvNum: number;
  // Reserved
  // Offset: 0x41, 1 byte
  BS_Reserved1: number;
  // Extended boot signature
  // Offset: 0x42, 1 byte
  BS_BootSig: number;
  // Volume ID
  // Offset: 0x43, 4 bytes
  BS_VolID: number;
  // Volume label
  // Offset: 0x47, 11 bytes
  BS_VolLab: string;
  // File system type
  // Offset: 0x52, 8 bytes
  BS_FileSysType: string;
  // Boot code
  // Offset: 0x5a, 420 bytes
  BootCode: Uint8Array;
  // Boot sector signature
  // Offset: 0x1fe, 2 bytes
  BootSectorSignature: number;
};

export type Fat32FSInfo = {
  // Signature
  // Offset: 0x00, 4 bytes
  FSI_LeadSig: number;
  // Reserved
  // Offset: 0x04, 480 bytes
  FSI_Reserved1: Uint8Array;
  // Signature
  // Offset: 0x1e4, 4 bytes
  FSI_StrucSig: number;
  // Free cluster count
  // Offset: 0x1e8, 4 bytes
  FSI_Free_Count: number;
  // Next free cluster
  // Offset: 0x1ec, 4 bytes
  FSI_Nxt_Free: number;
  // Reserved
  // Offset: 0x1f0, 12 bytes
  FSI_Reserved2: Uint8Array;
  // Signature
  // Offset: 0x1fc, 4 bytes
  FSI_TrailSig: number;
};

export type Fat32DirEntry = {
  // Short name
  // Offset: 0x00, 11 bytes
  DIR_Name: string;
  // Attributes
  // Offset: 0x0b, 1 byte
  DIR_Attr: number;
  // Reserved
  // Offset: 0x0c, 1 byte
  DIR_NTRes: number;
  // Creation time
  // Offset: 0x0d, 1 byte
  DIR_CrtTimeTenth: number;
  // Creation time
  // Offset: 0x0e, 2 bytes
  DIR_CrtTime: number;
  // Creation date
  // Offset: 0x10, 2 bytes
  DIR_CrtDate: number;
  // Last access date
  // Offset: 0x12, 2 bytes
  DIR_LstAccDate: number;
  // First cluster high word
  // Offset: 0x14, 2 bytes
  DIR_FstClusHI: number;
  // Last modification time
  // Offset: 0x16, 2 bytes
  DIR_WrtTime: number;
  // Last modification date
  // Offset: 0x18, 2 bytes
  DIR_WrtDate: number;
  // First cluster low word
  // Offset: 0x1a, 2 bytes
  DIR_FstClusLO: number;
  // File size
  // Offset: 0x1c, 4 bytes
  DIR_FileSize: number;
};

export type Fat32LongFileName = {
  // Order
  // Offset: 0x00, 1 byte
  LDIR_Ord: number;
  // Name 1
  // Offset: 0x01, 10 bytes
  LDIR_Name1: string;
  // Attributes
  // Offset: 0x0b, 1 byte
  LDIR_Attr: number;
  // Type
  // Offset: 0x0c, 1 byte
  LDIR_Type: number;
  // Checksum
  // Offset: 0x0d, 1 byte
  LDIR_Chksum: number;
  // Name 2
  // Offset: 0x0e, 12 bytes
  LDIR_Name2: string;
  // First cluster
  // Offset: 0x1a, 2 bytes
  LDIR_FstClusLO: number;
  // Name 3
  // Offset: 0x1c, 4 bytes
  LDIR_Name3: string;
};
