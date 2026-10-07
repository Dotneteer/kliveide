import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BinaryReader } from "@common/utils/BinaryReader";
import { TapReader } from "@emu/machines/tape/TapReader";
import { sp48TapeLoadFlow } from "@emu/machines/tapeLoadFlows";
import { parseRzxFile } from "@common/spectrum/rzx/rzxFile";
import { writeRzxFile } from "@common/spectrum/rzx/rzxWriter";
import { rzxSegments } from "@common/spectrum/rzx/rzxSegments";
import type { RzxFrame, RzxInputBlock } from "@common/spectrum/rzx/rzxModel";
import { HistoryKind } from "@common/history/historyRecord";
import { createSp48Session, type Sp48TestSession } from "../../harness/sp48";

/*
 * The RZX determinism proof on the 48K (`.plans/RZX_PLAN.md` Phase 3, §1.3): a session recorded on
 * the real core plays back to the identical machine state - RAM and registers at every 50th frame
 * and at the end - whatever keys are held during playback. Then the desync checks.
 *
 * The sessions are Klive's own: the ROM booting and typing, a real-speed tape load of the floating
 * bus test program already used by `test/tape/tape-load-flow.test.ts` (the fast-load trap is on, and
 * must stay out of the way, trap 3), and a program of our own with a DI stretch that polls the
 * keyboard and the floating bus, an EI/HALT loop, and an IM 2 handler short enough to retrigger.
 */

const FLOAT_SPY = new Uint8Array(readFileSync(join(__dirname, "../../testfiles/floatspy.tap")));

function tapBlocks(bytes: Uint8Array) {
  const reader = new TapReader(new BinaryReader(bytes));
  expect(reader.readContent()).toBeNull();
  return reader.dataBlocks;
}

/** RAM and registers, as a short hash; undefined inside a prefixed instruction */
function fingerprint(s: Sp48TestSession): string | undefined {
  const w = s.machine.wasmV2Runtime!.exports;
  if (w.sp48GetCpuPrefix() !== 0) return undefined;
  const regs = [
    w.sp48GetCpuAf(), w.sp48GetCpuBc(), w.sp48GetCpuDe(), w.sp48GetCpuHl(),
    w.sp48GetCpuAfAlt(), w.sp48GetCpuBcAlt(), w.sp48GetCpuDeAlt(), w.sp48GetCpuHlAlt(),
    w.sp48GetCpuIx(), w.sp48GetCpuIy(), w.sp48GetCpuSp(), w.sp48GetCpuPc(),
    w.sp48GetCpuIr() & 0xff00, w.sp48GetCpuIff1(), w.sp48GetCpuInterruptMode(), w.sp48GetCpuHalted()
  ];
  let h = 0x811c9dc5;
  const mix = (v: number) => {
    h ^= v & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  const ram = s.machine.wasmV2Runtime!.memory;
  for (let i = 0x4000; i < 0x10000; i++) mix(ram[i]);
  for (const r of regs) {
    mix(r);
    mix(r >> 8);
  }
  return `${h.toString(16)}:${regs.map((r) => r.toString(16)).join(",")}`;
}

type Recording = {
  bytes: Uint8Array;
  samples: Map<number, string>;
  final?: string;
  frames: number;
};

/**
 * Starts recording, and returns a function that runs whole frames sampling the state every 50th
 * frame, counted from the recording's start (a playback counts from there too)
 */
function startRecording(s: Sp48TestSession, samples: Map<number, string>) {
  const start = s.frames;
  s.startRzxRecording({ autosaveFrames: 0 });
  const run = (count: number) => {
    for (let i = 0; i < count; i++) {
      s.runFrames(1);
      const frame = s.frames - start;
      if (frame % 50 === 0) {
        const fp = fingerprint(s);
        if (fp) samples.set(frame, fp);
      }
    }
  };
  return { run, start };
}

function finish(s: Sp48TestSession, samples: Map<number, string>, start: number): Recording {
  const final = fingerprint(s);
  const frames = s.frames - start;
  return { bytes: s.stopRzxRecording(), samples, final, frames };
}

/** Plays a recording on a fresh machine, comparing its samples */
async function replay(rec: Recording, holdKeys: string[] = [], recordHistory = false) {
  const s = await createSp48Session();
  s.recordHistory(recordHistory);
  s.keyDown(...holdKeys);
  s.playRzx(rec.bytes);
  const seen = new Map<number, string>();
  const stop = s.runRzx({
    onFrame: () => {
      if (rec.samples.has(s.frames)) seen.set(s.frames, fingerprint(s) ?? "prefix");
    }
  });
  return { s, stop, seen };
}

function expectSameRun(rec: Recording, run: Awaited<ReturnType<typeof replay>>) {
  expect(run.stop.kind).toBe("ended");
  expect(run.s.frames).toBe(rec.frames);
  expect(rec.samples.size).toBeGreaterThan(3);
  for (const [frame, fp] of rec.samples) {
    expect(run.seen.get(frame), `state at frame ${frame}`).toBe(fp);
  }
  if (rec.final) expect(fingerprint(run.s)).toBe(rec.final);
}

/** The frames of a finalised recording */
function framesOf(bytes: Uint8Array): RzxFrame[] {
  return rzxSegments(parseRzxFile(bytes)).flatMap((seg) => seg.inputs.flatMap((b) => b.frames));
}

async function recordBootTypeAndTapeLoad(): Promise<Recording> {
  const s = await createSp48Session();
  // --- The deck is loaded, and fast load is ON: recording must load at real speed anyway (trap 3)
  s.insertTape(tapBlocks(FLOAT_SPY), { fastLoad: true });
  const samples = new Map<number, string>();
  const { run, start } = startRecording(s, samples);

  // --- Boot (through the debug loop: runTo), then type LOAD "" and let the ROM load the tape
  s.bootToBasic();
  s.typeFlowKeys(sp48TapeLoadFlow(), { gap: 8 });
  let shown = false;
  for (let i = 0; i < 400 && !shown; i++) {
    run(10);
    shown = (s.screenLine(8) ?? "").includes("FLOATING BUS test program");
  }
  expect(shown).toBe(true);
  // --- The program reads the floating bus; press a few keys while it runs
  run(30);
  s.keyDown("Space");
  run(10);
  s.keyUp("Space");
  run(40);
  return finish(s, samples, start);
}

const RETRIGGER_PROGRAM = `
    .org $8000
Main:
    di
    ld sp,$ff00
    ld a,$90
    ld i,a
    im 2
    ld hl,$9000          ; the vector table: every vector is $9191
    ld (hl),$91
    ld de,$9001
    ld bc,$0100
    ldir
    ld hl,$9191          ; the handler: EI; NOP; RET - short enough to be retriggered
    ld (hl),$fb
    inc hl
    ld (hl),$00
    inc hl
    ld (hl),$c9
Loop:
    di                   ; a DI stretch of a few frames: the keyboard and the floating bus
    ld d,8
Outer:
    ld b,0
Poll:
    ld a,$fe
    in a,($fe)
    ld c,a
    in a,($ff)
    xor c
    ld hl,(Acc)
    add a,l
    ld l,a
    adc a,h
    sub l
    ld h,a
    ld (Acc),hl
    djnz Poll
    dec d
    jr nz,Outer
    ei                   ; then an EI; HALT loop
    ld b,30
Wait:
    halt
    ld a,$7f
    in a,($fe)
    ld (Keys),a
    djnz Wait
    jr Loop
Acc:
    .defw 0
Keys:
    .defb 0
`;

async function recordRetriggerProgram(): Promise<Recording> {
  const s = await createSp48Session();
  s.bootToBasic();
  const program = await s.loadCode(RETRIGGER_PROGRAM);
  s.machine.pc = program.symbol("Main");
  const samples = new Map<number, string>();
  const { run, start } = startRecording(s, samples);
  run(60);
  s.keyDown("A");
  run(25);
  s.keyUp("A");
  s.keyDown("Enter", "P");
  run(15);
  s.keyUp("Enter", "P");
  run(150);
  return finish(s, samples, start);
}

describe("RZX round trip on the 48K (the determinism proof)", () => {
  let bootRec: Recording;
  let retriggerRec: Recording;

  it("records booting, typing and a real-speed tape load, and plays it back identically", async () => {
    bootRec = await recordBootTypeAndTapeLoad();
    expect(framesOf(bootRec.bytes).length).toBeGreaterThanOrEqual(bootRec.frames);
    expectSameRun(bootRec, await replay(bootRec));
  }, 120_000);

  it("plays the same file identically with other keys held", async () => {
    expectSameRun(bootRec, await replay(bootRec, ["N1", "Q", "Enter"]));
  }, 120_000);

  it("records a DI stretch, EI/HALT and a retriggered interrupt, and plays them back identically", async () => {
    retriggerRec = await recordRetriggerProgram();
    const frames = framesOf(retriggerRec.bytes);
    // --- Retriggers made short frames, which complete no picture (D19)
    expect(frames.some((f) => f.fetchCount <= 4)).toBe(true);
    expect(frames.filter((f) => f.fetchCount > 4).length).toBe(retriggerRec.frames);
    expectSameRun(retriggerRec, await replay(retriggerRec, ["Space"]));
  }, 120_000);

  /*
   * Playback records execution history (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` D8, T9): a desync
   * stop is where "how did I get here?" matters. The recorder only reads the CPU, so it cannot disturb
   * the replaced IN values or the fetch count that places the interrupts.
   */
  it("plays back identically while recording execution history, and records the playback (T9)", async () => {
    const run = await replay(retriggerRec, ["Space"], true);
    expectSameRun(retriggerRec, run);
    const records = run.s.history();
    expect(records.length).toBe(run.s.historyInfo().capacity);
    expect(records.some((r) => r.kind === HistoryKind.Int)).toBe(true);
    expect(records.some((r) => r.kind === HistoryKind.Halt)).toBe(true);
    expect(records.at(-1)!.frame).toBeGreaterThan(0);
  }, 120_000);

  it("pauses at the frame that lacks an IN", async () => {
    const { bytes, index } = withFrameChange(retriggerRec.bytes, (f) => ({ ...f, ins: f.ins.slice(0, -1) }));
    const run = await replay({ ...retriggerRec, bytes, samples: new Map() });
    expect(run.stop.kind).toBe("desync");
    expect(run.stop.frame).toBe(index + 1);
    expect(run.stop.message).toMatch(new RegExp(`desynced at frame ${index + 1} of .*read more than`));
  }, 120_000);

  it("pauses at the frame that has an IN too many", async () => {
    const { bytes, index, frame } = withFrameChange(retriggerRec.bytes, (f) => ({
      ...f,
      ins: Uint8Array.from([...f.ins, 0xff])
    }));
    const run = await replay({ ...retriggerRec, bytes, samples: new Map() });
    expect(run.stop.kind).toBe("desync");
    expect(run.stop.frame).toBe(index + 1);
    expect(run.stop.message).toContain(`the program read ${frame.ins.length - 1} IN values where the recording has ${frame.ins.length}`);
  }, 120_000);
});

/** Changes the first frame with INs after frame 100 */
function withFrameChange(bytes: Uint8Array, change: (f: RzxFrame) => RzxFrame) {
  const file = parseRzxFile(bytes);
  const input = file.blocks.find((b) => b.kind === "input") as RzxInputBlock;
  const index = input.frames.findIndex((f, i) => i > 100 && f.ins.length > 0);
  input.frames[index] = change(input.frames[index]);
  return { bytes: writeRzxFile(file), index, frame: input.frames[index] };
}
