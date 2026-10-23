import type { DiskInformation, SectorInformation, TrackInformation } from "./DiskInformation";
import { FloppyDiskFormat } from "@emu/abstractions/FloppyDiskFormat";
import { nominalSectorLength, unformattedTrack } from "./disk-readers";

/** One sector of a track to build */
export type SectorSpec = {
  /** Record ID */
  r: number;
  /** Size code (default: the track's) */
  n?: number;
  /** ID cylinder and head (default: the physical track's) */
  c?: number;
  h?: number;
  /** Status bytes stored with the sector (deleted marks, CRC errors) */
  st1?: number;
  st2?: number;
  /** The stored bytes: all copies of a weak sector back to back (default: `filler` × 128 << n) */
  data?: Uint8Array;
};

/** One track to build */
export type TrackSpec = {
  sectors: SectorSpec[];
  /** The Track-Info's size code (default 2: 512 bytes) */
  n?: number;
  gap3?: number;
  filler?: number;
};

export type DiskSpec = {
  extended?: boolean;
  cylinders: number;
  sides: 1 | 2;
  creator?: string;
  /** A track's contents, or "unformatted"; called in file order */
  track: (cylinder: number, side: number) => TrackSpec | "unformatted";
  /** Bytes after the last track */
  trailer?: Uint8Array;
};

/** Builds a disk model (write it with `writeDiskData`) */
export function buildDisk (spec: DiskSpec): DiskInformation {
  const tracks: TrackInformation[] = [];
  for (let cylinder = 0; cylinder < spec.cylinders; cylinder++) {
    for (let side = 0; side < spec.sides; side++) {
      const t = spec.track(cylinder, side);
      if (t === "unformatted") {
        tracks.push(unformattedTrack(cylinder, side));
        continue;
      }
      const trackN = t.n ?? 2;
      const filler = t.filler ?? 0xe5;
      const sectors: SectorInformation[] = t.sectors.map((s) => {
        const n = s.n ?? trackN;
        const data = s.data ?? new Uint8Array(nominalSectorLength(n)).fill(filler);
        const nominal = nominalSectorLength(n);
        const copies = data.length > nominal && data.length % nominal === 0 ? data.length / nominal : 1;
        return {
          C: s.c ?? cylinder,
          H: s.h ?? side,
          R: s.r,
          N: n,
          SR1: s.st1 ?? 0,
          SR2: s.st2 ?? 0,
          actualLength: data.length,
          sectorData: data,
          multipleWeakSectors: copies > 1,
          copies,
          sectorDataPosition: 0
        };
      });
      tracks.push({
        unformatted: false,
        trackNumber: cylinder,
        sideNumber: side,
        dataRate: 0,
        recordingMode: 0,
        sectorSize: trackN,
        sectorCount: sectors.length,
        gap3: t.gap3 ?? 0x4e,
        filler,
        sectors
      });
    }
  }
  return {
    diskFormat: spec.extended === false ? FloppyDiskFormat.Cpc : FloppyDiskFormat.CpcExtended,
    creator: spec.creator ?? "",
    numTracks: spec.cylinders,
    numSides: spec.sides,
    tracks,
    trailer: spec.trailer
  };
}

/** `count` sectors numbered from `firstId`, in order */
export function sectorRun (firstId: number, count: number, extra: Partial<SectorSpec> = {}): SectorSpec[] {
  return Array.from({ length: count }, (_, i) => ({ r: firstId + i, ...extra }));
}
