/**
 * Tests for Step 11: Prescaler Timing (specnext_dma clock_w)
 * Tests for Step 12: DMA Delay Mechanism (specnext_dma m_dma_delay)
 *
 * Step 11:
 *   After WRITE_DEST, if prescaler != 0, return prescaler × 4 T-states.
 *   In burst mode the bus is released during the prescaler wait (CPU interleaving).
 *   Formula: Math.floor((prescaler * 3_500_000) / 875_000) = prescaler * 4 T-states.
 *
 * Step 12:
 *   m_dma_delay stalls the DMA at SEQ_WAIT_READY (no bus request issued).
 *   For continuous mode it also limits transfers to one byte at a time: after
 *   WRITE_DEST, if the state would go to SEQ_TRANS1_INC_DEC_SOURCE (continue
 *   to the next byte), it is overridden to release the bus and go to WAIT_READY.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DmaDevice, DmaSeq, TransferMode } from "@emu/machines/zxNext/DmaDevice";
import { TestZxNextMachine } from "./TestNextMachine";

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Configure a burst-mode transfer with a prescaler (matches audio-test helper). */
function configureBurst(
  dma: DmaDevice,
  machine: TestZxNextMachine,
  srcAddr: number,
  dstAddr: number,
  blockLength: number,
  prescalar: number
): void {
  dma.writeWR6(0xc7); // RESET_PORT_A_TIMING
  dma.writeWR6(0xcb); // RESET_PORT_B_TIMING

  dma.writeWR0(0x7d);                           // A→B, portA addr + block len follow
  dma.writeWR0((srcAddr >> 0) & 0xff);
  dma.writeWR0((srcAddr >> 8) & 0xff);
  dma.writeWR0((blockLength >> 0) & 0xff);
  dma.writeWR0((blockLength >> 8) & 0xff);

  dma.writeWR1(0x14);                            // portA: memory, increment

  dma.writeWR2(0x50);                            // portB: memory, timing follows
  dma.writeWR2(0x20);                            // timing: D5=1 → prescaler follows
  dma.writeWR2(prescalar & 0xff);

  dma.writeWR4(0x8d);                            // burst mode, portB addr follows
  dma.writeWR4((dstAddr >> 0) & 0xff);
  dma.writeWR4((dstAddr >> 8) & 0xff);

  dma.writeWR6(0xcf);  // LOAD
  dma.writeWR6(0x87);  // ENABLE_DMA
}

/** Configure a continuous-mode transfer (no prescaler). */
function configureContinuous(
  dma: DmaDevice,
  machine: TestZxNextMachine,
  srcAddr: number,
  dstAddr: number,
  blockLength: number
): void {
  dma.writeWR6(0xc7); // RESET_PORT_A_TIMING
  dma.writeWR6(0xcb); // RESET_PORT_B_TIMING

  dma.writeWR0(0x7d);
  dma.writeWR0((srcAddr >> 0) & 0xff);
  dma.writeWR0((srcAddr >> 8) & 0xff);
  dma.writeWR0((blockLength >> 0) & 0xff);
  dma.writeWR0((blockLength >> 8) & 0xff);

  dma.writeWR1(0x14);  // portA: memory, increment

  dma.writeWR2(0x10);  // portB: memory, increment, no timing byte

  // WR4=0xBD: bits 6-5 = 01 → continuous (both old and MAME decodes agree)
  dma.writeWR4(0xbd);
  dma.writeWR4((dstAddr >> 0) & 0xff);
  dma.writeWR4((dstAddr >> 8) & 0xff);

  dma.writeWR6(0xcf);  // LOAD
  dma.writeWR6(0x87);  // ENABLE_DMA
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 11: Prescaler Timing
// ─────────────────────────────────────────────────────────────────────────────

describe("DmaDevice - Step 11: Prescaler Timing (specnext_dma clock_w)", () => {
  let machine: TestZxNextMachine;
  let dma: DmaDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dma = machine.dmaDevice;
  });

  describe("Prescaler formula: prescaler × 4 T-states", () => {
    it("prescaler=55 → 220 T-states per byte (16kHz audio)", () => {
      machine.memoryDevice.writeMemory(0x8000, 0xaa);
      configureBurst(dma, machine, 0x8000, 0x9000, 1, 55);

      dma.stepDma(); // WAIT_READY → request bus → WAITING_ACK
      dma.acknowledgeBus();
      const t = dma.stepDma(); // transfer byte

      expect(t).toBe(220); // 55 * 4
    });

    it("prescaler=18 → 72 T-states per byte (48kHz audio)", () => {
      machine.memoryDevice.writeMemory(0x8000, 0xbb);
      configureBurst(dma, machine, 0x8000, 0x9000, 1, 18);

      dma.stepDma();
      dma.acknowledgeBus();
      const t = dma.stepDma();

      expect(t).toBe(72); // 18 * 4
    });

    it("prescaler=1 → 4 T-states per byte (minimum prescaler)", () => {
      machine.memoryDevice.writeMemory(0x8000, 0xcc);
      configureBurst(dma, machine, 0x8000, 0x9000, 1, 1);

      dma.stepDma();
      dma.acknowledgeBus();
      const t = dma.stepDma();

      expect(t).toBe(4); // 1 * 4
    });

    it("prescaler=0 defaults to 1 → 4 T-states (no-prescaler sentinel)", () => {
      machine.memoryDevice.writeMemory(0x8000, 0xdd);
      configureBurst(dma, machine, 0x8000, 0x9000, 1, 0);

      dma.stepDma();
      dma.acknowledgeBus();
      const t = dma.stepDma();

      expect(t).toBe(4); // 0 || 1 = 1 → 1 * 4
    });

    it("prescaler=110 → 440 T-states per byte (8kHz audio)", () => {
      machine.memoryDevice.writeMemory(0x8000, 0xee);
      configureBurst(dma, machine, 0x8000, 0x9000, 1, 110);

      dma.stepDma();
      dma.acknowledgeBus();
      const t = dma.stepDma();

      expect(t).toBe(440); // 110 * 4
    });
  });

  describe("Bus release in burst mode during prescaler wait", () => {
    it("burst mode releases bus after each byte transfer", () => {
      machine.memoryDevice.writeMemory(0x8000, 0x11);
      machine.memoryDevice.writeMemory(0x8001, 0x22);
      configureBurst(dma, machine, 0x8000, 0x9000, 2, 55);

      // Transfer first byte
      dma.stepDma(); // request bus
      dma.acknowledgeBus();
      dma.stepDma(); // transfer byte 1

      // Bus must be released immediately after the byte (burst interleaving)
      expect(dma.getBusControl().busRequested).toBe(false);
      expect(dma.getDmaSeq()).toBe(DmaSeq.SEQ_WAIT_READY);
    });

    it("burst mode re-requests bus on the next stepDma() after prescaler wait", () => {
      machine.memoryDevice.writeMemory(0x8000, 0x11);
      machine.memoryDevice.writeMemory(0x8001, 0x22);
      configureBurst(dma, machine, 0x8000, 0x9000, 2, 55);

      // Transfer first byte
      dma.stepDma(); // request bus
      dma.acknowledgeBus();
      dma.stepDma(); // transfer byte 1 → releases bus

      // Simulate the prescaler wait period being consumed externally,
      // then the next stepDma() re-requests the bus.
      dma.stepDma(); // WAIT_READY → request bus (byte 2)
      expect(dma.getBusControl().busRequested).toBe(true);
    });

    it("each byte in multi-byte burst returns the same prescaler T-states", () => {
      for (let i = 0; i < 4; i++) {
        machine.memoryDevice.writeMemory(0x8000 + i, i + 1);
      }
      configureBurst(dma, machine, 0x8000, 0x9000, 4, 40);

      const byteTimes: number[] = [];
      for (let byte = 0; byte < 4; byte++) {
        dma.stepDma(); // WAIT_READY → request
        dma.acknowledgeBus();
        byteTimes.push(dma.stepDma()); // transfer
      }

      // All bytes should take 40 * 4 = 160 T-states
      for (const t of byteTimes) {
        expect(t).toBe(160);
      }
    });

    it("data is correctly copied even with prescaler timing", () => {
      machine.memoryDevice.writeMemory(0x8000, 0x42);
      configureBurst(dma, machine, 0x8000, 0x9000, 1, 55);

      dma.stepDma();
      dma.acknowledgeBus();
      dma.stepDma();

      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0x42);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 12: DMA Delay Mechanism
// ─────────────────────────────────────────────────────────────────────────────

describe("DmaDevice - Step 12: DMA Delay Mechanism (specnext_dma m_dma_delay)", () => {
  let machine: TestZxNextMachine;
  let dma: DmaDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dma = machine.dmaDevice;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Getter / Setter / Reset
  // ─────────────────────────────────────────────────────────────────────────

  describe("getDmaDelay / setDmaDelay API", () => {
    it("getDmaDelay() returns false by default", () => {
      expect(dma.getDmaDelay()).toBe(false);
    });

    it("setDmaDelay(true) makes getDmaDelay() return true", () => {
      dma.setDmaDelay(true);
      expect(dma.getDmaDelay()).toBe(true);
    });

    it("setDmaDelay(false) clears the flag", () => {
      dma.setDmaDelay(true);
      dma.setDmaDelay(false);
      expect(dma.getDmaDelay()).toBe(false);
    });

    it("reset() clears dmaDelay", () => {
      dma.setDmaDelay(true);
      dma.reset();
      expect(dma.getDmaDelay()).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SEQ_WAIT_READY stall
  // ─────────────────────────────────────────────────────────────────────────

  describe("SEQ_WAIT_READY stall when dmaDelay=true", () => {
    it("dmaDelay=true at WAIT_READY: stepDma() returns 0 without requesting bus", () => {
      machine.memoryDevice.writeMemory(0x8000, 0x11);
      configureContinuous(dma, machine, 0x8000, 0x9000, 3);
      // DMA is now at SEQ_WAIT_READY (ENABLE_DMA transitions there)

      dma.setDmaDelay(true);
      const t = dma.stepDma();

      expect(t).toBe(0);
      expect(dma.getBusControl().busRequested).toBe(false);
      expect(dma.getDmaSeq()).toBe(DmaSeq.SEQ_WAIT_READY);
    });

    it("dmaDelay=true: multiple stepDma() calls all stall at WAIT_READY", () => {
      machine.memoryDevice.writeMemory(0x8000, 0x11);
      configureContinuous(dma, machine, 0x8000, 0x9000, 3);

      dma.setDmaDelay(true);
      for (let i = 0; i < 10; i++) {
        expect(dma.stepDma()).toBe(0);
        expect(dma.getBusControl().busRequested).toBe(false);
      }
    });

    it("clearing dmaDelay allows WAIT_READY to re-request bus", () => {
      machine.memoryDevice.writeMemory(0x8000, 0x11);
      configureContinuous(dma, machine, 0x8000, 0x9000, 3);

      dma.setDmaDelay(true);
      dma.stepDma(); // stall

      dma.setDmaDelay(false);
      dma.stepDma(); // now requests bus

      expect(dma.getBusControl().busRequested).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Single-byte-at-a-time: continuous mode
  // ─────────────────────────────────────────────────────────────────────────

  describe("Single-byte-at-a-time in continuous mode", () => {
    it("dmaDelay=true causes first byte to complete then forces bus release + WAIT_READY", () => {
      for (let i = 0; i < 3; i++) {
        machine.memoryDevice.writeMemory(0x8000 + i, 0x10 + i);
      }
      configureContinuous(dma, machine, 0x8000, 0x9000, 3);

      // Step 1: request bus (no delay yet)
      dma.stepDma(); // WAIT_READY → request bus
      dma.acknowledgeBus();

      // Enable delay just before the byte is transferred
      dma.setDmaDelay(true);

      // Step 2: transfer byte 1 — delay should intercept before byte 2 starts
      const t = dma.stepDma();

      expect(t).toBeGreaterThan(0); // byte was transferred
      expect(dma.getTransferState().byteCounter).toBe(1); // exactly 1 byte done
      // Bus must be released (continuous normally keeps the bus, but dmaDelay forces release)
      expect(dma.getBusControl().busRequested).toBe(false);
      // DMA now stuck at WAIT_READY
      expect(dma.getDmaSeq()).toBe(DmaSeq.SEQ_WAIT_READY);
    });

    it("data is correctly written for the single byte that transferred", () => {
      machine.memoryDevice.writeMemory(0x8000, 0xab);
      machine.memoryDevice.writeMemory(0x8001, 0xcd);
      configureContinuous(dma, machine, 0x8000, 0x9000, 2);

      dma.stepDma();
      dma.acknowledgeBus();
      dma.setDmaDelay(true);
      dma.stepDma(); // transfers only byte 1

      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0xab);
      // Byte 2 must NOT have been written yet
      expect(machine.memoryDevice.readMemory(0x9001)).not.toBe(0xcd);
    });

    it("after dmaDelay stall, clearing delay and re-requesting bus transfers next byte", () => {
      for (let i = 0; i < 3; i++) {
        machine.memoryDevice.writeMemory(0x8000 + i, 0xa0 + i);
      }
      configureContinuous(dma, machine, 0x8000, 0x9000, 3);

      // Transfer byte 1 with delay
      dma.stepDma();
      dma.acknowledgeBus();
      dma.setDmaDelay(true);
      dma.stepDma(); // byte 1 transferred, now stalled

      // Allow byte 2
      dma.setDmaDelay(false);
      dma.stepDma(); // WAIT_READY → request bus
      dma.acknowledgeBus();
      dma.stepDma(); // transfer byte 2 (set delay again for single-byte)

      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0xa0);
      expect(machine.memoryDevice.readMemory(0x9001)).toBe(0xa1);
    });

    it("dmaDelay forces WAIT_READY stall after byte 1 (stepDma returns 0)", () => {
      for (let i = 0; i < 3; i++) {
        machine.memoryDevice.writeMemory(0x8000 + i, i + 1);
      }
      configureContinuous(dma, machine, 0x8000, 0x9000, 3);

      dma.stepDma();
      dma.acknowledgeBus();
      dma.setDmaDelay(true);
      dma.stepDma(); // byte 1 transferred

      // All subsequent calls stall at WAIT_READY
      const t = dma.stepDma();
      expect(t).toBe(0);
      expect(dma.getTransferState().byteCounter).toBe(1); // no progress
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Burst mode + dmaDelay
  // ─────────────────────────────────────────────────────────────────────────

  describe("dmaDelay with burst mode", () => {
    it("dmaDelay=true at WAIT_READY prevents bus re-request after first burst byte", () => {
      machine.memoryDevice.writeMemory(0x8000, 0x11);
      machine.memoryDevice.writeMemory(0x8001, 0x22);
      configureBurst(dma, machine, 0x8000, 0x9000, 2, 1);

      // Transfer first byte (before setting dmaDelay)
      dma.stepDma(); // request bus
      dma.acknowledgeBus();
      dma.stepDma(); // transfer byte 1 → burst releases bus to WAIT_READY

      dma.setDmaDelay(true);

      // Next stepDma at WAIT_READY with dmaDelay → stall
      const t = dma.stepDma();
      expect(t).toBe(0);
      expect(dma.getBusControl().busRequested).toBe(false);
    });

    it("clearing dmaDelay after burst stall allows byte 2 to transfer", () => {
      machine.memoryDevice.writeMemory(0x8000, 0x11);
      machine.memoryDevice.writeMemory(0x8001, 0x22);
      configureBurst(dma, machine, 0x8000, 0x9000, 2, 1);

      // Byte 1
      dma.stepDma();
      dma.acknowledgeBus();
      dma.stepDma();

      // Stall
      dma.setDmaDelay(true);
      dma.stepDma(); // stall

      // Resume
      dma.setDmaDelay(false);
      dma.stepDma(); // re-requests bus
      dma.acknowledgeBus();
      dma.stepDma(); // byte 2

      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0x11);
      expect(machine.memoryDevice.readMemory(0x9001)).toBe(0x22);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Final byte is unaffected by dmaDelay
  // ─────────────────────────────────────────────────────────────────────────

  describe("Final byte not affected by dmaDelay", () => {
    it("last byte of continuous transfer completes to FINISH even with dmaDelay", () => {
      machine.memoryDevice.writeMemory(0x8000, 0xff);
      configureContinuous(dma, machine, 0x8000, 0x9000, 1);
      // Only 1 byte → is_final=true for the first (and only) byte.
      // isFinal → effectiveOpMode = 0b11 (FINISH) → sets SEQ_FINISH → handleTransferFinish()
      // The dmaDelay check fires only when dmaSeq == SEQ_TRANS1_INC_DEC_SOURCE,
      // which is not reached for the final byte path.

      dma.setDmaDelay(true);
      dma.stepDma(); // WAIT_READY  — dmaDelay stall: no bus request
      expect(dma.getDmaSeq()).toBe(DmaSeq.SEQ_WAIT_READY);

      dma.setDmaDelay(false);
      dma.stepDma(); // WAIT_READY  → request bus
      dma.acknowledgeBus();
      dma.stepDma(); // transfer + FINISH

      // Transfer completed
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0xff);
      expect(dma.getDmaSeq()).toBe(DmaSeq.SEQ_IDLE);
    });
  });
});
