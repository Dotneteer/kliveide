import { diskFileName, hostFileToDiskFiles } from "@common/diskfs/importFiles";
import { tapeFileBlocks } from "@common/diskfs/tapefs";
import type { DiskFileKind, DiskFsKind } from "@common/diskfs/types";
import type { FmDriveRef, FmSpectrumFacts } from "./fmTypes";

/*
 * What a file becomes when the File Manager copies it (.plans/FILE_MANAGER_PLAN.md §6, Phase 3):
 * pure functions of the bytes and the two file systems, so every rule is tested without a drive.
 *
 * Two groups of file system: *file stores* (this computer, FAT cards) keep any bytes under any name;
 * *Spectrum catalogues* (+3DOS, TR-DOS, Microdrive) keep a header (kind, start, ...) and short names.
 * Between two of a group a file keeps what it is; across the groups the mode decides.
 */

/** A target or source file system, as the conversion rules see it */
export type FmFileSystem = "host" | "fat" | "+3dos" | "trdos" | "microdrive" | "tape";

/** How files cross between a file store and a Spectrum catalogue (D6) */
export type FmTransferMode = "auto" | "headers" | "raw";

export type FmTransferOptions = {
  mode: FmTransferMode;
  /** Where a headerless file loads on a Spectrum catalogue (32768 when omitted) */
  codeStart?: number;
  /** A `.bas` program's auto-run line */
  autoRun?: number;
  /** Copy the files of folders onto a catalogue without folders (otherwise folders are skipped) */
  flatten?: boolean;
};

export const DEFAULT_TRANSFER_OPTIONS: FmTransferOptions = { mode: "auto", codeStart: 32768 };

/** A file read from its drive */
export type FmSourceFile = {
  name: string;
  data: Uint8Array;
  /** The Spectrum header, for a file on a catalogue */
  spectrum?: FmSpectrumFacts;
};

/** What a file is on its target, for the copy dialog's "becomes" column */
export type FmBecomes =
  | { as: "asIs" }
  | { as: "bytes" }
  | { as: "tap" }
  | { as: "screen" }
  | { as: "basic"; line?: number }
  | { as: "code"; start: number }
  | { as: "numberArray" | "charArray"; variableName?: string };

/** A file to write */
export type FmOutFile = {
  name: string;
  data: Uint8Array;
  kind: DiskFileKind;
  start?: number;
  variablesOffset?: number;
  variableName?: string;
  becomes: FmBecomes;
};

export function isCatalogue (fs: FmFileSystem): boolean {
  return fs === "+3dos" || fs === "trdos" || fs === "microdrive" || fs === "tape";
}

/** The file system the conversion rules see on a drive */
export function fmFileSystemOf (drive: Pick<FmDriveRef, "kind" | "fileSystem">): FmFileSystem {
  if (drive.kind === "host" || drive.kind === "project") return "host";
  if (drive.fileSystem === "+3DOS") return "+3dos";
  if (drive.fileSystem === "TR-DOS") return "trdos";
  if (drive.fileSystem === "Microdrive") return "microdrive";
  if (drive.fileSystem === "TAP" || drive.fileSystem === "TZX") return "tape";
  return "fat";
}

function diskFsKindOf (fs: FmFileSystem): DiskFsKind {
  return fs === "host" ? "fat" : fs;
}

const SCREEN_SIZE = 6912;
const SCREEN_START = 16384;

function becomesOf (kind: DiskFileKind, data: Uint8Array, start?: number, variableName?: string): FmBecomes {
  if (kind === "basic") return { as: "basic", line: start };
  if (kind === "code") {
    return data.length === SCREEN_SIZE && start === SCREEN_START ? { as: "screen" } : { as: "code", start: start ?? 32768 };
  }
  if (kind === "numberArray" || kind === "charArray") return { as: kind, variableName };
  return { as: "bytes" };
}

/** A name's stem and extension; a TR-DOS name's type letter is not an extension */
export function splitName (name: string, fs: FmFileSystem): { stem: string; extension: string } {
  const dot = name.lastIndexOf(".");
  if (fs === "trdos") return { stem: dot > 0 ? name.slice(0, dot) : name, extension: "" };
  if (fs === "microdrive" || fs === "tape" || dot <= 0) return { stem: name, extension: "" };
  return { stem: name.slice(0, dot), extension: name.slice(dot + 1) };
}

/** A catalogue file's name on a file store, with `extension` added unless it already ends so */
function storeName (name: string, from: FmFileSystem, extension?: string): string {
  const { stem, extension: own } = splitName(name, from);
  const base = own ? `${stem}.${own}` : stem;
  if (!extension) return base;
  return base.toLowerCase().endsWith(`.${extension.toLowerCase()}`) ? base : `${base}.${extension}`;
}

/** What a file becomes on the target: one file, or several when a `.tap` is split onto a catalogue */
export function convertFile (src: FmSourceFile, from: FmFileSystem, to: FmFileSystem, options: FmTransferOptions): FmOutFile[] {
  const codeStart = options.codeStart ?? 32768;

  // --- Store to store: the bytes as they are
  if (!isCatalogue(from) && !isCatalogue(to)) {
    return [{ name: src.name, data: src.data, kind: "raw", becomes: { as: "asIs" } }];
  }

  // --- Store to catalogue: the import rules (`.tap` splits, `.scr`, `.bas`, the rest CODE)
  if (!isCatalogue(from)) {
    const system = diskFsKindOf(to);
    if (options.mode === "raw") {
      const { stem, extension } = splitName(src.name, from);
      return [{
        name: diskFileName(stem, extension, "code", system),
        data: src.data,
        kind: "code",
        start: codeStart,
        becomes: { as: "code", start: codeStart }
      }];
    }
    return hostFileToDiskFiles(src.name, src.data, { system, codeStart, autoRun: options.autoRun }).map((f) => ({
      name: f.name,
      data: f.data,
      kind: f.kind,
      start: f.start,
      variablesOffset: f.variablesOffset,
      variableName: f.variableName,
      becomes: becomesOf(f.kind, f.data, f.start, f.variableName)
    }));
  }

  const facts = src.spectrum ?? { kind: "raw" as DiskFileKind };

  // --- Catalogue to catalogue: the header goes with the file, the name is fitted (a Microdrive name
  // --- has no extension of its own, so one from another catalogue stays part of it)
  if (isCatalogue(to)) {
    const split = splitName(src.name, from);
    const { stem, extension } = (to === "microdrive" || to === "tape") && split.extension
      ? { stem: `${split.stem}.${split.extension}`, extension: "" }
      : split;
    return [{
      name: diskFileName(stem, extension, facts.kind, diskFsKindOf(to)),
      data: src.data,
      kind: facts.kind,
      start: facts.start,
      variablesOffset: facts.variablesOffset,
      variableName: facts.variableName,
      becomes: becomesOf(facts.kind, src.data, facts.start, facts.variableName)
    }];
  }

  // --- Catalogue to store
  const raw = (extension?: string): FmOutFile => ({
    name: storeName(src.name, from, extension),
    data: src.data,
    kind: "raw",
    becomes: { as: "bytes" }
  });
  if (facts.kind === "raw") return [{ ...raw(), becomes: { as: "asIs" } }];
  if (options.mode === "raw") return [raw(splitName(src.name, from).extension ? undefined : "bin")];
  const asTap = (): FmOutFile => ({
    name: storeName(src.name, from, "tap"),
    data: tapOf(src.name, from, src.data, facts),
    kind: "raw",
    becomes: { as: "tap" }
  });
  if (options.mode === "headers") return [asTap()];
  // --- Auto: what a computer or a card's operating system opens best
  if (facts.kind === "code") {
    if (src.data.length === SCREEN_SIZE && facts.start === SCREEN_START) {
      return [{ ...raw("scr"), becomes: { as: "screen" } }];
    }
    return [raw(splitName(src.name, from).extension ? undefined : "bin")];
  }
  // --- A program or an array keeps its header in a .tap: esxDOS and NextZXOS load it as it is
  return [asTap()];
}

// -------------------------------------------------------------------------------------------------
// TAP

/** A one-file `.tap`: the header block and the data block, each with its length and checksum */
export function tapOf (name: string, from: FmFileSystem, data: Uint8Array, facts: FmSpectrumFacts): Uint8Array {
  const blocks = tapeFileBlocks(splitName(name, from).stem, facts.kind, data, facts.start, facts.variablesOffset, facts.variableName);
  const out = new Uint8Array(blocks.reduce((sum, b) => sum + 2 + b.length, 0));
  let at = 0;
  for (const b of blocks) {
    out[at] = b.length & 0xff;
    out[at + 1] = (b.length >> 8) & 0xff;
    out.set(b, at + 2);
    at += 2 + b.length;
  }
  return out;
}

// -------------------------------------------------------------------------------------------------
// Names

const STORE_FORBIDDEN = /[<>:"/\\|?*\x00-\x1f]/g;

/** A name a file store takes: no path or reserved characters, no trailing dots or spaces */
export function storeSafeName (name: string): string {
  const cleaned = name.replace(STORE_FORBIDDEN, "_").replace(/[. ]+$/, "");
  return cleaned || "_";
}

/** Name lengths on the catalogues: the stem's room */
const STEM_ROOM: Partial<Record<FmFileSystem, number>> = { "+3dos": 8, trdos: 8, microdrive: 10, tape: 10 };

/**
 * A name not in `taken` (lower-case names): on a file store `name (2).ext`, on a catalogue the stem's
 * end replaced with `~2`, keeping its length rule
 */
export function freeName (name: string, fs: FmFileSystem, taken: ReadonlySet<string>): string {
  if (!taken.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf(".");
  const hasExt = dot > 0 && fs !== "microdrive" && fs !== "tape";
  const stem = hasExt ? name.slice(0, dot) : name;
  const ext = hasExt ? name.slice(dot) : "";
  for (let n = 2; n < 10000; n++) {
    const room = STEM_ROOM[fs];
    const candidate = room
      ? `${stem.slice(0, room - `~${n}`.length)}~${n}${ext}`
      : `${stem} (${n})${ext}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return name;
}

/** Did a file's stem change on the way (shortened, upper-cased letters aside)? */
export function wasShortened (sourceName: string, from: FmFileSystem, targetName: string, to: FmFileSystem): boolean {
  const a = splitName(sourceName, from).stem.toLowerCase();
  const b = splitName(targetName, to).stem.toLowerCase();
  return a !== b && !b.startsWith(a);
}

// -------------------------------------------------------------------------------------------------
// The plan

/** A file or folder to copy, as the job found it */
export type FmPlanSource = {
  sourcePath: string;
  sourceName: string;
  /** The folder under the target folder it goes to ("" for the target folder itself) */
  relDir: string;
  isDirectory: boolean;
  size: number;
  /** The file's bytes and header, read when the copy converts it */
  file?: FmSourceFile;
};

/** One thing the copy will do: make a folder or write a file */
export type FmPlanItem = {
  id: number;
  sourcePath: string;
  sourceName: string;
  relDir: string;
  isDirectory: boolean;
  targetName: string;
  size: number;
  becomes: FmBecomes;
  /** A file of that name is already there */
  conflict: boolean;
  /** The name had to be shortened or changed to fit */
  shortened: boolean;
  /** One of several files a source became (a `.tap` split onto a catalogue) */
  part: boolean;
};

export type FmPlanBuild = {
  items: FmPlanItem[];
  /** The files to write, by item id; absent for a store-to-store copy, which copies the source */
  outputs: Map<number, FmOutFile>;
  /** Folders a catalogue cannot take, skipped */
  skippedFolders: string[];
};

/**
 * The plan of a copy: every folder to make and file to write, its name on the target, what it
 * becomes, and whether a file of that name is already there. `existing` gives the lower-case names in
 * a target folder (relative to the target folder).
 */
export function buildPlan (
  sources: FmPlanSource[],
  from: FmFileSystem,
  to: FmFileSystem,
  options: FmTransferOptions,
  existing: (relDir: string) => ReadonlySet<string>
): FmPlanBuild {
  const items: FmPlanItem[] = [];
  const outputs = new Map<number, FmOutFile>();
  const skippedFolders: string[] = [];
  const planned = new Map<string, Set<string>>();
  const plannedIn = (relDir: string) => {
    let set = planned.get(relDir);
    if (!set) planned.set(relDir, (set = new Set()));
    return set;
  };
  const flatTarget = isCatalogue(to);

  for (const src of sources) {
    const relDir = flatTarget ? "" : src.relDir;
    if (src.isDirectory) {
      if (flatTarget) {
        if (!options.flatten) skippedFolders.push(src.relDir ? `${src.relDir}/${src.sourceName}` : src.sourceName);
        continue;
      }
      const name = storeSafeName(src.sourceName);
      plannedIn(relDir).add(name.toLowerCase());
      items.push({
        id: items.length,
        sourcePath: src.sourcePath,
        sourceName: src.sourceName,
        relDir,
        isDirectory: true,
        targetName: name,
        size: 0,
        becomes: { as: "asIs" },
        conflict: false,
        shortened: name !== src.sourceName,
        part: false
      });
      continue;
    }
    if (flatTarget && src.relDir && !options.flatten) continue;

    const outs: FmOutFile[] = src.file
      ? convertFile(src.file, from, to, options)
      : [{ name: src.sourceName, data: new Uint8Array(0), kind: "raw", becomes: { as: "asIs" } }];
    const already = existing(relDir);
    const inPlan = plannedIn(relDir);
    for (const out of outs) {
      const fitted = flatTarget ? out.name : storeSafeName(out.name);
      const name = freeName(fitted, to, inPlan);
      inPlan.add(name.toLowerCase());
      const id = items.length;
      items.push({
        id,
        sourcePath: src.sourcePath,
        sourceName: src.sourceName,
        relDir,
        isDirectory: false,
        targetName: name,
        size: src.file ? out.data.length : src.size,
        becomes: out.becomes,
        conflict: already.has(name.toLowerCase()),
        shortened: outs.length === 1 && wasShortened(src.sourceName, from, name, to),
        part: outs.length > 1
      });
      if (src.file) outputs.set(id, { ...out, name });
    }
  }
  return { items, outputs, skippedFolders };
}
