import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { describe, expect, it } from "vitest";

import { createSp48Session } from "../harness/sp48";
import { createSession } from "../harness/zxnext";

/**
 * Memory breakpoints on the real machines, for the accesses an instruction makes before its last one
 * (plan CONDITIONAL_BREAKPOINTS_PLAN.md, Phase 0). Each core used to keep a single access record
 * that every access overwrote, so these breakpoints never fired; the cores now keep a per-instruction
 * access log. Every program is set up so that only the access under test can stop it.
 */

type Scenario = {
  name: string;
  source: string;
  breakpoint: BreakpointInfo;
  /** The PC after the instruction that made the access */
  stopAt: string;
  /** Memory the instruction left behind, [address, byte] */
  memory: [number, number][];
};

const scenarios: Scenario[] = [
  {
    name: "a write breakpoint on the low byte of LD ($9000),HL",
    source: `
        ld sp,$9f00
        ld hl,$1234
        ld ($9000),hl
    After:
        jr After
    `,
    breakpoint: { address: 0x9000, memoryWrite: true },
    stopAt: "After",
    memory: [
      [0x9000, 0x34],
      [0x9001, 0x12]
    ]
  },
  {
    name: "a read breakpoint on an LDIR source byte",
    source: `
        ld sp,$9f00
        ld hl,Source
        ld de,$a000
        ld bc,4
    Copy:
        ldir
    After:
        jr After
    Source:
        .defb $11,$22,$33,$44
    `,
    // --- The third source byte; resolved below from the label
    breakpoint: { address: -1, memoryRead: true },
    // --- LDIR repeats: the iteration that read the byte leaves PC on the LDIR again
    stopAt: "Copy",
    memory: [
      [0xa002, 0x33],
      // --- the fourth byte is not copied yet
      [0xa003, 0x00]
    ]
  },
  {
    name: "a read breakpoint on INC (HL)'s address",
    source: `
        ld sp,$9f00
        ld hl,$9010
        inc (hl)
    After:
        jr After
    `,
    breakpoint: { address: 0x9010, memoryRead: true },
    stopAt: "After",
    memory: [[0x9010, 0x01]]
  },
  {
    name: "a write breakpoint on the first stack byte of a PUSH",
    source: `
        ld sp,$9f00
        ld bc,$abcd
        push bc
    After:
        jr After
    `,
    // --- PUSH writes B to SP-1 first, then C to SP-2
    breakpoint: { address: 0x9eff, memoryWrite: true },
    stopAt: "After",
    memory: [
      [0x9eff, 0xab],
      [0x9efe, 0xcd]
    ]
  }
];

function withSource(scenario: Scenario, symbol: (name: string) => number): BreakpointInfo {
  return scenario.breakpoint.address === -1
    ? { ...scenario.breakpoint, address: symbol("Source") + 2 }
    : scenario.breakpoint;
}

describe("Memory breakpoints on non-final accesses - ZX Spectrum 48K", () => {
  for (const scenario of scenarios) {
    it(scenario.name, async () => {
      const s = await createSp48Session();
      const program = await s.loadCode(`
        .org $8000
    Main:
        ${scenario.source}
      `);
      s.attachDebugSupport().addBreakpoint(withSource(scenario, (n) => program.symbol(n)));

      expect(s.callToBreakpoint("Main")).toBe(program.symbol(scenario.stopAt));
      for (const [address, value] of scenario.memory) expect(s.peek(address)).toBe(value);
    });
  }
});

describe("Memory breakpoints on non-final accesses - ZX Spectrum Next", () => {
  for (const scenario of scenarios) {
    it(scenario.name, async () => {
      const s = await createSession();
      await s.loadCode(`
        .org $8000
    Main:
        ${scenario.source}
      `);
      s.attachDebugSupport().addBreakpoint(withSource(scenario, (n) => s.symbol(n)));

      expect(s.continueToBreakpoint()).toBe(s.symbol(scenario.stopAt));
      for (const [address, value] of scenario.memory) expect(s.peek(address)).toBe(value);
    });
  }
});

describe("DMA traffic is not CPU traffic - ZX Spectrum Next", () => {
  /*
   * The zxnDMA reads and writes memory through the same mapping as the CPU. The core used to record
   * those accesses in the CPU's access record, so a burst transfer running between instructions
   * could fire (or hide) a CPU memory breakpoint. Burst mode with a prescaler releases the bus
   * between bytes (device/dma.vhd), so the CPU runs instructions while the transfer goes on.
   */
  it("memory breakpoints on a DMA transfer's source and destination never fire", async () => {
    const s = await createSession();
    // --- DISABLE; WR0 A->B, port A $C000, length 8; WR1 memory, increment; WR2 memory, increment,
    // --- timing $21 + prescaler 8; WR4 burst, port B $C100; WR5; LOAD
    const setup = [0x83, 0x7d, 0x00, 0xc0, 0x08, 0x00, 0x14, 0x50, 0x21, 0x08, 0xcd, 0x00, 0xc1, 0x82, 0xcf];
    await s.loadCode(`
        .org $8000
    Main:
        di
        ld hl,Setup
        ld b,SetupEnd-Setup
        ld c,$6b
        otir
        ld a,$87
        out (c),a
        ld b,200
    Wait:
        djnz Wait
    Done:
        jr Done
    Setup:
        .defb ${setup.map((b) => `$${b.toString(16)}`).join(",")}
    SetupEnd:
    `);
    s.poke(0xc000, [1, 2, 3, 4, 5, 6, 7, 8]);
    const debugSupport = s.attachDebugSupport();
    for (let i = 0; i < 8; i++) {
      debugSupport.addBreakpoint({ address: 0xc000 + i, memoryRead: true });
      debugSupport.addBreakpoint({ address: 0xc100 + i, memoryWrite: true });
    }
    debugSupport.addBreakpoint({ address: s.symbol("Done"), exec: true });

    expect(s.continueToBreakpoint()).toBe(s.symbol("Done"));
    // --- The transfer happened while the CPU ran
    expect(Array.from(s.peekBytes(0xc100, 8))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
