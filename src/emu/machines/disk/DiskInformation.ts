import type { FloppyDiskFormat } from "@emu/abstractions/FloppyDiskFormat";

// --- Describes the disk information
export type DiskInformation = {
  // --- Format of the disk
  diskFormat: FloppyDiskFormat;

  // --- #of sides (1 or 2)
  numSides: number;

  // --- #of tracks per side
  numTracks: number;

  // --- Optional disk creator
  creator?: string;

  // --- The tracks of the disk, in file order: index = cylinder * numSides + side
  tracks: TrackInformation[];

  // --- Standard DSK only: the size of every track block (Track-Info included) in the file
  standardTrackSize?: number;

  // --- Bytes after the last track (an EDSK v5 Offset-Info block, for example), kept as they are
  trailer?: Uint8Array;
};

// --- Describes a particular track
export type TrackInformation = {
  // --- Is the track unformatted?
  unformatted: boolean;

  // --- Track number
  trackNumber: number;

  // --- Side number
  sideNumber: number;

  // --- Optional data rate information
  dataRate?: number;

  // --- Optional recording mode information
  recordingMode?: number;

  // --- The Track-Info's sector size code (N)
  sectorSize: number;

  // --- Sector count
  sectorCount: number;

  // --- Gap3 data byte
  gap3: number;

  // --- Filler data byte
  filler: number;

  // --- Sectors in this track
  sectors: SectorInformation[];
};

// --- Describes a particular sector
export type SectorInformation = {
  // --- Track number (Cylinder)
  C: number;

  // --- Head number (Side)
  H: number;

  // --- Record number (Record ID)
  R: number;

  // --- Sector size code: the sector holds 128 << N bytes (N = 0..7)
  N: number;

  // --- FDC status register 1
  SR1: number;

  // --- FDC status register 2
  SR2: number;

  // --- The number of bytes stored for the sector in the file (all copies of a weak sector)
  actualLength: number;

  // --- The sector data as stored (`actualLength` bytes)
  sectorData: Uint8Array;

  // --- Has the file stored several copies of this (weak) sector?
  multipleWeakSectors?: boolean;

  // --- How many copies of the sector the file stores (1 for an ordinary sector)
  copies?: number;

  // --- The position of the sector data in the file
  sectorDataPosition: number;
};
