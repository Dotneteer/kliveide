import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine, TestZxNextMachine } from "./TestNextMachine";

/**
 * Tests for expansion bus NMI (Task 9).
 *
 * The expansion bus can assert /NMI when expansionBusDevice.enabled is true
 * and expansionBusDevice.expansionBusNmiPending is set. It enters the same
 * NMI state machine via _nmiSourceExpBus.
 */
describe("ExpansionBusNmi", async () => {
  let m: TestZxNextMachine;

  beforeEach(async () => {
    m = await createTestNextMachine();
  });

  // ─────────────────────────────
  //  Initial state
  // ─────────────────────────────

  it("expansionBusNmiPending defaults to false", () => {
    expect(m.expansionBusDevice.expansionBusNmiPending).toBe(false);
  });

  it("hardReset clears expansionBusNmiPending", () => {
    m.expansionBusDevice.expansionBusNmiPending = true;
    m.hardReset();
    expect(m.expansionBusDevice.expansionBusNmiPending).toBe(false);
  });

  // ─────────────────────────────
  //  Expansion bus NMI acceptance
  // ─────────────────────────────

  it("expbus NMI not accepted when expansion bus is disabled", () => {
    // Ensure expansion bus is disabled (default)
    m.expansionBusDevice.nextReg80Value = 0x00; // enabled bit 7 = 0
    expect(m.expansionBusDevice.enabled).toBe(false);

    m.expansionBusDevice.expansionBusNmiPending = true;
    m.beforeOpcodeFetch();

    expect((m as any)._nmiSourceExpBus).toBe(false);
    expect(m.sigNMI).toBe(false);
  });

  it("expbus NMI accepted when expansion bus is enabled", () => {
    m.expansionBusDevice.nextReg80Value = 0x80; // bit 7 = enabled
    expect(m.expansionBusDevice.enabled).toBe(true);

    m.expansionBusDevice.expansionBusNmiPending = true;
    m.beforeOpcodeFetch();

    expect((m as any)._nmiSourceExpBus).toBe(true);
  });

  it("expbus NMI: sigNMI raised when accepted (IDLE→FETCH)", () => {
    m.expansionBusDevice.nextReg80Value = 0x80;
    m.expansionBusDevice.expansionBusNmiPending = true;

    // First call: updateNmiSources latches _nmiSourceExpBus
    // Second call: stepNmiStateMachine sees nmiActivated → FETCH, raises sigNMI
    m.beforeOpcodeFetch(); // sources updated + state machine IDLE→FETCH
    expect(m.sigNMI).toBe(true);
    expect((m as any)._nmiState).toBe("FETCH");
  });

  it("expbus NMI: pending flag cleared after acceptance", () => {
    m.expansionBusDevice.nextReg80Value = 0x80;
    m.expansionBusDevice.expansionBusNmiPending = true;
    m.beforeOpcodeFetch();

    expect(m.expansionBusDevice.expansionBusNmiPending).toBe(false);
  });

  // ─────────────────────────────
  //  Priority: expbus loses to MF and DivMMC
  // ─────────────────────────────

  it("expbus NMI not accepted when MF NMI is already active", () => {
    // First accept a MF NMI
    m.divMmcDevice.enableMultifaceNmiByM1Button = true;
    (m as any)._pendingMfNmi = true;
    m.beforeOpcodeFetch(); // _nmiSourceMf = true, state → FETCH, sigNMI = true

    expect((m as any)._nmiSourceMf).toBe(true);

    // Now try expbus NMI
    m.expansionBusDevice.nextReg80Value = 0x80;
    m.expansionBusDevice.expansionBusNmiPending = true;
    m.beforeOpcodeFetch(); // nmiActivated already true → updateNmiSources returns early

    expect((m as any)._nmiSourceExpBus).toBe(false);
    // pending flag NOT consumed yet (still waiting)
    expect(m.expansionBusDevice.expansionBusNmiPending).toBe(true);
  });

  // ─────────────────────────────
  //  HOLD state with expbus NMI
  // ─────────────────────────────

  it("expbus NMI: nmiHold returns false (no hold source modelled)", () => {
    // After _nmiSourceExpBus is latched, nmiHold should return false since
    // expbus has no hold signal modelled, so state machine proceeds to END.
    m.expansionBusDevice.nextReg80Value = 0x80;
    m.expansionBusDevice.expansionBusNmiPending = true;
    m.beforeOpcodeFetch(); // IDLE → FETCH (sigNMI raised)

    // Simulate CPU fetching 0x0066
    m.pc = 0x0066;
    m.beforeOpcodeFetch(); // FETCH → HOLD (sigNMI cleared)
    expect((m as any)._nmiState).toBe("HOLD");
    expect(m.sigNMI).toBe(false);

    // nmiHold is false for expbus → immediate HOLD → END
    m.beforeOpcodeFetch(); // HOLD → END
    m.beforeOpcodeFetch(); // END → IDLE (clears sources)
    expect((m as any)._nmiState).toBe("IDLE");
    expect((m as any)._nmiSourceExpBus).toBe(false);
  });
});
