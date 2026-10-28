import { describe, expect, it } from "vitest";

import { createTvcSession, TvcTestSession } from "../harness/tvc";
import { buildTvcCasFile, parseTvcCasFile } from "@emu/machines/tvc/TvcCasFile";
import { pictureHash, writeShotIfAsked } from "./bare";

/*
 * The TVC's tape with the real BASIC 1.2 ROM (`.plans/VIDEOTON_TVC_PLAN.md` §9): SAVE is recorded
 * from the output toggles and decoded to a `.cas`; LOAD reads a `.cas` played as its signal. The
 * ROM does all the coding: nothing is trapped.
 */

/** `10 print 42`, as BASIC 1.2 tokenises it (read from the SAVE below) */
const PROGRAM = [0x08, 0x0a, 0x00, 0xdd, 0x20, 0x34, 0x32, 0xff, 0x00];
/** BASIC 1.2's program area starts at 19EFh (its TEXT pointer) */
const BASIC_TEXT = 0x19ef;
/** "load / Searching / Reading: T / ok / run / 42 / ok", checked by eye */
const LOAD_RUN_SHA1 = "f791384ec55c0c05e04a9a3b6e4610a4d928b48f";

async function savedProgram(): Promise<{ name: string; contents: Uint8Array }> {
  const s = await createTvcSession();
  s.bootToBasic();
  s.typeKeys('10 print 42\nsave "t"\n', { settle: 0 });
  s.runWhileMotor();
  const saved = s.takeSavedTape();
  if (!saved) throw new Error("SAVE published nothing");
  return saved;
}

/** Boots, loads and runs; returns the machine frames and the displayed frames the load took */
function loadAndRun(s: TvcTestSession, cas: Uint8Array, fastLoad: boolean): { machine: number; shown: number } {
  s.bootToBasic();
  s.insertTape(parseTvcCasFile(cas, "t.cas"), { fastLoad });
  s.typeKeys("load\n", { settle: 0 });
  const machine = s.wasm.tvcGetFrames();
  const shown = s.frames;
  s.runWhileMotor({ maxFrames: 3000 });
  const result = { machine: s.wasm.tvcGetFrames() - machine, shown: s.frames - shown };
  s.typeKeys("run\n", { settle: 20 });
  return result;
}

describe("TVC tape", () => {
  it("SAVE writes a .cas: header and data blocks decoded, every CRC right", async () => {
    const saved = await savedProgram();
    expect(saved.name).toBe("T.cas");
    const tape = parseTvcCasFile(saved.contents, saved.name);
    expect(tape.name).toBe("T");
    expect(tape.fileType).toBe(0x01);
    expect(Array.from(tape.payload)).toEqual(PROGRAM);
  });

  it("LOAD reads the saved file back into a fresh machine, and RUN prints 42", async () => {
    const saved = await savedProgram();
    const s = await createTvcSession();
    loadAndRun(s, saved.contents, true);
    expect(Array.from({ length: PROGRAM.length }, (_, i) => s.peek(BASIC_TEXT + i))).toEqual(PROGRAM);
    await writeShotIfAsked(s, "tape-load-run");
    expect(await pictureHash(s)).toBe(LOAD_RUN_SHA1);
  });

  it("LOAD reads a tape at the established converter's timings (1,276 T pilot)", async () => {
    const s = await createTvcSession();
    loadAndRun(s, buildTvcCasFile(Uint8Array.from(PROGRAM), 0x01, false), true);
    expect(Array.from({ length: PROGRAM.length }, (_, i) => s.peek(BASIC_TEXT + i))).toEqual(PROGRAM);
  });

  it("fast load runs the same load in a fraction of the displayed frames", async () => {
    const cas = buildTvcCasFile(Uint8Array.from(PROGRAM), 0x01, false);
    const real = await createTvcSession();
    const realLoad = loadAndRun(real, cas, false);
    const fast = await createTvcSession();
    const fastLoad = loadAndRun(fast, cas, true);
    expect(Array.from({ length: PROGRAM.length }, (_, i) => real.peek(BASIC_TEXT + i))).toEqual(PROGRAM);
    // --- The machine's own frames are about the same either way: the ROM reads the same signal
    expect(realLoad.machine).toBeGreaterThan(300);
    expect(Math.abs(fastLoad.machine - realLoad.machine)).toBeLessThan(60);
    // --- The displayed frames are not (60 of either are the wait for the motor to stay off)
    expect(fastLoad.shown).toBeLessThan(realLoad.shown / 3);
  });

  it("the tape moves only while the motor runs", async () => {
    const s = await createTvcSession();
    s.bootToBasic();
    s.insertTape(parseTvcCasFile(buildTvcCasFile(Uint8Array.from(PROGRAM), 0x01, false), "t.cas"), { fastLoad: false });
    const at = s.wasm.tvcTapeGetPosition();
    s.runFrames(100);
    expect(s.motorOn).toBe(false);
    expect(s.wasm.tvcTapeGetPosition()).toBe(at);
  });
});
