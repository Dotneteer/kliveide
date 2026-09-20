import { describe, expect, it } from "vitest";

import { createZ88Session, z88HarnessBackends, type Z88HarnessBackend, type Z88TestSession } from "../../harness/z88";

/*
 * The debugger on the Cambridge Z88, on every backend that runs the CPU: step-into, step-over (on a
 * CALL, and landing on one), step-out (also across an interrupt), breakpoints, and stepping a
 * snoozing CPU. Driven as the IDE drives it (`Z88TestSession.debug` = `MachineController.run`).
 *
 * The lessons behind these cases are in `.ai/wasm-migration-intent-and-lessons.md` ("Debugger
 * Behaviour Is Part Of The Port"): step-out needs the core's shadow stack, including interrupt
 * entries, and step-over must not execute an instruction it only just landed on.
 * Step 5 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`.
 */

const PROGRAM = `
      .org $0038
      jp irq

      .org $8000
start:
      ld sp,$bff0
      call routine
after:
      nop
      ld a,1
done:
      jr done

routine:
      ld ix,$1234          ; a prefixed (DD) instruction
      ld b,3
inner:
      call leaf
      djnz inner
      ret

leaf:
      nop
      ret

irq:
      push af
      ld a,$07
      out ($b4),a          ; TACK
      pop af
      ei
      ret

; --- A long routine that interrupts break into
slow:
      ld hl,$2000
slowLoop:
      dec hl
      ld a,h
      or l
      jr nz,slowLoop
      ret

callSlow:
      ld sp,$bff0
      im 1
      ld a,$03
      out ($b1),a          ; INT = TIME | GINT
      ld a,$01
      out ($b5),a          ; TMK = TICK
      ld a,$07
      out ($b4),a          ; TACK
      ei
      call slow
afterSlow:
      jr afterSlow
`;

async function session(backend: Z88HarnessBackend, entry = "start"): Promise<Z88TestSession> {
  const s = await createZ88Session({ backend });
  await s.loadCode(PROGRAM, { entry });
  return s;
}

describe.each(z88HarnessBackends("memory", "cpu", "blink"))("Z88 debugger (%s)", (backend) => {
  it("step-into executes exactly one instruction, prefixed ones included", async () => {
    const s = await session(backend);
    expect(s.debug("stepInto")).toBe(0x8003);
    expect(s.registers().sp).toBe(0xbff0);
    expect(s.debug("stepInto")).toBe(s.symbol("routine"));
    // --- LD IX,nn is one step, prefix and all
    expect(s.debug("stepInto")).toBe(s.symbol("routine") + 4);
    expect(s.registers().ix).toBe(0x1234);
    expect(s.debug("stepInto")).toBe(s.symbol("inner"));
  });

  it("step-over a CALL runs the whole routine and stops after it", async () => {
    const s = await session(backend);
    s.debug("stepInto");
    expect(s.debug("stepOver")).toBe(s.symbol("after"));
    expect((s.registers().bc >> 8) & 0xff).toBe(0);
  });

  it("step-over stops on the instruction it lands on (the `imminentJustCreated` guard)", async () => {
    const s = await session(backend);
    s.debug("stepInto"); // at CALL routine
    s.debug("stepInto"); // at LD IX,nn (routine)
    s.debug("stepInto"); // at LD B,3
    // --- Stepping over LD B,3 lands on CALL leaf: it must stop there, not run the call too
    expect(s.debug("stepOver")).toBe(s.symbol("inner"));
  });

  it("step-out returns to the routine's caller, not to an inner return", async () => {
    const s = await session(backend);
    s.debug("stepInto");
    s.debug("stepInto"); // in routine
    s.debug("stepInto");
    s.debug("stepInto"); // at inner (CALL leaf)
    expect(s.debug("stepOut")).toBe(s.symbol("after"));
  });

  it("step-out lands on the caller even when interrupts enter and leave meanwhile", async () => {
    const s = await session(backend, "callSlow");
    s.runTo("slowLoop");
    expect(s.debug("stepOut", { maxFrames: 400 })).toBe(s.symbol("afterSlow"));
  });

  it("stops at a breakpoint each time the code reaches it", async () => {
    const s = await session(backend);
    s.breakpoint("leaf");
    expect(s.debug("continue")).toBe(s.symbol("leaf"));
    expect(s.debug("continue")).toBe(s.symbol("leaf"));
    expect(s.debug("continue")).toBe(s.symbol("leaf"));
    expect((s.registers().bc >> 8) & 0xff).toBe(1);
  });

  it("stepping a snoozed CPU without waking it is a 16-tact pause at the same PC", async () => {
    const s = await createZ88Session({ backend });
    await s.loadCode(`
      .org $8000
      ld a,$81
      out ($b1),a          ; INT = KWAIT | GINT
      ld bc,$00b2
      in a,(c)             ; no key down: snooze
after:
      jr after
    `);
    s.runTo("after");
    s.step();
    expect(s.snoozed).toBe(true);
    const t0 = s.tacts;
    s.step(2);
    expect(s.tacts - t0).toBe(32);
    expect(s.registers().pc).toBe(s.symbol("after"));
  });

  it("the IDE's step wakes a snoozed CPU first (MachineController does)", async () => {
    const s = await createZ88Session({ backend });
    await s.loadCode(`
      .org $8000
      ld a,$81
      out ($b1),a
      ld bc,$00b2
      in a,(c)
after:
      nop
      nop
    `);
    s.runTo("after");
    s.step();
    expect(s.snoozed).toBe(true);
    expect(s.debug("stepInto")).toBe(s.symbol("after") + 1);
    expect(s.snoozed).toBe(false);
  });
});

/*
 * Memory and I/O breakpoints test the instruction's bus accesses as `Z80Cpu` records them: every
 * opcode fetch (prefix bytes included) and every data read or write - but not the operand bytes,
 * which `fetchCodeByte` reads without recording. So a read breakpoint on an instruction's first byte
 * stops after that instruction, one on its operand never does.
 */
const ACCESS = `
      .org $8000
start:
      ld sp,$bff0
      ld a,$47
fetch:
      ld a,($9000)
      ld ($9001),a
indexed:
      ld (ix+$10),a
      ld bc,$47b1
      in a,(c)
      ld c,$b5
      out (c),a            ; port $47B5: B is the high byte
done:
      jr done

      .org $9000
      .defb $47,$00
`;

describe.each(z88HarnessBackends("memory", "cpu", "blink"))("Z88 memory and I/O breakpoints (%s)", (backend) => {
  async function session(): Promise<Z88TestSession> {
    const s = await createZ88Session({ backend: backend as Z88HarnessBackend });
    await s.loadCode(ACCESS, { entry: "start" });
    s.setRegisters({ ix: 0xa000 });
    return s;
  }

  it.each([
    ["an opcode fetch", "fetch", "memoryRead", "fetch+3"],
    ["a data read", 0x9000, "memoryRead", "fetch+3"],
    ["a data write", 0x9001, "memoryWrite", "indexed"],
    ["an indexed write", 0xa010, "memoryWrite", "indexed+3"],
    ["a port read (the 16-bit port address)", 0x47b1, "ioRead", "done-4"],
    ["a port write", 0x47b5, "ioWrite", "done"]
  ] as const)("stops after the instruction that makes %s", async (_what, where, access, expected) => {
    const s = await session();
    s.watch(where, access);
    const [label, offset] = expected.split(/(?=[+-])/);
    expect(s.debug("continue")).toBe(s.symbol(label) + Number(offset ?? 0));
  });

  it("an operand byte is not a recorded read: its breakpoint never fires", async () => {
    const s = await session();
    s.watch(s.symbol("fetch") + 1, "memoryRead");
    s.breakpoint("done");
    expect(s.debug("continue")).toBe(s.symbol("done"));
  });
});

describe("Z88 debugger: both backends stop at the same places", () => {
  it.each([
    ["step-into", async (s: Z88TestSession) => [s.debug("stepInto"), s.debug("stepInto"), s.debug("stepInto")]],
    ["step-over", async (s: Z88TestSession) => [s.debug("stepInto"), s.debug("stepOver"), s.debug("stepOver")]],
    ["step-out", async (s: Z88TestSession) => [s.debug("stepInto"), s.debug("stepInto"), s.debug("stepOut")]],
    ["breakpoints", async (s: Z88TestSession) => (s.breakpoint("leaf"), [s.debug("continue"), s.debug("continue")])]
  ])("%s", async (_name, scenario) => {
    const [ts, wasm] = await Promise.all(z88HarnessBackends("memory", "cpu", "blink").map((b) => session(b)));
    if (!wasm) return; // --- the WASM core does not run the CPU yet
    const tsStops = await scenario(ts);
    const wasmStops = await scenario(wasm);
    expect(wasmStops).toEqual(tsStops);
    expect(wasm.registers()).toEqual(ts.registers());
    expect(wasm.tacts).toBe(ts.tacts);
  });
});

/*
 * The WASM debug loop lets the core run on to the next place the stop policy may stop at (a flagged
 * address, a run-to point, a step-over or step-out target) instead of returning after every
 * instruction. These cases cross several frames in one debugger command, and pass flagged addresses
 * that are not stops - a disabled breakpoint, a breakpoint for a partition that is not paged in - and
 * both backends must stop at the same instruction, with the same registers and tacts.
 */
const LONG = `
      .org $8000
start:
      ld sp,$bff0
      call long
after:
      nop
passed:
      ld a,1
other:
      nop
done:
      jr done

long:
      ld de,$0a00          ; about four 5 ms frames
wait: dec de
      ld a,d
      or e
      jr nz,wait
      call inner
      ret

inner:
      ld b,0
spin: djnz spin
      ret
`;

describe("Z88 debugger: long runs between stops, on both backends", () => {
  async function both(): Promise<Z88TestSession[]> {
    const sessions = await Promise.all(z88HarnessBackends("memory", "cpu", "blink").map((b) => createZ88Session({ backend: b })));
    for (const s of sessions) await s.loadCode(LONG, { entry: "start" });
    return sessions;
  }

  it.each([
    [
      "step-over a CALL that runs for frames",
      (s: Z88TestSession) => [s.debug("stepInto"), s.debug("stepOver"), s.debug("stepOver")]
    ],
    [
      "step-out of a routine that runs for frames",
      (s: Z88TestSession) => [s.debug("stepInto"), s.debug("stepInto"), s.debug("stepOut")]
    ],
    [
      "step-over a CALL inside the long routine, then step-out",
      (s: Z88TestSession) => (s.breakpoint("wait"), [s.debug("continue"), (s.machine.executionContext.debugSupport.eraseAllBreakpoints(), s.debug("stepOut"))])
    ],
    [
      "a disabled breakpoint and another partition's breakpoint are passed; the real one stops",
      (s: Z88TestSession) => {
        const debugSupport = s.machine.executionContext.debugSupport;
        const disabled = { address: s.symbol("after"), exec: true };
        debugSupport.addBreakpoint(disabled);
        debugSupport.enableBreakpoint(disabled, false);
        debugSupport.addBreakpoint({ address: s.symbol("passed"), partition: 0x99, exec: true });
        s.breakpoint("other");
        return [s.debug("continue")];
      }
    ],
    [
      "a breakpoint hit again on the next pass through a loop",
      (s: Z88TestSession) => (s.breakpoint("spin"), [s.debug("continue"), s.debug("continue"), s.debug("continue")])
    ]
  ])("%s", async (_name, scenario) => {
    const [ts, wasm] = await both();
    if (!wasm) return;
    const tsStops = scenario(ts);
    const wasmStops = scenario(wasm);
    expect(wasmStops).toEqual(tsStops);
    expect(wasm.registers()).toEqual(ts.registers());
    expect(wasm.tacts).toBe(ts.tacts);
    expect(wasm.machine.frames).toBe(ts.machine.frames);
  });

  it("the stops are the ones the program implies", async () => {
    const [s] = await both();
    expect([s.debug("stepInto"), s.debug("stepOver")]).toEqual([s.symbol("start") + 3, s.symbol("after")]);
    expect(s.machine.frames).toBeGreaterThanOrEqual(3);
  });
});
