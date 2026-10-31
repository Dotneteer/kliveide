/*
 * Builds and reads MS-DOS (FAT12) floppy images for the EXDOS tests: Klive's own builder, so the tests
 * need no third-party disk image (whose licence would be unknown). One root directory, contiguous
 * clusters, two FAT copies; 8.3 names.
 */

export type Fat12Geometry = { cylinders: number; sides: number; sectorsPerTrack: number };

export type Fat12File = { name: string; contents: Uint8Array };

/** The 720K format: 80 x 2 x 9 x 512, two sectors a cluster, 112 root entries, three sectors a FAT */
export const FAT12_720K: Fat12Geometry = { cylinders: 80, sides: 2, sectorsPerTrack: 9 };

type Layout = {
  totalSectors: number;
  sectorsPerCluster: number;
  rootEntries: number;
  fatSectors: number;
  media: number;
};

function layoutOf(g: Fat12Geometry): Layout {
  const totalSectors = g.cylinders * g.sides * g.sectorsPerTrack;
  // --- The DOS conventions: 720K F9h 2/112/3; 360K FDh 2/112/2; 180K FCh 1/64/2
  if (totalSectors >= 1440) return { totalSectors, sectorsPerCluster: 2, rootEntries: 112, fatSectors: 3, media: 0xf9 };
  if (g.sides === 2) return { totalSectors, sectorsPerCluster: 2, rootEntries: 112, fatSectors: 2, media: 0xfd };
  return { totalSectors, sectorsPerCluster: 1, rootEntries: 64, fatSectors: 2, media: 0xfc };
}

function nameBytes(name: string): number[] {
  const [base, ext = ""] = name.toUpperCase().split(".");
  return [...base.padEnd(8, " ").slice(0, 8), ...ext.padEnd(3, " ").slice(0, 3)].map((c) => c.charCodeAt(0));
}

/** A freshly formatted disk with these files in its root directory */
export function buildFat12Image(files: Fat12File[] = [], geometry: Fat12Geometry = FAT12_720K): Uint8Array {
  const l = layoutOf(geometry);
  const image = new Uint8Array(l.totalSectors * 512);
  const put16 = (at: number, v: number) => {
    image[at] = v & 0xff;
    image[at + 1] = (v >> 8) & 0xff;
  };
  // --- The boot sector
  image.set([0xeb, 0x3c, 0x90], 0);
  image.set([..."KLIVE   "].map((c) => c.charCodeAt(0)), 3);
  put16(0x0b, 512);
  image[0x0d] = l.sectorsPerCluster;
  put16(0x0e, 1);
  image[0x10] = 2;
  put16(0x11, l.rootEntries);
  put16(0x13, l.totalSectors);
  image[0x15] = l.media;
  put16(0x16, l.fatSectors);
  put16(0x18, geometry.sectorsPerTrack);
  put16(0x1a, geometry.sides);
  image[0x1fe] = 0x55;
  image[0x1ff] = 0xaa;
  // --- The FATs and the root directory
  const fat = new Array<number>(Math.floor((l.fatSectors * 512 * 2) / 3)).fill(0);
  fat[0] = 0xf00 | l.media;
  fat[1] = 0xfff;
  const rootAt = (1 + 2 * l.fatSectors) * 512;
  const dataSector = 1 + 2 * l.fatSectors + (l.rootEntries * 32) / 512;
  const clusterBytes = l.sectorsPerCluster * 512;
  let cluster = 2;
  files.forEach((file, index) => {
    const entry = rootAt + index * 32;
    image.set(nameBytes(file.name), entry);
    image[entry + 11] = 0x20;
    // --- 1 January 1990, noon
    put16(entry + 22, 12 << 11);
    put16(entry + 24, ((1990 - 1980) << 9) | (1 << 5) | 1);
    const count = Math.ceil(file.contents.length / clusterBytes);
    put16(entry + 26, count ? cluster : 0);
    const size = file.contents.length;
    image.set([size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, size >>> 24], entry + 28);
    for (let i = 0; i < count; i++) {
      fat[cluster + i] = i === count - 1 ? 0xfff : cluster + i + 1;
    }
    image.set(file.contents, (dataSector + (cluster - 2) * l.sectorsPerCluster) * 512);
    cluster += count;
  });
  const fatBytes = new Uint8Array(l.fatSectors * 512);
  for (let i = 0; i + 1 < fat.length; i += 2) {
    const at = (i / 2) * 3;
    fatBytes[at] = fat[i] & 0xff;
    fatBytes[at + 1] = ((fat[i] >> 8) & 0x0f) | ((fat[i + 1] & 0x0f) << 4);
    fatBytes[at + 2] = (fat[i + 1] >> 4) & 0xff;
  }
  image.set(fatBytes, 512);
  image.set(fatBytes, (1 + l.fatSectors) * 512);
  return image;
}

/** The files in a disk's root directory: name, size and contents (following the FAT chain) */
export function readFat12Files(image: Uint8Array): { name: string; size: number; contents: Uint8Array }[] {
  const word = (at: number) => image[at] | (image[at + 1] << 8);
  const sectorsPerCluster = image[0x0d];
  const reserved = word(0x0e);
  const fats = image[0x10];
  const rootEntries = word(0x11);
  const fatSectors = word(0x16);
  const fatAt = reserved * 512;
  const rootAt = (reserved + fats * fatSectors) * 512;
  const dataSector = reserved + fats * fatSectors + (rootEntries * 32) / 512;
  const next = (c: number) => {
    const at = fatAt + Math.floor((c * 3) / 2);
    const v = word(at);
    return c & 1 ? v >> 4 : v & 0xfff;
  };
  const result: { name: string; size: number; contents: Uint8Array }[] = [];
  for (let i = 0; i < rootEntries; i++) {
    const entry = rootAt + i * 32;
    const first = image[entry];
    if (first === 0) break;
    if (first === 0xe5 || (image[entry + 11] & 0x18) !== 0) continue;
    const base = String.fromCharCode(...image.subarray(entry, entry + 8)).trimEnd();
    const ext = String.fromCharCode(...image.subarray(entry + 8, entry + 11)).trimEnd();
    const size = image[entry + 28] | (image[entry + 29] << 8) | (image[entry + 30] << 16);
    const contents = new Uint8Array(size);
    let cluster = word(entry + 26);
    let at = 0;
    while (at < size && cluster >= 2 && cluster < 0xff0) {
      const from = (dataSector + (cluster - 2) * sectorsPerCluster) * 512;
      const take = Math.min(size - at, sectorsPerCluster * 512);
      contents.set(image.subarray(from, from + take), at);
      at += take;
      cluster = next(cluster);
    }
    result.push({ name: ext ? `${base}.${ext}` : base, size, contents });
  }
  return result;
}
