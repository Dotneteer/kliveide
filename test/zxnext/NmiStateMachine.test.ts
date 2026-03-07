import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine, TestZxNextMachine } from "./TestNextMachine";

/**
 * Tests for the NMI state machine (Tasks 2 & 3) in ZxNextMachine.
 *
 * strategy: we manipulate the machine's NMI-related fields directly
 * (rather than running a full Z80 fetch cycle) because wiring real
 * ROM into place and running instructions is covered by e2e tests.
 * Here we focus on the state-machine transitions.
 */
describe("NmiStateMachine", async () => {
  let m: TestZxNextMachine;

  beforeEach(async () => {
    m = await createTestNextMachine();
    // Enable the NMI enable flags so sources are accepted
    m.divMmcDevice.enableMultifaceNmiByM1Button = true;
    m.divMmcDevice.enableDivMmcNmiByDriveButton = true;
  });

  // ─────────────────────────────
  //  Initial / computed state
  // ─────────────────────────────

  it("after hard reset: nmiActivated=false, nmiAcceptCause=true, sigNMI=false", () => {
    expect(m.nmiActivated).toBe(false);
    expect(m.nmiAcceptCause).toBe(true);
    expect(m.sigNMI).toBe(false);
  });

  it("nmiHold: false when no source is active", () => {
    expect(m.nmiHold).toBe(false);
  });

  // ─────────────────────────────
  //  Task 3 – custom commands set pending flags
  // ─────────────────────────────

  it("executeCustomCommand('multifaceNmi') sets _pendingMfNmi", async () => {
    expect((m as any)._pendingMfNmi).toBe(false);
    await m.executeCustomCommand("multifaceNmi");
    expect((m as any)._pendingMfNmi).toBe(true);
  });

  it("executeCustomCommand('divmmcNmi') sets _pendingDivMmcNmi", async () => {
    expect((m as any)._pendingDivMmcNmi).toBe(false);
    await m.executeCustomCommand("divmmcNmi");
    expect((m as any)._pendingDivMmcNmi).toBe(true);
  });

  // ─────────────────────────────
  //  IDLE → FETCH transition
  // ─────────────────────────────

  it("MF NMI: IDLE→FETCH on beforeOpcodeFetch when pending and enabled", async () => {
    await m.executeCustomCommand("multifaceNmi");
    m.beforeOpcodeFetch();
    // State machine should now be in FETCH and sigNMI raised
    expect((m as any)._nmiState).toBe("FETCH");
    expect(m.sigNMI).toBe(true);
    expect((m as any)._nmiSourceMf).toBe(true);
    expect((m as any)._pendingMfNmi).toBe(false);
  });

  it("DivMMC NMI: IDLE→FETCH on beforeOpcodeFetch when pending and enabled", async () => {
    await m.executeCustomCommand("divmmcNmi");
    m.beforeOpcodeFetch();
    expect((m as any)._nmiState).toBe("FETCH");
    expect(m.sigNMI).toBe(true);
    expect((m as any)._nmiSourceDivMmc).toBe(true);
  });

  it("MF NMI not accepted when enableMultifaceNmiByM1Button=false", async () => {
    m.divMmcDevice.enableMultifaceNmiByM1Button = false;
    await m.executeCustomCommand("multifaceNmi");
    m.beforeOpcodeFetch();
    expect((m as any)._nmiState).toBe("IDLE");
    expect(m.sigNMI).toBe(false);
  });

  it("DivMMC NMI not accepted when enableDivMmcNmiByDriveButton=false", async () => {
    m.divMmcDevice.enableDivMmcNmiByDriveButton = false;
    await m.executeCustomCommand("divmmcNmi");
    m.beforeOpcodeFetch();
    expect((m as any)._nmiState).toBe("IDLE");
    expect(m.sigNMI).toBe(false);
  });

  // ─────────────────────────────
  //  FETCH → HOLD transition (fetch at 0x0066)
  // ─────────────────────────────

  it("FETCH→HOLD when pc===0x0066", async () => {
    await m.executeCustomCommand("multifaceNmi");
    m.beforeOpcodeFetch();             // IDLE→FETCH, sigNMI=true
    expect((m as any)._nmiState).toBe("FETCH");
    // Simulate the CPU jumping to 0x0066
    m.pc = 0x0066;
    m.beforeOpcodeFetch();             // FETCH→HOLD, sigNMI=false
    expect((m as any)._nmiState).toBe("HOLD");
    expect(m.sigNMI).toBe(false);
  });

  it("FETCH stays in FETCH when pc!==0x0066", async () => {
    await m.executeCustomCommand("multifaceNmi");
    m.beforeOpcodeFetch();
    m.pc = 0x1234;
    m.beforeOpcodeFetch();
    expect((m as any)._nmiState).toBe("FETCH");
    expect(m.sigNMI).toBe(true);
  });

  // ─────────────────────────────
  //  HOLD → END transition
  // ─────────────────────────────

  it("HOLD→END when nmiHold drops false (MF: nmiActive cleared)", async () => {
    await m.executeCustomCommand("multifaceNmi");
    m.beforeOpcodeFetch();   // IDLE→FETCH
    m.pc = 0x0066;
    m.beforeOpcodeFetch();   // FETCH→HOLD
    // At this point multifaceDevice.nmiActive=true (pressNmiButton was called)
    expect(m.nmiHold).toBe(true);
    expect((m as any)._nmiState).toBe("HOLD");
    // Clear nmiActive — simulates RETN completion
    m.multifaceDevice.nmiActive = false;
    m.beforeOpcodeFetch();   // HOLD→END
    expect((m as any)._nmiState).toBe("END");
  });

  it("HOLD stays in HOLD while nmiHold is true", async () => {
    await m.executeCustomCommand("multifaceNmi");
    m.beforeOpcodeFetch();
    m.pc = 0x0066;
    m.beforeOpcodeFetch();   // FETCH→HOLD
    // nmiActive is still true, so nmiHold is true
    m.beforeOpcodeFetch();
    expect((m as any)._nmiState).toBe("HOLD");
  });

  // ─────────────────────────────
  //  END → IDLE transition
  // ─────────────────────────────

  it("END→IDLE clears source latches", async () => {
    await m.executeCustomCommand("multifaceNmi");
    m.beforeOpcodeFetch();   // IDLE→FETCH
    m.pc = 0x0066;
    m.beforeOpcodeFetch();   // FETCH→HOLD
    m.multifaceDevice.nmiActive = false;
    m.beforeOpcodeFetch();   // HOLD→END
    m.beforeOpcodeFetch();   // END→IDLE
    expect((m as any)._nmiState).toBe("IDLE");
    expect((m as any)._nmiSourceMf).toBe(false);
    expect((m as any)._nmiSourceDivMmc).toBe(false);
    expect((m as any)._nmiSourceExpBus).toBe(false);
    expect(m.nmiActivated).toBe(false);
  });

  // ─────────────────────────────
  //  Arbitration — first come first served
  // ─────────────────────────────

  it("MF wins over DivMMC when both pending", async () => {
    await m.executeCustomCommand("multifaceNmi");
    await m.executeCustomCommand("divmmcNmi");
    m.beforeOpcodeFetch();
    expect((m as any)._nmiSourceMf).toBe(true);
    expect((m as any)._nmiSourceDivMmc).toBe(false);
  });

  it("DivMMC is not accepted when MF is already active", async () => {
    await m.executeCustomCommand("multifaceNmi");
    m.beforeOpcodeFetch();   // IDLE→FETCH, MF latched
    // Now add DivMMC pending — nmiAcceptCause is still true in FETCH
    (m as any)._pendingDivMmcNmi = true;
    m.pc = 0x1234;
    m.beforeOpcodeFetch();   // stays FETCH
    // MF is active, so DivMMC must NOT have been accepted
    expect((m as any)._nmiSourceDivMmc).toBe(false);
  });

  // ─────────────────────────────
  //  nmiAcceptCause gating
  // ─────────────────────────────

  it("nmiAcceptCause: false in HOLD state", async () => {
    await m.executeCustomCommand("multifaceNmi");
    m.beforeOpcodeFetch();
    m.pc = 0x0066;
    m.beforeOpcodeFetch();
    expect(m.nmiAcceptCause).toBe(false);
  });

  it("nmiAcceptCause: false in END state", async () => {
    await m.executeCustomCommand("multifaceNmi");
    m.beforeOpcodeFetch();
    m.pc = 0x0066;
    m.beforeOpcodeFetch();
    m.multifaceDevice.nmiActive = false;
    m.beforeOpcodeFetch();
    expect(m.nmiAcceptCause).toBe(false);
  });

  // ─────────────────────────────
  //  MF pressNmiButton / onFetch0066 side-effects
  // ─────────────────────────────

  it("pressNmiButton called on MF device when IDLE→FETCH", async () => {
    m.multifaceDevice.invisible = true;
    await m.executeCustomCommand("multifaceNmi");
    m.beforeOpcodeFetch();   // IDLE→FETCH
    expect(m.multifaceDevice.nmiActive).toBe(true);
    expect(m.multifaceDevice.invisible).toBe(false); // pressNmiButton clears invisible
  });

  it("onFetch0066 pages in MF memory when pc===0x0066", async () => {
    await m.executeCustomCommand("multifaceNmi");
    m.beforeOpcodeFetch();   // IDLE→FETCH
    m.pc = 0x0066;
    m.beforeOpcodeFetch();   // FETCH→HOLD, onFetch0066 called
    expect(m.multifaceDevice.mfEnabled).toBe(true);
  });

  it("armNmiButton called on DivMMC device when IDLE→FETCH", async () => {
    await m.executeCustomCommand("divmmcNmi");
    expect(m.divMmcDevice.divMmcNmiHold).toBe(false);
    m.beforeOpcodeFetch();
    // armNmiButton sets _nmiButtonPressed → divMmcNmiHold should be true
    expect(m.divMmcDevice.divMmcNmiHold).toBe(true);
  });
});
