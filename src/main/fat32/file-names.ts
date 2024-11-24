import {
  FAT_CASE_LC_BASE,
  FAT_CASE_LC_EXT,
  FNAME_FLAG_LOST_CHARS,
  FNAME_FLAG_MIXED_CASE,
} from "@main/fat32/Fat32Types";

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
