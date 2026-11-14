/*
 * The ZX Spectrum Next's core update file, `TBBLUE.TBU` (`dev/plans/TBBLUE_TBU_VIEWER_PLAN.md`, §1 and
 * §1a): a pure reader, bytes in and a model out, for the TBU viewer. It never throws: a file that is not
 * a TBU, is cut short or has a broken index comes back with what could be read and a list of problems
 * (D3). Problems are codes; their texts are made at display.
 *
 * The layout is an interface fact, read from the bytes of real files and from the upstream maker's
 * `list`/`pull` commands; no code of the maker is used here.
 */

/** Size of the header and of every image's unit */
export const TBU_SECTOR = 512;

/** The magic word both formats start with (`TBUFILE` and a NUL) */
const MAGIC = "TBUFILE";

/** Bytes 8-24 of the multi-core format */
const MACHINE = "ZX SPECTRUM NEXT";

/** The index starts after the magic (8 bytes) and the machine (17 bytes) */
const INDEX_START = 25;

/** An index record's size, as every known file writes it */
export const TBU_RECORD_LENGTH = 15;

/** The index holds at most this many 15-byte records before the header ends */
export const TBU_INDEX_CAPACITY = Math.floor((TBU_SECTOR - INDEX_START - 1) / TBU_RECORD_LENGTH);

/** The record length byte that ends the index */
const END_OF_INDEX = 0xff;

export type TbuFormat = "multi" | "legacy" | "unknown";

export type TbuProblemSeverity = "error" | "warning" | "info";

export type TbuProblemCode =
  // --- The file as a whole
  | "tooShort"
  | "notTbu"
  | "notSectorAligned"
  | "trailingData"
  // --- The index
  | "indexNotTerminated"
  | "recordLength"
  | "duplicateRecord"
  // --- One record's image
  | "imageOutOfRange"
  | "imageOverlap"
  | "checksumMismatch"
  | "trailerMismatch"
  | "partMismatch"
  | "tooBigForSlot"
  // --- The legacy single-core format
  | "legacySizeMismatch"
  | "legacyChecksumMismatch"
  | "legacyNotNext";

export type TbuProblem = {
  code: TbuProblemCode;
  severity: TbuProblemSeverity;
  /** The 1-based record number the problem is about */
  record?: number;
  /** A second record (the one overlapped or duplicated) */
  otherRecord?: number;
};

/** FPGA families told apart by their configuration packets */
export type TbuFpgaFamily = "spartan6" | "series7";

/** What the bitstream itself says */
export type TbuBitstreamInfo = {
  /** Offset of the sync word `AA 99 55 66` in the image, if found */
  syncOffset?: number;
  family?: TbuFpgaFamily;
  /** The device ID the bitstream checks, and where in the image it is written */
  idcode?: number;
  idcodeOffset?: number;
  /** The part name of a known IDCODE */
  part?: string;
  /** Bytes up to the last one that is not `$FF`, before the trailer sector */
  dataLength: number;
  /** `$FF` bytes between the data and the trailer sector (or the image's end) */
  paddingLength: number;
};

/** The 7-byte record the updater leaves at the end of the flash slot */
export type TbuFlashRecord = {
  length: number;
  type: number;
  boardByte: number;
  coreMajor: number;
  coreSub: number;
  /** Offset from the start of the user area to a screen; `$FFFF` when there is none */
  screenOffset: number;
};

/** The image's last sector, when it carries the slot's identification */
export type TbuTrailer = {
  /** Offset of the trailer sector in the file */
  fileOffset: number;
  machine: string;
  description: string;
  flash?: TbuFlashRecord;
  /** Does the flash record repeat the index record's type, board and version? */
  matchesRecord: boolean;
};

export type TbuRecord = {
  /** 1-based, in index order */
  number: number;
  /** Offset of the record in the header */
  headerOffset: number;
  length: number;
  /** 1 = the Next core (slot 1), 0 = the anti-brick core (slot 0); other values are shown raw */
  type: number;
  /** The slot a known type goes to */
  slot?: number;
  /** The raw board byte */
  boardByte: number;
  /** Its low nibble: the NextReg `$0F` value (0 = Issue 2, 1 = Issue 3, 2 = Issue 4, 3 = Issue 5) */
  boardId: number;
  /** The board issue, `boardId + 2` */
  issue: number;
  /** Its high nibble: a variant of the board's core (26.11a; meaning unconfirmed) */
  variant: number;
  /** NextReg `$01` (major in the high nibble, minor in the low) and `$0E` */
  coreMajor: number;
  coreSub: number;
  /** `3.03.03` */
  version: string;
  /** Image start in sectors after the header, and its length in sectors */
  sectorOffset: number;
  sectorLength: number;
  /** The same in bytes from the start of the file */
  fileOffset: number;
  byteLength: number;
  storedChecksum: number;
  /** Fletcher-16 of the image; undefined when the image is not all in the file */
  computedChecksum?: number;
  /** The records whose image is this very one (same offset and length) */
  sharedWith: number[];
  /** The name the upstream maker's `pull` command gives the image */
  pullName: string;
  /** The flash slot's size for the board, when known */
  slotSize?: number;
  trailer?: TbuTrailer;
  bitstream?: TbuBitstreamInfo;
};

/** The legacy single-core header (2019 and earlier) */
export type TbuLegacyInfo = {
  hardwareId: number;
  hardwareName: string;
  /** The hardware name the maker's table gives the ID, when known */
  knownHardware?: string;
  versionByte: number;
  subVersion: number;
  version: string;
  statedSize: number;
  actualSize: number;
  storedXor: number;
  computedXor: number;
  bitstream: TbuBitstreamInfo;
};

export type TbuFile = {
  format: TbuFormat;
  fileSize: number;
  magic: string;
  /** The multi-core format's machine string */
  machine?: string;
  records: TbuRecord[];
  /** Header bytes the index takes, its end marker included */
  indexBytesUsed: number;
  legacy?: TbuLegacyInfo;
  /** End of the last image, in bytes */
  imagesEnd: number;
  problems: TbuProblem[];
};

/** Is this file name the update file (any case, any folder; `dev/plans/TBBLUE_TBU_VIEWER_PLAN.md` D1)? */
export function isTbuFileName(path: string): boolean {
  const name = path.split(/[\\/]/).pop() ?? "";
  return name.toUpperCase() === "TBBLUE.TBU";
}

/** Fletcher-16 as the TBU index stores it: sum1 in the low byte, sum2 in the high, both mod 255 */
export function fletcher16(data: Uint8Array, seed = 0, start = 0, end = data.length): number {
  let sum1 = seed & 0xff;
  let sum2 = (seed >> 8) & 0xff;
  let i = start;
  while (i < end) {
    // --- 359 bytes keep both sums inside 32 bits before the modulo (sum2 grows quadratically)
    const blockEnd = Math.min(end, i + 359);
    for (; i < blockEnd; i++) {
      sum1 += data[i];
      sum2 += sum1;
    }
    sum1 %= 255;
    sum2 %= 255;
  }
  return (sum2 << 8) | sum1;
}

/** Known FPGA IDCODEs, compared without the revision nibble */
const KNOWN_PARTS: Record<number, string> = {
  // --- Xilinx UG380 / the urjtag parts table
  0x04002093: "XC6SLX16",
  // --- The part's BSDL file (UG470 v1.10 wrongly gives $0362D093 for it too)
  0x0362e093: "XC7A15T",
  0x0362d093: "XC7A35T"
};

/** The part each board's FPGA is (`next-fpga-boot.mdx`, "What the blank chip is made of") */
const BOARD_PARTS: Record<number, string> = {
  0: "XC6SLX16",
  1: "XC6SLX16",
  2: "XC7A15T",
  3: "XC7A35T"
};

/** Flash slot sizes: 512K on the 16 MB flash of Issues 2-3, 2,176K on the 32 MB flash of Issues 4-5 */
const SLOT_SIZES: Record<number, number> = {
  0: 512 * 1024,
  1: 512 * 1024,
  2: 2176 * 1024,
  3: 2176 * 1024
};

/** The slot each known record type is written to */
const TYPE_SLOTS: Record<number, number> = { 0: 0, 1: 1 };

/** Hardware IDs of the legacy format, as the original maker's table names them */
const LEGACY_HARDWARE: Record<number, string> = {
  1: "DE-1",
  2: "DE-2",
  5: "FBLabs",
  6: "Vtrucco",
  7: "WXEDA",
  9: "ZX-Uno",
  10: "ZX Spectrum Next",
  11: "Multicore"
};
const LEGACY_NEXT_ID = 10;

/** The part name of an IDCODE, ignoring the silicon revision */
export function fpgaPartName(idcode: number): string | undefined {
  return KNOWN_PARTS[(idcode & 0x0fffffff) >>> 0];
}

/** `$32`, `$03` -> `3.02.03` */
export function formatCoreVersion(major: number, sub: number): string {
  return `${major >> 4}.${pad2(major & 0x0f)}.${pad2(sub)}`;
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function ascii(data: Uint8Array, start: number, end: number): string {
  let text = "";
  for (let i = start; i < end && i < data.length; i++) text += String.fromCharCode(data[i]);
  return text;
}

/** A NUL-terminated string from `start`, at most `max` characters; `next` is past its NUL */
function cString(data: Uint8Array, start: number, max: number): { text: string; next: number } {
  let i = start;
  const limit = Math.min(data.length, start + max);
  while (i < limit && data[i] !== 0) i++;
  return { text: ascii(data, start, i), next: i + 1 };
}

function readU16(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

function readU32(data: Uint8Array, offset: number): number {
  return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
}

function readU32BE(data: Uint8Array, offset: number): number {
  return ((data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]) >>> 0;
}

/** How far after the sync word the IDCODE write is looked for */
const IDCODE_SEARCH = 1024;

/**
 * What a bitstream between `start` and `end` says: its sync word, the IDCODE it writes (a 7-series type-1
 * write of one word to register `$0C`, header `$30018001`; a Spartan-6 one of two 16-bit words to
 * register `$0E`, header `$31C2`), and how much of it is `$FF` padding.
 */
export function probeBitstream(data: Uint8Array, start: number, end: number): TbuBitstreamInfo {
  let last = end - 1;
  while (last >= start && data[last] === 0xff) last--;
  const dataLength = last + 1 - start;
  const info: TbuBitstreamInfo = { dataLength, paddingLength: end - start - dataLength };

  const searchEnd = Math.min(end, start + 4096);
  for (let i = start; i + 4 <= searchEnd; i++) {
    if (data[i] === 0xaa && data[i + 1] === 0x99 && data[i + 2] === 0x55 && data[i + 3] === 0x66) {
      info.syncOffset = i - start;
      break;
    }
  }
  if (info.syncOffset === undefined) return info;

  const from = start + info.syncOffset + 4;
  const to = Math.min(end, from + IDCODE_SEARCH);
  // --- 7-series: 32-bit words, aligned to the sync word
  for (let i = from; i + 8 <= to; i += 4) {
    if (readU32BE(data, i) === 0x30018001) {
      info.family = "series7";
      info.idcode = readU32BE(data, i + 4);
      info.idcodeOffset = i + 4 - start;
      break;
    }
  }
  // --- Spartan-6: 16-bit words, aligned to the sync word
  if (info.family === undefined) {
    for (let i = from; i + 6 <= to; i += 2) {
      if (data[i] === 0x31 && data[i + 1] === 0xc2) {
        info.family = "spartan6";
        info.idcode = readU32BE(data, i + 2);
        info.idcodeOffset = i + 2 - start;
        break;
      }
    }
  }
  if (info.idcode !== undefined) info.part = fpgaPartName(info.idcode);
  return info;
}

/** The trailer sector at `offset`, if it starts with the machine string */
function readTrailer(data: Uint8Array, offset: number): Omit<TbuTrailer, "matchesRecord"> | undefined {
  if (offset < 0 || offset + TBU_SECTOR > data.length) return undefined;
  const machine = cString(data, offset, 32);
  if (machine.text !== MACHINE) return undefined;
  const description = cString(data, machine.next, 64);
  const at = description.next;
  const trailer: Omit<TbuTrailer, "matchesRecord"> = {
    fileOffset: offset,
    machine: machine.text,
    description: description.text
  };
  if (data[at] === 7 && at + 7 <= offset + TBU_SECTOR) {
    trailer.flash = {
      length: data[at],
      type: data[at + 1],
      boardByte: data[at + 2],
      coreMajor: data[at + 3],
      coreSub: data[at + 4],
      screenOffset: readU16(data, at + 5)
    };
  }
  return trailer;
}

/** Read a `TBBLUE.TBU` file */
export function parseTbuFile(data: Uint8Array): TbuFile {
  const file: TbuFile = {
    format: "unknown",
    fileSize: data.length,
    magic: ascii(data, 0, Math.min(7, data.length)),
    records: [],
    indexBytesUsed: 0,
    imagesEnd: 0,
    problems: []
  };
  if (data.length < TBU_SECTOR) {
    file.problems.push({ code: data.length >= 7 && file.magic === MAGIC ? "tooShort" : "notTbu", severity: "error" });
    return file;
  }
  if (file.magic !== MAGIC) {
    file.problems.push({ code: "notTbu", severity: "error" });
    return file;
  }
  if (ascii(data, 8, 8 + MACHINE.length) === MACHINE && data[8 + MACHINE.length] === 0) {
    readMultiCore(data, file);
  } else {
    readLegacy(data, file);
  }
  return file;
}

function readMultiCore(data: Uint8Array, file: TbuFile): void {
  file.format = "multi";
  file.machine = MACHINE;
  const problems = file.problems;

  // --- The index
  let pos = INDEX_START;
  let terminated = false;
  while (pos < TBU_SECTOR) {
    const length = data[pos];
    if (length === END_OF_INDEX) {
      terminated = true;
      pos++;
      break;
    }
    const number = file.records.length + 1;
    if (length !== TBU_RECORD_LENGTH) {
      problems.push({ code: "recordLength", severity: "warning", record: number });
    }
    // --- A record must hold all 15 fields and lie inside the header; a shorter length cannot be walked
    if (length < TBU_RECORD_LENGTH || pos + TBU_RECORD_LENGTH > TBU_SECTOR) break;
    file.records.push(readRecord(data, pos, number));
    pos += length;
  }
  file.indexBytesUsed = Math.min(pos, TBU_SECTOR) - INDEX_START;
  if (!terminated) problems.push({ code: "indexNotTerminated", severity: "error" });

  if (data.length % TBU_SECTOR !== 0) problems.push({ code: "notSectorAligned", severity: "warning" });

  // --- Shared images and overlaps
  const records = file.records;
  for (let i = 0; i < records.length; i++) {
    const a = records[i];
    for (let j = i + 1; j < records.length; j++) {
      const b = records[j];
      if (a.fileOffset === b.fileOffset && a.byteLength === b.byteLength) {
        a.sharedWith.push(b.number);
        b.sharedWith.push(a.number);
      } else if (a.fileOffset < b.fileOffset + b.byteLength && b.fileOffset < a.fileOffset + a.byteLength) {
        problems.push({ code: "imageOverlap", severity: "error", record: a.number, otherRecord: b.number });
      }
      if (a.type === b.type && a.boardByte === b.boardByte && a.coreMajor === b.coreMajor && a.coreSub === b.coreSub) {
        problems.push({ code: "duplicateRecord", severity: "warning", record: b.number, otherRecord: a.number });
      }
    }
  }

  // --- Each image: checksum (once per distinct image), trailer, bitstream
  const checksums = new Map<string, number>();
  for (const record of records) {
    const end = record.fileOffset + record.byteLength;
    file.imagesEnd = Math.max(file.imagesEnd, Math.min(end, data.length));
    if (end > data.length || record.byteLength === 0) {
      problems.push({ code: "imageOutOfRange", severity: "error", record: record.number });
      continue;
    }
    const key = `${record.fileOffset}:${record.byteLength}`;
    let checksum = checksums.get(key);
    if (checksum === undefined) {
      checksum = fletcher16(data, 0, record.fileOffset, end);
      checksums.set(key, checksum);
    }
    record.computedChecksum = checksum;
    if (checksum !== record.storedChecksum) {
      problems.push({ code: "checksumMismatch", severity: "error", record: record.number });
    }

    const trailer = readTrailer(data, end - TBU_SECTOR);
    if (trailer) {
      const flash = trailer.flash;
      const matchesRecord =
        !!flash &&
        flash.type === record.type &&
        flash.boardByte === record.boardByte &&
        flash.coreMajor === record.coreMajor &&
        flash.coreSub === record.coreSub;
      record.trailer = { ...trailer, matchesRecord };
    }
    record.bitstream = probeBitstream(data, record.fileOffset, trailer ? end - TBU_SECTOR : end);

    const expected = BOARD_PARTS[record.boardId];
    if (record.bitstream.part && expected && record.bitstream.part !== expected) {
      problems.push({ code: "partMismatch", severity: "error", record: record.number });
    }
    if (record.slotSize !== undefined && record.byteLength > record.slotSize) {
      problems.push({ code: "tooBigForSlot", severity: "error", record: record.number });
    }
  }

  // --- A shared image has one trailer, which can repeat only one of its records (26.11a's `$00` and
  // --- `$20`): it is wrong only when it repeats none of them
  for (const record of records) {
    if (!record.trailer || record.trailer.matchesRecord) continue;
    const group = record.sharedWith.map((n) => records[n - 1]);
    if (group.some((other) => other.trailer?.matchesRecord)) continue;
    problems.push({ code: "trailerMismatch", severity: "warning", record: record.number });
  }

  const expectedEnd = records.length ? file.imagesEnd : TBU_SECTOR;
  if (data.length > Math.max(expectedEnd, TBU_SECTOR)) problems.push({ code: "trailingData", severity: "info" });
}

function readRecord(data: Uint8Array, pos: number, number: number): TbuRecord {
  const type = data[pos + 1];
  const boardByte = data[pos + 2];
  const boardId = boardByte & 0x0f;
  const variant = boardByte >> 4;
  const coreMajor = data[pos + 3];
  const coreSub = data[pos + 4];
  const sectorOffset = readU32(data, pos + 5);
  const sectorLength = readU32(data, pos + 9);
  const version = formatCoreVersion(coreMajor, coreSub);
  const versionNumber = `${coreMajor >> 4}${pad2(coreMajor & 0x0f)}${pad2(coreSub)}`;
  return {
    number,
    headerOffset: pos,
    length: data[pos],
    type,
    slot: TYPE_SLOTS[type],
    boardByte,
    boardId,
    issue: boardId + 2,
    variant,
    coreMajor,
    coreSub,
    version,
    sectorOffset,
    sectorLength,
    fileOffset: (sectorOffset + 1) * TBU_SECTOR,
    byteLength: sectorLength * TBU_SECTOR,
    storedChecksum: readU16(data, pos + 13),
    sharedWith: [],
    pullName: `zxnext-${boardId + 2}-${versionNumber}${type === 0 ? "-ab" : ""}.bin`,
    slotSize: SLOT_SIZES[boardId]
  };
}

function readLegacy(data: Uint8Array, file: TbuFile): void {
  file.format = "legacy";
  const statedSize = readU32(data, 7);
  const hardwareId = data[11];
  const versionByte = data[12];
  const subVersion = data[500];
  const actualSize = data.length - TBU_SECTOR;
  const end = TBU_SECTOR + Math.min(statedSize, actualSize);
  let computedXor = 0;
  for (let i = TBU_SECTOR; i < end; i++) computedXor ^= data[i];
  file.legacy = {
    hardwareId,
    hardwareName: cString(data, 14, 20).text,
    knownHardware: LEGACY_HARDWARE[hardwareId],
    versionByte,
    subVersion,
    version: formatCoreVersion(versionByte, subVersion),
    statedSize,
    actualSize,
    storedXor: data[13],
    computedXor,
    bitstream: probeBitstream(data, TBU_SECTOR, end)
  };
  file.imagesEnd = end;
  if (statedSize !== actualSize) file.problems.push({ code: "legacySizeMismatch", severity: "error" });
  if (computedXor !== data[13] || statedSize > actualSize) {
    file.problems.push({ code: "legacyChecksumMismatch", severity: "error" });
  }
  if (hardwareId !== LEGACY_NEXT_ID) file.problems.push({ code: "legacyNotNext", severity: "warning" });
}
