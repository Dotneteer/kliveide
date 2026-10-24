import type { DiskInformation, TrackInformation } from "./DiskInformation";

import { DiskDensity } from "@emu/abstractions/DiskDensity";
import { BufferSpan } from "./BufferSpan";
import { DiskCrc } from "./DiskCrc";
import { nominalSectorLength } from "./disk-readers";

// --- ST2 bit 6 (CM): the sector was read with a deleted data address mark
const ST2_CONTROL_MARK = 0x40;
// --- ST2 bit 5 (DD): CRC error in the data field
const ST2_DATA_ERROR = 0x20;

// --- Gap type indexes
const GAP_MINIMAL_FM = 0;
const GAP_MINIMAL_MFM = 1;

/**
 * The surface view of a disk
 */
export interface DiskSurface {
  density: DiskDensity;
  bytesPerTrack: number;
  tracks: TrackSurface[];
}

/**
 * Surface of a single track
 */
interface TrackSurface {
  trackLength: number;
  trackData: Uint8Array;
  header: BufferSpan;
  sectors: SectorSurface[];
  clockData: BufferSpan;
  fmData: BufferSpan;
  weakSectorData: BufferSpan;
}

/**
 * Surface of a single sector
 */
interface SectorSurface {
  headerData: BufferSpan;
  sectorPrefix: BufferSpan;
  sectordata: BufferSpan;
  tailData: BufferSpan;
}

/**
 * Creates a surface view of the specified disk file contents
 * @param contents Disk contents or a reader parsing the contents
 * @returns The surface view of the disk
 */
export function createDiskSurface(diskInfo: DiskInformation): DiskSurface {
  // --- Get the longest track
  let maxBytesPerTrack = 0;
  let gapType = GAP_MINIMAL_FM;

  // --- All tracks should have the same gap type. Calculate track header length.
  const track0 = diskInfo.tracks[0];
  if (track0.gap3 !== 0xff) {
    gapType = GAP_MINIMAL_MFM;
  }
  const gapInfo = gaps[gapType];
  const trackHeaderLength =
    gapInfo.sync_len + // --- Sync bytes
    (gapInfo.mark !== 0xff ? 3 : 0) +
    1 + // --- Index mark
    gapInfo.len[1]; // --- Gap 1

  // --- Iterate through all tracks to find the longest track size
  diskInfo.tracks.forEach((t) => {
    let trackDataLength = 0;

    // --- Iterate through all sectors
    t.sectors.forEach((s) => {
      // --- Add sector header block length
      trackDataLength +=
        gapInfo.sync_len + // -- Sync bytes
        (gapInfo.mark !== 0xff ? 3 : 0) +
        1 + // --- Address mark
        1 + // --- C
        1 + // --- H
        1 + // --- R
        1 + // --- N
        2 + // --- CRC
        gapInfo.len[2]; // --- Gap 2

      // --- Add sector data block length: the surface holds one copy of the sector, at its size
      // --- code's length (a weak sector's further copies are versions of the same bytes)
      const sectorDataLength = nominalSectorLength(s.N);
      trackDataLength +=
        gapInfo.sync_len + // -- Sync bytes
        (gapInfo.mark !== 0xff ? 3 : 0) +
        1 + // --- Data mark
        sectorDataLength + // --- Sector data
        2 + // --- CRC
        gapInfo.len[3]; // --- Gap 3
    });

    // --- At this point, we have the total track data length.
    const bytesPerTrack = trackHeaderLength + trackDataLength;

    // --- Ok, set the maximum track length
    if (maxBytesPerTrack < bytesPerTrack) {
      maxBytesPerTrack = bytesPerTrack;
    }
  });

  // --- Now, we can calculate the density and set the real bytes per track value
  let density = DiskDensity.SD;
  if (maxBytesPerTrack > 12500) {
    throw new Error("Disk density not supported");
  } else if (maxBytesPerTrack > 10416) {
    density = DiskDensity.HD;
  } else if (maxBytesPerTrack > 6500) {
    density = DiskDensity.DD_8;
  } else if (maxBytesPerTrack > 6250) {
    density = DiskDensity.DD_PLUS;
  } else if (maxBytesPerTrack > 5208) {
    density = DiskDensity.DD;
  } else if (maxBytesPerTrack > 3125) {
    density = DiskDensity.SD_8;
  } else if (maxBytesPerTrack > 0) {
    density = DiskDensity.SD;
  }
  const bytesPerTrack = bytesPerTrackForDensity[density];

  // --- Each track stores some extra bits of information as a bit array in the track's tail
  const bitArrayLength = Math.ceil(bytesPerTrack / 8);
  const trackLength =
    bytesPerTrack +
    bitArrayLength + // --- Clock data
    bitArrayLength + // --- FM data
    bitArrayLength; // --- Weak sector data

  // --- Now, let's allocate the space for the surface view
  const tracks: TrackSurface[] = [];
  for (let i = 0; i < diskInfo.tracks.length; i++) {
    const trackData = new Uint8Array(trackLength);
    const sectorSpan = new BufferSpan(
      trackData,
      trackHeaderLength,
      bytesPerTrack - trackHeaderLength
    );
    const weakOffset = trackLength - bitArrayLength;
    const fmOffset = weakOffset - bitArrayLength;
    const clockOffset = fmOffset - bitArrayLength;
    const clockData = new BufferSpan(trackData, clockOffset, bitArrayLength);
    const weakSectorData = new BufferSpan(trackData, weakOffset, bitArrayLength);
    const track = (tracks[i] = {
      trackLength: bytesPerTrack,
      trackData,
      header: new BufferSpan(trackData, 0, trackHeaderLength),
      sectors: setSectorData(diskInfo.tracks[i], sectorSpan, gapInfo, clockData, weakSectorData),
      clockData,
      fmData: new BufferSpan(trackData, fmOffset, bitArrayLength),
      weakSectorData
    });

    // --- Fill the track header
    let offset = 0;

    // --- Sync bytes
    for (let i = 0; i < gapInfo.sync_len; i++) {
      track.header.set(offset++, 0x00);
    }

    // --- Index mark
    for (let i = 0; i < (gapInfo.mark !== 0xff ? 3 : 0); i++) {
      track.header.set(offset, gapInfo.mark);
      track.clockData.setBit(offset++, true);
    }
    if (gapInfo.mark === 0xff) {
      track.clockData.setBit(offset, true);
    }
    track.header.set(offset++, 0xfc);

    // --- Gap 1
    for (let i = 0; i < gapInfo.len[1]; i++) {
      track.header.set(offset++, gapInfo.gap);
    }

    // --- Fill the track data
  }

  // --- Done.
  return {
    density,
    bytesPerTrack,
    tracks
  };
}

/**
 * Fill sector data from the track data
 * @param trackData
 * @param headerLength
 * @param gapInfo
 * @param clockData
 * @returns
 */
function setSectorData(
  track: TrackInformation,
  sectorSpan: BufferSpan,
  gapInfo: DiskGap,
  clockData: BufferSpan,
  weakData: BufferSpan
): SectorSurface[] {
  const sectors: SectorSurface[] = [];
  let offset = 0;
  const clockOffset = sectorSpan.startOffset;
  track.sectors.forEach((s) => {
    // --- Take a note of the sector offset
    const sectorOffset = offset;

    // --- Sector header block (sync)
    for (let i = 0; i < gapInfo.sync_len; i++) {
      sectorSpan.set(offset++, 0x00);
    }

    // --- Sector header block (address mark)
    let crc = new DiskCrc();
    for (let i = 0; i < (gapInfo.mark !== 0xff ? 3 : 0); i++) {
      sectorSpan.set(offset, gapInfo.mark);
      crc.add(gapInfo.mark);
      clockData.setBit(clockOffset + offset++, true);
    }
    if (gapInfo.mark === 0xff) {
      clockData.setBit(clockOffset + offset, true);
    }
    sectorSpan.set(offset++, 0xfe);
    crc.add(0xfe);

    // --- Sector header block (CHRN)
    sectorSpan.set(offset++, s.C);
    crc.add(s.C);
    sectorSpan.set(offset++, s.H);
    crc.add(s.H);
    sectorSpan.set(offset++, s.R);
    crc.add(s.R);
    sectorSpan.set(offset++, s.N);
    crc.add(s.N);

    // --- Sector header block (CRC)
    sectorSpan.set(offset++, crc.high);
    sectorSpan.set(offset++, crc.low);

    // --- Gap 2
    for (let i = 0; i < gapInfo.len[2]; i++) {
      sectorSpan.set(offset++, gapInfo.gap);
    }

    // --- Take a note of sector header length
    const headerLength = offset - sectorOffset;

    // --- Sector data block (sync)
    for (let i = 0; i < gapInfo.sync_len; i++) {
      sectorSpan.set(offset++, 0x00);
    }

    // --- Sector data block (data mark)
    crc = new DiskCrc();
    for (let i = 0; i < (gapInfo.mark !== 0xff ? 3 : 0); i++) {
      sectorSpan.set(offset, gapInfo.mark);
      crc.add(gapInfo.mark);
      clockData.setBit(clockOffset + offset++, true);
    }
    if (gapInfo.mark === 0xff) {
      clockData.setBit(clockOffset + offset, true);
    }
    // --- A deleted data address mark when the dump says the sector was read with one
    const dataMark = (s.SR2 & ST2_CONTROL_MARK) !== 0 ? 0xf8 : 0xfb;
    sectorSpan.set(offset++, dataMark);
    crc.add(dataMark);

    // --- Take a not of prefix length
    const prefixLength = offset - sectorOffset - headerLength;

    // --- Sector data block: the first copy, padded with 0x00 when the dump stored fewer bytes
    const storedDataLenght = nominalSectorLength(s.N);
    const dataOffset = offset;
    const stored = Math.min(s.actualLength, storedDataLenght);
    for (let i = 0; i < stored; i++) {
      sectorSpan.set(offset++, s.sectorData[i]);
      crc.add(s.sectorData[i]);
    }
    for (let i = stored; i < storedDataLenght; i++) {
      sectorSpan.set(offset++, 0x00);
      crc.add(0x00);
    }

    // --- A weak sector's bytes read differently each time: mark them on the weak-data bit array
    if ((s.copies ?? 1) > 1) {
      for (let i = 0; i < storedDataLenght; i++) {
        weakData.setBit(clockOffset + dataOffset + i, true);
      }
    }

    // --- Take a note of sector tail length
    const tailLength = offset - sectorOffset - headerLength;

    // --- Sector data block (CRC), deliberately wrong when the dump recorded a data CRC error
    const crcFlip = (s.SR2 & ST2_DATA_ERROR) !== 0 ? 0xff : 0x00;
    sectorSpan.set(offset++, crc.high ^ crcFlip);
    sectorSpan.set(offset++, crc.low ^ crcFlip);

    // --- Gap 3
    for (let i = 0; i < gapInfo.len[3]; i++) {
      sectorSpan.set(offset++, gapInfo.gap);
    }

    // --- Store sector surface information
    sectors.push({
      headerData: new BufferSpan(
        sectorSpan.buffer,
        sectorSpan.startOffset + sectorOffset,
        headerLength
      ),
      sectorPrefix: new BufferSpan(
        sectorSpan.buffer,
        sectorSpan.startOffset + sectorOffset + headerLength,
        prefixLength
      ),
      sectordata: new BufferSpan(
        sectorSpan.buffer,
        sectorSpan.startOffset + sectorOffset + headerLength + prefixLength,
        storedDataLenght
      ),
      tailData: new BufferSpan(
        sectorSpan.buffer,
        sectorSpan.startOffset + sectorOffset + headerLength + prefixLength + storedDataLenght,
        tailLength
      )
    });
  });
  return sectors;
}

type DiskGap = {
  // --- Gap byte
  gap: number;
  // --- Sync byte
  sync: number;
  // --- Sync length
  sync_len: number;
  // --- Byte 0xa1 for MFM 0xff for MF
  mark: number;
  len: number[];
};

const gaps: DiskGap[] = [
  // --- MINIMAL_FM
  { gap: 0xff, sync: 0x00, sync_len: 6, mark: 0xff, len: [0, 16, 11, 10] },
  // --- MINIMAL MFM
  { gap: 0x4e, sync: 0x00, sync_len: 12, mark: 0xa1, len: [0, 32, 22, 24] }
];

const bytesPerTrackForDensity: number[] = [
  6250 /* AUTO assumes DD */, 5208 /* 8" SD */, 10416 /* 8" DD */, 3125 /* SD */, 6250 /* DD */,
  6500 /* DD+ e.g. Coin Op Hits */, 12500 /* HD */
];
