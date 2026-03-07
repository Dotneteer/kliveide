import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine, TestZxNextMachine } from "./TestNextMachine";

/**
 * Tests for Task 4: Software NMI via nextreg 0x02 write (bits 3 and 2).
 */
describe("NmiSoftware – nextreg 0x02", async () => {
  let m: TestZxNextMachine;

  beforeEach(async () => {
    m = await createTestNextMachine();
    m.divMmcDevice.enableMultifaceNmiByM1Button = true;
    m.divMmcDevice.enableDivMmcNmiByDriveButton = true;
  });

  // ─────────────────────────────
  //  InterruptDevice flags updated by write
  // ─────────────────────────────

  it("writing bit 3 sets mfNmiByNextReg", () => {
    m.tbblueOut(0x02, 0x08);
    expect(m.interruptDevice.mfNmiByNextReg).toBe(true);
  });

  it("writing bit 3 = 0 clears mfNmiByNextReg", () => {
    m.tbblueOut(0x02, 0x08); // set
    m.tbblueOut(0x02, 0x00); // clear
    expect(m.interruptDevice.mfNmiByNextReg).toBe(false);
  });

  it("writing bit 2 sets divMccNmiBtNextReg", () => {
    m.tbblueOut(0x02, 0x04);
    expect(m.interruptDevice.divMccNmiBtNextReg).toBe(true);
  });

  it("writing bit 2 = 0 clears divMccNmiBtNextReg", () => {
    m.tbblueOut(0x02, 0x04);
    m.tbblueOut(0x02, 0x00);
    expect(m.interruptDevice.divMccNmiBtNextReg).toBe(false);
  });

  it("writing bit 4 = 0 clears mfNmiByIoTrap", () => {
    m.interruptDevice.mfNmiByIoTrap = true;
    m.tbblueOut(0x02, 0x00); // no bit 4
    expect(m.interruptDevice.mfNmiByIoTrap).toBe(false);
  });

  it("writing bit 4 = 1 does NOT clear mfNmiByIoTrap", () => {
    m.interruptDevice.mfNmiByIoTrap = true;
    m.tbblueOut(0x02, 0x10);
    expect(m.interruptDevice.mfNmiByIoTrap).toBe(true);
  });

  it("writing bit 7 sets busResetRequested", () => {
    m.tbblueOut(0x02, 0x80);
    expect(m.interruptDevice.busResetRequested).toBe(true);
  });

  // ─────────────────────────────
  //  Software NMI actually triggers the state machine
  // ─────────────────────────────

  it("writing bit 3 (MF NMI) while nmiAcceptCause triggers MF NMI", () => {
    expect(m.nmiAcceptCause).toBe(true); // IDLE
    m.tbblueOut(0x02, 0x08);
    m.beforeOpcodeFetch(); // should accept pending NMI
    expect((m as any)._nmiState).toBe("FETCH");
    expect((m as any)._nmiSourceMf).toBe(true);
    expect(m.sigNMI).toBe(true);
  });

  it("writing bit 2 (DivMMC NMI) while nmiAcceptCause triggers DivMMC NMI", () => {
    m.tbblueOut(0x02, 0x04);
    m.beforeOpcodeFetch();
    expect((m as any)._nmiState).toBe("FETCH");
    expect((m as any)._nmiSourceDivMmc).toBe(true);
    expect(m.sigNMI).toBe(true);
  });

  it("software NMI NOT accepted when nmiAcceptCause=false (HOLD state)", async () => {
    // Drive the machine to HOLD state first
    await m.executeCustomCommand("multifaceNmi");
    m.beforeOpcodeFetch();   // IDLE→FETCH
    m.pc = 0x0066;
    m.beforeOpcodeFetch();   // FETCH→HOLD
    expect(m.nmiAcceptCause).toBe(false);

    // Now request via software — should be silently dropped
    m.tbblueOut(0x02, 0x04);
    expect((m as any)._pendingDivMmcNmi).toBe(false);
    expect((m as any)._nmiSourceDivMmc).toBe(false);
  });

  // ─────────────────────────────
  //  Read reflects status flags
  // ─────────────────────────────

  it("readFn returns correct bitmask from interruptDevice", () => {
    m.interruptDevice.mfNmiByNextReg = true;
    m.interruptDevice.divMccNmiBtNextReg = true;
    m.interruptDevice.busResetRequested = false;
    m.nextRegDevice.setNextRegisterIndex(0x02);
    const val = m.nextRegDevice.getNextRegisterValue();
    expect(val & 0x08).toBeTruthy();
    expect(val & 0x04).toBeTruthy();
    expect(val & 0x80).toBe(0x00);
  });
});
