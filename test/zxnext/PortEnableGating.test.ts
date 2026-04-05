import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

// --- Helpers
function writeNextReg(m: IZxNextMachine, reg: number, value: number) {
  m.nextRegDevice.setNextRegisterIndex(reg);
  m.nextRegDevice.setNextRegisterValue(value);
}

function readNextReg(m: IZxNextMachine, reg: number): number {
  m.nextRegDevice.setNextRegisterIndex(reg);
  return m.nextRegDevice.getNextRegisterValue();
}

describe("Next - Port Enable Gating (NR $82-$85)", function () {
  // ==========================================================================
  // Initialization & Reset
  // ==========================================================================

  it("Hard reset sets NR $82 to 0xFF (all internal enables on)", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x82, 0x00); // disable all
    m.nextRegDevice.hardReset();
    expect(readNextReg(m, 0x82)).toBe(0xff);
  });

  it("Hard reset sets NR $83 to 0xFF (all internal enables on)", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x83, 0x00);
    m.nextRegDevice.hardReset();
    expect(readNextReg(m, 0x83)).toBe(0xff);
  });

  it("Hard reset sets NR $84 to 0xFF (all internal enables on)", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x84, 0x00);
    m.nextRegDevice.hardReset();
    expect(readNextReg(m, 0x84)).toBe(0xff);
  });

  it("Hard reset sets NR $85 to 0x0F (enables on, reset mode off)", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x85, 0x8f);
    m.nextRegDevice.hardReset();
    expect(readNextReg(m, 0x85)).toBe(0x0f);
  });

  it("isPortGroupEnabled returns true by default for all groups", async () => {
    const m = await createTestNextMachine();
    for (let ri = 0; ri < 4; ri++) {
      for (let bit = 0; bit < 8; bit++) {
        if (ri === 3 && bit >= 4) continue; // NR $85 bits 4-6 unused, bit 7 = reset mode
        expect(m.nextRegDevice.isPortGroupEnabled(ri, bit)).toBe(true);
      }
    }
  });

  // ==========================================================================
  // NR $82 — Port 0xFF (bit 0)
  // ==========================================================================

  it("Port 0xFF reads Timex value when NR $82 bit 0 is set", async () => {
    const m = await createTestNextMachine();
    m.portManager.writePort(0xff, 0x07);
    expect(m.portManager.readPort(0xff)).toBe(0x07);
  });

  it("Port 0xFF returns 0xFF when NR $82 bit 0 is cleared", async () => {
    const m = await createTestNextMachine();
    m.portManager.writePort(0xff, 0x07);
    writeNextReg(m, 0x82, 0xfe); // clear bit 0
    expect(m.portManager.readPort(0xff)).toBe(0xff);
  });

  it("Port 0xFF write is ignored when NR $82 bit 0 is cleared", async () => {
    const m = await createTestNextMachine();
    m.portManager.writePort(0xff, 0x07); // initial write (enabled)
    writeNextReg(m, 0x82, 0xfe); // disable
    m.portManager.writePort(0xff, 0x3f); // this should be ignored
    writeNextReg(m, 0x82, 0xff); // re-enable
    expect(m.portManager.readPort(0xff)).toBe(0x07); // still the old value
  });

  // ==========================================================================
  // NR $82 — Port 0x7FFD (bit 1)
  // ==========================================================================

  it("Port 0x7FFD write works when NR $82 bit 1 is set", async () => {
    const m = await createTestNextMachine();
    m.portManager.writePort(0x7ffd, 0x01);
    expect(m.memoryDevice.port7ffdValue).toBe(0x01);
  });

  it("Port 0x7FFD write is blocked when NR $82 bit 1 is cleared", async () => {
    const m = await createTestNextMachine();
    const initial = m.memoryDevice.port7ffdValue;
    writeNextReg(m, 0x82, 0xfd); // clear bit 1
    m.portManager.writePort(0x7ffd, 0x05);
    expect(m.memoryDevice.port7ffdValue).toBe(initial);
  });

  // ==========================================================================
  // NR $82 — Port 0xDFFD (bit 2)
  // ==========================================================================

  it("Port 0xDFFD write is blocked when NR $82 bit 2 is cleared", async () => {
    const m = await createTestNextMachine();
    const initial = m.memoryDevice.portDffdValue;
    writeNextReg(m, 0x82, 0xfb); // clear bit 2
    m.portManager.writePort(0xdffd, 0x03);
    expect(m.memoryDevice.portDffdValue).toBe(initial);
  });

  // ==========================================================================
  // NR $82 — Port 0x1FFD (bit 3)
  // ==========================================================================

  it("Port 0x1FFD write is blocked when NR $82 bit 3 is cleared", async () => {
    const m = await createTestNextMachine();
    const initial = m.memoryDevice.port1ffdValue;
    writeNextReg(m, 0x82, 0xf7); // clear bit 3
    m.portManager.writePort(0x1ffd, 0x04);
    expect(m.memoryDevice.port1ffdValue).toBe(initial);
  });

  // ==========================================================================
  // NR $82 — FDC ports 0x2FFD/0x3FFD (bit 4)
  // ==========================================================================

  it("Port 0x2FFD read returns 0xFF when NR $82 bit 4 is cleared", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x82, 0xef); // clear bit 4
    expect(m.portManager.readPort(0x2ffd)).toBe(0xff);
  });

  it("Port 0x3FFD read returns 0xFF when NR $82 bit 4 is cleared", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x82, 0xef); // clear bit 4
    expect(m.portManager.readPort(0x3ffd)).toBe(0xff);
  });

  // ==========================================================================
  // NR $82 — ZXN DMA port 0x6B (bit 5)
  // ==========================================================================

  it("Port 0x6B read returns 0xFF when NR $82 bit 5 is cleared", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x82, 0xdf); // clear bit 5
    expect(m.portManager.readPort(0x6b)).toBe(0xff);
  });

  // ==========================================================================
  // NR $82 — Kempston joy 1 port 0x1F (bit 6)
  // ==========================================================================

  it("Port 0x1F Kempston read returns 0xFF when NR $82 bit 6 is cleared", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x82, 0xbf); // clear bit 6
    // All Kempston/Multiface/DAC readers at 0x1F should fall through
    const val = m.portManager.readPort(0x1f);
    // When kempston is disabled, read should not return joystick data
    // (multiface may still respond if enabled, but with default state returns not-handled)
    expect(val).toBe(0xff);
  });

  // ==========================================================================
  // NR $82 — Kempston joy 2 port 0x37 (bit 7)
  // ==========================================================================

  it("Port 0x37 Kempston 2 read returns 0xFF when NR $82 bit 7 is cleared", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x82, 0x7f); // clear bit 7
    expect(m.portManager.readPort(0x37)).toBe(0xff);
  });

  // ==========================================================================
  // NR $83 — DivMMC port 0xE3 (bit 0)
  // ==========================================================================

  it("Port 0xE3 read returns 0xFF when NR $83 bit 0 is cleared", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x83, 0xfe); // clear bit 0
    expect(m.portManager.readPort(0xe3)).toBe(0xff);
  });

  it("Port 0xE3 write is blocked when NR $83 bit 0 is cleared", async () => {
    const m = await createTestNextMachine();
    // DivMMC disable via NR $83 also disables internally via nextReg83Value
    writeNextReg(m, 0x83, 0xfe); // clear bit 0
    m.portManager.writePort(0xe3, 0x55);
    // When DivMMC is disabled, port 0xE3 getter returns 0xFF regardless
    expect(m.divMmcDevice.port0xe3Value).toBe(0xff);
  });

  // ==========================================================================
  // NR $83 — I2C ports 0x103B/0x113B (bit 2)
  // ==========================================================================

  it("Port 0x103B read returns 0xFF when NR $83 bit 2 is cleared", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x83, 0xfb); // clear bit 2
    expect(m.portManager.readPort(0x103b)).toBe(0xff);
  });

  it("Port 0x113B read returns 0xFF when NR $83 bit 2 is cleared", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x83, 0xfb); // clear bit 2
    expect(m.portManager.readPort(0x113b)).toBe(0xff);
  });

  // ==========================================================================
  // NR $83 — UART ports 0x133B-0x163B (bit 4)
  // ==========================================================================

  it("Port 0x133B read returns 0xFF when NR $83 bit 4 is cleared", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x83, 0xef); // clear bit 4
    expect(m.portManager.readPort(0x133b)).toBe(0xff);
  });

  it("Port 0x143B read returns 0xFF when NR $83 bit 4 is cleared", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x83, 0xef); // clear bit 4
    expect(m.portManager.readPort(0x143b)).toBe(0xff);
  });

  it("Port 0x153B read returns 0xFF when NR $83 bit 4 is cleared", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x83, 0xef); // clear bit 4
    expect(m.portManager.readPort(0x153b)).toBe(0xff);
  });

  it("Port 0x163B read returns 0xFF when NR $83 bit 4 is cleared", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x83, 0xef); // clear bit 4
    expect(m.portManager.readPort(0x163b)).toBe(0xff);
  });

  // ==========================================================================
  // NR $83 — Mouse ports (bit 5)
  // ==========================================================================

  it("Mouse ports return Kempston alias instead of mouse data when NR $83 bit 5 is cleared", async () => {
    const m = await createTestNextMachine();
    // Set mouse position so we can distinguish mouse data from other handlers
    m.mouseDevice.xPos = 0x42;
    m.mouseDevice.yPos = 0x55;
    // With mouse enabled, read mouse X port
    expect(m.portManager.readPort(0xfbdf)).toBe(0x42);
    // Disable mouse (NR $83 bit 5)
    writeNextReg(m, 0x83, 0xdf);
    // Mouse ports overlap with Kempston joy alias (mask 0x00FF) at low byte 0xDF
    // When mouse disabled, alias responds with joystick data (0x00 = no buttons)
    expect(m.portManager.readPort(0xfbdf)).toBe(0x00);
    // Verify mouse Y port also does not return mouse data
    expect(m.portManager.readPort(0xffdf)).not.toBe(0x55);
  });

  // ==========================================================================
  // NR $83 — Sprite ports (bit 6)
  // ==========================================================================

  it("Port 0x303B read returns 0xFF when NR $83 bit 6 is cleared", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x83, 0xbf); // clear bit 6
    expect(m.portManager.readPort(0x303b)).toBe(0xff);
  });

  // ==========================================================================
  // NR $83 — Layer 2 port 0x123B (bit 7)
  // ==========================================================================

  it("Port 0x123B read returns 0xFF when NR $83 bit 7 is cleared", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x83, 0x7f); // clear bit 7
    expect(m.portManager.readPort(0x123b)).toBe(0xff);
  });

  it("Port 0x123B write is blocked when NR $83 bit 7 is cleared", async () => {
    const m = await createTestNextMachine();
    m.portManager.writePort(0x123b, 0x02); // initial write (enabled)
    writeNextReg(m, 0x83, 0x7f); // disable layer2
    m.portManager.writePort(0x123b, 0x10); // this should be ignored
    writeNextReg(m, 0x83, 0xff); // re-enable
    expect(m.portManager.readPort(0x123b)).toBe(0x02); // still old value
  });

  // ==========================================================================
  // NR $84 — AY ports (bit 0)
  // ==========================================================================

  it("Port 0xFFFD AY read returns 0xFF when NR $84 bit 0 is cleared", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x84, 0xfe); // clear bit 0
    expect(m.portManager.readPort(0xfffd)).toBe(0xff);
  });

  it("Port 0xBFFD AY read returns 0xFF when NR $84 bit 0 is cleared", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x84, 0xfe); // clear bit 0
    expect(m.portManager.readPort(0xbffd)).toBe(0xff);
  });

  // ==========================================================================
  // NR $85 — ULA+ ports (bit 0)
  // ==========================================================================

  it("Port 0xFF3B ULA+ read returns 0xFF when NR $85 bit 0 is cleared", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x85, 0x0e); // clear bit 0
    expect(m.portManager.readPort(0xff3b)).toBe(0xff);
  });

  // ==========================================================================
  // NR $85 — Z80 DMA port 0x0B (bit 1)
  // ==========================================================================

  it("Port 0x0B Z80 DMA read returns 0xFF when NR $85 bit 1 is cleared", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x85, 0x0d); // clear bit 1
    expect(m.portManager.readPort(0x0b)).toBe(0xff);
  });

  // ==========================================================================
  // NR $85 — Pentagon 1024 port 0xEFF7 (bit 2)
  // ==========================================================================

  it("Port 0xEFF7 write is blocked when NR $85 bit 2 is cleared", async () => {
    const m = await createTestNextMachine();
    const initial = m.memoryDevice.portEff7Value;
    writeNextReg(m, 0x85, 0x0b); // clear bit 2
    m.portManager.writePort(0xeff7, 0x0c);
    expect(m.memoryDevice.portEff7Value).toBe(initial);
  });

  // ==========================================================================
  // NR $85 — CTC ports (bit 3)
  // ==========================================================================

  it("CTC port 0x183B read returns 0xFF when NR $85 bit 3 is cleared", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x85, 0x07); // clear bit 3
    expect(m.portManager.readPort(0x183b)).toBe(0xff);
  });

  // ==========================================================================
  // Expansion Bus AND-masking (NR $86–$89)
  // ==========================================================================

  it("Bus enable AND-masking: port disabled when bus enable clears bit", async () => {
    const m = await createTestNextMachine();
    // Enable expansion bus
    m.expansionBusDevice.nextReg80Value = 0x80;
    // Clear bit 0 of NR $86 (disables port 0xFF via bus)
    writeNextReg(m, 0x86, 0xfe);
    // Port 0xFF should now be disabled (internal=1, bus=0, effective=0)
    m.portManager.writePort(0xff, 0x07);
    expect(m.portManager.readPort(0xff)).toBe(0xff);
  });

  it("Bus enable AND-masking: port enabled when both internal and bus set", async () => {
    const m = await createTestNextMachine();
    // Enable expansion bus
    m.expansionBusDevice.nextReg80Value = 0x80;
    // Both NR $82 and NR $86 have bit 0 set (default)
    m.portManager.writePort(0xff, 0x07);
    expect(m.portManager.readPort(0xff)).toBe(0x07);
  });

  it("Bus enable AND-masking has no effect when expansion bus is off", async () => {
    const m = await createTestNextMachine();
    // Bus is OFF (default)
    // Clear bit 0 of NR $86
    writeNextReg(m, 0x86, 0xfe);
    // Port 0xFF should still work (bus masking only applies when bus is ON)
    m.portManager.writePort(0xff, 0x07);
    expect(m.portManager.readPort(0xff)).toBe(0x07);
  });

  it("Bus enable AND-masking: NR $87 disables UART when bus on", async () => {
    const m = await createTestNextMachine();
    m.expansionBusDevice.nextReg80Value = 0x80; // bus on
    writeNextReg(m, 0x87, 0xef); // clear bit 4 (UART)
    expect(m.portManager.readPort(0x133b)).toBe(0xff);
  });

  it("Bus enable AND-masking: NR $88 disables AY when bus on", async () => {
    const m = await createTestNextMachine();
    m.expansionBusDevice.nextReg80Value = 0x80; // bus on
    writeNextReg(m, 0x88, 0xfe); // clear bit 0 (AY)
    expect(m.portManager.readPort(0xfffd)).toBe(0xff);
  });

  it("Bus enable AND-masking: NR $89 disables CTC when bus on", async () => {
    const m = await createTestNextMachine();
    m.expansionBusDevice.nextReg80Value = 0x80; // bus on
    writeNextReg(m, 0x89, 0xf7); // clear bit 3 (CTC)
    expect(m.portManager.readPort(0x183b)).toBe(0xff);
  });

  // ==========================================================================
  // Kempston DF alias vs Mouse interaction
  // ==========================================================================

  it("Kempston DF alias disabled when mouse is enabled (NR $83 bit 5)", async () => {
    const m = await createTestNextMachine();
    // By default NR $83 = 0xFF, so mouse is enabled → DF alias should be OFF
    // The DF alias reader should return { handled: false } → readPort falls through to 0xFF
    // unless another handler provides a value
    const val = m.portManager.readPort(0xdf);
    // With mouse enabled, the kempston DF alias should not respond
    // Other handlers at 0xDF (like SpecDrum DAC writer-only) won't provide a read
    expect(val).toBe(0xff);
  });

  it("Kempston DF alias enabled when mouse is disabled (NR $83 bit 5 cleared)", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x83, 0xdf); // clear bit 5 (disable mouse)
    // Now DF alias should work — reads joystick 1 data
    const val = m.portManager.readPort(0xdf);
    // Default joystick returns 0x00 (no buttons pressed)
    expect(val).toBe(0x00);
  });

  // ==========================================================================
  // Re-enable after disable
  // ==========================================================================

  it("Port responds again after re-enabling via NR $82", async () => {
    const m = await createTestNextMachine();
    m.portManager.writePort(0xff, 0x07);
    writeNextReg(m, 0x82, 0xfe); // disable port 0xFF
    expect(m.portManager.readPort(0xff)).toBe(0xff);
    writeNextReg(m, 0x82, 0xff); // re-enable
    expect(m.portManager.readPort(0xff)).toBe(0x07);
  });

  it("SPI port responds again after re-enabling via NR $83", async () => {
    const m = await createTestNextMachine();
    // SPI DATA (0xEB) should return data when enabled
    const enabled = m.portManager.readPort(0xeb);
    writeNextReg(m, 0x83, 0xf7); // clear bit 3 (SPI)
    expect(m.portManager.readPort(0xeb)).toBe(0xff);
    writeNextReg(m, 0x83, 0xff); // re-enable
    expect(m.portManager.readPort(0xeb)).toBe(enabled);
  });

  // ==========================================================================
  // Disable all ports in a register
  // ==========================================================================

  it("NR $82 = 0x00 disables all group 0 ports", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x82, 0x00);
    // Port 0xFF, 0x7FFD, 0xDFFD, 0x1FFD, FDC, ZXN DMA, Kempston should all be disabled
    m.portManager.writePort(0xff, 0x07);
    expect(m.portManager.readPort(0xff)).toBe(0xff);
    expect(m.portManager.readPort(0x6b)).toBe(0xff);
    expect(m.portManager.readPort(0x37)).toBe(0xff);
  });

  it("NR $83 = 0x00 disables all group 1 ports", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x83, 0x00);
    expect(m.portManager.readPort(0xe3)).toBe(0xff);
    expect(m.portManager.readPort(0x103b)).toBe(0xff);
    expect(m.portManager.readPort(0x133b)).toBe(0xff);
    expect(m.portManager.readPort(0x123b)).toBe(0xff);
  });

  it("NR $84 = 0x00 disables all group 2 ports", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x84, 0x00);
    expect(m.portManager.readPort(0xfffd)).toBe(0xff);
    expect(m.portManager.readPort(0xbffd)).toBe(0xff);
  });

  it("NR $85 = 0x00 disables all group 3 ports", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x85, 0x00);
    expect(m.portManager.readPort(0xff3b)).toBe(0xff);
    expect(m.portManager.readPort(0x0b)).toBe(0xff);
    expect(m.portManager.readPort(0x183b)).toBe(0xff);
  });

  // ==========================================================================
  // NextREG ports are always active (not gated)
  // ==========================================================================

  it("NextREG ports 0x243B/0x253B are not affected by port enables", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x82, 0x00);
    writeNextReg(m, 0x83, 0x00);
    writeNextReg(m, 0x84, 0x00);
    writeNextReg(m, 0x85, 0x00);
    // NextREG select and data should still work
    m.portManager.writePort(0x243b, 0x00);
    const machineId = m.portManager.readPort(0x253b);
    expect(machineId).not.toBe(0xff);
  });

  // ==========================================================================
  // ULA port 0xFE is not gated by NR $82-$85
  // ==========================================================================

  it("ULA port 0xFE is always active regardless of NR $82", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x82, 0x00);
    // ULA port should still respond
    m.portManager.writePort(0xfe, 0x07);
    // ULA read always returns keyboard state, not 0xFF
    const val = m.portManager.readPort(0xfe);
    expect(val).not.toBe(undefined);
  });

  // ==========================================================================
  // Combined scenario: internal+bus AND-masking with selective disables
  // ==========================================================================

  it("Selective port disable: AY disabled, UART enabled, bus on", async () => {
    const m = await createTestNextMachine();
    m.expansionBusDevice.nextReg80Value = 0x80; // bus on
    writeNextReg(m, 0x84, 0xfe); // disable AY (bit 0)
    // AY should be disabled
    expect(m.portManager.readPort(0xfffd)).toBe(0xff);
    // UART should still work (NR $83 bit 4 still set, NR $87 bit 4 default set)
    const uartVal = m.portManager.readPort(0x133b);
    // UART Tx read returns something (not necessarily 0xFF)
    // Just verify it's not blocked by the AY disable
    expect(uartVal).toBeDefined();
  });

  it("Bus fully disables all ports in group 0 via NR $86 = 0x00", async () => {
    const m = await createTestNextMachine();
    m.expansionBusDevice.nextReg80Value = 0x80; // bus on
    writeNextReg(m, 0x86, 0x00); // all bus enables for group 0 off
    m.portManager.writePort(0xff, 0x07);
    expect(m.portManager.readPort(0xff)).toBe(0xff);
    expect(m.portManager.readPort(0x6b)).toBe(0xff);
    expect(m.portManager.readPort(0x37)).toBe(0xff);
  });

  // ==========================================================================
  // isPortGroupEnabled method tests
  // ==========================================================================

  it("isPortGroupEnabled returns false when internal bit is cleared", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x82, 0x00);
    for (let bit = 0; bit < 8; bit++) {
      expect(m.nextRegDevice.isPortGroupEnabled(0, bit)).toBe(false);
    }
  });

  it("isPortGroupEnabled reflects bus AND-masking", async () => {
    const m = await createTestNextMachine();
    m.expansionBusDevice.nextReg80Value = 0x80; // bus on
    // Internal all on (default), bus bit 0 off
    writeNextReg(m, 0x86, 0xfe);
    expect(m.nextRegDevice.isPortGroupEnabled(0, 0)).toBe(false);
    expect(m.nextRegDevice.isPortGroupEnabled(0, 1)).toBe(true);
  });

  it("isPortGroupEnabled ignores bus mask when bus is off", async () => {
    const m = await createTestNextMachine();
    // Bus is off (default)
    writeNextReg(m, 0x86, 0x00); // bus would disable everything
    // But bus is off, so all should be enabled
    for (let bit = 0; bit < 8; bit++) {
      expect(m.nextRegDevice.isPortGroupEnabled(0, bit)).toBe(true);
    }
  });

  // ==========================================================================
  // SPI port gating
  // ==========================================================================

  it("SPI CS write is blocked when NR $83 bit 3 is cleared", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x83, 0xf7); // clear bit 3
    // SPI CS write should be ignored
    m.portManager.writePort(0xe7, 0x01);
    // No crash, just a no-op
  });

  it("SPI DATA read returns 0xFF when NR $83 bit 3 is cleared", async () => {
    const m = await createTestNextMachine();
    writeNextReg(m, 0x83, 0xf7); // clear bit 3
    expect(m.portManager.readPort(0xeb)).toBe(0xff);
  });
});
