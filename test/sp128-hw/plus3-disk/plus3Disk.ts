import { p3ModelRomSet, type P3ModelId } from "@emu/machines/zxSpectrumP3e/p3RomSets";
import { createSp128Session, type Sp128TestSession } from "../../harness/sp128";

/*
 * Shared steps for the +3 disk tests (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, D9): the real
 * Amstrad ROMs are the oracle for +3DOS, driving Klive's floppy controller.
 */

/** The model the oracle tests run on: the +3 with Amstrad's v4.1 English ROMs, two drives */
export const ORACLE_MODEL: P3ModelId = "plus3-fdd2";

/** The screen's text lines that are not blank */
export const nonBlank = (s: Sp128TestSession) =>
  s
    .screenText()
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim());

/** A +3 in its BASIC editor, with disks in drive A (and B) */
export async function plus3WithDisks (driveA?: Uint8Array, driveB?: Uint8Array, model = ORACLE_MODEL) {
  const s = await createSp128Session(model);
  if (driveA) s.insertDisk(0, driveA);
  if (driveB) s.insertDisk(1, driveB);
  const flow = await s.machine.getCodeInjectionFlow("spp3e");
  s.runFlow(flow, { checkRom: false });
  s.machine.pc = p3ModelRomSet(model).returnToEditor;
  s.runFrames(30);
  return s;
}

const REPORT = /^[0-9A-Z] .+, \d+:\d+$/;

/** The report line on the screen (`<code> <message>, <line>:<statement>`), if any */
export const reportLine = (s: Sp128TestSession) => nonBlank(s).find((l) => REPORT.test(l));

/**
 * Types a BASIC command and runs until its report is on the screen.
 *
 * Two traps of typing into the +3 editor: the key that takes the editor back from a report is
 * swallowed (so a report on the screen is dismissed with ENTER first, and the editor given time to
 * redraw the screen before it takes keys again), and a key typed twice in a
 * row is read once (the ROM's debounce: a quote is Symbol Shift + P, so `"p...` loses its `p`).
 * @returns The screen's lines at the report
 */
export function command (s: Sp128TestSession, text: string, maxFrames = 3000): string[] {
  s.runFrames(10);
  if (reportLine(s)) {
    s.typeText("\n");
    for (let frame = 0; frame < 200 && reportLine(s); frame += 5) s.runFrames(5);
    // --- The editor redraws the screen before it takes keys again
    s.runFrames(50);
  }
  s.typeText(`${text}\n`);
  for (let frame = 0; frame < maxFrames && !reportLine(s); frame += 5) {
    s.runFrames(5);
  }
  return nonBlank(s);
}

/** Types a program line into the editor */
export function programLine (s: Sp128TestSession, line: string): void {
  s.runFrames(10);
  if (reportLine(s)) {
    s.typeText("\n");
    for (let frame = 0; frame < 200 && reportLine(s); frame += 5) s.runFrames(5);
    s.runFrames(50);
  }
  s.typeText(`${line}\n`).runFrames(20);
}

/**
 * What a program sees at an address: the +3 editor keeps bank 7 at $C000, so the top 16K is read
 * from bank 0, where BASIC's `LOAD ... CODE` puts it
 */
export function memory (s: Sp128TestSession, address: number, length: number): number[] {
  const top = s.bank(0);
  return Array.from({ length }, (_, i) => (address + i < 0xc000 ? s.peek(address + i) : top[address + i - 0xc000]));
}
