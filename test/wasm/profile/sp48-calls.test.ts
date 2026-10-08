import { beforeAll, describe, expect, it } from "vitest";
import {
  PROFILE_KEY_INT,
  PROFILE_KEY_ROOT,
  type ProfileEdge
} from "@common/profile/profileTypes";
import { createSp48Session, type Sp48TestSession } from "../../harness/sp48";

/*
 * The call tracker on the ZX Spectrum 48K (`.plans/PROFILER_PLAN.md` Phase 2, D9-D12, traps T1-T5):
 * known programs give exact inclusive and exclusive times per edge. $8000 and up is uncontended, so
 * every instruction's time is its documented T-state count.
 *
 * `s.call` enters a routine the way USR does - a pushed return address, not a CALL - so the routine
 * under test runs at the root and its final RET closes nothing (T5).
 */

const PROGRAM = `
        .org $8000
; --- Nested calls: A twice, each calling B
Nested: di
        call RA
        call RA
        ret
RA:     nop
        call RB
        ret
RB:     nop
        nop
        ret

; --- T1: PUSH HL / RET is a computed jump, not a return
Dispatch:
        di
        call Disp
        ret
Disp:   ld hl,Target
        push hl
        ret
Target: ret

; --- D12: recursion counts inclusive time once
Recurse:
        di
        ld b,3
        call Rec
        ret
Rec:    dec b
        call nz,Rec
        ret

; --- D10: a stack switch flushes the stack
Switch: di
        call Sw
        ret
Sw:     ld (SavedSp),sp
        ld sp,$7000
        call RB
        ld sp,(SavedSp)
        ret

; --- T2: an unwinder (LD SP,(ERR_SP) then RET) closes every frame below in one RET
Unwind: di
        ld hl,Recover
        push hl
        ld (ErrSp),sp
        call D1
Recover:
        ret
D1:     call D2
        ret
D2:     call Thrower
        ret
Thrower:
        ld sp,(ErrSp)
        ret

; --- D2: the armed window
Window: di
        ld b,5
WLoop:  call RA
        djnz WLoop
        ret

; --- T4/D11: an IM 2 interrupt is its own root, excluded from what it interrupted
Im2:    di
        ld a,$81
        ld i,a
        im 2
        ei
        call Work
        di
        im 1
        ret
Work:   ld bc,12000
WLoop2: dec bc
        ld a,b
        or c
        jr nz,WLoop2
WorkEnd:
        ret

SavedSp: .defw 0
ErrSp:  .defw 0

; --- The IM 2 table: the bus reads $FF, so the vector is at $81FF/$8200
        .org $8100
        .defs 257, $82
        .org $8282
Handler:
        push af
        push bc
        ld b,20
HLoop:  djnz HLoop
        pop bc
        pop af
        ei
        reti
`;

let s: Sp48TestSession;
let symbol: (name: string) => number;

beforeAll(async () => {
  s = await createSp48Session();
  s.bootToBasic();
  symbol = (await s.loadCode(PROGRAM)).symbol;
});

function profileCalls(entry: string): ProfileEdge[] {
  s.machine.resetProfile();
  s.machine.setProfiling(true, true);
  s.machine.setProfileCalls(true);
  try {
    s.call(entry);
  } finally {
    s.machine.setProfiling(false, true);
  }
  return s.machine.readProfileEdges()!;
}

function edge(edges: ProfileEdge[], caller: number | string, callee: number | string): ProfileEdge | undefined {
  const from = typeof caller === "string" ? symbol(caller) : caller;
  const to = typeof callee === "string" ? symbol(callee) : callee;
  return edges.find((e) => e.caller === from && e.callee === to);
}

describe("the 48K's call tracker", () => {
  it("is off by default and reports its capacity", () => {
    const info = s.machine.getProfileInfo()!;
    expect(info.callsOn).toBe(false);
    expect(info.edgeCapacity).toBe(16384);
    expect(info.depth).toBe(0);
  });

  it("gives exact inclusive and exclusive times for nested calls", () => {
    const edges = profileCalls("Nested");
    // --- B: nop, nop, ret = 4 + 4 + 10
    expect(edge(edges, "RA", "RB")).toMatchObject({ calls: 2, inclusive: 2 * 18, exclusive: 2 * 18, kind: "call" });
    // --- A: nop, call B, ret = 4 + 17 + 10 of its own, and B: a CALL's time is its caller's
    expect(edge(edges, PROFILE_KEY_ROOT, "RA")).toMatchObject({ calls: 2, inclusive: 2 * 49, exclusive: 2 * 31 });
    expect(edges).toHaveLength(2);
    const info = s.machine.getProfileInfo()!;
    expect(info.calls).toBe(4);
    expect(info.depth).toBe(0);
    expect(info.stackResyncs).toBe(0);
  });

  it("treats PUSH HL / RET as a jump, not a return (T1)", () => {
    const edges = profileCalls("Dispatch");
    // --- Disp: ld hl,nn (10), push hl (11), ret (10), then Target's ret (10) returns from Disp
    expect(edge(edges, PROFILE_KEY_ROOT, "Disp")).toMatchObject({ calls: 1, inclusive: 41, exclusive: 41 });
    expect(edges).toHaveLength(1);
    expect(s.machine.getProfileInfo()!.depth).toBe(0);
  });

  it("counts a recursive routine's inclusive time once (D12)", () => {
    const edges = profileCalls("Recurse");
    const outer = edge(edges, PROFILE_KEY_ROOT, "Rec")!;
    const inner = edge(edges, "Rec", "Rec")!;
    expect(outer.calls).toBe(1);
    expect(inner.calls).toBe(2);
    expect(inner.inclusive).toBe(0);
    // --- Every activation's own time adds up to the outermost one's inclusive time
    expect(outer.exclusive + inner.exclusive).toBe(outer.inclusive);
    // --- dec b (4), call nz taken (17) twice and not taken (10) once, ret (10) three times
    expect(outer.inclusive).toBe(3 * 4 + 2 * 17 + 10 + 3 * 10);
  });

  it("flushes the stack on a stack switch and says so (D10)", () => {
    const edges = profileCalls("Switch");
    const info = s.machine.getProfileInfo()!;
    expect(info.stackResyncs).toBe(1);
    expect(info.depth).toBe(0);
    // --- B ran on the new stack as a root of its own
    expect(edge(edges, PROFILE_KEY_ROOT, "RB")).toMatchObject({ calls: 1, inclusive: 18 });
    // --- Sw's frame was closed by the flush, with its time up to the switch: ld (nn),sp, ld sp,nn and
    // --- the CALL (whose pushes to $6FFE are contended)
    const sw = s.machine.readProfileCounts(symbol("Sw"), 10)!;
    const upToSwitch = Array.from(sw.time).reduce((a, b) => a + b, 0);
    expect(upToSwitch).toBeGreaterThan(20 + 10 + 17);
    expect(edge(edges, PROFILE_KEY_ROOT, "Sw")).toMatchObject({ calls: 1, inclusive: upToSwitch });
  });

  it("closes every frame below an unwinder's RET (T2)", () => {
    const edges = profileCalls("Unwind");
    expect(s.machine.getProfileInfo()!.depth).toBe(0);
    expect(s.machine.getProfileInfo()!.stackResyncs).toBe(0);
    // --- Thrower: ld sp,(nn) (20), ret (10)
    expect(edge(edges, "D2", "Thrower")).toMatchObject({ calls: 1, inclusive: 30, exclusive: 30 });
    // --- D2: call (17) + Thrower; D1: call (17) + D2
    expect(edge(edges, "D1", "D2")).toMatchObject({ calls: 1, inclusive: 47, exclusive: 17 });
    expect(edge(edges, PROFILE_KEY_ROOT, "D1")).toMatchObject({ calls: 1, inclusive: 64, exclusive: 17 });
  });

  it("keeps an interrupt's time out of the routine it interrupted (T4, D11)", () => {
    const edges = profileCalls("Im2");
    const handler = edge(edges, PROFILE_KEY_INT, "Handler")!;
    expect(handler.kind).toBe("im2");
    // --- 12,000 iterations of 26 T-states span several frames: one interrupt per frame
    expect(handler.calls).toBeGreaterThanOrEqual(4);
    const work = edge(edges, PROFILE_KEY_ROOT, "Work")!;
    // --- Work's inclusive time is exactly its own instructions' time: nothing of the handler's
    const counts = s.machine.readProfileCounts(symbol("Work"), symbol("WorkEnd") + 1 - symbol("Work"))!;
    const own = Array.from(counts.time).reduce((a, b) => a + b, 0);
    expect(work.inclusive).toBe(own);
    expect(work.exclusive).toBe(own);
    // --- The handler's frame includes its acknowledge: per interrupt, the ack's 19 T-states plus its body
    const body = s.machine.readProfileCounts(symbol("Handler"), 16)!;
    const handlerOwn = Array.from(body.time).reduce((a, b) => a + b, 0);
    const info = s.machine.getProfileInfo()!;
    expect(handler.inclusive).toBe(handlerOwn + info.timeIntAck);
  });

  it("starts and stops at the armed markers (D2)", () => {
    s.machine.resetProfile();
    s.machine.setProfiling(true, true);
    s.machine.armProfileWindow(symbol("RA"), symbol("RA"));
    s.machine.setProfileCalls(true);
    try {
      s.call("Window");
    } finally {
      s.machine.setProfileCalls(false);
    }
    const info = s.machine.getProfileInfo()!;
    expect(info.enabled).toBe(false);
    expect(info.windowClosed).toBe(1);
    expect(info.armedStart).toBe(-1);
    expect(info.armedStop).toBe(-1);
    // --- One pass through A, its RET, DJNZ and the next CALL: then the stop at A's second arrival
    const exec = (name: string) => s.machine.readProfileCounts(symbol(name), 1)!.exec[0];
    expect(exec("RA")).toBe(1);
    expect(exec("RB")).toBe(1);
    expect(exec("WLoop")).toBe(1);
    expect(exec("Window")).toBe(0);
    // --- A nop (4), call B (17), B (18), ret (10), djnz taken (13), call A (17)
    expect(info.timeTotal).toBe(4 + 17 + 18 + 10 + 13 + 17);
    // --- Counting started inside RA, with no frame for it (T5): RB is the root's callee, RA's RET
    // --- closed nothing, and the second CALL opened RA's frame just before the stop
    const edges = s.machine.readProfileEdges()!;
    expect(edge(edges, PROFILE_KEY_ROOT, "RB")).toMatchObject({ calls: 1, inclusive: 18 });
    expect(edge(edges, PROFILE_KEY_ROOT, "RA")).toMatchObject({ calls: 1, inclusive: 0 });
  });

  it("folds the frames still open into the edges it reports", () => {
    s.machine.resetProfile();
    s.machine.setProfiling(true, true);
    s.machine.setProfileCalls(true);
    // --- Stop inside B: Nested -> A -> B, at B's second nop
    const ret = s.machine.pc;
    const sp = (s.machine.sp - 2) & 0xffff;
    s.pokeWord(sp, ret);
    s.machine.sp = sp;
    s.machine.pc = symbol("Nested");
    s.runTo(symbol("RB") + 1);
    s.machine.setProfiling(false, true);
    const info = s.machine.getProfileInfo()!;
    expect(info.depth).toBe(2);
    const edges = s.machine.readProfileEdges()!;
    // --- B so far: one nop; A so far: nop, call B, and B's nop
    expect(edge(edges, "RA", "RB")).toMatchObject({ calls: 1, inclusive: 4, exclusive: 4, open: 1 });
    expect(edge(edges, PROFILE_KEY_ROOT, "RA")).toMatchObject({ calls: 1, inclusive: 25, exclusive: 21, open: 1 });
    // --- Finish the run so the session's PC is back where BASIC expects it
    s.runTo(ret);
  });
});
