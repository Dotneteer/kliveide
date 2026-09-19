import { describe, expect, it } from "vitest";

import { machineRegistry } from "@common/machines/machine-registry";
import { createZ88Session, z88HarnessBackends, type Z88TestSession } from "../../harness/z88";

/*
 * Parity of the WASM Cambridge Z88 with the TypeScript oracle, in lockstep: the same program on both
 * backends, compared through the public machine API - CPU registers, tacts and frames, the Blink state
 * the IDE shows, the snooze state and all 4 MB of physical memory.
 *
 * Covers what the core emulates so far (Steps 4-6 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`):
 * the memory map, the CPU and the frame loop, the Blink (ports, RTC, interrupts). The LCD and the beeper
 * are not compared yet (Steps 8-9).
 */

const runsOnWasm = z88HarnessBackends("memory", "cpu", "blink").includes("wasm");

/** Compares the two machines; the message names the first difference */
function expectSameState(ts: Z88TestSession, wasm: Z88TestSession, where: string): void {
  expect(wasm.registers(), `registers ${where}`).toEqual(ts.registers());
  expect(wasm.tacts, `tacts ${where}`).toBe(ts.tacts);
  expect(wasm.machine.frames, `frames ${where}`).toBe(ts.machine.frames);
  expect(wasm.snoozed, `snoozed ${where}`).toBe(ts.snoozed);
  expect(wasm.blinkState(), `Blink ${where}`).toEqual(ts.blinkState());
  for (let bank = 0; bank < 256; bank++) {
    const a = ts.machine.getMemoryPartition(bank);
    const b = wasm.machine.getMemoryPartition(bank);
    if (Buffer.compare(Buffer.from(a), Buffer.from(b)) !== 0) {
      const offset = a.findIndex((v, i) => v !== b[i]);
      throw new Error(
        `Memory differs ${where}: bank $${bank.toString(16)} offset $${offset.toString(16)} ` +
          `(typescript $${a[offset].toString(16)}, wasm $${b[offset].toString(16)})`
      );
    }
  }
}

describe.runIf(runsOnWasm)("Z88 parity: OZ boots identically on both backends", () => {
  const models = machineRegistry.find((m) => m.machineId === "z88").models.map((m) => m.modelId);

  it.each(models)(
    "%s",
    async (model) => {
      const ts = await createZ88Session({ backend: "typescript", model, rom: "model" });
      const wasm = await createZ88Session({ backend: "wasm", model, rom: "model" });
      expectSameState(ts, wasm, "after the hard reset");
      for (const checkpoint of [1, 7, 50, 200, 600, 1700]) {
        ts.runFrames(checkpoint - ts.frames);
        wasm.runFrames(checkpoint - wasm.frames);
        expectSameState(ts, wasm, `at frame ${checkpoint}`);
      }
    },
    60_000
  );
});

/*
 * A program that keeps the CPU, the paging and the Blink busy: prefixed and block instructions, bank
 * switching through SR1-SR3, reads from an empty slot (the pseudo-random values), the RTC interrupt
 * with IM 1, HALT until the next interrupt, and the Blink's status ports.
 */
const MIXED = `
      .org $0038
      jp irq

      .org $8000
start:
      ld sp,$bff0
      im 1
      ld a,$03
      out ($b1),a          ; INT = TIME | GINT
      ld a,$01
      out ($b5),a          ; TMK = TICK
      ld a,$07
      out ($b4),a          ; TACK
      ei
loop:
      ; --- arithmetic and flags
      ld a,(counter)
      inc a
      ld (counter),a
      add a,$37
      daa
      rla
      sbc a,$12
      cpl
      neg
      ; --- block moves and searches (bank $22 to bank $23)
      ld hl,$8000
      ld de,$c100
      ld bc,$0040
      ldir
      ld hl,$c100
      ld bc,$0040
      ld a,$3e
      cpir
      ; --- IX/IY and bit operations
      ld ix,table
      ld iy,table+4
      ld a,(ix+1)
      add a,(iy+2)
      ld (ix+3),a
      set 3,(ix+0)
      bit 3,(ix+0)
      res 3,(iy-4)
      rlc (ix+2)
      srl b
      ; --- exchanges and the stack
      ex af,af'
      exx
      push hl
      pop de
      exx
      ex af,af'
      ; --- paging: bank $C5 (slot 3, empty) into segment 3, read the random values, bank $23 back
      ld a,$c5
      out ($d3),a
      ld hl,$c000
      ld b,(hl)
      ld c,(hl)
      ld a,$23
      out ($d3),a
      ; --- the Blink: status and timer ports
      in a,($b1)
      in a,($d0)
      in a,($b5)
      ; --- wait for the next RTC interrupt now and then
      ld a,(counter)
      and $07
      jr nz,loop
      halt
      jr loop

irq:
      push af
      ld a,$07
      out ($b4),a          ; TACK
      ld a,(ticks)
      inc a
      ld (ticks),a
      pop af
      ei
      reti

counter: .defb 0
ticks:   .defb 0
table:   .defb $11,$22,$33,$44,$55,$66,$77,$88
`;

describe.runIf(runsOnWasm)("Z88 parity: a mixed program, instruction by instruction", () => {
  it("30000 instructions: the same registers and tacts after each, the same machine at the end", async () => {
    const ts = await createZ88Session({ backend: "typescript" });
    const wasm = await createZ88Session({ backend: "wasm" });
    await ts.loadCode(MIXED, { entry: "start" });
    await wasm.loadCode(MIXED, { entry: "start" });

    // --- HALT waits for the next RTC tick (a 4-tact step each), so it takes this many to cross
    // --- several interrupts and frames
    for (let i = 0; i < 30000; i++) {
      ts.step();
      wasm.step();
      const where = `after instruction ${i + 1} (PC $${ts.registers().pc.toString(16)})`;
      expect(wasm.registers(), where).toEqual(ts.registers());
      expect(wasm.tacts, where).toBe(ts.tacts);
    }
    expectSameState(ts, wasm, "after 30000 instructions");
    // --- The program really went through interrupts and frames
    expect(ts.peek(ts.symbol("ticks"))).toBeGreaterThanOrEqual(3);
    expect(ts.machine.frames).toBeGreaterThanOrEqual(6);
  });

  it("the same program in whole frames reaches the same state", async () => {
    const ts = await createZ88Session({ backend: "typescript" });
    const wasm = await createZ88Session({ backend: "wasm" });
    await ts.loadCode(MIXED, { entry: "start" });
    await wasm.loadCode(MIXED, { entry: "start" });
    for (const frames of [1, 3, 20, 100]) {
      ts.runFrames(frames);
      wasm.runFrames(frames);
      expectSameState(ts, wasm, `after ${frames} more frames`);
    }
  });

  it("a frame stopped midway (runTo) finishes identically", async () => {
    const ts = await createZ88Session({ backend: "typescript" });
    const wasm = await createZ88Session({ backend: "wasm" });
    await ts.loadCode(MIXED, { entry: "start" });
    await wasm.loadCode(MIXED, { entry: "start" });
    for (let round = 0; round < 5; round++) {
      ts.runTo("irq");
      wasm.runTo("irq");
      expectSameState(ts, wasm, `at the interrupt handler, round ${round}`);
      ts.runFrames(1);
      wasm.runFrames(1);
      expectSameState(ts, wasm, `after finishing the frame, round ${round}`);
    }
  });
});
