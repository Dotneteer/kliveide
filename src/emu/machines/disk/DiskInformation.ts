import type { FloppyDiskFormat } from "../../../emu/abstractions/FloppyDiskFormat";

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

  // --- The tracks of the disk
  tracks: TrackInformation[];
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

  // --- Sector size
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

  // --- Sector size
  N: number;

  // --- FDC status register 1
  SR1: number;

  // --- FDC status register 2
  SR2: number;

  // --- The actual sector length
  actualLength: number;

  // --- The sector data
  sectorData: Uint8Array;

  // --- Has this sector multiple weak sectors?
  multipleWeakSectors?: boolean;

  // --- The position of the sector data in the file
  sectorDataPosition: number;
};
