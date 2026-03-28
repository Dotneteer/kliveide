import { describe, it, expect, beforeEach } from "vitest";
import { DmaDevice, DmaState, RegisterWriteSequence } from "@emu/machines/zxNext/DmaDevice";
import { TestZxNextMachine } from "./TestNextMachine";

/**
 * Tests for Step 5 (WR2 prescaler conditionality) and Step 6 (WR3 follow bytes and D6 trigger).
 *
 * Step 5: specnext_dma.cpp prescalar behaviour — the ZXN prescaler byte follows only when
 *   the timing byte has D5=1.  When D5=0 the sequence returns to IDLE after the timing byte.
 *
 * Step 6: WR3 conditional follow bytes.
 *   D3=1 → mask byte follows
 *   D4=1 → match byte follows
 *   D6=1 → dmaState = START_DMA immediately (does NOT touch dmaEnabled / D0)
 */
describe("DmaDevice - Step 5: WR2 Prescaler Conditionality", () => {
  let machine: TestZxNextMachine;
  let dma: DmaDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dma = machine.dmaDevice;
  });

  // ── WR2 timing byte: D5=0 → no prescaler ─────────────────────────────────

  it("timing byte with D5=0: sequence returns to IDLE", () => {
    dma.writeWR2(0x40); // D6=1 — timing byte follows
    // Timing byte without D5 set
    dma.writeWR2(0x00);
    expect(dma.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
  });

  it("timing byte with D5=0 (value 0x01): sequence returns to IDLE", () => {
    dma.writeWR2(0x40);
    dma.writeWR2(0x01); // D5=0
    expect(dma.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
  });

  it("timing byte with D5=0: next write is treated as a new base byte", () => {
    dma.writeWR2(0x40);
    dma.writeWR2(0x00); // D5=0 → no prescaler expected
    // The next byte should dispatch as a new command, not consume a prescaler slot.
    // 0x80 dispatches to WR3 (0x80 & 0x83 == 0x80).
    dma.writePort(0x80);
    expect(dma.getRawReg(3, 0)).toBe(0x80);
  });

  // ── WR2 timing byte: D5=1 → prescaler follows ────────────────────────────

  it("timing byte with D5=1: R2_BYTE_1 (prescaler) is next", () => {
    dma.writeWR2(0x40); // D6=1 — timing byte follows
    dma.writeWR2(0x20); // D5=1 → prescaler byte follows
    expect(dma.getRegisterWriteSeq()).toBe(RegisterWriteSequence.R2_BYTE_1);
  });

  it("timing byte with D5=1: prescaler byte stored correctly", () => {
    dma.writeWR2(0x40);
    dma.writeWR2(0x20);
    dma.writeWR2(0xab); // prescaler byte
    expect(dma.getRegisters().portBPrescalar).toBe(0xab);
    expect(dma.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
  });

  it("timing byte 0x20 (D5=1) alone triggers prescaler follow", () => {
    dma.writeWR2(0x40);
    dma.writeWR2(0x20);
    dma.writeWR2(0x42);
    expect(dma.getRegisters().portBPrescalar).toBe(0x42);
  });

  // ── Same behaviour via writePort() follow path ────────────────────────────

  it("via writePort(): D5=0 timing byte → IDLE after timing byte", () => {
    // WR2 base with D6=1 (0x40 & 0x87 == 0x00 → WR2)
    dma.writePort(0x40);
    expect(dma.getRegisterWriteSeq()).toBe(RegisterWriteSequence.R2_BYTE_0);
    dma.writePort(0x00); // timing byte D5=0
    expect(dma.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
  });

  it("via writePort(): D5=1 timing byte → prescaler queued", () => {
    dma.writePort(0x40);
    dma.writePort(0x20); // timing byte D5=1
    expect(dma.getRegisterWriteSeq()).toBe(RegisterWriteSequence.R2_BYTE_1);
    dma.writePort(0x55);
    expect(dma.getRegisters().portBPrescalar).toBe(0x55);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("DmaDevice - Step 6: WR3 Follow Bytes and D6 Enable Trigger", () => {
  let machine: TestZxNextMachine;
  let dma: DmaDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dma = machine.dmaDevice;
  });

  // ── D3 / D4 follow byte queue ─────────────────────────────────────────────

  it("WR3 with D3=0, D4=0: no follow bytes expected", () => {
    dma.writePort(0x80); // WR3 base, D3=D4=0
    expect(dma.getNumFollow()).toBe(0);
    expect(dma.getRegisterWriteSeq()).toBe(RegisterWriteSequence.IDLE);
  });

  it("WR3 with D3=1: one follow byte (mask byte) queued", () => {
    dma.writePort(0x88); // WR3 | D3=1
    expect(dma.getNumFollow()).toBe(1);
  });

  it("WR3 with D4=1: one follow byte (match byte) queued", () => {
    dma.writePort(0x90); // WR3 | D4=1
    expect(dma.getNumFollow()).toBe(1);
  });

  it("WR3 with D3=1 and D4=1: two follow bytes queued", () => {
    dma.writePort(0x98); // WR3 | D3=1 | D4=1
    expect(dma.getNumFollow()).toBe(2);
  });

  it("mask byte (D3=1) is written to raw reg (3,1)", () => {
    dma.writePort(0x88); // WR3 | D3=1
    dma.writePort(0xf0); // mask byte
    expect(dma.getRawReg(3, 1)).toBe(0xf0);
  });

  it("match byte (D4=1) is written to raw reg (3,2)", () => {
    dma.writePort(0x90); // WR3 | D4=1
    dma.writePort(0x3c); // match byte
    expect(dma.getRawReg(3, 2)).toBe(0x3c);
  });

  it("mask then match bytes written when D3=1 and D4=1", () => {
    dma.writePort(0x98); // WR3 | D3=1 | D4=1
    dma.writePort(0xaa); // first follow → mask byte
    dma.writePort(0x55); // second follow → match byte
    expect(dma.getRawReg(3, 1)).toBe(0xaa);
    expect(dma.getRawReg(3, 2)).toBe(0x55);
  });

  // ── D6 trigger: dmaState = START_DMA, dmaEnabled not forced ──────────────

  it("WR3 with D6=1: dmaState becomes START_DMA", () => {
    dma.writePort(0xc0); // WR3 | D6=1
    expect(dma.getDmaState()).toBe(DmaState.START_DMA);
  });

  it("WR3 with D6=1 and D0=0: dmaEnabled stays false", () => {
    dma.writePort(0xc0); // WR3 | D6=1 | D0=0
    expect(dma.getRegisters().dmaEnabled).toBe(false);
    expect(dma.getDmaState()).toBe(DmaState.START_DMA);
  });

  it("WR3 with D6=1 and D0=1 (via writeWR3): dmaEnabled=true and dmaState=START_DMA", () => {
    // Note: 0xc1 dispatches to WR4 via writePort() (rule: (0xc1 & 0x83) == 0x81).
    // D0=1 in WR3 can only be set by calling writeWR3() directly.
    dma.writeWR3(0xc1); // D6=1 | D0=1
    expect(dma.getRegisters().dmaEnabled).toBe(true);
    expect(dma.getDmaState()).toBe(DmaState.START_DMA);
  });

  it("WR3 with D6=0: dmaState stays IDLE", () => {
    dma.writePort(0x80); // WR3, D6=0
    expect(dma.getDmaState()).toBe(DmaState.IDLE);
  });

  it("WR3 D6=1 via writeWR3() directly: dmaState = START_DMA", () => {
    dma.writeWR3(0xc0); // D6=1 | D0=0
    expect(dma.getDmaState()).toBe(DmaState.START_DMA);
    expect(dma.getRegisters().dmaEnabled).toBe(false);
  });

  it("WR3 D6=1, D3=1: dmaState triggered AND mask byte queued", () => {
    dma.writePort(0xc8); // WR3 | D6=1 | D3=1
    expect(dma.getDmaState()).toBe(DmaState.START_DMA);
    expect(dma.getNumFollow()).toBe(1);
    dma.writePort(0x0f); // mask byte
    expect(dma.getRawReg(3, 1)).toBe(0x0f);
  });

  it("WR3 base byte stored at raw reg (3,0)", () => {
    dma.writePort(0x98); // WR3 | D3=1 | D4=1
    expect(dma.getRawReg(3, 0)).toBe(0x98);
  });
});
