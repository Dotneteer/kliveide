import { describe, it, expect, beforeAll } from "vitest";
import { createTestSpectrum48Machine, TestSpectrum48Machine } from "./TestSpectrum48Machine";
import { createTestSpectrum128Machine, TestSpectrum128Machine } from "./TestSpectrum128Machine";
import { createTestSpectrumP3eMachine, TestSpectrumP3eMachine } from "./TestSpectrumP3eMachine";

// --- Contention delay value used throughout tests. The screen device sets real values,
//     but we override a contiguous range so tests see a predictable, non-zero delay.
const DELAY = 6;
// --- Frame tact at which we position the CPU before each test instruction.
const START_TACT = 100;
// --- We set contention for a wide range so multi-tact instructions always see contention.
const CONTENTION_RANGE = 200;

// =============================================================================
// Helper: Set up contention at START_TACT..START_TACT+CONTENTION_RANGE,
//         position CPU at START_TACT, and reset contention counters.
// =============================================================================
function prepContention(machine: TestSpectrum48Machine | TestSpectrum128Machine | TestSpectrumP3eMachine) {
  machine.setContentionRange(START_TACT, CONTENTION_RANGE, DELAY);
  machine.setFrameTact(START_TACT);
  machine.resetContentionCounters();
}

// =============================================================================
// D1 — I/O contention address range
//
// Before the fix, delayContendedIo tested only 0x4000-0x7FFF regardless of
// machine type. After the fix, each machine's isContendedIoAddress() is used:
// - 48K: only 0x4000-0x7FFF
// - 128K: 0x4000-0x7FFF + 0xC000-0xFFFF when odd bank (1,3,5,7) selected
// - P3e: delegates to isContendedMemoryAddress (banks 4-7 contended)
// =============================================================================

describe("D1 — I/O contention address range", () => {

  // -------------------------------------------------------------------------
  // 48K tests
  // -------------------------------------------------------------------------
  describe("ZX Spectrum 48K", () => {
    let machine: TestSpectrum48Machine;
    beforeAll(async () => { machine = await createTestSpectrum48Machine(); });

    it("contended I/O port (odd, in 0x4000 range) applies 4x contention", () => {
      // OUT (n),A — opcode 0xD3 n, port = n | (A << 8)
      // Set A=0x40 so port address = 0x40FF (odd bit, in contended 0x4000 range)
      machine.a = 0x40;
      machine.pc = 0x8000;
      machine.i = 0; // non-contended IR
      machine.initCode([0xd3, 0xff], 0x8000); // OUT (0xFF),A → port 0x40FF
      prepContention(machine);

      const tactsBefore = machine.tacts;
      machine.executeOne();
      const tactsUsed = machine.tacts - tactsBefore;

      // Contended + odd port: C:1, C:1, C:1, C:1 → 4×DELAY + 4T base I/O
      // M1 at 0x8000: non-contended → 3T read + 1T refresh = 4T
      // Operand at 0x8001: non-contended → 3T
      // I/O: 4×DELAY + 4T
      expect(tactsUsed).toBe(4 + 3 + 4 * DELAY + 4);
      expect(machine.totalContentionDelaySinceStart).toBe(4 * DELAY);
    });

    it("non-contended I/O port (odd, in 0x8000 range) applies no contention", () => {
      machine.a = 0x80;
      machine.pc = 0x8000;
      machine.i = 0;
      machine.initCode([0xd3, 0xff], 0x8000); // OUT (0xFF),A → port 0x80FF
      prepContention(machine);

      const tactsBefore = machine.tacts;
      machine.executeOne();
      const tactsUsed = machine.tacts - tactsBefore;

      // Non-contended + odd port: N:4 → 0 contention + 4T base
      expect(tactsUsed).toBe(4 + 3 + 4);
      expect(machine.totalContentionDelaySinceStart).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 128K tests — the key D1 fix
  // -------------------------------------------------------------------------
  describe("ZX Spectrum 128K", () => {
    let machine: TestSpectrum128Machine;
    beforeAll(async () => { machine = await createTestSpectrum128Machine(); });

    it("port in 0xC000 range with odd bank → contention applies", () => {
      // Select bank 3 (odd) at 0xC000
      machine.setSelectedBank(3);
      machine.a = 0xc0;
      machine.pc = 0x8000;
      machine.i = 0;
      machine.initCode([0xd3, 0xff], 0x8000); // OUT (0xFF),A → port 0xC0FF (odd)
      prepContention(machine);

      const tactsBefore = machine.tacts;
      machine.executeOne();
      const tactsUsed = machine.tacts - tactsBefore;

      // Contended I/O + odd port: C:1, C:1, C:1, C:1 → 4×DELAY + 4T
      expect(tactsUsed).toBe(4 + 3 + 4 * DELAY + 4);
      expect(machine.totalContentionDelaySinceStart).toBe(4 * DELAY);
    });

    it("port in 0xC000 range with even bank → no contention", () => {
      // Select bank 0 (even) at 0xC000
      machine.setSelectedBank(0);
      machine.a = 0xc0;
      machine.pc = 0x8000;
      machine.i = 0;
      machine.initCode([0xd3, 0xff], 0x8000); // OUT (0xFF),A → port 0xC0FF
      prepContention(machine);

      const tactsBefore = machine.tacts;
      machine.executeOne();
      const tactsUsed = machine.tacts - tactsBefore;

      // Non-contended + odd port: N:4 → 0 contention
      expect(tactsUsed).toBe(4 + 3 + 4);
      expect(machine.totalContentionDelaySinceStart).toBe(0);
    });

    it("port in 0x4000 range always contended regardless of bank", () => {
      machine.setSelectedBank(0); // even bank shouldn't matter for 0x4000 range
      machine.a = 0x40;
      machine.pc = 0x8000;
      machine.i = 0;
      machine.initCode([0xd3, 0xff], 0x8000); // OUT (0xFF),A → port 0x40FF (odd)
      prepContention(machine);

      const tactsBefore = machine.tacts;
      machine.executeOne();
      const tactsUsed = machine.tacts - tactsBefore;

      expect(tactsUsed).toBe(4 + 3 + 4 * DELAY + 4);
      expect(machine.totalContentionDelaySinceStart).toBe(4 * DELAY);
    });
  });

  // -------------------------------------------------------------------------
  // P3e tests
  // -------------------------------------------------------------------------
  describe("ZX Spectrum +3E", () => {
    let machine: TestSpectrumP3eMachine;
    beforeAll(async () => { machine = await createTestSpectrumP3eMachine(); });

    it("port in 0xC000 range with bank >= 4 → contention applies", () => {
      machine.setSelectedBank(5); // bank 5 (>= 4, contended)
      machine.a = 0xc0;
      machine.pc = 0x8000;
      machine.i = 0;
      machine.initCode([0xd3, 0xff], 0x8000); // port 0xC0FF (odd)
      prepContention(machine);

      const tactsBefore = machine.tacts;
      machine.executeOne();
      const tactsUsed = machine.tacts - tactsBefore;

      expect(tactsUsed).toBe(4 + 3 + 4 * DELAY + 4);
      expect(machine.totalContentionDelaySinceStart).toBe(4 * DELAY);
    });

    it("port in 0xC000 range with bank < 4 → no contention", () => {
      machine.setSelectedBank(2); // bank 2 (< 4, not contended)
      machine.a = 0xc0;
      machine.pc = 0x8000;
      machine.i = 0;
      machine.initCode([0xd3, 0xff], 0x8000); // port 0xC0FF (odd)
      prepContention(machine);

      const tactsBefore = machine.tacts;
      machine.executeOne();
      const tactsUsed = machine.tacts - tactsBefore;

      expect(tactsUsed).toBe(4 + 3 + 4);
      expect(machine.totalContentionDelaySinceStart).toBe(0);
    });
  });
});

// =============================================================================
// D2 — HALT contention
//
// Before the fix, HALT used `tactPlusN(4)` without applying contention.
// After: HALT uses delayMemoryRead(PC) + refreshMemory + tactPlus1WithAddress(IR),
// which applies contention when PC is in contended memory.
// =============================================================================

describe("D2 — HALT applies contention when PC is in contended memory", () => {

  describe("ZX Spectrum 48K", () => {
    let machine: TestSpectrum48Machine;
    beforeAll(async () => { machine = await createTestSpectrum48Machine(); });

    it("HALT at contended address 0x4000 applies contention each dummy M1", () => {
      machine.i = 0; // non-contended IR
      machine.pc = 0x4000;
      machine.initCode([0x76], 0x4000); // HALT

      // First, execute the real HALT fetch (M1 at 0x4000 — contended)
      prepContention(machine);
      const tactsBefore = machine.tacts;
      machine.executeOne();
      const realHaltTacts = machine.tacts - tactsBefore;

      // Real HALT fetch:
      //   readMemory(0x4000): contention + 3T
      //   refresh(IR=0): no contention + 1T
      //   Instruction enters halted state, no additional tacts
      // Total: DELAY + 4T
      expect(realHaltTacts).toBe(DELAY + 4);
      expect(machine.halted).toBe(true);

      // Now execute one dummy HALT cycle (CPU is halted)
      prepContention(machine);
      machine.pc = 0x4000; // PC stays at HALT
      const tactsBefore2 = machine.tacts;
      machine.executeOne();
      const dummyHaltTacts = machine.tacts - tactsBefore2;

      // Dummy HALT M1:
      //   delayMemoryRead(0x4000): contention + 3T
      //   refreshMemory: no tacts
      //   tactPlus1WithAddress(IR=0): no contention + 1T
      // Total: DELAY + 4T
      expect(dummyHaltTacts).toBe(DELAY + 4);
      expect(machine.totalContentionDelaySinceStart).toBe(DELAY);
    });

    it("HALT at non-contended address 0x8000 — no contention", () => {
      machine.halted = false;
      machine.i = 0;
      machine.pc = 0x8000;
      machine.initCode([0x76], 0x8000); // HALT

      // Execute the HALT instruction
      prepContention(machine);
      const tactsBefore = machine.tacts;
      machine.executeOne();
      expect(machine.halted).toBe(true);
      expect(machine.tacts - tactsBefore).toBe(4); // no contention

      // Dummy HALT cycle
      prepContention(machine);
      machine.pc = 0x8000;
      const tactsBefore2 = machine.tacts;
      machine.executeOne();
      expect(machine.tacts - tactsBefore2).toBe(4); // no contention
      expect(machine.totalContentionDelaySinceStart).toBe(0);
    });
  });
});

// =============================================================================
// D3 — M1 refresh applies contention when IR points to contended memory
//
// Before the fix, M1 refresh used `tactPlusN(1)`. After: uses
// `tactPlus1WithAddress(this.ir)`, which applies contention when IR
// points to contended memory (e.g., I register = 0x40).
// =============================================================================

describe("D3 — M1 refresh applies contention via IR address", () => {

  describe("ZX Spectrum 48K", () => {
    let machine: TestSpectrum48Machine;
    beforeAll(async () => { machine = await createTestSpectrum48Machine(); });

    it("NOP with I=0x40 (contended) adds contention on refresh", () => {
      machine.halted = false;
      machine.i = 0x40; // IR will be 0x40xx — contended range
      machine.r = 0;
      machine.pc = 0x8000;
      machine.initCode([0x00], 0x8000); // NOP

      prepContention(machine);
      const tactsBefore = machine.tacts;
      machine.executeOne();
      const tactsUsed = machine.tacts - tactsBefore;

      // M1 at 0x8000: non-contended → 3T read
      // Refresh: tactPlus1WithAddress(IR=0x4000) → contention + 1T
      // NOP body: 0T
      // Total: 3 + DELAY + 1 = 4 + DELAY
      expect(tactsUsed).toBe(4 + DELAY);
      expect(machine.totalContentionDelaySinceStart).toBe(DELAY);
    });

    it("NOP with I=0x00 (non-contended) — no refresh contention", () => {
      machine.halted = false;
      machine.i = 0x00;
      machine.r = 0;
      machine.pc = 0x8000;
      machine.initCode([0x00], 0x8000); // NOP

      prepContention(machine);
      const tactsBefore = machine.tacts;
      machine.executeOne();
      const tactsUsed = machine.tacts - tactsBefore;

      // No contention at all (code at 0x8000, IR at 0x0000)
      expect(tactsUsed).toBe(4);
      expect(machine.totalContentionDelaySinceStart).toBe(0);
    });

    it("NOP with I=0x40 and code at 0x4000 — both fetch and refresh contended", () => {
      machine.halted = false;
      machine.i = 0x40;
      machine.r = 0;
      machine.pc = 0x4000;
      machine.initCode([0x00], 0x4000); // NOP at contended address

      prepContention(machine);
      const tactsBefore = machine.tacts;
      machine.executeOne();
      const tactsUsed = machine.tacts - tactsBefore;

      // M1 at 0x4000: contention + 3T
      // Refresh: contention + 1T (IR = 0x4000)
      // Total: 2×DELAY + 4
      expect(tactsUsed).toBe(4 + 2 * DELAY);
      expect(machine.totalContentionDelaySinceStart).toBe(2 * DELAY);
    });
  });
});

// =============================================================================
// D5 — Stats double-counting removed
//
// Before the fix, delayContendedIo() added `+= 4` to contention counters
// unconditionally (in addition to actual contention delays). After the fix,
// only real contention delays are counted.
// =============================================================================

describe("D5 — Contention stats only include real delays", () => {

  describe("ZX Spectrum 48K", () => {
    let machine: TestSpectrum48Machine;
    beforeAll(async () => { machine = await createTestSpectrum48Machine(); });

    it("I/O to non-contended odd port records zero contention", () => {
      machine.halted = false;
      machine.a = 0x80;
      machine.pc = 0x8000;
      machine.i = 0;
      machine.initCode([0xd3, 0xff], 0x8000); // OUT (0xFF),A → port 0x80FF (non-contended, odd)
      prepContention(machine);

      machine.executeOne();

      // Non-contended + odd: N:4. Zero contention delay.
      expect(machine.totalContentionDelaySinceStart).toBe(0);
      expect(machine.contentionDelaySincePause).toBe(0);
    });

    it("I/O to contended odd port records exactly 4×DELAY contention", () => {
      machine.halted = false;
      machine.a = 0x40;
      machine.pc = 0x8000;
      machine.i = 0;
      machine.initCode([0xd3, 0xff], 0x8000); // OUT (0xFF),A → port 0x40FF (contended, odd)
      prepContention(machine);

      machine.executeOne();

      // Contended + odd: C:1, C:1, C:1, C:1 → exactly 4×DELAY
      expect(machine.totalContentionDelaySinceStart).toBe(4 * DELAY);
      expect(machine.contentionDelaySincePause).toBe(4 * DELAY);
    });

    it("I/O to non-contended even port records exactly 1×contention (ULA port)", () => {
      machine.halted = false;
      machine.a = 0x80;
      machine.pc = 0x8000;
      machine.i = 0;
      machine.initCode([0xd3, 0xfe], 0x8000); // OUT (0xFE),A → port 0x80FE (non-contended, even/ULA)
      prepContention(machine);

      machine.executeOne();

      // Non-contended + even: N:1, C:3 → 1 contention application= DELAY
      expect(machine.totalContentionDelaySinceStart).toBe(DELAY);
      expect(machine.contentionDelaySincePause).toBe(DELAY);
    });

    it("I/O to contended even port records exactly 2×contention", () => {
      machine.halted = false;
      machine.a = 0x40;
      machine.pc = 0x8000;
      machine.i = 0;
      machine.initCode([0xd3, 0xfe], 0x8000); // OUT (0xFE),A → port 0x40FE (contended, even)
      prepContention(machine);

      machine.executeOne();

      // Contended + even: C:1, C:3 → 2 contention applications = 2×DELAY
      expect(machine.totalContentionDelaySinceStart).toBe(2 * DELAY);
      expect(machine.contentionDelaySincePause).toBe(2 * DELAY);
    });
  });
});
