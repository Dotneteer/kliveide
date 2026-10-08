import { describe, expect, it } from "vitest";

import { HistoryKind, type HistoryRecord } from "@common/history/historyRecord";
import { findServiceSpans } from "@common/history/serviceSpans";
import {
  arrayHistorySource,
  historicalCallStack,
  PagedHistorySource,
  reverseContinue,
  stepBack,
  stepBackOut,
  stepBackOver,
  stepForward,
  type HistoryWalkSource
} from "@common/history/reverseStep";

/*
 * G4.3's walkers (`.plans/LITE_STEP_BACK_PLAN.md` §4.2, §6.1) over hand-built records. A trace is
 * written as the program ran it - one entry per record, each with the PC and SP *before* it ran and
 * its bytes - so every fixture reads like the disassembly it stands for.
 */

type Step = { pc: number; sp?: number; bytes?: number[]; kind?: HistoryRecord["kind"]; repeat?: number };

/** Builds consecutive records from 1 on; each step's SP defaults to the previous one's */
function trace(steps: Step[]): HistoryRecord[] {
  let sp = 0xff00;
  return steps.map((step, i) => {
    sp = step.sp ?? sp;
    return {
      sequence: i + 1,
      frame: 1,
      frameTact: i * 4,
      kind: step.kind ?? HistoryKind.Instruction,
      repeat: step.repeat ?? 1,
      intPending: false,
      bytesTruncated: false,
      regs: {
        pc: step.pc,
        af: 0,
        bc: 0,
        de: 0,
        hl: 0,
        af_: 0,
        bc_: 0,
        de_: 0,
        hl_: 0,
        ix: 0,
        iy: 0,
        sp,
        ir: 0,
        wz: 0,
        iff1: true,
        iff2: true,
        interruptMode: 1
      },
      bytes: [...(step.bytes ?? [0x00]), 0, 0, 0].slice(0, 4),
      context: new Uint8Array(16)
    };
  });
}

const NOP = [0x00];
const CALL = (addr: number) => [0xcd, addr & 0xff, addr >> 8];
const CALL_Z = (addr: number) => [0xcc, addr & 0xff, addr >> 8];
const RET = [0xc9];
const RET_Z = [0xc8];
const RETI = [0xed, 0x4d];
const RST38 = [0xff];
const PUSH_HL = [0xe5];
const POP_HL = [0xe1];
const EX_SP_HL = [0xe3];
const JP_HL = [0xe9];
const HALT = [0x76];

function source(steps: Step[], live: { pc: number; sp?: number }): HistoryWalkSource {
  const records = trace(steps);
  return arrayHistorySource(records, { pc: live.pc, sp: live.sp ?? records[records.length - 1].regs.sp });
}

/** A main program calling $9000, which calls $9100 */
const NESTED: Step[] = [
  { pc: 0x8000, bytes: NOP }, //                       1
  { pc: 0x8001, bytes: CALL(0x9000) }, //              2  depth 0
  { pc: 0x9000, sp: 0xfefe, bytes: NOP }, //           3  depth 1
  { pc: 0x9001, bytes: CALL(0x9100) }, //              4
  { pc: 0x9100, sp: 0xfefc, bytes: NOP }, //           5  depth 2
  { pc: 0x9101, bytes: RET }, //                       6
  { pc: 0x9004, sp: 0xfefe, bytes: NOP }, //           7  depth 1
  { pc: 0x9005, bytes: RET }, //                       8
  { pc: 0x8004, sp: 0xff00, bytes: NOP } //            9  depth 0
];

describe("Step Back and Step Forward", () => {
  it("steps back one record at a time from the present, and forward to the present again", () => {
    const src = source(NESTED, { pc: 0x8005 });
    expect(stepBack(src, null)).toEqual({ position: 9, moved: true });
    expect(stepBack(src, 9)).toEqual({ position: 8, moved: true });
    expect(stepForward(src, 8)).toEqual({ position: 9, moved: true });
    expect(stepForward(src, 9)).toEqual({ position: null, moved: true });
    expect(stepForward(src, null)).toMatchObject({ position: null, moved: false, reason: "present" });
  });

  it("stops at the start of recorded history and never wraps (T7)", () => {
    const src = source(NESTED, { pc: 0x8005 });
    expect(stepBack(src, 1)).toEqual({ position: 1, moved: false, reason: "start" });
    expect(stepBack(arrayHistorySource([], { pc: 0, sp: 0 }), null)).toMatchObject({ moved: false, reason: "empty" });
  });

  it("lands on the interrupted instruction when stepping back from an ISR's first instruction (D8)", () => {
    const src = source(
      [
        { pc: 0x8000, bytes: NOP },
        { pc: 0x8001, kind: HistoryKind.Int, bytes: [0xff] },
        { pc: 0x0038, sp: 0xfefe, bytes: NOP },
        { pc: 0x0039, bytes: RETI },
        { pc: 0x8001, sp: 0xff00, bytes: NOP }
      ],
      { pc: 0x8002 }
    );
    expect(stepBack(src, 3)).toEqual({ position: 1, moved: true });
    expect(stepForward(src, 1)).toEqual({ position: 3, moved: true });
  });

  it("treats a coalesced HALT as one stop, and skips forced NOPs and DMA holds", () => {
    const src = source(
      [
        { pc: 0x8000, bytes: NOP },
        { pc: 0x8001, kind: HistoryKind.Halt, bytes: HALT, repeat: 1203 },
        { pc: 0x8002, kind: HistoryKind.ForcedNop, repeat: 32 },
        { pc: 0x8002, kind: HistoryKind.DmaHold, repeat: 12 },
        { pc: 0x8002, bytes: NOP }
      ],
      { pc: 0x8003 }
    );
    expect(stepBack(src, 5)).toEqual({ position: 2, moved: true });
    expect(stepForward(src, 2)).toEqual({ position: 5, moved: true });
  });

  it("passes over a whole interrupt service when the services are folded (D8, the ZX81's NMIs)", () => {
    const records = trace([
      { pc: 0x8000, bytes: NOP }, //                                  1
      { pc: 0x8001, kind: HistoryKind.Nmi }, //                       2
      { pc: 0x0066, sp: 0xfefe, bytes: NOP }, //                      3
      { pc: 0x0067, bytes: POP_HL }, //                               4
      { pc: 0x0068, sp: 0xff00, bytes: JP_HL }, //                    5  leaves through JP (HL)
      { pc: 0x8001, bytes: NOP } //                                   6
    ]);
    const src = arrayHistorySource(records, { pc: 0x8002, sp: 0xff00 });
    const services = findServiceSpans(records);
    expect(services).toHaveLength(1);
    expect(stepBack(src, 6, { services, foldServices: true })).toEqual({ position: 1, moved: true });
    expect(stepForward(src, 1, { services, foldServices: true })).toEqual({ position: 6, moved: true });
    // --- Unfolded, the service's own instructions are stops
    expect(stepBack(src, 6, { services })).toEqual({ position: 5, moved: true });
    // --- A position inside the service still steps through it
    expect(stepBack(src, 5, { services, foldServices: true })).toEqual({ position: 4, moved: true });
  });
});

describe("Reverse Step Over", () => {
  it("is Step Back for an ordinary instruction", () => {
    const src = source(NESTED, { pc: 0x8005 });
    expect(stepBackOver(src, 3)).toEqual({ position: 2, moved: true });
  });

  it("walks back past a returned call to the CALL itself, nested calls included", () => {
    const src = source(NESTED, { pc: 0x8005 });
    expect(stepBackOver(src, 9)).toEqual({ position: 2, moved: true });
    expect(stepBackOver(src, 7)).toEqual({ position: 4, moved: true });
  });

  it("steps over an RST like a call", () => {
    const src = source(
      [
        { pc: 0x8000, bytes: RST38 },
        { pc: 0x0038, sp: 0xfefe, bytes: RET },
        { pc: 0x8001, sp: 0xff00, bytes: NOP }
      ],
      { pc: 0x8002 }
    );
    expect(stepBackOver(src, 3)).toEqual({ position: 1, moved: true });
  });

  it("steps back over a not-taken RET Z as an ordinary instruction (T4)", () => {
    const src = source(
      [
        { pc: 0x8000, bytes: CALL(0x9000) },
        { pc: 0x9000, sp: 0xfefe, bytes: RET_Z }, //    not taken: the next PC is $9001
        { pc: 0x9001, bytes: NOP },
        { pc: 0x9002, bytes: RET_Z }, //                taken
        { pc: 0x8003, sp: 0xff00, bytes: NOP }
      ],
      { pc: 0x8004 }
    );
    expect(stepBackOver(src, 3)).toEqual({ position: 2, moved: true });
    expect(stepBackOver(src, 5)).toEqual({ position: 1, moved: true });
  });

  it("treats a not-taken CALL Z as an ordinary instruction", () => {
    const src = source(
      [
        { pc: 0x8000, bytes: CALL_Z(0x9000) },
        { pc: 0x8003, bytes: NOP }
      ],
      { pc: 0x8004 }
    );
    expect(stepBackOver(src, 2)).toEqual({ position: 1, moved: true });
    expect(stepBackOut(src, 2)).toMatchObject({ moved: true, position: 1, reason: "noCall" });
  });

  it("is not fooled by PUSH/POP and EX (SP),HL inside the routine (T3)", () => {
    const src = source(
      [
        { pc: 0x8000, bytes: CALL(0x9000) },
        { pc: 0x9000, sp: 0xfefe, bytes: PUSH_HL },
        { pc: 0x9001, sp: 0xfefc, bytes: EX_SP_HL },
        { pc: 0x9002, bytes: POP_HL },
        { pc: 0x9003, sp: 0xfefe, bytes: RET },
        { pc: 0x8003, sp: 0xff00, bytes: NOP }
      ],
      { pc: 0x8004 }
    );
    expect(stepBackOver(src, 6)).toEqual({ position: 1, moved: true });
    expect(stepBackOut(src, 4)).toEqual({ position: 1, moved: true });
  });

  it("says the pairing is uncertain when SP disagrees with it (a POP + JP (HL) return)", () => {
    const src = source(
      [
        { pc: 0x8000, bytes: CALL(0x9000) }, //          1  never returns with RET
        { pc: 0x9000, sp: 0xfefe, bytes: POP_HL }, //    2
        { pc: 0x9001, sp: 0xff00, bytes: JP_HL }, //     3
        { pc: 0x8003, bytes: CALL(0x9100) }, //          4
        { pc: 0x9100, sp: 0xfefe, bytes: RET }, //       5
        { pc: 0x8006, sp: 0xff00, bytes: NOP } //        6
      ],
      { pc: 0x8007 }
    );
    // --- The JP (HL) return is not a return: stepping over from after it is a plain step
    expect(stepBackOver(src, 4)).toEqual({ position: 3, moved: true });
    // --- The RET pairs with the CALL at 4 and SP agrees
    expect(stepBackOver(src, 6)).toEqual({ position: 4, moved: true });
    // --- An unbalanced trace: a RET whose SP does not match the call it pairs with
    const odd = source(
      [
        { pc: 0x8000, bytes: CALL(0x9000) },
        { pc: 0x9000, sp: 0xfefe, bytes: PUSH_HL },
        { pc: 0x9001, sp: 0xfefc, bytes: RET }, //   returns to the pushed HL, two bytes too high
        { pc: 0x1234, sp: 0xfefe, bytes: NOP }
      ],
      { pc: 0x1235 }
    );
    expect(stepBackOver(odd, 4)).toEqual({ position: 1, moved: true, uncertain: true });
  });

  it("returns to the interrupted instruction from after an ISR's RETI (T8)", () => {
    const records = trace([
      { pc: 0x8000, bytes: NOP }, //                        1
      { pc: 0x8001, kind: HistoryKind.Int, bytes: [0xff] }, // 2
      { pc: 0x0038, sp: 0xfefe, bytes: CALL(0x0100) }, //   3
      { pc: 0x0100, sp: 0xfefc, bytes: RET }, //            4
      { pc: 0x003b, sp: 0xfefe, bytes: RETI }, //           5
      { pc: 0x8001, sp: 0xff00, bytes: NOP } //             6
    ]);
    const src = arrayHistorySource(records, { pc: 0x8002, sp: 0xff00 });
    const services = findServiceSpans(records);
    expect(stepBackOver(src, 6, { services })).toEqual({ position: 1, moved: true });
    // --- Without the spans the INT is the "call" the RETI pairs with
    expect(stepBackOver(src, 6)).toEqual({ position: 1, moved: true });
  });

  it("passes over an interrupt taken inside the stepped-over call (T8)", () => {
    const records = trace([
      { pc: 0x8000, bytes: CALL(0x9000) }, //                1
      { pc: 0x9000, sp: 0xfefe, bytes: NOP }, //             2
      { pc: 0x9001, kind: HistoryKind.Int, bytes: [0xff] }, // 3
      { pc: 0x0038, sp: 0xfefc, bytes: RET }, //             4  an ISR that ends with RET
      { pc: 0x9001, sp: 0xfefe, bytes: RET }, //             5
      { pc: 0x8003, sp: 0xff00, bytes: NOP } //              6
    ]);
    const src = arrayHistorySource(records, { pc: 0x8004, sp: 0xff00 });
    expect(stepBackOver(src, 6, { services: findServiceSpans(records) })).toEqual({ position: 1, moved: true });
    expect(stepBackOver(src, 6)).toEqual({ position: 1, moved: true });
  });

  it("stops at the start of recorded history when the call is older than the ring (T7)", () => {
    const src = source(NESTED.slice(2), { pc: 0x8005 });
    // --- Sequences 1..7 now: the RET at 6 pairs with nothing held
    expect(stepBackOver(src, 7)).toEqual({ position: 1, moved: true, reason: "start" });
  });
});

describe("Reverse Step Out", () => {
  it("walks back to the call that entered the current routine", () => {
    const src = source(NESTED, { pc: 0x8005 });
    expect(stepBackOut(src, 5)).toEqual({ position: 4, moved: true });
    expect(stepBackOut(src, 7)).toEqual({ position: 2, moved: true });
    expect(stepBackOut(src, 3)).toEqual({ position: 2, moved: true });
  });

  it("leaves an ISR for the interrupted instruction, the NMI included (T8)", () => {
    const records = trace([
      { pc: 0x8000, bytes: NOP }, //                     1
      { pc: 0x8001, kind: HistoryKind.Nmi }, //          2
      { pc: 0x0066, sp: 0xfefe, bytes: NOP }, //         3
      { pc: 0x0067, bytes: NOP } //                      4
    ]);
    const src = arrayHistorySource(records, { pc: 0x0068, sp: 0xfefe });
    expect(stepBackOut(src, null, { services: findServiceSpans(records) })).toEqual({ position: 1, moved: true });
  });

  it("stops at the oldest record when no call entered the routine (T7)", () => {
    const src = source(NESTED.slice(2), { pc: 0x8005 });
    expect(stepBackOut(src, 7)).toEqual({ position: 1, moved: true, reason: "noCall" });
  });
});

describe("Reverse Continue", () => {
  it("finds the most recent earlier hit, not the position itself", () => {
    const src = source(NESTED, { pc: 0x8005 });
    const at = (address: number) => (r: HistoryRecord) => r.regs.pc === address;
    expect(reverseContinue(src, null, at(0x9001))).toEqual({ position: 4, moved: true });
    expect(reverseContinue(src, 4, at(0x9001))).toEqual({ position: 1, moved: true, reason: "noHit" });
    expect(reverseContinue(src, 1, at(0x9001))).toEqual({ position: 1, moved: false, reason: "noHit" });
  });
});

describe("the historical call stack (D10)", () => {
  it("lists the active calls, innermost first, with their return addresses", () => {
    const src = source(NESTED, { pc: 0x8005 });
    const stack = historicalCallStack(src, 5);
    expect(stack.frames.map((f) => [f.sequence, f.kind, f.callSite, f.returnAddress])).toEqual([
      [4, "call", 0x9001, 0x9004],
      [2, "call", 0x8001, 0x8004]
    ]);
    expect(stack.incomplete).toBe(true);
    expect(historicalCallStack(src, null).frames).toEqual([]);
    expect(historicalCallStack(src, 7).frames.map((f) => f.sequence)).toEqual([2]);
  });

  it("shows an interrupt as a frame returning to the interrupted address", () => {
    const records = trace([
      { pc: 0x8000, bytes: CALL(0x9000) },
      { pc: 0x9000, sp: 0xfefe, kind: HistoryKind.Int, bytes: [0xff] },
      { pc: 0x0038, sp: 0xfefc, bytes: NOP }
    ]);
    const src = arrayHistorySource(records, { pc: 0x0039, sp: 0xfefc });
    expect(historicalCallStack(src, null).frames.map((f) => [f.kind, f.returnAddress])).toEqual([
      ["int", 0x9000],
      ["call", 0x8003]
    ]);
  });
});

describe("PagedHistorySource", () => {
  it("reads pages once and answers by sequence", () => {
    const records = trace(NESTED);
    let reads = 0;
    const src = new PagedHistorySource(1, records.length, 0x8005, 0xff00, (from, count) => {
      reads++;
      return records.slice(from - 1, from - 1 + count);
    }, 4);
    expect(stepBackOver(src, 9)).toEqual({ position: 2, moved: true });
    expect(src.record(9)?.regs.pc).toBe(0x8004);
    expect(src.record(10)).toBeUndefined();
    expect(reads).toBe(3);
  });
});

describe("statement-level stepping back (D12, T10)", () => {
  /*
   * A BASIC-like trace: statement 10 at $8000 calls a runtime routine at $9000 (no statements),
   * statement 20 at $8010 calls procedure P ($A000 entry, $A008 second statement), statement 30.
   */
  const records = trace([
    { pc: 0x8000, bytes: NOP }, //                       1  stmt 10
    { pc: 0x8001, bytes: CALL(0x9000) }, //              2
    { pc: 0x9000, sp: 0xfefe, bytes: NOP }, //           3  runtime
    { pc: 0x9001, bytes: RET }, //                       4
    { pc: 0x8004, sp: 0xff00, bytes: NOP }, //           5
    { pc: 0x8010, bytes: CALL(0xa000) }, //              6  stmt 20
    { pc: 0xa000, sp: 0xfefe, bytes: NOP }, //           7  P stmt 1
    { pc: 0xa008, bytes: NOP }, //                       8  P stmt 2
    { pc: 0xa009, bytes: RET }, //                       9
    { pc: 0x8013, sp: 0xff00, bytes: NOP }, //           10
    { pc: 0x8020, bytes: NOP } //                        11 stmt 30
  ]);
  const entries = new Set([0x8000, 0x8010, 0x8020, 0xa000, 0xa008]);
  const isStop = (r: HistoryRecord) => r.kind === HistoryKind.Instruction && entries.has(r.regs.pc);
  const src = arrayHistorySource(records, { pc: 0x8021, sp: 0xff00 });

  it("steps back to the start of the previous statement that ran, into procedures", () => {
    expect(stepBack(src, 11, { isStop })).toEqual({ position: 8, moved: true });
    expect(stepBack(src, 8, { isStop })).toEqual({ position: 7, moved: true });
    expect(stepBack(src, 7, { isStop })).toEqual({ position: 6, moved: true });
    // --- The runtime routine has no statements: straight back to statement 10
    expect(stepBack(src, 6, { isStop })).toEqual({ position: 1, moved: true });
    expect(stepForward(src, 1, { isStop })).toEqual({ position: 6, moved: true });
  });

  it("steps back over a procedure call, and out of a procedure to its calling statement", () => {
    expect(stepBackOver(src, 11, { isStop })).toEqual({ position: 6, moved: true });
    expect(stepBackOut(src, 8, { isStop })).toEqual({ position: 6, moved: true });
  });
});
