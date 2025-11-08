import {
  FAT_ATTRIB_LONG_NAME,
  FAT_CASE_LC_BASE,
  FAT_CASE_LC_EXT,
  FNAME_FLAG_LOST_CHARS,
  FNAME_FLAG_MIXED_CASE,
  FNAME_FLAG_NEED_LFN,
  FS_ATTR_ARCHIVE,
  FS_DIR_SIZE
} from "@main/fat32/Fat32Types";
import { FatLongFileName } from "./FatLongFileName";
import { FatDirEntry } from "./FatDirEntry";

export function convertLongToShortName(
  fname: string,
  conflict = 0
): { name: string; seqPos: number; flags: number } {
  let bit = FAT_CASE_LC_BASE;
  let lc = 0;
  let uc = 0;
  let i = 0;
  let idx = 7;

  if (!fname || fname.trim().length === 0) {
    throw new Error("Invalid file name");
  }
  if (
    fname.charAt(0) === " " ||
    fname.charAt(fname.length - 1) === " " ||
    fname.charAt(fname.length - 1) === "."
  ) {
    throw new Error("Invalid file name");
  }

  if (conflict < 0 || conflict > 999) {
    throw new Error("Invalid conflict number");
  }
  conflict++;

  const conflictDigits = Math.floor(Math.log10(conflict));
  const conflictStr = conflict.toString();

  // --- Remove spaces from fname
  fname = fname.replace(/\s/g, "");

  // --- Initialize
  let dotIdx = 0;
  let endIdx = fname.length;
  let ptrIdx = 0;
  let seqPos = 0;

  // --- Blank file short name.
  const sfn: string[] = Array(12).fill(" ");
  sfn[8] = ".";
  let flags = 0;

  // --- Not 8.3 if starts with dot.
  let is83 = fname.charAt(0) !== ".";

  // --- Skip leading dots.
  for (; fname.charAt(ptrIdx) === "."; ptrIdx++);

  // --- Find last dot.
  for (dotIdx = endIdx - 1; dotIdx > ptrIdx && fname.charAt(dotIdx) !== "."; dotIdx--);

  for (; ptrIdx < endIdx; ptrIdx++) {
    let c = fname.charAt(ptrIdx);
    if (c === "." && ptrIdx === dotIdx) {
      idx = 11; // Max index for full 8.3 name.
      i = 9; // Place for extension.
      bit = FAT_CASE_LC_EXT; // bit for extension.
    } else {
      if (isSfnReservedChar(c)) {
        is83 = false;
        // --- Skip UTF-8 trailing characters.
        if ((c.charCodeAt(0) & 0xc0) == 0x80) {
          continue;
        }
        c = "_";
      }
      if (i > idx) {
        is83 = false;
        if (idx === 11 || ptrIdx > dotIdx) {
          // Done - extension longer than three characters or no extension.
          break;
        }
        // --- Skip to dot.
        ptrIdx = dotIdx - 1;
        continue;
      }
      if (isLower(c)) {
        c = c.toUpperCase();
        lc |= bit;
      } else if (isUpper(c)) {
        uc |= bit;
      }
      sfn[i++] = c;
      if (i < 7 - conflictDigits) {
        seqPos = i;
      }
    }
  }
  if (sfn[0] === " ") {
    throw new Error("Invalid file name");
  }
  if (is83) {
    flags = lc & uc ? FNAME_FLAG_MIXED_CASE : lc;
  } else {
    flags = FNAME_FLAG_LOST_CHARS;
    sfn[seqPos] = "~";
    for (let j = 0; j < conflictStr.length; j++) {
      sfn[seqPos + j + 1] = conflictStr.charAt(j);
    }
  }
  return { name: sfn.join(""), seqPos, flags };
}

export function calcShortNameCheckSum(shortName: string): number {
  if (shortName.length !== 11) {
    throw new Error("Invalid short name");
  }
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum = ((sum & 1 ? 0x80 : 0) + (sum >>> 1) + shortName[i].charCodeAt(0)) & 0xff;
  }
  return sum;
}

export function getLongFileFatEntries(
  fname: string,
  conflict = 0
): (FatLongFileName | FatDirEntry)[] {
  fname = fname.trim();
  const sfn = convertLongToShortName(fname, conflict);

  // --- Create the short file name entry
  const shortParts = sfn.name.split(".");
  const shortName = shortParts[0].padEnd(8, " ") + shortParts[1].padEnd(3, " ");
  const sfnEntry: FatDirEntry = new FatDirEntry(new Uint8Array(FS_DIR_SIZE));
  sfnEntry.DIR_Name = shortName;
  sfnEntry.DIR_Attr = FS_ATTR_ARCHIVE;

  if (!(sfn.flags & FNAME_FLAG_NEED_LFN)) {
    // --- We do not need long name entries
    return [sfnEntry];
  }
  // --- Create the long file name entries
  const lfnEntries: FatLongFileName[] = [];
  const checksum = calcShortNameCheckSum(shortName);
  let entryIdx = 0;
  for (let i = 0; i < fname.length; i += 13) {
    const name1 = convertTo16BitArray(fname.substring(i, i + 5).padEnd(5, " "));
    const name2 = convertTo16BitArray(fname.substring(i + 5, i + 11).padEnd(6, " "));
    const name3 = convertTo16BitArray(fname.substring(i + 11, i + 13).padEnd(2, " "));
    const remaining = fname.length - i;
    if (remaining < 5) {
      name1[remaining] = 0x0000;
      for (let j = remaining + 1; j < 5; j++) name1[j] = 0xffff;
      for (let j = 0; j < 6; j++) name2[j] = 0xffff;
      name3[0] = name3[1] = 0xffff;
    } else if (remaining < 11) {
      name2[remaining - 5] = 0x0000;
      for (let j = remaining + 1; j < 11; j++) name2[j - 5] = 0xffff;
      name3[0] = name3[1] = 0xffff;
    } else if (remaining === 11) {
      name3[0] = 0x0000;
      name3[1] = 0xffff;
    } else if (remaining === 12) {
      name3[1] = 0x0000;
    }
    const lfnEntry: FatLongFileName = new FatLongFileName(new Uint8Array(FS_DIR_SIZE));
    (lfnEntry.LDIR_Ord = ++entryIdx),
      (lfnEntry.LDIR_Name1 = name1),
      (lfnEntry.LDIR_Attr = FAT_ATTRIB_LONG_NAME),
      (lfnEntry.LDIR_Type = 0),
      (lfnEntry.LDIR_Chksum = checksum),
      (lfnEntry.LDIR_Name2 = name2),
      (lfnEntry.LDIR_FstClusLO = 0),
      (lfnEntry.LDIR_Name3 = name3);
    lfnEntries.unshift(lfnEntry);
  }

  // --- Set the last LFN entry's order flag
  lfnEntries[0].LDIR_Ord |= 0x40;

  return [...lfnEntries, sfnEntry];
}

function isSfnReservedChar(ch: string) {
  const c = ch.charCodeAt(0);
  if (ch === '"' || ch === "|" || ch === "[" || ch === "\\" || ch === "]") {
    return true;
  }
  // --- *+,./ or :;<=>?
  if ((0x2a <= c && c <= 0x2f && c != 0x2d) || (0x3a <= c && c <= 0x3f)) {
    return true;
  }
  // --- Reserved if not in range (0X20, 0X7F).
  return !(0x20 < c && c < 0x7f);
}

function isLower(c: string) {
  c = c.charAt(0);
  return "a" <= c && c <= "z";
}

function isUpper(c: string) {
  c = c.charAt(0);
  return "A" <= c && c <= "Z";
}

function convertTo16BitArray(name: string): number[] {
  const array: number[] = [];
  for (let i = 0; i < name.length; i++) {
    array.push(name.charCodeAt(i));
  }
  return array;
}
