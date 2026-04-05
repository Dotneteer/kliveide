import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";

describe("Next - ExpansionBusDevice", function () {
  // ==========================================================================
  // Hard Reset
  // ==========================================================================

  it("Hard reset sets NR $80 to 0x00", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0xff;
    d.hardReset();
    expect(d.nextReg80Value).toBe(0x00);
  });

  it("Hard reset sets NR $81 to 0x00", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg81Value = 0xff;
    d.hardReset();
    expect(d.nextReg81Value).toBe(0x00);
  });

  it("Hard reset sets bus port enables to 0xFF", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.setBusPortEnable(0, 0x00);
    d.setBusPortEnable(1, 0x00);
    d.setBusPortEnable(2, 0x00);
    d.setBusPortEnable(3, 0x00);
    d.hardReset();
    expect(d.getBusPortEnable(0)).toBe(0xff);
    expect(d.getBusPortEnable(1)).toBe(0xff);
    expect(d.getBusPortEnable(2)).toBe(0xff);
    expect(d.getBusPortEnable(3)).toBe(0xff);
  });

  it("Hard reset sets IO propagate to 0x00", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.ioPropagate = 0x3f;
    d.hardReset();
    expect(d.ioPropagate).toBe(0x00);
  });

  it("Hard reset clears NMI pending", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.expansionBusNmiPending = true;
    d.hardReset();
    expect(d.expansionBusNmiPending).toBe(false);
  });

  it("Hard reset clears INT pending", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.expansionBusIntPending = true;
    d.hardReset();
    expect(d.expansionBusIntPending).toBe(false);
  });

  it("Hard reset clears ROMCS signal", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.romcsSignal = true;
    d.hardReset();
    expect(d.romcsSignal).toBe(false);
  });

  it("Hard reset sets external bus data to 0xFF", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.externalBusData = 0x00;
    d.hardReset();
    expect(d.externalBusData).toBe(0xff);
  });

  // ==========================================================================
  // Soft Reset
  // ==========================================================================

  it("Soft reset copies low nibble to high nibble #1", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.hardReset();
    d.nextReg80Value = 0x07;
    d.reset();
    expect(d.nextReg80Value).toBe(0x77);
  });

  it("Soft reset copies low nibble to high nibble #2", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.hardReset();
    d.nextReg80Value = 0xf7;
    d.reset();
    expect(d.nextReg80Value).toBe(0x77);
  });

  it("Soft reset copies low nibble to high nibble #3", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.hardReset();
    d.nextReg80Value = 0x96;
    d.reset();
    expect(d.nextReg80Value).toBe(0x66);
  });

  // ==========================================================================
  // NR $80 — Expansion Bus Enable
  // ==========================================================================

  it("Disable expansion bus", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x00;
    expect(d.enabled).toBe(false);
  });

  it("Enable expansion bus", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80;
    expect(d.enabled).toBe(true);
  });

  it("Set ROMCS replacement", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x40;
    expect(d.romcsReplacement).toBe(true);
  });

  it("Clear ROMCS replacement", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x00;
    expect(d.romcsReplacement).toBe(false);
  });

  it("Set disable I/O cycles", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x20;
    expect(d.disableIoCycles).toBe(true);
  });

  it("Clear disable I/O cycles", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x00;
    expect(d.disableIoCycles).toBe(false);
  });

  it("Set disable memory cycles", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x10;
    expect(d.disableMemCycles).toBe(true);
  });

  it("Clear disable memory cycles", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x00;
    expect(d.disableMemCycles).toBe(false);
  });

  it("Set soft reset persistence", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x0a;
    expect(d.softResetPersistence).toBe(0x0a);
  });

  it("NR $80 roundtrip", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0xf5;
    expect(d.nextReg80Value).toBe(0xf5);
  });

  // ==========================================================================
  // NR $81 — Expansion Bus Control
  // ==========================================================================

  it("NR $81 bit 7 is read-only (ROMCS status)", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.hardReset();
    d.nextReg81Value = 0x80;
    // bit 7 should NOT be set by writing — it's read-only
    expect(d.romcsAsserted).toBe(false);
    expect(d.nextReg81Value & 0x80).toBe(0x00);
  });

  it("Set ulaOverrideEnabled", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg81Value = 0x40;
    expect(d.ulaOverrideEnabled).toBe(true);
  });

  it("Clear ulaOverrideEnabled", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg81Value = 0x00;
    expect(d.ulaOverrideEnabled).toBe(false);
  });

  it("Set nmiDebounceDisabled", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg81Value = 0x20;
    expect(d.nmiDebounceDisabled).toBe(true);
  });

  it("Clear nmiDebounceDisabled", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg81Value = 0x00;
    expect(d.nmiDebounceDisabled).toBe(false);
  });

  it("Set clockAlwaysOn", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg81Value = 0x10;
    expect(d.clockAlwaysOn).toBe(true);
  });

  it("Clear clockAlwaysOn", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg81Value = 0x00;
    expect(d.clockAlwaysOn).toBe(false);
  });

  it("NR $81 set multiple writable bits", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg81Value = 0x70; // bits 6, 5, 4
    expect(d.ulaOverrideEnabled).toBe(true);
    expect(d.nmiDebounceDisabled).toBe(true);
    expect(d.clockAlwaysOn).toBe(true);
    expect(d.nextReg81Value).toBe(0x70);
  });

  it("NR $81 ROMCS asserted reflects in read", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.hardReset();
    // Simulate external hardware asserting ROMCS
    (d as any)._romcsAsserted = true;
    expect(d.nextReg81Value & 0x80).toBe(0x80);
  });

  // ==========================================================================
  // NR $86–$89 — Expansion Bus Port Decoding Enables
  // ==========================================================================

  it("Bus port enable $86 defaults to 0xFF", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    expect(d.getBusPortEnable(0)).toBe(0xff);
  });

  it("Bus port enable $87 defaults to 0xFF", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    expect(d.getBusPortEnable(1)).toBe(0xff);
  });

  it("Bus port enable $88 defaults to 0xFF", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    expect(d.getBusPortEnable(2)).toBe(0xff);
  });

  it("Bus port enable $89 defaults to 0xFF", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    expect(d.getBusPortEnable(3)).toBe(0xff);
  });

  it("Write/read bus port enable $86", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.setBusPortEnable(0, 0xa5);
    expect(d.getBusPortEnable(0)).toBe(0xa5);
  });

  it("Write/read bus port enable $87", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.setBusPortEnable(1, 0x5a);
    expect(d.getBusPortEnable(1)).toBe(0x5a);
  });

  it("Write/read bus port enable $88", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.setBusPortEnable(2, 0x33);
    expect(d.getBusPortEnable(2)).toBe(0x33);
  });

  it("Write/read bus port enable $89", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.setBusPortEnable(3, 0xcc);
    expect(d.getBusPortEnable(3)).toBe(0xcc);
  });

  it("Bus port enable masks to 8 bits", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.setBusPortEnable(0, 0x1ff);
    expect(d.getBusPortEnable(0)).toBe(0xff);
  });

  it("Bus port enable register index wraps at 4", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.setBusPortEnable(4, 0x42); // should write to index 0
    expect(d.getBusPortEnable(0)).toBe(0x42);
  });

  // ==========================================================================
  // NR $86–$89 via NextRegDevice
  // ==========================================================================

  it("NR $86 write via NextRegDevice", async () => {
    const m = await createTestNextMachine();
    m.nextRegDevice.directSetRegValue(0x86, 0xa5);
    expect(m.expansionBusDevice.getBusPortEnable(0)).toBe(0xa5);
  });

  it("NR $86 read via NextRegDevice", async () => {
    const m = await createTestNextMachine();
    m.expansionBusDevice.setBusPortEnable(0, 0x5a);
    const val = m.nextRegDevice.directGetRegValue(0x86);
    expect(val).toBe(0x5a);
  });

  it("NR $87 write via NextRegDevice", async () => {
    const m = await createTestNextMachine();
    m.nextRegDevice.directSetRegValue(0x87, 0xb6);
    expect(m.expansionBusDevice.getBusPortEnable(1)).toBe(0xb6);
  });

  it("NR $87 read via NextRegDevice", async () => {
    const m = await createTestNextMachine();
    m.expansionBusDevice.setBusPortEnable(1, 0x6b);
    const val = m.nextRegDevice.directGetRegValue(0x87);
    expect(val).toBe(0x6b);
  });

  it("NR $88 write via NextRegDevice", async () => {
    const m = await createTestNextMachine();
    m.nextRegDevice.directSetRegValue(0x88, 0xc7);
    expect(m.expansionBusDevice.getBusPortEnable(2)).toBe(0xc7);
  });

  it("NR $88 read via NextRegDevice", async () => {
    const m = await createTestNextMachine();
    m.expansionBusDevice.setBusPortEnable(2, 0x7c);
    const val = m.nextRegDevice.directGetRegValue(0x88);
    expect(val).toBe(0x7c);
  });

  it("NR $89 write via NextRegDevice masks to 0x8F", async () => {
    const m = await createTestNextMachine();
    m.nextRegDevice.directSetRegValue(0x89, 0xff);
    expect(m.expansionBusDevice.getBusPortEnable(3)).toBe(0x8f);
  });

  it("NR $89 read via NextRegDevice masks to 0x8F", async () => {
    const m = await createTestNextMachine();
    m.expansionBusDevice.setBusPortEnable(3, 0xff);
    const val = m.nextRegDevice.directGetRegValue(0x89);
    expect(val).toBe(0x8f);
  });

  // ==========================================================================
  // NR $8A — IO Propagate
  // ==========================================================================

  it("IO propagate defaults to 0x00", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    expect(d.ioPropagate).toBe(0x00);
  });

  it("IO propagate write/read", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.ioPropagate = 0x3f;
    expect(d.ioPropagate).toBe(0x3f);
  });

  it("IO propagate masks to 6 bits", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.ioPropagate = 0xff;
    expect(d.ioPropagate).toBe(0x3f);
  });

  it("NR $8A write via NextRegDevice", async () => {
    const m = await createTestNextMachine();
    m.nextRegDevice.directSetRegValue(0x8a, 0x15);
    expect(m.expansionBusDevice.ioPropagate).toBe(0x15);
  });

  it("NR $8A read via NextRegDevice", async () => {
    const m = await createTestNextMachine();
    m.expansionBusDevice.ioPropagate = 0x2a;
    const val = m.nextRegDevice.directGetRegValue(0x8a);
    expect(val).toBe(0x2a);
  });

  it("NR $8A write via NextRegDevice masks to 6 bits", async () => {
    const m = await createTestNextMachine();
    m.nextRegDevice.directSetRegValue(0x8a, 0xff);
    expect(m.expansionBusDevice.ioPropagate).toBe(0x3f);
  });

  // ==========================================================================
  // Effective Port Enable Masking
  // ==========================================================================

  it("Effective port enable returns internal value when bus OFF", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x00; // bus disabled
    d.setBusPortEnable(0, 0x00); // all bus enables off
    expect(d.effectivePortEnable(0xff, 0)).toBe(0xff); // internal value unchanged
  });

  it("Effective port enable AND-masks when bus ON", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80; // bus enabled
    d.setBusPortEnable(0, 0xf0);
    expect(d.effectivePortEnable(0xff, 0)).toBe(0xf0); // 0xff AND 0xf0
  });

  it("Effective port enable AND with both internal and bus masks", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80;
    d.setBusPortEnable(1, 0xaa);
    expect(d.effectivePortEnable(0x55, 1)).toBe(0x00); // 0x55 AND 0xaa = 0
  });

  it("Effective port enable all enabled when both are 0xFF", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80;
    d.setBusPortEnable(2, 0xff);
    expect(d.effectivePortEnable(0xff, 2)).toBe(0xff);
  });

  it("Effective port enable zero when bus enables all zero", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80;
    d.setBusPortEnable(3, 0x00);
    expect(d.effectivePortEnable(0xff, 3)).toBe(0x00);
  });

  it("Effective port enable for each bus register index", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80;
    d.setBusPortEnable(0, 0x01);
    d.setBusPortEnable(1, 0x02);
    d.setBusPortEnable(2, 0x04);
    d.setBusPortEnable(3, 0x08);

    expect(d.effectivePortEnable(0xff, 0)).toBe(0x01);
    expect(d.effectivePortEnable(0xff, 1)).toBe(0x02);
    expect(d.effectivePortEnable(0xff, 2)).toBe(0x04);
    expect(d.effectivePortEnable(0xff, 3)).toBe(0x08);
  });

  // ==========================================================================
  // IO Propagation Check
  // ==========================================================================

  it("shouldPropagateIo returns false when bus disabled", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x00; // disabled
    d.ioPropagate = 0x3f; // all set
    expect(d.shouldPropagateIo(0)).toBe(false);
  });

  it("shouldPropagateIo returns false when bit not set", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80; // enabled
    d.ioPropagate = 0x00;
    expect(d.shouldPropagateIo(0)).toBe(false);
  });

  it("shouldPropagateIo port FE (bit 0)", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80;
    d.ioPropagate = 0x01;
    expect(d.shouldPropagateIo(0)).toBe(true);
    expect(d.shouldPropagateIo(1)).toBe(false);
  });

  it("shouldPropagateIo port 7FFD (bit 1)", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80;
    d.ioPropagate = 0x02;
    expect(d.shouldPropagateIo(1)).toBe(true);
    expect(d.shouldPropagateIo(0)).toBe(false);
  });

  it("shouldPropagateIo port DFFD (bit 2)", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80;
    d.ioPropagate = 0x04;
    expect(d.shouldPropagateIo(2)).toBe(true);
  });

  it("shouldPropagateIo port 1FFD (bit 3)", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80;
    d.ioPropagate = 0x08;
    expect(d.shouldPropagateIo(3)).toBe(true);
  });

  it("shouldPropagateIo port FF (bit 4)", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80;
    d.ioPropagate = 0x10;
    expect(d.shouldPropagateIo(4)).toBe(true);
  });

  it("shouldPropagateIo port EFF7 (bit 5)", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80;
    d.ioPropagate = 0x20;
    expect(d.shouldPropagateIo(5)).toBe(true);
  });

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

  // ==========================================================================
  // ULA Override
  // ==========================================================================

  it("ULA override not active when bus disabled", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x00;
    d.nextReg81Value = 0x40; // ULA override enabled
    expect(d.isUlaOverride(0x00fe)).toBe(false);
  });

  it("ULA override not active when NR $81 bit 6 clear", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80;
    d.nextReg81Value = 0x00;
    expect(d.isUlaOverride(0x00fe)).toBe(false);
  });

  it("ULA override active for address bits 15:12 = 0x0", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80;
    d.nextReg81Value = 0x40;
    expect(d.isUlaOverride(0x00fe)).toBe(true);
    expect(d.isUlaOverride(0x0ffe)).toBe(true);
    expect(d.isUlaOverride(0x000e)).toBe(true);
  });

  it("ULA override not active for address bits 15:12 > 0", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80;
    d.nextReg81Value = 0x40;
    expect(d.isUlaOverride(0x10fe)).toBe(false);
    expect(d.isUlaOverride(0x20fe)).toBe(false);
    expect(d.isUlaOverride(0xf0fe)).toBe(false);
  });

  // ==========================================================================
  // CPU Speed Forcing
  // ==========================================================================

  it("CPU speed forced to 3.5MHz when expansion bus enabled", async () => {
    const m = await createTestNextMachine();
    m.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz
    expect(m.cpuSpeedDevice.effectiveSpeed).toBe(0x03);
    m.expansionBusDevice.nextReg80Value = 0x80; // enable bus
    expect(m.cpuSpeedDevice.effectiveSpeed).toBe(0x00); // forced 3.5MHz
  });

  it("CPU speed restored when expansion bus disabled", async () => {
    const m = await createTestNextMachine();
    m.cpuSpeedDevice.nextReg07Value = 0x02; // 14 MHz
    m.expansionBusDevice.nextReg80Value = 0x80;
    expect(m.cpuSpeedDevice.effectiveSpeed).toBe(0x00);
    m.expansionBusDevice.nextReg80Value = 0x00; // disable bus
    expect(m.cpuSpeedDevice.effectiveSpeed).toBe(0x02); // back to 14MHz
  });

  // ==========================================================================
  // Combined Scenarios
  // ==========================================================================

  it("All NR $80 bits roundtrip", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    for (let v = 0; v < 256; v++) {
      d.nextReg80Value = v;
      expect(d.nextReg80Value).toBe(v);
    }
  });

  it("NR $81 writable bits roundtrip (bit 7 ignored)", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    // Only bits 6:4 are writable
    d.nextReg81Value = 0x70;
    expect(d.nextReg81Value).toBe(0x70);
    d.nextReg81Value = 0x00;
    expect(d.nextReg81Value).toBe(0x00);
    d.nextReg81Value = 0x50;
    expect(d.nextReg81Value).toBe(0x50);
  });

  it("Bus port enables AND-mask scenario: disable keyboard port on bus", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80; // bus on

    // NR $86 bit 0 = port 0xFF enable
    // Internal 0xFF = all enabled, Bus disables port 0xFF (bit 0 = 0)
    d.setBusPortEnable(0, 0xfe);
    expect(d.effectivePortEnable(0xff, 0)).toBe(0xfe);

    // Turn bus off — internal value should pass through unchanged
    d.nextReg80Value = 0x00;
    expect(d.effectivePortEnable(0xff, 0)).toBe(0xff);
  });

  it("IO propagate combined with effective enables", async () => {
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.nextReg80Value = 0x80; // bus on

    // Disable port 7FFD via bus port enable (NR $86 bit 1)
    d.setBusPortEnable(0, 0xfd); // bit 1 cleared
    expect(d.effectivePortEnable(0xff, 0) & 0x02).toBe(0x00);

    // But also propagate port 7FFD IO cycles (NR $8A bit 1)
    d.ioPropagate = 0x02;
    expect(d.shouldPropagateIo(1)).toBe(true);
  });
});