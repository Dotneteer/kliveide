import { describe, expect, it } from "vitest";

import type { SavedFileInfo } from "@emu/abstractions/ITapeDevice";
import { FAST_LOAD, SAVED_TO_TAPE } from "@emu/machines/machine-props";
import { Zx8081KeyCode } from "@emu/machines/zx8081/Zx8081KeyCode";
import { parseZxProgramFile } from "@emu/machines/zx8081/ZxPFile";
import { createZx81Session, Zx81TestSession } from "../harness/zx81";

/**
 * The ZX81's SAVE on the real ROM, captured as a `.P` file (`zx8081-tape.c`, "SAVE"): the machine
 * hands it to the host through `SAVED_TO_TAPE`, as the Spectrum machines hand over their `.tzx`.
 */

const E_LINE = 0x4014;
const D_FILE = 0x400c;
const PROGRAM_START = 0x407d;

/**
 * Types a one-line program, `10 PRINT "HI"` (K mode: P is PRINT, SHIFT+P the quote), and waits until
 * the ROM has listed it and shows the K cursor again (some 40 frames)
 */
function typeProgram(s: Zx81TestSession): void {
  s.typeKeys('10P"HI"\n', { settle: 0 });
  s.runUntil(() => s.screenText()[0] !== "" && s.hasKCursor(), { maxFrames: 200 }, "the listing").runFrames(10);
}

/** Types `SAVE "<name>"` (K mode: S is SAVE) */
function typeSave(s: Zx81TestSession, name: string): void {
  s.typeKeys(`S"${name}"\n`, { settle: 0 });
}

function savedFile(s: Zx81TestSession): SavedFileInfo | undefined {
  return s.machine.getMachineProperty(SAVED_TO_TAPE) as SavedFileInfo | undefined;
}

/** The BASIC program in RAM: $407D up to the display file */
function programInRam(s: Zx81TestSession): number[] {
  const bytes: number[] = [];
  for (let a = PROGRAM_START; a < s.peekWord(D_FILE); a++) bytes.push(s.peek(a));
  return bytes;
}

/** The BASIC program in a `.P` file's bytes (from $4009) */
function programInFile(data: Uint8Array): number[] {
  const dfile = data[D_FILE - 0x4009] | (data[D_FILE - 0x4009 + 1] << 8);
  return [...data.subarray(PROGRAM_START - 0x4009, dfile - 0x4009)];
}

/**
 * The system variables the ROM changes while it runs (DF_CC, X_PTR, LAST_K, DEBOUNCE, MARGIN, FRAMES,
 * S_POSN...): they differ between a fast and a real-time SAVE
 */
const VOLATILE = new Set([
  0x400e, 0x400f, 0x4018, 0x4019, 0x401a, 0x401b, 0x401c, 0x4025, 0x4026, 0x4027, 0x4028, 0x4034, 0x4035, 0x4039,
  0x403a
]);

function stable(data: Uint8Array): number[] {
  return [...data].map((b, i) => (VOLATILE.has(0x4009 + i) ? -1 : b));
}

describe("ZX81 tape SAVE", () => {
  it("SAVE hands the program to the host as a .P file named after the tape name", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    typeProgram(s);
    const eLine = s.peekWord(E_LINE);
    typeSave(s, "PROG");
    s.runUntil(() => savedFile(s) !== undefined, { maxFrames: 100 }, "the SAVE");

    const saved = savedFile(s)!;
    expect(saved.name).toBe("PROG.p");
    // --- A .P file: VERSN ($4009) up to E_LINE - 1
    expect(saved.contents.length).toBe(eLine - 0x4009);
    expect(saved.contents[0]).toBe(0x00); // VERSN
    expect(saved.contents[E_LINE - 0x4009] | (saved.contents[E_LINE - 0x4009 + 1] << 8)).toBe(eLine);
    expect(programInFile(saved.contents)).toEqual(programInRam(s));
    expect(s.wasm.zx8081TapeGetSavedRevision()).toBe(1);
    expect(s.wasm.zx8081TapeGetSavePhase()).toBe(0);
    // --- The ROM ends the command with its report, the program intact
    s.runFrames(50);
    expect(s.screenText()[23]).toBe("0/0");
  });

  it("a saved file loads back into another machine", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    typeProgram(s);
    typeSave(s, "ROUND");
    s.runUntil(() => savedFile(s) !== undefined, { maxFrames: 100 }, "the SAVE");
    const saved = savedFile(s)!;

    const file = parseZxProgramFile(saved.contents, saved.name);
    expect(file).toBeDefined();
    const t = await createZx81Session();
    t.bootToBasic();
    t.loadProgram(file!, { autoRun: false });
    expect(programInRam(t)).toEqual(programInFile(saved.contents));
    // --- And it runs
    t.typeKeys("R\n", { settle: 50 });
    expect(t.screenText()[0]).toBe("HI");
  }, 30_000);

  it("a real-time SAVE writes the same file as a fast one, in the time the pulses take", async () => {
    const fast = await createZx81Session();
    fast.bootToBasic();
    typeProgram(fast);
    typeSave(fast, "PROG");
    fast.runUntil(() => savedFile(fast) !== undefined, { maxFrames: 100 }, "the fast SAVE");

    const slow = await createZx81Session();
    slow.machine.setMachineProperty(FAST_LOAD, false);
    slow.bootToBasic();
    typeProgram(slow);
    typeSave(slow, "PROG");
    const start = slow.frames;
    slow.runUntil(() => savedFile(slow) !== undefined, { maxFrames: 2000 }, "the real-time SAVE");
    // --- About 5 s of lead-in before the first byte
    expect(slow.frames - start).toBeGreaterThan(250);

    expect(savedFile(slow)!.name).toBe("PROG.p");
    expect(stable(savedFile(slow)!.contents)).toEqual(stable(savedFile(fast)!.contents));
  }, 60_000);

  it("BREAK during a real-time SAVE drops the file", async () => {
    const s = await createZx81Session();
    s.machine.setMachineProperty(FAST_LOAD, false);
    s.bootToBasic();
    typeProgram(s);
    typeSave(s, "PROG");
    s.runFrames(50);
    expect(s.wasm.zx8081TapeGetSavePhase()).not.toBe(0);
    s.keyDown(Zx8081KeyCode.Space).runFrames(10).keyUp(Zx8081KeyCode.Space).runFrames(400);
    expect(savedFile(s)).toBeUndefined();
    expect(s.wasm.zx8081TapeGetSavedRevision()).toBe(0);
    expect(s.screenText()[23]).toMatch(/^D\//);
  }, 30_000);
});
