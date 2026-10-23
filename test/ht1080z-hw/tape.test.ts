import { describe, expect, it } from "vitest";

import { createHtSession, Ht1080zTestSession } from "../harness/ht1080z";

/*
 * The Phase 6 tape tests (`.plans/HT1080Z_PLAN.md` §8-9, §13): real-time and fast loads of the same
 * tape end in the same RAM, SAVE round-trips through a `.cas`, `.cmd` and `.bas` files load and run,
 * and the tape moves only with the motor. Every program here is written for these tests (§12.3).
 */

/** `10 PRINT 42`, tokenised, as a `.bas` (FFh, then the lines; the link points at 42F2h) */
const PRINT_42_BAS = [0xff, 0xf2, 0x42, 0x0a, 0x00, 0xb2, 0x20, 0x34, 0x32, 0x00, 0x00, 0x00];

/** A `.cmd`: at 7000h `LD A,'H' / LD (3C00h),A / JR $`, with a module header and the transfer address */
const H_AT_7000_CMD = [
  0x05, 0x06, ...Array.from("HTEST ").map((c) => c.charCodeAt(0)),
  0x01, 0x09, 0x00, 0x70, 0x3e, 0x48, 0x32, 0x00, 0x3c, 0x18, 0xfe,
  0x02, 0x02, 0x00, 0x70
];

/** BASIC's program area and its end pointer (VARTAB) */
function program(s: Ht1080zTestSession): number[] {
  const end = s.peekWord(0x40f9);
  const bytes: number[] = [];
  for (let a = 0x42e9; a < end; a++) bytes.push(s.peek(a));
  return bytes;
}

/** Types a program and saves it with `CSAVE "A"`; returns the `.cas` the machine published */
async function savedProgram(): Promise<Uint8Array> {
  const s = (await createHtSession()).bootToPrompt();
  s.typeKeys('10 FOR I=1 TO 3\n20 PRINT I*7\n30 NEXT I\n');
  s.typeKeys('CSAVE "A"\n', { settle: 0 });
  s.runUntil(() => s.machine.getMachineProperty("SavedToTape") !== undefined, { maxFrames: 3000 }, "the save");
  const saved = s.takeSavedTape()!;
  expect(saved.name).toBe("A.cas");
  return saved.contents;
}

describe("HT-1080Z tape: SAVE", () => {
  it("captures CSAVE as a .cas: 255 zeros, A5h, D3h D3h D3h, the name, the program, 00 00", async () => {
    const cas = await savedProgram();
    expect(Array.from(cas.slice(0, 255)).every((b) => b === 0)).toBe(true);
    expect(Array.from(cas.slice(255, 260))).toEqual([0xa5, 0xd3, 0xd3, 0xd3, 0x41]);
    expect(Array.from(cas.slice(-2))).toEqual([0, 0]);
  });

  it("round-trips: the saved tape loads back on a new machine and runs", async () => {
    const cas = await savedProgram();
    const s = await createHtSession();
    s.loadTape(Ht1080zTestSession.tape(cas, "A.cas"));
    // --- The flow typed RUN once the load ended
    expect(s.lastLines(6)).toEqual([">RUN", " 7", " 14", " 21", "READY", ">_"]);
    s.typeKeys("LIST\n", { settle: 10 });
    expect(s.lastLines(5).slice(0, 3)).toEqual(["10 FOR I=1 TO 3", "20 PRINT I*7", "30 NEXT I"]);
  });
});

describe("HT-1080Z tape: real time and fast load", () => {
  it("end in the same program, pointers and screen; real time takes as long as the tape", async () => {
    const cas = await savedProgram();
    const results = [];
    for (const fastLoad of [true, false]) {
      const s = await createHtSession();
      const frames = s.loadTape(Ht1080zTestSession.tape(cas, "A.cas"), { fastLoad, maxFrames: 6000 });
      results.push({
        frames,
        traps: s.wasm.ht1080zTapeGetTraps(),
        program: program(s),
        pointers: [0x40a4, 0x40f9, 0x40fb, 0x40fd].map((a) => s.peekWord(a)),
        screen: s.screenText()
      });
    }
    const [fast, real] = results;
    expect(real.program).toEqual(fast.program);
    expect(real.pointers).toEqual(fast.pointers);
    expect(real.screen).toEqual(fast.screen);
    expect(fast.traps).toBeGreaterThan(0);
    expect(real.traps).toBe(0);
    // --- Both include the power-on and the typing; real time adds the tape itself, about 2.0 ms a
    // --- bit - 9.8 bits a frame - and fast load next to nothing
    const tapeFrames = (cas.length * 8) / 9.8;
    expect(real.frames - fast.frames).toBeGreaterThan(tapeFrames * 0.9);
    expect(real.frames - fast.frames).toBeLessThan(tapeFrames * 1.2);
  });

  it("the tape moves only while the recorder's motor runs, or F1 holds it on", async () => {
    const s = (await createHtSession()).bootToPrompt();
    s.insertTape(Ht1080zTestSession.tape(PRINT_42_BAS, "P.bas"), { fastLoad: false });
    s.runFrames(20);
    expect(s.wasm.ht1080zTapeGetBitPosition()).toBe(0);
    s.machine.setKeyStatus(65, true);
    s.machine.setKeyStatus(65, false);
    s.runFrames(10);
    const moved = s.wasm.ht1080zTapeGetBitPosition();
    expect(moved).toBeGreaterThan(90);
    s.machine.setKeyStatus(65, true);
    s.runFrames(10);
    expect(s.wasm.ht1080zTapeGetBitPosition()).toBe(moved);
  });
});

describe("HT-1080Z tape: files", () => {
  it("a .bas loads with CLOAD and runs", async () => {
    const s = await createHtSession();
    s.loadTape(Ht1080zTestSession.tape(PRINT_42_BAS, "P.bas"));
    expect(s.screenText().join("\n")).toContain(" 42");
    s.typeKeys("LIST\n", { settle: 10 });
    expect(s.lastLines(3)[0]).toBe("10 PRINT 42");
  });

  it("a .cmd loads with SYSTEM as a machine-code tape and starts at its transfer address", async () => {
    for (const fastLoad of [true, false]) {
      const s = await createHtSession();
      s.loadTape(Ht1080zTestSession.tape(H_AT_7000_CMD, "htest.cmd"), { fastLoad, maxFrames: 6000 });
      expect(s.peek(0x7000), `fast ${fastLoad}`).toBe(0x3e);
      expect(s.machine.pc, `fast ${fastLoad}`).toBe(0x7005);
      expect(s.screenCode(0, 0), `fast ${fastLoad}`).toBe(0x48);
    }
  });

  it("the /64 loads tapes too", async () => {
    const s = await createHtSession({ model: "ht1080z-64" });
    s.loadTape(Ht1080zTestSession.tape(PRINT_42_BAS, "P.bas"));
    expect(s.screenText().join("\n")).toContain(" 42");
  });
});
