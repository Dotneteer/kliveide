import { describe, expect, it } from "vitest";

import { createZx81Session, Zx81TestSession } from "../harness/zx81";

/**
 * ZX81 program loading on the real ROM (`.plans/ZX8081_WASM_PLAN.md` §9, §12): the same file loaded
 * through the fast-load traps and in real time from the synthesized pulses, the auto-RUN, the
 * automatic motor control, and the corpus files that test the loader's tolerance.
 */

/**
 * The program as it sits in RAM after a load: VERSN ($4009) up to E_LINE, without the system
 * variables the ROM itself changes after a load (DF_CC, X_PTR, LAST_K, DEBOUNCE, MARGIN, FRAMES,
 * S_POSN...), which differ with timing.
 */
function programBytes(s: Zx81TestSession, length: number): number[] {
  const volatile = new Set([0x400e, 0x400f, 0x4018, 0x4019, 0x401a, 0x401b, 0x401c, 0x4025, 0x4026, 0x4027, 0x4028, 0x4034, 0x4035, 0x4039, 0x403a]);
  const bytes: number[] = [];
  for (let a = 0x4009; a < 0x4009 + length; a++) bytes.push(volatile.has(a) ? -1 : s.peek(a));
  return bytes;
}

describe("ZX81 tape", () => {
  it("a fast load and a real-time load of the same file end with the same program in RAM", async () => {
    const file = Zx81TestSession.readProgram("basic/Characters.P");
    const fast = await createZx81Session();
    fast.bootToBasic();
    const fastFrames = fast.loadProgram(file, { fastLoad: true, autoRun: false });

    const slow = await createZx81Session();
    slow.bootToBasic();
    const slowFrames = slow.loadProgram(file, { fastLoad: false, autoRun: false, maxFrames: 3000 });

    // --- Real time: 1 s of leader, then about 21 ms a byte (8 bits of 4 or 9 300-us waves, a 1.3 ms gap)
    expect(slowFrames).toBeGreaterThan(1000);
    // --- Fast: the typing and 50 frames for the report, the load itself in a frame or two
    expect(fastFrames).toBeLessThan(150);
    expect(slow.wasm.zx8081TapeGetTraps()).toBe(0);
    // --- One trap a byte (the $80 name marker included), and one for NEXT-PROG's wait for silence
    expect(fast.wasm.zx8081TapeGetTraps()).toBe(file.tapeBytes.length + 1);
    const loaded = programBytes(fast, file.data.length);
    expect(programBytes(slow, file.data.length)).toEqual(loaded);
    // --- And it is the file's program up to its display file (the volatile system variables aside;
    // --- the ROM prints its report into the display file)
    const dfile = file.data[0x400c - 0x4009] | (file.data[0x400d - 0x4009] << 8);
    expect(loaded.slice(0, dfile - 0x4009).filter((b, i) => b !== -1 && b !== file.data[i])).toEqual([]);
  }, 60_000);

  it("auto-RUN types RUN when the ROM has finished the load", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    s.loadProgram(Zx81TestSession.readProgram("basic/Characters.P"));
    // --- The program runs (in FAST mode, as it was saved) and ends in its SAVE ($02F6)
    s.runTo(0x02f6, { maxFrames: 1000 });
  });

  it("the motor runs only while the ROM's LOAD routine does", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    s.insertProgram(Zx81TestSession.readProgram("basic/BASE.p"), { fastLoad: false });
    s.runFrames(100);
    // --- In the deck, play pressed, but the ROM is at the editor: the tape does not move
    expect(s.wasm.zx8081TapeGetMotor()).toBe(0);
    expect(s.wasm.zx8081TapeGetPulsePosition()).toBe(0);
    s.typeKeys('J""\n', { settle: 0 });
    s.runFrames(200);
    expect(s.wasm.zx8081TapeGetPulsePosition()).toBeGreaterThan(0);
  });

  it("loads the smallest program, and programs with bytes after E_LINE", async () => {
    for (const name of ["edge-cases/minimal.p", "basic/BASE.p", "basic/POKE1.p"]) {
      const s = await createZx81Session();
      s.bootToBasic();
      const file = Zx81TestSession.readProgram(name);
      s.loadProgram(file, { autoRun: false });
      // --- The BASIC program ($407D up to the display file) as the file has it; the ROM moves
      // --- E_LINE after the load, when it sets up the edit line
      const dfile = file.data[0x400c - 0x4009] | (file.data[0x400d - 0x4009] << 8);
      const program = [...file.data.subarray(0x407d - 0x4009, dfile - 0x4009)];
      expect(program.map((_, i) => s.peek(0x407d + i)), name).toEqual(program);
      expect(s.screenText()[23], name).toBe("0/0");
    }
  });

  it("loads 1K programs that keep code in the system variables on a 1K machine", async () => {
    for (const name of ["1k/byteForever.p", "1k/rcar.p"]) {
      const s = await createZx81Session({ model: "zx81-1k" });
      s.bootToBasic();
      const file = Zx81TestSession.readProgram(name);
      s.insertProgram(file);
      s.typeKeys('J""\n', { settle: 0 });
      s.runUntil(() => s.wasm.zx8081TapeGetFastPosition() >= file.tapeBytes.length, { maxFrames: 200 }, name);
      expect(s.wasm.zx8081TapeGetTraps(), name).toBe(file.tapeBytes.length + 1);
    }
  });
});
