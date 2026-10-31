import { BinaryReader } from "@utils/BinaryReader";
import { TzxReader } from "@emu/machines/tape/TzxReader";
import {
  DiskFsError,
  type DiskFileAttributes,
  type DiskFileEntry,
  type DiskFileKind,
  type DiskFileSystem,
  type DiskFsInfo,
  type DiskSectorRole,
  type NewDiskFile
} from "./types";

/*
 * A tape as a file system (.plans/FILE_MANAGER_PLAN.md §5.4, Phase 6): its header and data block
 * pairs are the files, in tape order. A `.tap` is read and written: a new file is appended as a
 * header and a data block, deleting removes both, renaming rewrites the header. A `.tzx` is read
 * only, from its standard-speed blocks (ID $10); its other blocks are not files.
 *
 * Names are not unique on a tape; the second `game` is listed as `game#2`, and that is the name the
 * other calls take.
 */

const KIND_BY_TYPE: DiskFileKind[] = ["basic", "numberArray", "charArray", "code"];
const TYPE_BY_KIND: Partial<Record<DiskFileKind, number>> = { basic: 0, numberArray: 1, charArray: 2, code: 3 };
const HEADER_LENGTH = 19;
const NAME_LENGTH = 10;

/** A block of the tape: its payload, flag byte first and checksum last */
type TapeBlock = { data: Uint8Array };

/** A file of the tape: a header block and its data, or a data block alone */
type TapeFile = {
  name: string;
  header?: number;
  data: number;
};

export type TapeFormat = "tap" | "tzx";

export class TapeFileSystem implements DiskFileSystem {
  readonly system = "tape";
  private blocks: TapeBlock[];
  private files: TapeFile[] = [];

  constructor (bytes: Uint8Array, readonly format: TapeFormat) {
    this.blocks = format === "tap" ? readTapBlocks(bytes) : readTzxBlocks(bytes);
    this.index();
  }

  get readOnly (): boolean {
    return this.format === "tzx";
  }

  info (): DiskFsInfo {
    const total = this.blocks.reduce((sum, b) => sum + b.data.length + 2, 0);
    return {
      system: this.format === "tap" ? "TAP" : "TZX",
      format: this.format === "tap" ? "TAP" : "TZX",
      totalBytes: total,
      // --- A tape has no end to fill: as much room as it is long
      freeBytes: 0,
      blockSize: 1,
      directoryEntries: 0,
      usedEntries: this.files.length
    };
  }

  list (): DiskFileEntry[] {
    return this.files.map((f) => this.entryOf(f));
  }

  read (name: string): Uint8Array {
    const file = this.find(name);
    const block = this.blocks[file.data].data;
    const body = block.subarray(1, block.length - 1);
    const header = file.header === undefined ? undefined : this.blocks[file.header].data;
    if (!header) return body.slice();
    const length = header[12] | (header[13] << 8);
    return body.slice(0, Math.min(length, body.length));
  }

  write (file: NewDiskFile): DiskFileEntry {
    this.writable();
    const blocks = tapeFileBlocks(file.name, file.kind, file.data, file.start, file.variablesOffset, file.variableName);
    this.blocks.push(...blocks.map((data) => ({ data })));
    this.index();
    return this.entryOf(this.files[this.files.length - 1]);
  }

  delete (name: string): void {
    this.writable();
    const file = this.find(name);
    const drop = new Set([file.data, ...(file.header === undefined ? [] : [file.header])]);
    this.blocks = this.blocks.filter((_, i) => !drop.has(i));
    this.index();
  }

  rename (name: string, newName: string): void {
    this.writable();
    const file = this.find(name);
    if (file.header === undefined) {
      throw new DiskFsError("unsupported", `${name} has no header to hold a name.`, { name });
    }
    if (!newName || newName.length > NAME_LENGTH) {
      throw new DiskFsError("badName", `"${newName}" is not a tape name (1 to ${NAME_LENGTH} characters).`, { name: newName });
    }
    const header = this.blocks[file.header].data.slice();
    writeName(header, newName);
    header[HEADER_LENGTH - 1] = checksum(header.subarray(0, HEADER_LENGTH - 1));
    this.blocks[file.header] = { data: header };
    this.index();
  }

  setAttributes (_name: string, _attributes: Partial<DiskFileAttributes>): void {
    throw new DiskFsError("unsupported", "A tape has no attributes.");
  }

  /** Moves a file one place earlier (-1) or later (+1) on the tape */
  move (name: string, by: -1 | 1): void {
    this.writable();
    const at = this.files.indexOf(this.find(name));
    const other = this.files[at + by];
    if (!other) return;
    const [first, second] = by < 0 ? [other, this.files[at]] : [this.files[at], other];
    const span = (f: TapeFile) => (f.header === undefined ? [f.data] : [f.header, f.data]);
    const a = span(first);
    const b = span(second);
    const start = a[0];
    const moved = [...b.map((i) => this.blocks[i]), ...a.map((i) => this.blocks[i])];
    this.blocks.splice(start, a.length + b.length, ...moved);
    this.index();
  }

  layout (): Map<number, DiskSectorRole> {
    return new Map();
  }

  image (): Uint8Array {
    if (this.format !== "tap") throw new DiskFsError("readOnly", "A .tzx tape is read only.");
    const out = new Uint8Array(this.blocks.reduce((sum, b) => sum + 2 + b.data.length, 0));
    let at = 0;
    for (const b of this.blocks) {
      out[at] = b.data.length & 0xff;
      out[at + 1] = (b.data.length >> 8) & 0xff;
      out.set(b.data, at + 2);
      at += 2 + b.data.length;
    }
    return out;
  }

  // -----------------------------------------------------------------------------------------------

  private writable (): void {
    if (this.readOnly) throw new DiskFsError("readOnly", "A .tzx tape is read only.");
  }

  private index (): void {
    const files: TapeFile[] = [];
    const used = new Map<string, number>();
    const unique = (name: string) => {
      const n = (used.get(name.toLowerCase()) ?? 0) + 1;
      used.set(name.toLowerCase(), n);
      return n === 1 ? name : `${name}#${n}`;
    };
    let headerless = 0;
    for (let i = 0; i < this.blocks.length; i++) {
      const block = this.blocks[i].data;
      const next = this.blocks[i + 1]?.data;
      if (block[0] === 0x00 && block.length === HEADER_LENGTH && next?.[0] === 0xff) {
        files.push({ name: unique(readName(block) || "noname"), header: i, data: i + 1 });
        i++;
        continue;
      }
      if (block[0] !== 0x00) {
        headerless++;
        files.push({ name: unique(`block${String(headerless).padStart(2, "0")}`), data: i });
      }
    }
    this.files = files;
  }

  private find (name: string): TapeFile {
    const file = this.files.find((f) => f.name === name) ?? this.files.find((f) => f.name.toLowerCase() === name.toLowerCase());
    if (!file) throw new DiskFsError("notFound", `${name} is not on the tape.`, { name });
    return file;
  }

  private entryOf (f: TapeFile): DiskFileEntry {
    const header = f.header === undefined ? undefined : this.blocks[f.header].data;
    const body = this.blocks[f.data].data;
    const kind: DiskFileKind = header ? KIND_BY_TYPE[header[1]] ?? "code" : "raw";
    const size = header ? header[12] | (header[13] << 8) : Math.max(0, body.length - 2);
    const param1 = header ? header[14] | (header[15] << 8) : 0;
    const param2 = header ? header[16] | (header[17] << 8) : 0;
    return {
      name: f.name,
      baseName: f.name,
      extension: "",
      kind,
      size,
      allocated: body.length + (header ? header.length + 2 : 0) + 2,
      start: kind === "basic" ? (param1 < 32768 ? param1 : undefined) : kind === "code" ? param1 : undefined,
      variablesOffset: kind === "basic" ? param2 : undefined,
      variableName: kind === "numberArray" || kind === "charArray" ? String.fromCharCode(0x60 + (header![15] & 0x1f)) : undefined,
      attributes: { readOnly: false, system: false, archive: false },
      deleted: false,
      sectors: []
    };
  }
}

/** A file as tape blocks: a header and its data block, each with flag and checksum */
export function tapeFileBlocks (
  name: string,
  kind: DiskFileKind,
  data: Uint8Array,
  start?: number,
  variablesOffset?: number,
  variableName?: string
): Uint8Array[] {
  const body = new Uint8Array(data.length + 2);
  body[0] = 0xff;
  body.set(data, 1);
  body[body.length - 1] = checksum(body.subarray(0, body.length - 1));
  const type = TYPE_BY_KIND[kind];
  // --- A headerless file is its data block alone
  if (type === undefined) return [body];
  const header = new Uint8Array(HEADER_LENGTH);
  header[1] = type;
  writeName(header, name);
  const word = (at: number, v: number) => {
    header[at] = v & 0xff;
    header[at + 1] = (v >> 8) & 0xff;
  };
  word(12, data.length);
  if (kind === "basic") {
    word(14, start ?? 0x8000);
    word(16, variablesOffset ?? data.length);
  } else if (kind === "code") {
    word(14, start ?? 32768);
    word(16, 32768);
  } else {
    header[15] = (kind === "charArray" ? 0xc0 : 0x80) | ((variableName ?? "a").toLowerCase().charCodeAt(0) & 0x1f);
    word(16, 32768);
  }
  header[HEADER_LENGTH - 1] = checksum(header.subarray(0, HEADER_LENGTH - 1));
  return [header, body];
}

function readTapBlocks (bytes: Uint8Array): TapeBlock[] {
  const blocks: TapeBlock[] = [];
  for (let at = 0; at + 2 <= bytes.length; ) {
    const length = bytes[at] | (bytes[at + 1] << 8);
    if (length < 1 || at + 2 + length > bytes.length) break;
    blocks.push({ data: bytes.slice(at + 2, at + 2 + length) });
    at += 2 + length;
  }
  return blocks;
}

function readTzxBlocks (bytes: Uint8Array): TapeBlock[] {
  const reader = new TzxReader(new BinaryReader(bytes));
  const error = reader.readContent();
  if (error) throw new DiskFsError("unformatted", `The tape cannot be read: ${error}`);
  return reader.dataBlocks
    .filter((b) => b.blockId === 0x10)
    .map((b) => ({ data: (b as unknown as { data: Uint8Array }).data }))
    .filter((b) => b.data && b.data.length >= 2);
}

function readName (header: Uint8Array): string {
  return String.fromCharCode(...header.subarray(2, 2 + NAME_LENGTH)).trimEnd();
}

function writeName (header: Uint8Array, name: string): void {
  const padded = name.padEnd(NAME_LENGTH, " ").slice(0, NAME_LENGTH);
  for (let i = 0; i < NAME_LENGTH; i++) header[2 + i] = padded.charCodeAt(i) & 0xff;
}

function checksum (bytes: Uint8Array): number {
  let x = 0;
  for (const b of bytes) x ^= b;
  return x;
}
