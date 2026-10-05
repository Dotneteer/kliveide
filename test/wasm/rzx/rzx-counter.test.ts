import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * The RZX module's fetch counter, IN tap and playback interrupt rule (`.plans/RZX_PLAN.md` Phase 2,
 * D4, D7, D8, D9), on the shared Z80 core in a test-only translation unit (`rzx-counter-test.c`)
 * wired as the Spectrum cores wire it. The machine-level behaviour is covered by the harness tests.
 */

type Exports = Record<string, (...args: number[]) => number> & { memory: WebAssembly.Memory };
let x: Exports;
let mem: Uint8Array;

const OFF = 0;
const PLAY = 1;
const RECORD = 2;
const STATUS_OK = 0;
const FRAME_DONE = 1;
const DESYNC_OVER = 2;
const DESYNC_UNDER = 3;
const STEP_RUN = 1;
const STEP_RUN_INT = 2;
const STEP_BOUNDARY = 3;

function build(): Uint8Array {
  const root = resolve(__dirname, "../../..");
  const out = join(mkdtempSync(join(tmpdir(), "rzx-counter-")), "rzx-counter.wasm");
  const result = spawnSync(
    process.env.Z80_WASM_CC || "clang",
    [
      "--target=wasm32",
      "-std=c11",
      "-O2",
      "-ffreestanding",
      "-fno-builtin",
      "-nostdlib",
      "-Wl,--no-entry",
      "-Wl,--export-all",
      "-Wl,--export-memory",
      "-Wl,--initial-memory=1048576",
      "-Wl,--max-memory=1048576",
      resolve(__dirname, "rzx-counter-test.c"),
      "-o",
      out
    ],
    { cwd: root, encoding: "utf8" }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`RZX test TU build failed:\n${result.stderr}`);
  return readFileSync(out);
}

function reset(code: number[], at = 0x8000, mode = OFF): void {
  x.z80Reset();
  mem = new Uint8Array(x.memory.buffer, x.z80MemoryPtr(), 0x10000);
  mem.fill(0);
  code.forEach((b, i) => (mem[(at + i) & 0xffff] = b));
  x.z80SetPc(at);
  x.z80SetSp(0xff00);
  x.z80SetInterruptMode(1);
  x.testRzxSetMode(mode);
}

/** Runs one whole instruction (prefix bytes included). */
function step(): void {
  do {
    x.z80ExecuteCpuCycle();
  } while (x.z80GetPrefix() !== 0);
}

/** The fetches one instruction counts */
function fetchesOf(code: number[]): number {
  reset(code);
  step();
  return x.testRzxGetFetchCount();
}

function playFrame(fetchCount: number, ins: number[], raiseInt: boolean): void {
  new Uint8Array(x.memory.buffer, x.testRzxPlayBufferPtr(), ins.length).set(ins);
  x.testRzxSetPlayFrame(fetchCount, ins.length, raiseInt ? 1 : 0);
}

function recordedFrames(): Array<[number, number[]]> {
  const count = x.testRzxGetRecFrameCount();
  const table = new Uint32Array(x.memory.buffer, x.testRzxRecFrameTablePtr(), count * 2);
  const bytes = new Uint8Array(x.memory.buffer, x.testRzxRecBufferPtr(), x.testRzxGetRecByteCount());
  const frames: Array<[number, number[]]> = [];
  let offset = 0;
  for (let i = 0; i < count; i++) {
    frames.push([table[i * 2], Array.from(bytes.slice(offset, offset + table[i * 2 + 1]))]);
    offset += table[i * 2 + 1];
  }
  return frames;
}

beforeAll(async () => {
  const { instance } = (await WebAssembly.instantiate(build())) as unknown as WebAssembly.WebAssemblyInstantiatedSource;
  x = instance.exports as unknown as Exports;
});

describe("the fetch counter (D4)", () => {
  it("counts 1 for an unprefixed opcode", () => {
    expect(fetchesOf([0x00])).toBe(1);
    expect(fetchesOf([0x3e, 0x12])).toBe(1); // LD A,n: the operand is no fetch
  });

  it("counts 2 for CB, ED, DD and FD instructions", () => {
    expect(fetchesOf([0xcb, 0x00])).toBe(2);
    expect(fetchesOf([0xed, 0x44])).toBe(2);
    expect(fetchesOf([0xdd, 0x21, 0x00, 0x00])).toBe(2);
    expect(fetchesOf([0xfd, 0x21, 0x00, 0x00])).toBe(2);
  });

  it("counts 2 for DDCB/FDCB: the displacement and last byte are no fetches", () => {
    expect(fetchesOf([0xdd, 0xcb, 0x05, 0x06])).toBe(2);
    expect(fetchesOf([0xfd, 0xcb, 0x05, 0x46])).toBe(2);
  });

  it("counts 1 more for each chained DD/FD prefix", () => {
    expect(fetchesOf([0xdd, 0xdd, 0x21, 0x00, 0x00])).toBe(3);
    expect(fetchesOf([0xfd, 0xdd, 0x21, 0x00, 0x00])).toBe(3);
    expect(fetchesOf([0xdd, 0xfd, 0xdd, 0xcb, 0x01, 0x06])).toBe(4);
  });

  it("counts 1 for every HALTed cycle", () => {
    reset([0x76]);
    step();
    expect(x.testRzxGetFetchCount()).toBe(1);
    for (let i = 0; i < 5; i++) x.z80ExecuteCpuCycle();
    expect(x.z80GetHalted()).toBe(1);
    expect(x.testRzxGetFetchCount()).toBe(6);
  });

  it("does not count the INT acknowledge", () => {
    reset([0x00]);
    x.z80SetIff1(1);
    x.z80SetSigInt(1);
    x.z80ExecuteCpuCycle();
    x.z80SetSigInt(0);
    expect(x.z80GetPc()).toBe(0x0038);
    expect(x.testRzxGetFetchCount()).toBe(0);
  });

  it("counts the NMI acknowledge", () => {
    reset([0x00]);
    x.z80SetSigNmi(1);
    x.z80ExecuteCpuCycle();
    x.z80SetSigNmi(0);
    expect(x.z80GetPc()).toBe(0x0066);
    expect(x.testRzxGetFetchCount()).toBe(1);
  });

  it("is not R: LD R,A leaves it alone", () => {
    reset([0x3e, 0x7f, 0xed, 0x4f, 0x00]); // LD A,$7F; LD R,A; NOP
    step();
    step();
    step();
    expect(x.testRzxGetFetchCount()).toBe(4);
    expect(x.z80GetIr() & 0x7f).toBe(0); // R wrapped at 128, the counter did not
  });

  it("counts 2 for every INIR iteration", () => {
    reset([0x21, 0x00, 0x90, 0x01, 0xfe, 0x03, 0xed, 0xb2]); // LD HL,$9000; LD BC,$03FE; INIR
    step();
    step();
    const before = x.testRzxGetFetchCount();
    for (let i = 0; i < 3; i++) step();
    expect(x.z80GetBc() >> 8).toBe(0);
    expect(x.testRzxGetFetchCount() - before).toBe(6);
  });
});

describe("the IN tap (D7)", () => {
  // --- Every IN form: IN A,(n); IN r,(C); IN (C); INI; IND; INIR (2 iterations); INDR (2)
  const program = [
    0x01, 0xfe, 0x02, // LD BC,$02FE
    0x21, 0x00, 0x90, // LD HL,$9000
    0xdb, 0xfe, // IN A,(n)
    0xed, 0x78, // IN A,(C)
    0xed, 0x70, // IN (C)
    0xed, 0xa2, // INI
    0x06, 0x02, // LD B,2
    0xed, 0xaa, // IND
    0x06, 0x02, // LD B,2
    0xed, 0xb2, // INIR
    0x06, 0x02, // LD B,2
    0xed, 0xba // INDR
  ];
  const instructions = 12 + 2; // INIR and INDR run twice each

  it("records every IN form once, in order", () => {
    reset(program, 0x8000, RECORD);
    x.testSetLivePort(0x5a);
    for (let i = 0; i < instructions; i++) step();
    x.testRecordStep(0, 1); // a ULA frame end closes the frame
    const frames = recordedFrames();
    expect(frames.length).toBe(1);
    expect(frames[0][1]).toEqual(new Array(9).fill(0x5a));
  });

  it("does not record the debugger's port read", () => {
    reset([0x00], 0x8000, RECORD);
    x.testReadPort(0xfe);
    x.testRecordStep(0, 1);
    expect(recordedFrames()).toEqual([[1, []]]);
  });

  it("answers every IN from the recording while playing", () => {
    reset(program, 0x8000, PLAY);
    const ins = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    playFrame(1000, ins, false);
    const reads = x.testGetLivePortReads();
    for (let i = 0; i < instructions; i++) step();
    expect(x.testGetLivePortReads()).toBe(reads);
    expect(x.testRzxGetReadIndex()).toBe(9);
    expect(x.testRzxGetStatus()).toBe(STATUS_OK);
    // --- IN A,(n) then IN A,(C): A holds the second value
    expect(x.z80GetAf() >> 8).toBe(2);
  });

  it("reports an overrun and falls back to the live port", () => {
    reset([0xdb, 0xfe, 0xdb, 0xfe], 0x8000, PLAY);
    x.testSetLivePort(0x77);
    playFrame(100, [0x11], false);
    step();
    expect(x.z80GetAf() >> 8).toBe(0x11);
    step();
    expect(x.testRzxGetStatus()).toBe(DESYNC_OVER);
    expect(x.z80GetAf() >> 8).toBe(0x77);
  });
});

describe("playback frames (D8)", () => {
  it("ends a frame at its fetch count, at an instruction boundary", () => {
    reset([0x00, 0x00, 0xdd, 0x21, 0x00, 0x00, 0x00], 0x8000, PLAY);
    playFrame(3, [], false);
    expect(x.testPlayStep()).toBe(STEP_RUN); // NOP
    expect(x.testPlayStep()).toBe(STEP_RUN); // NOP
    expect(x.testPlayStep()).toBe(STEP_RUN); // DD prefix: the count is reached mid-instruction
    expect(x.testRzxGetFetchCount()).toBe(3);
    expect(x.testPlayStep()).toBe(STEP_RUN); // LD IX,nn completes it
    expect(x.testPlayStep()).toBe(STEP_BOUNDARY);
    expect(x.testRzxGetStatus()).toBe(FRAME_DONE);
    expect(x.z80GetPc()).toBe(0x8006);
  });

  it("reports unread INs at the frame end as an underrun", () => {
    reset([0x00, 0x00], 0x8000, PLAY);
    playFrame(2, [1, 2], false);
    x.testPlayStep();
    x.testPlayStep();
    expect(x.testPlayStep()).toBe(STEP_BOUNDARY);
    expect(x.testRzxGetStatus()).toBe(DESYNC_UNDER);
  });

  it("raises the interrupt for one step and accepts it with IFF1 set", () => {
    reset([0x00, 0x00], 0x8000, PLAY);
    x.z80SetIff1(1);
    playFrame(10, [], true);
    expect(x.testPlayStep()).toBe(STEP_RUN_INT);
    expect(x.z80GetPc()).toBe(0x0038);
    expect(x.testRzxGetFetchCount()).toBe(0);
  });

  it("under DI the frame just moves on, even a frame of 0 fetches", () => {
    reset([0x00, 0x00], 0x8000, PLAY);
    x.z80SetIff1(0);
    playFrame(0, [], true);
    expect(x.testPlayStep()).toBe(STEP_BOUNDARY);
    expect(x.testRzxGetStatus()).toBe(FRAME_DONE);
    expect(x.z80GetPc()).toBe(0x8000);
  });

  it("ignores a pending EI delay at a long frame's start", () => {
    reset([0xfb, 0x00, 0x00], 0x8000, PLAY);
    playFrame(1, [], false);
    x.testPlayStep(); // EI
    expect(x.testPlayStep()).toBe(STEP_BOUNDARY);
    playFrame(100, [], true);
    expect(x.testPlayStep()).toBe(STEP_RUN_INT);
    expect(x.z80GetPc()).toBe(0x0038);
  });

  it("keeps the EI delay when the next frame is an EI frame (4 fetches or fewer)", () => {
    reset([0xfb, 0x00, 0x00], 0x8000, PLAY);
    playFrame(1, [], false);
    x.testPlayStep(); // EI
    expect(x.testPlayStep()).toBe(STEP_BOUNDARY);
    playFrame(1, [], true);
    expect(x.testPlayStep()).toBe(STEP_RUN); // the NOP after EI, no interrupt yet
    expect(x.z80GetPc()).toBe(0x8002);
    expect(x.testPlayStep()).toBe(STEP_BOUNDARY);
    playFrame(100, [], true);
    expect(x.testPlayStep()).toBe(STEP_RUN_INT);
    expect(x.z80GetPc()).toBe(0x0038);
  });
});

describe("recording frames (D9)", () => {
  it("closes a frame at the ULA frame end, at the next instruction boundary", () => {
    reset([0x00, 0xdd, 0x21, 0x00, 0x00, 0x00], 0x8000, RECORD);
    x.testRecordStep(0, 0); // NOP
    x.testRecordStep(0, 1); // DD prefix: the ULA frame ends mid-instruction
    expect(x.testRzxGetRecFrameCount()).toBe(0);
    x.testRecordStep(0, 0); // LD IX,nn completes it: the frame closes
    expect(recordedFrames()).toEqual([[3, []]]);
  });

  it("closes a frame at an interrupt accepted after fetches (EI delay, retrigger)", () => {
    reset([0xfb, 0x00, 0x00], 0x8000, RECORD);
    x.testRecordStep(0, 1); // EI; the ULA frame ends
    x.testRecordStep(1, 0); // the NOP after EI: the interrupt waits
    x.testRecordStep(1, 0); // the interrupt is accepted after a fetch
    expect(x.z80GetPc()).toBe(0x0038);
    expect(recordedFrames()).toEqual([
      [1, []],
      [1, []]
    ]);
  });

  it("does not close a frame at an interrupt accepted right after the ULA frame end", () => {
    reset([0xfb, 0x00, 0x00, 0x00], 0x8000, RECORD);
    x.testRecordStep(0, 0); // EI
    x.testRecordStep(0, 0); // NOP
    x.testRecordStep(0, 1); // NOP; the ULA frame ends
    x.testRecordStep(1, 0); // the interrupt
    expect(x.z80GetPc()).toBe(0x0038);
    expect(recordedFrames()).toEqual([[3, []]]);
  });

  it("closes an empty frame when the interrupt comes first in a block", () => {
    reset([0x00], 0x8000, RECORD);
    x.z80SetIff1(1);
    x.testRecordStep(1, 0);
    expect(x.z80GetPc()).toBe(0x0038);
    expect(recordedFrames()).toEqual([[0, []]]);
  });

  it("keeps the open frame's INs when the closed frames are drained", () => {
    reset([0xdb, 0xfe, 0xdb, 0xfe, 0xdb, 0xfe], 0x8000, RECORD);
    x.testSetLivePort(0x31);
    x.testRecordStep(0, 1);
    x.testSetLivePort(0x32);
    x.testRecordStep(0, 0);
    expect(recordedFrames()).toEqual([[1, [0x31]]]);
    x.testRzxClearRec();
    x.testRecordStep(0, 1);
    expect(recordedFrames()).toEqual([[2, [0x32, 0x32]]]);
  });

  it("stops at an overflow, keeping the complete frames", () => {
    const cap = x.testRzxRecBufferCapacity();
    reset([0xed, 0xb2, 0x18, 0xfc], 0x8000, RECORD); // INIR; JR back: endless INs
    x.z80SetBc(0x00fe);
    x.testRecordStep(0, 0);
    x.testRecordStep(0, 1); // one frame closed with 2 INs
    let guard = 0;
    while (x.testRzxGetMode() === RECORD && guard++ < cap * 4) x.testRecordStep(0, 0);
    expect(x.testRzxGetOverflow()).toBe(1);
    expect(x.testRzxGetMode()).toBe(OFF);
    expect(x.testRzxGetRecFrameCount()).toBe(1);
  });
});
