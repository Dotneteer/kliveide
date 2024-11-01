import {
  Fat32DirEntry,
  FS_ATTRIB_DIRECTORY,
  FAT_ATTRIB_LABEL,
  FAT_ATTRIB_LONG_NAME
} from "@abstractions/Fat32Types";

// Reserved characters for exFAT names and FAT LFN.
export function lfnReservedChar(c: string): boolean {
  return (
    c.charCodeAt(0) < 0x20 ||
    c === '"' ||
    c === "*" ||
    c === "/" ||
    c === ":" ||
    c === "<" ||
    c === ">" ||
    c === "?" ||
    c === "\\" ||
    c === "|"
  );
}

// Reserved characters for FAT short 8.3 names.
export function sfnReservedChar(c: string): boolean {
  if (c === '"' || c === "|" || c === "[" || c === "\\" || c === "]") {
    return true;
  }
  //  *+,./ or :;<=>?
  const code = c.charCodeAt(0);
  if ((0x2a <= code && code <= 0x2f && code != 0x2d) || (0x3a <= code && code <= 0x3f)) {
    return true;
  }
  // Reserved if not in range (0X20, 0X7F).
  return !(0x20 < code && code < 0x7f);
}

export function isFatFile(dir: Fat32DirEntry): boolean {
  return !(dir.DIR_Attr & (FS_ATTRIB_DIRECTORY | FAT_ATTRIB_LABEL));
}

export function isFatFileOrSubdir(dir: Fat32DirEntry): boolean {
  return !(dir.DIR_Attr & FAT_ATTRIB_LABEL);
}

export function isFatLongName(dir: Fat32DirEntry): boolean {
  return dir.DIR_Attr === FAT_ATTRIB_LONG_NAME;
}

export function isFatSubdir(dir: Fat32DirEntry): boolean {
  return (dir.DIR_Attr & (FS_ATTRIB_DIRECTORY | FAT_ATTRIB_LABEL)) === FS_ATTRIB_DIRECTORY;
}

type UppercaseMapEntry = [key: number, off: number, count: number];
type UppercaseLookupEntry = [key: number, value: number];

const upperCaseMap: UppercaseMapEntry[] = [
  [0x0061, -32, 26],
  [0x00e0, -32, 23],
  [0x00f8, -32, 7],
  [0x0100, 1, 48],
  [0x0132, 1, 6],
  [0x0139, 1, 16],
  [0x014a, 1, 46],
  [0x0179, 1, 6],
  [0x0182, 1, 4],
  [0x01a0, 1, 6],
  [0x01b3, 1, 4],
  [0x01cd, 1, 16],
  [0x01de, 1, 18],
  [0x01f8, 1, 40],
  [0x0222, 1, 18],
  [0x0246, 1, 10],
  [0x03ad, -37, 3],
  [0x03b1, -32, 17],
  [0x03c3, -32, 9],
  [0x03d8, 1, 24],
  [0x0430, -32, 32],
  [0x0450, -80, 16],
  [0x0460, 1, 34],
  [0x048a, 1, 54],
  [0x04c1, 1, 14],
  [0x04d0, 1, 68],
  [0x0561, -48, 38],
  [0x1e00, 1, 150],
  [0x1ea0, 1, 90],
  [0x1f00, 8, 8],
  [0x1f10, 8, 6],
  [0x1f20, 8, 8],
  [0x1f30, 8, 8],
  [0x1f40, 8, 6],
  [0x1f60, 8, 8],
  [0x1f70, 74, 2],
  [0x1f72, 86, 4],
  [0x1f76, 100, 2],
  [0x1f7a, 112, 2],
  [0x1f7c, 126, 2],
  [0x1f80, 8, 8],
  [0x1f90, 8, 8],
  [0x1fa0, 8, 8],
  [0x1fb0, 8, 2],
  [0x1fd0, 8, 2],
  [0x1fe0, 8, 2],
  [0x2170, -16, 16],
  [0x24d0, -26, 26],
  [0x2c30, -48, 47],
  [0x2c67, 1, 6],
  [0x2c80, 1, 100],
  [0x2d00, 0, 38],
  [0xff41, -32, 26]
];

const upperCaseLookup: UppercaseLookupEntry[] = [
  [0x00ff, 0x0178],
  [0x0180, 0x0243],
  [0x0188, 0x0187],
  [0x018c, 0x018b],
  [0x0192, 0x0191],
  [0x0195, 0x01f6],
  [0x0199, 0x0198],
  [0x019a, 0x023d],
  [0x019e, 0x0220],
  [0x01a8, 0x01a7],
  [0x01ad, 0x01ac],
  [0x01b0, 0x01af],
  [0x01b9, 0x01b8],
  [0x01bd, 0x01bc],
  [0x01bf, 0x01f7],
  [0x01c6, 0x01c4],
  [0x01c9, 0x01c7],
  [0x01cc, 0x01ca],
  [0x01dd, 0x018e],
  [0x01f3, 0x01f1],
  [0x01f5, 0x01f4],
  [0x023a, 0x2c65],
  [0x023c, 0x023b],
  [0x023e, 0x2c66],
  [0x0242, 0x0241],
  [0x0253, 0x0181],
  [0x0254, 0x0186],
  [0x0256, 0x0189],
  [0x0257, 0x018a],
  [0x0259, 0x018f],
  [0x025b, 0x0190],
  [0x0260, 0x0193],
  [0x0263, 0x0194],
  [0x0268, 0x0197],
  [0x0269, 0x0196],
  [0x026b, 0x2c62],
  [0x026f, 0x019c],
  [0x0272, 0x019d],
  [0x0275, 0x019f],
  [0x027d, 0x2c64],
  [0x0280, 0x01a6],
  [0x0283, 0x01a9],
  [0x0288, 0x01ae],
  [0x0289, 0x0244],
  [0x028a, 0x01b1],
  [0x028b, 0x01b2],
  [0x028c, 0x0245],
  [0x0292, 0x01b7],
  [0x037b, 0x03fd],
  [0x037c, 0x03fe],
  [0x037d, 0x03ff],
  [0x03ac, 0x0386],
  [0x03c2, 0x03a3],
  [0x03cc, 0x038c],
  [0x03cd, 0x038e],
  [0x03ce, 0x038f],
  [0x03f2, 0x03f9],
  [0x03f8, 0x03f7],
  [0x03fb, 0x03fa],
  [0x04cf, 0x04c0],
  [0x1d7d, 0x2c63],
  [0x1f51, 0x1f59],
  [0x1f53, 0x1f5b],
  [0x1f55, 0x1f5d],
  [0x1f57, 0x1f5f],
  [0x1f78, 0x1ff8],
  [0x1f79, 0x1ff9],
  [0x1fb3, 0x1fbc],
  [0x1fcc, 0x1fc3],
  [0x1fe5, 0x1fec],
  [0x1ffc, 0x1ff3],
  [0x214e, 0x2132],
  [0x2184, 0x2183],
  [0x2c61, 0x2c60],
  [0x2c76, 0x2c75]
];

function searchUppercaseEntry(table: (UppercaseLookupEntry | UppercaseMapEntry)[], key: number): number {
  let left = 0;
  let right = table.length;
  while (right - left > 1) {
    const mid = Math.floor(left + (right - left) / 2);
    if (table[mid][0] <= key) {
      left = mid;
    } else {
      right = mid;
    }
  }
  return left;
}

export function toUppercaseLetter(chr: number): number {
  // Optimize for simple ASCII.
  if (chr < 127) {
    return chr - ('a'.charCodeAt(0) <= chr && chr <= 'z'.charCodeAt(0) ? 'a'.charCodeAt(0) - 'A'.charCodeAt(0) : 0);
  }
  let i = searchUppercaseEntry(upperCaseMap, chr);
  const first = upperCaseMap[i][0];
  if (first <= chr && (chr - first) < upperCaseMap[i][2]) {
    let off = upperCaseMap[i][1];
    if (off === 1) {
      return chr - ((chr - first) & 1);
    }
    return chr + (off ? off : -0x1C60);
  }
  i = searchUppercaseEntry(upperCaseLookup, chr);
  if (upperCaseLookup[i][0] === chr) {
    return upperCaseLookup[i][1];
  }
  return chr;
}
