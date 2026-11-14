/*
 * The ZX Spectrum Next's firmware file, `TBBLUE.FW` (`dev/plans/TBBLUE_FW_VIEWER_PLAN.md`, §1 and §1a):
 * a pure reader, bytes in and a model out, for the FW viewer. It never throws: a file that is not a
 * firmware file, is cut short or has a broken map comes back with what could be read and a list of
 * problems (codes; their texts are made at display).
 *
 * The layout is an interface fact, read from real files and from the firmware's published packer and
 * block numbers; no code of the firmware is used here.
 */

/** Size of the map and of every module's unit, a block */
export const FW_BLOCK = 512;

/** The map's room: 4-byte entries in the first block */
export const FW_MAP_CAPACITY = FW_BLOCK / 4;

/** Where a code module is loaded and run (`--code-loc 0x6010` after a start-up stub at $6000) */
export const FW_MODULE_ADDRESS = 0x6000;

/** The stub every code module starts with: `ld sp,$FFFF / di` */
const CODE_STUB = [0x31, 0xff, 0xff, 0xf3];

/** The test card picture at the start of the screens block: 256×192 Layer 2, one index per pixel */
export const FW_TEST_CARD_WIDTH = 256;
export const FW_TEST_CARD_HEIGHT = 192;
const TEST_CARD_PIXELS = FW_TEST_CARD_WIDTH * FW_TEST_CARD_HEIGHT;
/** Its palette: 9-bit entries, two bytes each, as far as the block carries them (`FW_L2_PAL_SIZE`) */
const TEST_CARD_PALETTE_BYTES = 227;

/**
 * The modules the published source names by position (`FW_BLK_*`). Entries 1 and 3 are where the
 * editor and the extra cores module used to be: real modules in the old layout, aliases of the boot
 * module in the current one.
 */
export type FwModuleName =
  | "boot"
  | "editorOld"
  | "updater"
  | "coresOld"
  | "editor"
  | "cores"
  | "testCard"
  | "reset"
  | "screens";

const NAMES_ALWAYS: FwModuleName[] = ["boot", "editorOld", "updater", "coresOld"];
const NAMES_CURRENT: FwModuleName[] = ["editor", "cores", "testCard", "reset", "screens"];

/** `current`: entries 1 and 3 alias the boot module; `old`: they are modules of their own (2019) */
export type FwLayout = "current" | "old";

export type FwProblemSeverity = "error" | "warning" | "info";

export type FwProblemCode =
  | "tooShort"
  | "notFirmware"
  | "notBlockAligned"
  | "trailingData"
  | "entryOutOfRange"
  | "entryOverlap"
  | "noUpdater";

export type FwProblem = {
  code: FwProblemCode;
  severity: FwProblemSeverity;
  /** The entry the problem is about */
  entry?: number;
  /** A second entry (the one overlapped) */
  otherEntry?: number;
};

export type FwEntry = {
  index: number;
  /** First block and length in blocks, as the map holds them (blocks counted after the map) */
  start: number;
  length: number;
  /** The same in bytes from the start of the file */
  fileOffset: number;
  byteLength: number;
  /** The name the published source gives this position, when it applies to this layout */
  name?: FwModuleName;
  /** The earlier entry this one repeats (same start and length) */
  aliasOf?: number;
  /** Code (it starts with the modules' start-up stub) or data; undefined when not all in the file */
  kind?: "code" | "data";
  /** Where a code module runs */
  runsAt?: number;
  /** Bytes up to the last one that is not `$00`, and the `$00` padding after them */
  dataLength: number;
  paddingLength: number;
};

export type FwFile = {
  format: "firmware" | "unknown";
  fileSize: number;
  layout?: FwLayout;
  entries: FwEntry[];
  /** The version text in the boot module (`1.46`), when one is found */
  version?: string;
  /** End of the last module, in bytes */
  modulesEnd: number;
  problems: FwProblem[];
};

/** Is this file name the firmware file (any case, any folder; plan D1)? */
export function isFwFileName(path: string): boolean {
  const name = path.split(/[\\/]/).pop() ?? "";
  return name.toUpperCase() === "TBBLUE.FW";
}

function readU16(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

/** Read a `TBBLUE.FW` file */
export function parseFwFile(data: Uint8Array): FwFile {
  const file: FwFile = { format: "unknown", fileSize: data.length, entries: [], modulesEnd: 0, problems: [] };
  if (data.length < FW_BLOCK) {
    file.problems.push({ code: "tooShort", severity: "error" });
    return file;
  }

  // --- The map: entries until the first one of no blocks
  for (let i = 0; i < FW_MAP_CAPACITY; i++) {
    const start = readU16(data, i * 4);
    const length = readU16(data, i * 4 + 2);
    if (length === 0) break;
    file.entries.push({
      index: i,
      start,
      length,
      fileOffset: (start + 1) * FW_BLOCK,
      byteLength: length * FW_BLOCK,
      dataLength: 0,
      paddingLength: 0
    });
  }

  // --- A firmware file's boot module is its first, at block 0, and every entry lies after the map
  const entries = file.entries;
  if (entries.length === 0 || entries[0].start !== 0) {
    file.entries = [];
    file.problems.push({ code: "notFirmware", severity: "error" });
    return file;
  }
  file.format = "firmware";

  // --- Aliases and overlaps
  for (const e of entries) {
    for (const other of entries) {
      if (other.index >= e.index) break;
      if (other.start === e.start && other.length === e.length) {
        e.aliasOf ??= other.aliasOf ?? other.index;
      } else if (other.aliasOf === undefined && e.start < other.start + other.length && other.start < e.start + e.length) {
        file.problems.push({ code: "entryOverlap", severity: "error", entry: e.index, otherEntry: other.index });
      }
    }
  }

  // --- The layout decides which names apply
  const aliasesBoot = (i: number) => entries[i]?.aliasOf === 0;
  file.layout = aliasesBoot(1) && aliasesBoot(3) ? "current" : "old";
  for (const e of entries) {
    if (e.index < NAMES_ALWAYS.length) e.name = NAMES_ALWAYS[e.index];
    else if (file.layout === "current" && e.index - NAMES_ALWAYS.length < NAMES_CURRENT.length) {
      e.name = NAMES_CURRENT[e.index - NAMES_ALWAYS.length];
    }
  }

  // --- Each module: in the file, its kind, its padding
  for (const e of entries) {
    const end = e.fileOffset + e.byteLength;
    file.modulesEnd = Math.max(file.modulesEnd, Math.min(end, data.length));
    if (end > data.length) {
      file.problems.push({ code: "entryOutOfRange", severity: "error", entry: e.index });
      continue;
    }
    let last = end - 1;
    while (last >= e.fileOffset && data[last] === 0) last--;
    e.dataLength = last + 1 - e.fileOffset;
    e.paddingLength = e.byteLength - e.dataLength;
    const isCode = CODE_STUB.every((b, i) => data[e.fileOffset + i] === b);
    e.kind = isCode ? "code" : "data";
    if (isCode) e.runsAt = FW_MODULE_ADDRESS;
  }

  // --- The anti-brick boot ROM loads entry 2 to update a broken slot 1
  if (!entries[2] || entries[2].aliasOf !== undefined) {
    file.problems.push({ code: "noUpdater", severity: "warning" });
  }

  if (data.length % FW_BLOCK !== 0) file.problems.push({ code: "notBlockAligned", severity: "warning" });
  if (data.length > Math.max(file.modulesEnd, FW_BLOCK)) file.problems.push({ code: "trailingData", severity: "info" });

  file.version = findFwVersion(data, entries[0]);
  return file;
}

/**
 * The version text the boot module prints after "Firmware v": a zero-terminated `1.46` among its
 * strings. Best effort (the 2019 firmware prints its version differently and has none of this form).
 */
export function findFwVersion(data: Uint8Array, boot: FwEntry | undefined): string | undefined {
  if (!boot || boot.kind !== "code") return undefined;
  const end = Math.min(data.length, boot.fileOffset + boot.byteLength);
  for (let i = boot.fileOffset + 1; i + 5 < end; i++) {
    if (
      data[i - 1] === 0 &&
      isDigit(data[i]) &&
      data[i + 1] === 0x2e &&
      isDigit(data[i + 2]) &&
      isDigit(data[i + 3]) &&
      data[i + 4] === 0
    ) {
      return String.fromCharCode(data[i], 0x2e, data[i + 2], data[i + 3]);
    }
  }
  return undefined;
}

function isDigit(b: number): boolean {
  return b >= 0x30 && b <= 0x39;
}

/**
 * The texts in a module (plan D8): printable runs of six or more characters with at least four letters
 * and three different characters, which keeps words and drops picture bytes that happen to be
 * printable (`$%%%%%%`, `GGGGGGGG`). At most `limit` of them, in file order.
 */
export function fwModuleTexts(data: Uint8Array, entry: FwEntry, limit = 200): string[] {
  const texts: string[] = [];
  const end = Math.min(data.length, entry.fileOffset + entry.byteLength);
  let run = "";
  const flush = () => {
    if (run.length >= 6) {
      const letters = run.replace(/[^A-Za-z]/g, "").length;
      if (letters >= 4 && new Set(run).size >= 3) texts.push(run.trim());
    }
    run = "";
  };
  for (let i = entry.fileOffset; i < end && texts.length < limit; i++) {
    const b = data[i];
    if (b >= 0x20 && b <= 0x7e) run += String.fromCharCode(b);
    else flush();
  }
  if (texts.length < limit) flush();
  return texts;
}

/** The test card picture of the screens block: palette indexes and the 256 9-bit palette entries */
export type FwTestCard = {
  pixels: Uint8Array;
  /** 9-bit RRRGGGBBB values, the entries the block does not carry are 0 */
  palette: number[];
};

/**
 * The screens block's Layer 2 picture, the video test card (plan §1a): 49,152 palette indexes, then
 * 227 bytes of palette entries (first byte `RRRGGGBB`, second bit 0 the low blue bit).
 */
export function readFwTestCard(data: Uint8Array, entry: FwEntry): FwTestCard | undefined {
  if (entry.name !== "screens" || entry.kind !== "data") return undefined;
  const start = entry.fileOffset;
  if (entry.byteLength < TEST_CARD_PIXELS + TEST_CARD_PALETTE_BYTES || start + TEST_CARD_PIXELS + TEST_CARD_PALETTE_BYTES > data.length) {
    return undefined;
  }
  const palette = new Array<number>(256).fill(0);
  const base = start + TEST_CARD_PIXELS;
  for (let i = 0; i * 2 < TEST_CARD_PALETTE_BYTES; i++) {
    const hi = data[base + i * 2];
    const lo = i * 2 + 1 < TEST_CARD_PALETTE_BYTES ? data[base + i * 2 + 1] & 1 : 0;
    palette[i] = (hi << 1) | lo;
  }
  return { pixels: data.slice(start, start + TEST_CARD_PIXELS), palette };
}
