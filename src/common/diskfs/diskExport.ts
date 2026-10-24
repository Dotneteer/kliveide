import { tokenizeStatementText } from "@common/basic/spectrumBasicTokenizer";
import { createBlankDsk } from "@emu/machines/disk/blank-dsk";
import { createBlankTrd } from "@emu/machines/disk/trd/trdImage";
import { Plus3DosFileSystem } from "./plus3dos";
import { TrdosFileSystem } from "./trdos";
import { DiskFsError, type DiskFileSystem } from "./types";
import { diskFileName } from "./importFiles";

/*
 * A compiled program as a bootable disk (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, B6): Klive's
 * own `expc -f dsk` / `-f trd`, so an assembly or Klive BASIC build needs no other tool for a disk.
 *
 * The disk holds each code segment as a CODE file at its address, an optional loading screen, and a
 * BASIC loader that the machine's own boot starts:
 * - +3: `DISK`, which the +3's Loader runs - `10 [CLEAR n:] [BORDER b:] [LOAD "SCREEN"CODE:]
 *   LOAD "name"CODE: ... RANDOMIZE USR entry`;
 * - TR-DOS: `boot`, which TR-DOS runs from a boot - each load a TR-DOS command line of its own,
 *   `RANDOMIZE USR 15619: REM : LOAD "name"CODE` (the Beta 128 manual's BASIC entry), since the
 *   command takes the rest of its line.
 *
 * Banked (128K paging) segments are not exported to disk: their loader would have to page the
 * banks, which the tape export does and this does not yet.
 */

export type DiskExportSegment = { startAddress: number; emittedCode: number[]; bank?: number };

export type DiskExportProgram = {
  /** The program's name (the code files are named after it) */
  name: string;
  segments: DiskExportSegment[];
  /** Where `RANDOMIZE USR` starts the program */
  entryAddress: number;
  /** CLEAR to below the code */
  clear?: boolean;
  border?: number;
  /** A 6912-byte loading screen */
  screen?: Uint8Array;
};

export function buildExportDisk (format: "dsk" | "trd", program: DiskExportProgram): Uint8Array {
  if (program.segments.some((s) => s.bank !== undefined)) {
    throw new DiskFsError("unsupported", "Banked code cannot be exported to a disk yet; export a tape instead.");
  }
  const segments = program.segments.filter((s) => s.emittedCode.length > 0);
  if (segments.length === 0) throw new DiskFsError("unsupported", "The program has no code to put on a disk.");

  const fs: DiskFileSystem =
    format === "dsk" ? new Plus3DosFileSystem(createBlankDsk("sse")) : new TrdosFileSystem(createBlankTrd({ cylinders: 80, sides: 2 }, program.name.slice(0, 8)));
  const system = fs.system;
  const stem = program.name.replace(/\.[^.]*$/, "") || "code";

  // --- The files, named to fit the disk: one segment takes the program's name, several are numbered
  const codeName = (index: number) => {
    const base = segments.length === 1 ? stem : `${stem.slice(0, 7)}${index + 1}`;
    return diskFileName(base, system === "+3dos" ? "bin" : "", "code", system);
  };
  const names = segments.map((_, i) => codeName(i));
  const screenName = program.screen ? diskFileName("screen", system === "+3dos" ? "scr" : "", "code", system) : undefined;
  if (screenName) fs.write({ name: screenName, kind: "code", data: program.screen!, start: 16384 });
  segments.forEach((s, i) => fs.write({ name: names[i], kind: "code", data: Uint8Array.from(s.emittedCode), start: s.startAddress }));

  // --- The loader
  const quoted = (name: string) => `"${system === "trdos" ? name.replace(/\.[A-Z#]$/i, "") : name}"`;
  const head: string[] = [];
  if (program.clear) head.push(`CLEAR ${Math.min(...segments.map((s) => s.startAddress)) - 1}`);
  if (program.border !== undefined) head.push(`BORDER ${program.border & 7}`);
  const loads = [...(screenName ? [screenName] : []), ...names].map((n) => `LOAD ${quoted(n)}CODE`);
  const run = `RANDOMIZE USR ${program.entryAddress}`;

  const lines: number[][] = [];
  if (system === "+3dos") {
    lines.push(tokenizeStatementText([...head, ...loads, run].join(": "), { plus128: true }));
  } else {
    if (head.length) lines.push(tokenizeStatementText(head.join(": ")));
    // --- `RANDOMIZE USR 15619: REM :` then the TR-DOS command, as the editor stores it after a REM:
    // --- keywords as tokens, numbers as digits only (no hidden 5-byte forms)
    const trdosEntry = tokenizeStatementText("RANDOMIZE USR 15619: REM");
    for (const load of loads) lines.push([...trdosEntry, 0x3a, ...tokenizeStatementText(load, { noHiddenNumbers: true })]);
    lines.push(tokenizeStatementText(run));
  }
  const program48: number[] = [];
  lines.forEach((body, i) => {
    const number = (i + 1) * 10;
    const withEnter = [...body, 0x0d];
    program48.push(number >> 8, number & 0xff, withEnter.length & 0xff, withEnter.length >> 8, ...withEnter);
  });
  const loader = Uint8Array.from(program48);
  fs.write({
    name: system === "+3dos" ? "DISK" : "boot.B",
    kind: "basic",
    data: loader,
    start: 10,
    variablesOffset: loader.length
  });
  return fs.image();
}
