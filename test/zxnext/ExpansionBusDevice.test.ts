import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";

/*
 * What stays of the expansion bus mock tests: the signals a peripheral on the bus would drive (ROMCS,
 * /NMI, /INT). The harness has no bus peripheral to plug in, so these still set the device's inputs
 * directly. Everything a program can see - $80, $81, $86-$89, $8A, the port enables, the ULA override,
 * the reset behaviour and the speed override - is tested on both cores in
 * `test/zxnext-hw/bus/expansion-bus.test.ts` and `test/zxnext-hw/speed/cpu-speed.test.ts`.
 */
describe("Next - ExpansionBusDevice", function () {
  // ==========================================================================
  // ROMCS Claimed
  // ==========================================================================

  it("ROMCS not claimed when bus disabled", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x00; // disabled
    d.romcsSignal = true;
    expect(d.isRomcsClaimed).toBe(false);
  });

  it("ROMCS not claimed when memory cycles disabled", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x90; // enabled + disable mem
    d.romcsSignal = true;
    expect(d.isRomcsClaimed).toBe(false);
  });

  it("ROMCS not claimed when signal not asserted", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80; // enabled
    d.romcsSignal = false;
    expect(d.isRomcsClaimed).toBe(false);
  });

  it("ROMCS claimed when all conditions met", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80; // enabled, mem cycles not disabled
    d.romcsSignal = true;
    expect(d.isRomcsClaimed).toBe(true);
  });

  // ==========================================================================
  // NMI Assertion
  // ==========================================================================

  it("NMI not asserted when bus disabled", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x00;
    d.expansionBusNmiPending = true;
    expect(d.isNmiAsserted).toBe(false);
  });

  it("NMI not asserted when memory cycles disabled", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x90; // enabled + mem disabled
    d.expansionBusNmiPending = true;
    expect(d.isNmiAsserted).toBe(false);
  });

  it("NMI not asserted when no NMI pending", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80;
    d.expansionBusNmiPending = false;
    expect(d.isNmiAsserted).toBe(false);
  });

  it("NMI asserted when all conditions met", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80;
    d.expansionBusNmiPending = true;
    expect(d.isNmiAsserted).toBe(true);
  });

  // ==========================================================================
  // INT Assertion
  // ==========================================================================

  it("INT not active when bus disabled", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x00;
    d.expansionBusIntPending = true;
    m.interruptDevice.expBusInterruptEnabled = true;
    expect(d.isIntActive).toBe(false);
  });

  it("INT not active when IO disabled", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0xa0; // enabled + IO disabled
    d.expansionBusIntPending = true;
    m.interruptDevice.expBusInterruptEnabled = true;
    expect(d.isIntActive).toBe(false);
  });

  it("INT not active when expBusInterruptEnabled is false", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80;
    d.expansionBusIntPending = true;
    m.interruptDevice.expBusInterruptEnabled = false;
    expect(d.isIntActive).toBe(false);
  });

  it("INT not active when no INT pending", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80;
    d.expansionBusIntPending = false;
    m.interruptDevice.expBusInterruptEnabled = true;
    expect(d.isIntActive).toBe(false);
  });

  it("INT active when all conditions met", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80;
    d.expansionBusIntPending = true;
    m.interruptDevice.expBusInterruptEnabled = true;
    expect(d.isIntActive).toBe(true);
  });
});
