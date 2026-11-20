import { gunzipSync } from "fflate";

import { MGT_SECTORS, MGT_SECTOR_SIZE, SAM_FILE_CODE, buildMgtImage } from "@common/samcoupe/mgtImage";

/*
 * SAM Coupé disk images to the controllers' canonical layout and back (`dev/plans/SAM_COUPE_PLAN.md`
 * §10.2; STORAGE_FIRMWARE_SOFTWARE.md §4.4). The canonical layout is the MGT image's own: cylinder-major,
 * the two heads interleaved, ten 512-byte sectors a track (IDs 1-10).
 *
 *   - `.mgt` / raw `.dsk`: 819 200 bytes (80 cylinders; up to 82 accepted), as they are;
 *   - gzip-compressed images (pyz80's default output, SAD version 2): unpacked first;
 *   - `.sad`: "Aley's disk backup", heads, tracks, sectors, sector size / 64, then the data side-major;
 *   - EDSK `.dsk` ("EXTENDED CPC DSK" / "MV - CPCEMU"): normal-format disks only (ten 512-byte sectors,
 *     IDs 1-10, on every track); anything else is refused, so copy-protected disks need another plan;
 *   - `.sbt`: a bare self-booting code file, wrapped as a one-file disk (the CODE file `autoExec` at page
 *     1, 8000h, track 4 sector 1, so the ROM boots it). Read-only.
 * Written from the pack's descriptions of the formats (SAMdisk is MIT, MAME's readers BSD-3); no code was
 * taken from them.
 */

export const SAM_DISK_TRACK_BYTES = MGT_SECTORS * MGT_SECTOR_SIZE;
export const SAM_DISK_CYLINDER_BYTES = 2 * SAM_DISK_TRACK_BYTES;
export const SAM_DISK_MAX_CYLINDERS = 82;

export type SamDiskKind = "mgt" | "sad" | "edsk" | "sbt";

/** A disk ready for the controller: the canonical bytes, its geometry, whether it is read-only */
export type SamDisk = {
  kind: SamDiskKind;
  cylinders: number;
  canonical: Uint8Array;
  readOnly: boolean;
};

const SAD_SIGNATURE = "Aley's disk backup";

function ascii(bytes: Uint8Array, from: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(from, from + length));
}

function fromSad(bytes: Uint8Array): SamDisk | string {
  const heads = bytes[18];
  const tracks = bytes[19];
  const sectors = bytes[20];
  const size = bytes[21] * 64;
  if (heads < 1 || heads > 2 || sectors !== MGT_SECTORS || size !== MGT_SECTOR_SIZE || tracks < 1 || tracks > SAM_DISK_MAX_CYLINDERS) {
    return `This SAD image's geometry (${heads} heads, ${tracks} tracks, ${sectors} sectors of ${size} bytes) is not a SAM disk format Klive reads.`;
  }
  const trackBytes = sectors * size;
  if (bytes.length < 22 + heads * tracks * trackBytes) return "The SAD image is shorter than its header says.";
  const canonical = new Uint8Array(tracks * SAM_DISK_CYLINDER_BYTES);
  for (let h = 0; h < heads; h++) {
    for (let t = 0; t < tracks; t++) {
      const from = 22 + (h * tracks + t) * trackBytes;
      canonical.set(bytes.subarray(from, from + trackBytes), (t * 2 + h) * SAM_DISK_TRACK_BYTES);
    }
  }
  return { kind: "sad", cylinders: tracks, canonical, readOnly: false };
}

function fromEdsk(bytes: Uint8Array): SamDisk | string {
  const extended = ascii(bytes, 0, 8) === "EXTENDED";
  const tracks = bytes[0x30];
  const sides = bytes[0x31];
  if (sides < 1 || sides > 2 || tracks < 1 || tracks > SAM_DISK_MAX_CYLINDERS) return "This DSK image's geometry is not a SAM disk's.";
  const canonical = new Uint8Array(tracks * SAM_DISK_CYLINDER_BYTES);
  let at = 0x100;
  for (let t = 0; t < tracks; t++) {
    for (let s = 0; s < sides; s++) {
      const blockSize = extended ? bytes[0x34 + t * sides + s] * 256 : bytes[0x32] | (bytes[0x33] << 8);
      if (blockSize === 0) continue;
      if (ascii(bytes, at, 10) !== "Track-Info") return "The DSK image is damaged (a track has no Track-Info).";
      const count = bytes[at + 0x15];
      if (count !== MGT_SECTORS || bytes[at + 0x14] !== 2) return "This DSK image has tracks in a format other than the SAM's ten 512-byte sectors (a protected disk?).";
      let data = at + 0x100;
      for (let k = 0; k < count; k++) {
        const info = at + 0x18 + k * 8;
        const id = bytes[info + 2];
        const length = extended ? bytes[info + 6] | (bytes[info + 7] << 8) : MGT_SECTOR_SIZE;
        if (id < 1 || id > MGT_SECTORS || bytes[info + 3] !== 2) return "This DSK image has sectors the SAM's format does not have (a protected disk?).";
        canonical.set(bytes.subarray(data, data + MGT_SECTOR_SIZE), (t * 2 + s) * SAM_DISK_TRACK_BYTES + (id - 1) * MGT_SECTOR_SIZE);
        data += length;
      }
      at += blockSize;
    }
  }
  return { kind: "edsk", cylinders: tracks, canonical, readOnly: false };
}

/** Wraps a `.sbt` file as a one-file bootable disk */
export function wrapSbt(bytes: Uint8Array): Uint8Array {
  return buildMgtImage([{ name: "autoExec", type: SAM_FILE_CODE, data: bytes, startPage: 1, startOffset: 0x8000, execPage: 1, execOffset: 0x8009 }]);
}

/**
 * The disk an image file holds
 * @returns the disk, or why it cannot go in a drive
 */
export function samDiskFromImage(file: Uint8Array): SamDisk | string {
  let bytes = file;
  if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    try {
      bytes = gunzipSync(bytes);
    } catch {
      return "The compressed disk image cannot be unpacked.";
    }
  }
  if (bytes.length >= 22 && ascii(bytes, 0, SAD_SIGNATURE.length) === SAD_SIGNATURE) return fromSad(bytes);
  if (bytes.length >= 0x100 && (ascii(bytes, 0, 8) === "EXTENDED" || ascii(bytes, 0, 8) === "MV - CPC")) return fromEdsk(bytes);
  if (bytes.length % SAM_DISK_CYLINDER_BYTES === 0 && bytes.length >= 40 * SAM_DISK_CYLINDER_BYTES) {
    const cylinders = bytes.length / SAM_DISK_CYLINDER_BYTES;
    if (cylinders > SAM_DISK_MAX_CYLINDERS) return "The disk image is larger than a SAM disk.";
    return { kind: "mgt", cylinders, canonical: bytes, readOnly: false };
  }
  // --- A bare self-booting file: as a one-file disk
  if (bytes.length > 0 && bytes.length < 780 * 1024) {
    return { kind: "sbt", cylinders: 80, canonical: wrapSbt(bytes), readOnly: true };
  }
  return "This file is not a SAM disk image Klive reads (.mgt, .dsk, .sad, .sbt).";
}

/** The canonical bytes back as an image of the same kind (EDSK and SAD come back as `.mgt`) */
export function samDiskToImage(canonical: Uint8Array, cylinders: number): Uint8Array {
  return canonical.slice(0, cylinders * SAM_DISK_CYLINDER_BYTES);
}
