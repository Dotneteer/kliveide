/*
 * The SAM Coupé's MGT disk format (`dev/plans/SAM_COUPE_PLAN.md` §10, §12; STORAGE_FIRMWARE_SOFTWARE.md
 * §4.2): 80 cylinders x 2 sides x 10 sectors of 512 bytes (819 200 bytes), cylinder-major with the
 * heads interleaved. The directory is tracks 0-3 of side 0, two 256-byte entries a sector (80 entries);
 * a file is a chain of sectors, 510 data bytes each and the next track/sector in the last two (0, 0 ends
 * it); side 1's tracks are numbered 128 + cylinder.
 *
 * A SAM file starts with a 9-byte header: 0 type, 1-2 length mod 16384, 3-4 start offset (8000h-BFFFh),
 * 5-6 FFh, 7 pages, 8 start page. Its directory entry repeats the place and adds the exec address:
 * 236 start page, 237-238 offset, 239 pages, 240-241 length mod 16384, 242 exec page (FFh: none),
 * 243-244 exec offset.
 *
 * Written from the research pack's description (which cites the Technical Manual and SAMdisk's MIT
 * headers); used for `.sbt` images, Run's boot disk and the `.mgt` export.
 */

export const MGT_CYLINDERS = 80;
export const MGT_SECTORS = 10;
export const MGT_SECTOR_SIZE = 512;
export const MGT_IMAGE_SIZE = MGT_CYLINDERS * 2 * MGT_SECTORS * MGT_SECTOR_SIZE;
export const MGT_DIR_TRACKS = 4;
export const MGT_DIR_ENTRIES = 80;
/** The data bytes of a sector (the last two link it to the next) */
export const MGT_SECTOR_DATA = 510;

/** SAM file types (bits 0-5 of a directory entry's byte 0) */
export const SAM_FILE_BASIC = 16;
export const SAM_FILE_NUMARRAY = 17;
export const SAM_FILE_STRARRAY = 18;
export const SAM_FILE_CODE = 19;
export const SAM_FILE_SCREEN = 20;
export const SAM_FILE_DIR = 21;

/** The page form of a SAM address: page and offset (8000h-BFFFh), from a BASIC linear address */
export function samPageForm(address: number): { page: number; offset: number } {
  const linear = address - 0x4000;
  return { page: Math.floor(linear / 0x4000) & 0x1f, offset: 0x8000 + (linear & 0x3fff) };
}

/** The linear BASIC address of a page and offset */
export function samLinearAddress(page: number, offset: number): number {
  return page * 0x4000 + (offset & 0x3fff) + 0x4000;
}

/** A SAM file to put on a disk */
export type MgtFile = {
  name: string;
  type: number;
  /** The file's data, without the 9-byte header (it is written here) */
  data: Uint8Array;
  startPage: number;
  /** 8000h-BFFFh */
  startOffset: number;
  /** Where it runs (a CODE file); none when absent */
  execPage?: number;
  execOffset?: number;
};

/** The 9-byte SAM file header of `file` */
export function samFileHeader(file: Pick<MgtFile, "type" | "data" | "startPage" | "startOffset">): Uint8Array {
  const header = new Uint8Array(9);
  const length = file.data.length;
  header[0] = file.type;
  header[1] = length & 0xff;
  header[2] = (length >> 8) & 0x3f;
  header[3] = file.startOffset & 0xff;
  header[4] = (file.startOffset >> 8) & 0xff;
  header[5] = 0xff;
  header[6] = 0xff;
  header[7] = Math.floor(length / 0x4000);
  header[8] = file.startPage & 0x1f;
  return header;
}

/** A sector's offset in the image: `track` 0-79 side 0, 128-207 side 1; `sector` 1-10 */
export function mgtSectorOffset(track: number, sector: number): number {
  const side = track & 0x80 ? 1 : 0;
  const cylinder = track & 0x7f;
  return ((cylinder * 2 + side) * MGT_SECTORS + (sector - 1)) * MGT_SECTOR_SIZE;
}

/** The offset of directory entry `index` (0-79) */
export function mgtDirEntryOffset(index: number): number {
  return mgtSectorOffset(Math.floor(index / 20), Math.floor((index % 20) / 2) + 1) + (index % 2) * 256;
}

/** The data sectors in allocation order: side 0 from track 4, then side 1 */
function* dataSectors(): Generator<[number, number]> {
  for (let c = MGT_DIR_TRACKS; c < MGT_CYLINDERS; c++) for (let s = 1; s <= MGT_SECTORS; s++) yield [c, s];
  for (let c = 0; c < MGT_CYLINDERS; c++) for (let s = 1; s <= MGT_SECTORS; s++) yield [0x80 | c, s];
}

/** A data sector's bit in an entry's sector map (bit 0 of byte 15 is track 4 sector 1) */
function sectorMapBit(track: number, sector: number): number {
  const side = track & 0x80 ? 1 : 0;
  const cylinder = track & 0x7f;
  const index = side ? (MGT_CYLINDERS - MGT_DIR_TRACKS) * MGT_SECTORS + cylinder * MGT_SECTORS : (cylinder - MGT_DIR_TRACKS) * MGT_SECTORS;
  return index + sector - 1;
}

/**
 * A formatted disk holding `files`, the first at track 4 sector 1 (so it is the boot file when it carries
 * "BOOT" at byte 256 of that sector)
 * @throws when the files do not fit
 */
export function buildMgtImage(files: readonly MgtFile[]): Uint8Array {
  if (files.length > MGT_DIR_ENTRIES) throw new Error("Too many files for one SAM disk.");
  const image = new Uint8Array(MGT_IMAGE_SIZE);
  const sectors = dataSectors();
  files.forEach((file, index) => {
    const bytes = new Uint8Array(9 + file.data.length);
    bytes.set(samFileHeader(file), 0);
    bytes.set(file.data, 9);
    const count = Math.max(1, Math.ceil(bytes.length / MGT_SECTOR_DATA));
    const chain: [number, number][] = [];
    for (let i = 0; i < count; i++) {
      const next = sectors.next();
      if (next.done) throw new Error("The files do not fit on one SAM disk.");
      chain.push(next.value);
    }
    const entry = new Uint8Array(256);
    chain.forEach(([track, sector], i) => {
      const at = mgtSectorOffset(track, sector);
      image.set(bytes.subarray(i * MGT_SECTOR_DATA, (i + 1) * MGT_SECTOR_DATA), at);
      const next = chain[i + 1];
      image[at + 510] = next ? next[0] : 0;
      image[at + 511] = next ? next[1] : 0;
      const bit = sectorMapBit(track, sector);
      entry[15 + (bit >> 3)] |= 1 << (bit & 7);
    });
    entry[0] = file.type;
    const name = file.name.slice(0, 10).padEnd(10, " ");
    for (let i = 0; i < 10; i++) entry[1 + i] = name.charCodeAt(i) & 0x7f;
    entry[11] = (count >> 8) & 0xff;
    entry[12] = count & 0xff;
    entry[13] = chain[0][0];
    entry[14] = chain[0][1];
    entry[236] = file.startPage & 0x1f;
    entry[237] = file.startOffset & 0xff;
    entry[238] = (file.startOffset >> 8) & 0xff;
    entry[239] = Math.floor(file.data.length / 0x4000);
    entry[240] = file.data.length & 0xff;
    entry[241] = (file.data.length >> 8) & 0x3f;
    const hasExec = file.execPage !== undefined && file.execOffset !== undefined;
    entry[242] = hasExec ? file.execPage! & 0x1f : 0xff;
    entry[243] = hasExec ? file.execOffset! & 0xff : 0xff;
    entry[244] = hasExec ? (file.execOffset! >> 8) & 0xff : 0xff;
    image.set(entry, mgtDirEntryOffset(index));
  });
  return image;
}

/** A directory entry as read from an image */
export type MgtDirEntry = {
  index: number;
  type: number;
  name: string;
  sectors: number;
  firstTrack: number;
  firstSector: number;
  startPage: number;
  startOffset: number;
  length: number;
  execPage?: number;
  execOffset?: number;
};

/** The used entries of an image's directory */
export function readMgtDirectory(image: Uint8Array): MgtDirEntry[] {
  const result: MgtDirEntry[] = [];
  for (let index = 0; index < MGT_DIR_ENTRIES; index++) {
    const at = mgtDirEntryOffset(index);
    const type = image[at] & 0x3f;
    if (type === 0 || image[at + 1] === 0) continue;
    let name = "";
    for (let i = 0; i < 10; i++) name += String.fromCharCode(image[at + 1 + i] & 0x7f);
    const execPage = image[at + 242];
    result.push({
      index,
      type,
      name: name.trimEnd(),
      sectors: (image[at + 11] << 8) | image[at + 12],
      firstTrack: image[at + 13],
      firstSector: image[at + 14],
      startPage: image[at + 236] & 0x1f,
      startOffset: image[at + 237] | (image[at + 238] << 8),
      length: image[at + 239] * 0x4000 + (image[at + 240] | ((image[at + 241] & 0x3f) << 8)),
      execPage: execPage === 0xff ? undefined : execPage & 0x1f,
      execOffset: execPage === 0xff ? undefined : image[at + 243] | (image[at + 244] << 8)
    });
  }
  return result;
}

/** A file's bytes (header included) by following its sector chain */
export function readMgtFileBytes(image: Uint8Array, entry: Pick<MgtDirEntry, "firstTrack" | "firstSector" | "sectors">): Uint8Array {
  const out: number[] = [];
  let track = entry.firstTrack;
  let sector = entry.firstSector;
  for (let i = 0; i < entry.sectors && !(track === 0 && sector === 0); i++) {
    const at = mgtSectorOffset(track, sector);
    for (let k = 0; k < MGT_SECTOR_DATA; k++) out.push(image[at + k]);
    track = image[at + 510];
    sector = image[at + 511];
  }
  return Uint8Array.from(out);
}
