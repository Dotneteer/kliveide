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
