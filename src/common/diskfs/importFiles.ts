import { tokenizeBasicProgram } from "@common/basic/spectrumBasicTokenizer";
import type { DiskFileKind, DiskFsKind, NewDiskFile } from "./types";

/*
 * Host files as disk files (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, B4): what a file dropped on
 * or added to the Disk Explorer becomes.
 *
 * - `.tap`: every file on the tape, with its header's kind, name and parameters; a headerless block
 *   becomes CODE named after the tape.
 * - `.scr` (6912 bytes): a `SCREEN$` - CODE at 16384.
 * - `.bas`: BASIC text, tokenised; `autoRun` gives it an auto-run line (the +3's Loader and TR-DOS's
 *   boot run it).
 * - anything else: CODE at the address given (32768 by default).
 *
 * The names are made to fit the disk: +3DOS takes 8 characters, a dot and 3 (letters, digits and a
 * few signs, upper case); TR-DOS 8 characters and its type letter; a Microdrive 10 characters.
 *
 * A FAT disk (an SD card) takes every file as it is, under its own name: esxDOS and NextZXOS load
 * `.tap`, `.scr` and the rest straight from the card.
 */

export type ImportOptions = {
  /** Where headerless code loads */
  codeStart?: number;
  /** The disk's file system: names follow its rules */
  system: DiskFsKind;
  /** Accept the 128K keywords in `.bas` text */
  plus128?: boolean;
  /** A `.bas` program's auto-run line (none by default) */
  autoRun?: number;
};

const SCREEN_SIZE = 6912;
const KIND_BY_TAPE_TYPE: DiskFileKind[] = ["basic", "numberArray", "charArray", "code"];

/** The disk files a host file becomes */
export function hostFileToDiskFiles (fileName: string, bytes: Uint8Array, options: ImportOptions): NewDiskFile[] {
  const base = fileName.replace(/^.*[\\/]/, "");
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const extension = dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
  if (options.system === "fat") return [{ name: base, kind: "raw", data: bytes }];
  const system = options.system;
  const named = (name: string, ext: string, kind: DiskFileKind) => diskFileName(name, ext, kind, system);

  if (extension === "tap") {
    return tapFiles(bytes, stem).map((f) => ({ ...f, name: named(f.name, f.kind === "code" ? "bin" : "", f.kind) }));
  }
  if (extension === "scr" && bytes.length === SCREEN_SIZE) {
    return [{ name: named(stem, "scr", "code"), kind: "code", data: bytes, start: 16384 }];
  }
  if (extension === "bas") {
    const program = tokenizeBasicProgram(new TextDecoder().decode(bytes), { plus128: options.plus128 });
    return [{ name: named(stem, "", "basic"), kind: "basic", data: program, variablesOffset: program.length, start: options.autoRun }];
  }
  return [{ name: named(stem, extension, "code"), kind: "code", data: bytes, start: options.codeStart ?? 32768 }];
}

/** A name that fits the file system */
export function diskFileName (name: string, extension: string, kind: DiskFileKind, system: DiskFsKind): string {
  if (system === "fat") return extension ? `${name}.${extension}` : name;
  // --- A Microdrive or tape name: 1-10 characters, as typed; the extension has no place in it
  if (system === "microdrive" || system === "tape") return (name.trim() || "file").slice(0, 10);
  if (system === "trdos") {
    const base = (name.trim() || "file").slice(0, 8);
    const type = kind === "basic" ? "B" : kind === "code" ? "C" : kind === "raw" ? "#" : "D";
    return `${base}.${type}`;
  }
  const clean = (text: string, length: number) =>
    text
      .toUpperCase()
      .replace(/[^!#$%&'()\-@^_{}~0-9A-Z]/g, "")
      .slice(0, length);
  const base = clean(name, 8) || "FILE";
  const ext = clean(extension, 3);
  return ext ? `${base}.${ext}` : base;
}

/** The files of a `.tap`: header and data pairs, and headerless blocks */
export function tapFiles (bytes: Uint8Array, tapeName: string): NewDiskFile[] {
  const blocks: Uint8Array[] = [];
  for (let at = 0; at + 2 <= bytes.length; ) {
    const length = bytes[at] | (bytes[at + 1] << 8);
    if (length < 2 || at + 2 + length > bytes.length) break;
    blocks.push(bytes.subarray(at + 2, at + 2 + length));
    at += 2 + length;
  }
  const files: NewDiskFile[] = [];
  let headerless = 0;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const isHeader = block[0] === 0x00 && block.length === 19;
    if (isHeader && blocks[i + 1]?.[0] === 0xff) {
      const type = block[1];
      const name = String.fromCharCode(...block.subarray(2, 12)).trimEnd();
      const length = block[12] | (block[13] << 8);
      const param1 = block[14] | (block[15] << 8);
      const param2 = block[16] | (block[17] << 8);
      const data = blocks[i + 1].slice(1, 1 + length);
      const kind = KIND_BY_TAPE_TYPE[type] ?? "code";
      const file: NewDiskFile = { name: name || tapeName, kind, data };
      if (kind === "basic") {
        file.start = param1 < 32768 ? param1 : undefined;
        file.variablesOffset = param2;
      } else if (kind === "code") {
        file.start = param1;
      } else {
        file.variableName = String.fromCharCode(0x60 + (block[15] & 0x1f));
      }
      files.push(file);
      i++;
      continue;
    }
    if (block[0] === 0xff) {
      headerless++;
      files.push({ name: `${tapeName}${headerless}`, kind: "code", data: block.slice(1, block.length - 1), start: 32768 });
    }
  }
  return files;
}
