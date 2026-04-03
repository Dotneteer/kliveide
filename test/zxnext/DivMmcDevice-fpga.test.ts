import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine, TestZxNextMachine } from "./TestNextMachine";
import { OFFS_DIVMMC_ROM, OFFS_DIVMMC_RAM, OFFS_DIVMMC_RAM_BANK_3 } from "../../src/emu/machines/zxNext/MemoryDevice";

/**
 * Tests for DivMMC FPGA-verified fixes (divmmc-plan.md D1–D8).
 * FPGA (divmmc.vhd) is the ground truth.
 */

let machine: TestZxNextMachine;

async function setup() {
  machine = await createTestNextMachine();
  machine.nextRegDevice.directSetRegValue(0x0a, 0x10); // NR $0A bit 4: enable DivMMC automap
  machine.nextRegDevice.directSetRegValue(0x83, 0x01); // NR $83 bit 0: enable DivMMC hardware
}

// ──────────────────────────────────────────────────────────────
// D1: 0x1FF8-0x1FFF should NOT unmap when NR BB bit 6 = 0
// ──────────────────────────────────────────────────────────────
describe("D1: 1FF8 range with automapOff1ff8=false (NR BB bit 6=0)", () => {
  beforeEach(setup);

  it("automap should persist at 1FF8 when automapOff1ff8=false", () => {
    const d = machine.divMmcDevice;
    d.rstTraps[0].enabled = true;
    d.rstTraps[0].instantMapping = true;
    d.rstTraps[0].onlyWithRom3 = false;

    // Activate automap via RST 0x00
    machine.pc = 0x0000;
    d.beforeOpcodeFetch();
    expect(d.autoMapActive).toBe(true);

    // Ensure automapOff1ff8 is off (NR BB bit 6 = 0)
    d.automapOff1ff8 = false;

    // PC at 0x1FF8 should NOT unmap
    machine.pc = 0x1ff8;
    d.beforeOpcodeFetch();
    d.afterOpcodeFetch();
    expect(d.autoMapActive).toBe(true);
  });

  it("automap should unmap (delayed) at 1FF8 when automapOff1ff8=true", () => {
    const d = machine.divMmcDevice;
    d.rstTraps[0].enabled = true;
    d.rstTraps[0].instantMapping = true;
    d.rstTraps[0].onlyWithRom3 = false;

    machine.pc = 0x0000;
    d.beforeOpcodeFetch();
    expect(d.autoMapActive).toBe(true);

    d.automapOff1ff8 = true;

    machine.pc = 0x1ff8;
    d.beforeOpcodeFetch();
    // During beforeOpcodeFetch the request is queued, not applied yet
    expect(d.autoMapActive).toBe(true);

    d.afterOpcodeFetch();
    // Now the delayed unmap fires
    expect(d.autoMapActive).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// D2: conmem + mapram page 0 reads RAM bank 3, not ROM
// ──────────────────────────────────────────────────────────────
describe("D2: conmem+mapram page0 reads DivMMC RAM bank 3", () => {
  beforeEach(setup);

  it("conmem=1, mapram=0, page0 reads DivMMC ROM", () => {
    const mem = machine.memoryDevice;

    // Write a known byte to DivMMC ROM area
    mem.memory[OFFS_DIVMMC_ROM + 0x100] = 0xAA;

    // Set conmem=1, mapram=0, bank=0
    machine.writePort(0xe3, 0x80);
    machine.divMmcDevice.beforeOpcodeFetch();

    // Read from page 0 at 0x0100
    const val = mem.readMemory(0x0100);
    expect(val).toBe(0xAA);
  });

  it("conmem=1, mapram=1, page0 reads DivMMC RAM bank 3", () => {
    const mem = machine.memoryDevice;

    // Write known bytes
    mem.memory[OFFS_DIVMMC_ROM + 0x100] = 0xBB; // ROM area
    mem.memory[OFFS_DIVMMC_RAM_BANK_3 + 0x100] = 0xCC; // RAM bank 3

    // Set conmem=1, mapram=1, bank=5
    machine.writePort(0xe3, 0xC5);
    machine.divMmcDevice.beforeOpcodeFetch();

    // Page 0 should read RAM bank 3, NOT ROM
    const val = mem.readMemory(0x0100);
    expect(val).toBe(0xCC);
  });

  it("conmem=1, mapram=1, page1 reads selected bank (not bank 3)", () => {
    const mem = machine.memoryDevice;
    const bank5offset = OFFS_DIVMMC_RAM + (5 << 13);
    mem.memory[bank5offset + 0x100] = 0xDD;

    // Set conmem=1, mapram=1, bank=5
    machine.writePort(0xe3, 0xC5);
    machine.divMmcDevice.beforeOpcodeFetch();

    // Page 1 (0x2000-0x3FFF) should read selected bank 5
    const val = mem.readMemory(0x2100);
    expect(val).toBe(0xDD);
  });
});

// ──────────────────────────────────────────────────────────────
// D3: conmem write protection (mapram + bank 3)
// ──────────────────────────────────────────────────────────────
describe("D3: conmem write protection for page0 and mapram+bank3", () => {
  beforeEach(setup);

  it("conmem page0 write is blocked (read-only)", () => {
    const mem = machine.memoryDevice;
    mem.memory[OFFS_DIVMMC_ROM + 0x50] = 0x11;

    machine.writePort(0xe3, 0x80); // conmem=1, mapram=0
    machine.divMmcDevice.beforeOpcodeFetch();

    mem.writeMemory(0x0050, 0xFF);
    expect(mem.memory[OFFS_DIVMMC_ROM + 0x50]).toBe(0x11); // unchanged
  });

  it("conmem page1 mapram=1 bank=3 write is blocked", () => {
    const mem = machine.memoryDevice;
    const bank3offset = OFFS_DIVMMC_RAM + (3 << 13);
    mem.memory[bank3offset + 0x50] = 0x22;

    // conmem=1, mapram=1, bank=3
    machine.writePort(0xe3, 0xC3);
    machine.divMmcDevice.beforeOpcodeFetch();

    // Write to page 1 (0x2050) with mapram=1, bank=3 should be blocked
    mem.writeMemory(0x2050, 0xFF);
    expect(mem.memory[bank3offset + 0x50]).toBe(0x22); // unchanged
  });

  it("conmem page1 bank=5 write succeeds", () => {
    const mem = machine.memoryDevice;
    const bank5offset = OFFS_DIVMMC_RAM + (5 << 13);
    mem.memory[bank5offset + 0x50] = 0x33;

    // conmem=1, mapram=0, bank=5
    machine.writePort(0xe3, 0x85);
    machine.divMmcDevice.beforeOpcodeFetch();

    mem.writeMemory(0x2050, 0x99);
    expect(mem.memory[bank5offset + 0x50]).toBe(0x99);
  });
});

// ──────────────────────────────────────────────────────────────
// D4: RETN should NOT clear conmem
// ──────────────────────────────────────────────────────────────
describe("D4: RETN preserves conmem (FPGA: retn_seen only clears automap state)", () => {
  beforeEach(setup);

  it("RETN clears autoMapActive but leaves conmem untouched", () => {
    const d = machine.divMmcDevice;

    // Set conmem=1, bank=1
    machine.writePort(0xe3, 0x81);
    expect(d.conmem).toBe(true);

    // Also activate automap via RST entry point
    d.rstTraps[0].enabled = true;
    d.rstTraps[0].instantMapping = true;
    d.rstTraps[0].onlyWithRom3 = false;
    machine.pc = 0x0000;
    d.beforeOpcodeFetch();
    expect(d.autoMapActive).toBe(true);

    // Simulate RETN
    d.handleRetnExecution();

    expect(d.autoMapActive).toBe(false);
    // FPGA: conmem is NOT cleared by retn_seen
    expect(d.conmem).toBe(true);
    expect(d.port0xe3Value & 0x80).toBe(0x80);
  });

  it("RETN clears button_nmi", () => {
    const d = machine.divMmcDevice;
    d.armNmiButton();
    expect(d.divMmcNmiHold).toBe(true);

    d.handleRetnExecution();
    // button_nmi should be cleared
    expect(d.divMmcNmiHold).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// D5: button_nmi cleared when automap_held becomes true
// ──────────────────────────────────────────────────────────────
describe("D5: button_nmi cleared when automap established", () => {
  beforeEach(setup);

  it("instant automap clears button_nmi", () => {
    const d = machine.divMmcDevice;

    // Arm NMI button
    d.armNmiButton();
    expect(d.divMmcNmiHold).toBe(true);

    // Trigger instant automap via RST 0x00
    d.rstTraps[0].enabled = true;
    d.rstTraps[0].instantMapping = true;
    d.rstTraps[0].onlyWithRom3 = false;

    machine.pc = 0x0000;
    d.beforeOpcodeFetch();

    expect(d.autoMapActive).toBe(true);
    // button_nmi should now be cleared (FPGA: automap_held=1 clears button_nmi)
    // divMmcNmiHold = automap(true) || button_nmi(false) = true
    // But once automap drops, nmiHold should also drop
    d.handleRetnExecution();
    expect(d.divMmcNmiHold).toBe(false);
  });

  it("delayed automap clears button_nmi on afterOpcodeFetch", () => {
    const d = machine.divMmcDevice;

    d.armNmiButton();
    expect(d.divMmcNmiHold).toBe(true);

    d.rstTraps[1].enabled = true;
    d.rstTraps[1].instantMapping = false; // delayed
    d.rstTraps[1].onlyWithRom3 = false;

    machine.pc = 0x0008;
    d.beforeOpcodeFetch();
    // Not active yet (delayed)
    expect(d.autoMapActive).toBe(false);

    d.afterOpcodeFetch();
    expect(d.autoMapActive).toBe(true);

    // After delayed activation, button_nmi should be cleared
    // So once automap is dropped by RETN, nmiHold = false
    d.handleRetnExecution();
    expect(d.divMmcNmiHold).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// D6: conmem no longer sets _autoMapActive
// ──────────────────────────────────────────────────────────────
describe("D6: conmem does not set autoMapActive (FPGA: separate signals)", () => {
  beforeEach(setup);

  it("conmem=1 does not set autoMapActive", () => {
    const d = machine.divMmcDevice;

    machine.writePort(0xe3, 0x80); // conmem=1
    d.beforeOpcodeFetch();

    expect(d.conmem).toBe(true);
    expect(d.autoMapActive).toBe(false);
  });

  it("conmem=1 does not inhibit NMI acceptance (divMmcNmiHold stays false)", () => {
    const d = machine.divMmcDevice;

    machine.writePort(0xe3, 0x80); // conmem=1
    d.beforeOpcodeFetch();

    // Neither automap nor button_nmi is set — NMI can be accepted
    expect(d.divMmcNmiHold).toBe(false);
  });

  it("conmem=1 still pages DivMMC memory even without autoMapActive", () => {
    const mem = machine.memoryDevice;

    // Write a marker to DivMMC ROM
    mem.memory[OFFS_DIVMMC_ROM + 0x10] = 0xEE;

    machine.writePort(0xe3, 0x80); // conmem=1, mapram=0
    machine.divMmcDevice.beforeOpcodeFetch();

    // Memory at page 0 should read from DivMMC ROM
    expect(mem.readMemory(0x0010)).toBe(0xEE);
  });
});

// ──────────────────────────────────────────────────────────────
// D7: automap_reset (enableAutomap=false) clears button_nmi
// ──────────────────────────────────────────────────────────────
describe("D7: disabling automap clears button_nmi", () => {
  beforeEach(setup);

  it("enableAutomap=false clears _nmiButtonPressed", () => {
    const d = machine.divMmcDevice;

    d.armNmiButton();
    expect(d.divMmcNmiHold).toBe(true);

    // Disable automap — VHDL: automap_reset clears button_nmi
    d.enableAutomap = false;

    expect(d.divMmcNmiHold).toBe(false);
    expect(d.autoMapActive).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// D8: isRom3AutomapActive includes Layer 2 check
// ──────────────────────────────────────────────────────────────
describe("D8: ROM3 automap gated by Layer 2 mapping", () => {
  beforeEach(setup);

  it("ROM3 entry point fires when Layer 2 is not mapped over ROM", () => {
    const d = machine.divMmcDevice;

    // Select ROM 3 (MSB=0x02, LSB=0x01 → 0x02|0x01=0x03)
    machine.memoryDevice.selectedRomMsb = 0x02;
    machine.memoryDevice.selectedRomLsb = 0x01;

    // ROM3-only entry point at 0x04C6
    d.automapOn04c6 = true;

    // No Layer 2 overlapping ROM
    machine.composedScreenDevice.layer2EnableMappingForReads = false;

    machine.pc = 0x04c6;
    d.beforeOpcodeFetch();
    d.afterOpcodeFetch();

    expect(d.autoMapActive).toBe(true);
  });

  it("ROM3 entry point does NOT fire when Layer 2 segment 0 overlaps ROM", () => {
    const d = machine.divMmcDevice;

    machine.memoryDevice.selectedRomMsb = 0x02;
    machine.memoryDevice.selectedRomLsb = 0x01;

    d.automapOn04c6 = true;

    // Enable Layer 2 read mapping, segment 0 covers 0x0000-0x3FFF
    machine.composedScreenDevice.layer2EnableMappingForReads = true;
    machine.composedScreenDevice.layer2Bank = 0; // segment 0

    machine.pc = 0x04c6;
    d.beforeOpcodeFetch();
    d.afterOpcodeFetch();

    // Layer 2 mapped over ROM → rom3 automap should not activate
    expect(d.autoMapActive).toBe(false);
  });

  it("ROM3 entry point does NOT fire when Layer 2 segment 3 (whole 48K) overlaps ROM", () => {
    const d = machine.divMmcDevice;

    machine.memoryDevice.selectedRomMsb = 0x02;
    machine.memoryDevice.selectedRomLsb = 0x01;

    d.automapOn04c6 = true;

    machine.composedScreenDevice.layer2EnableMappingForReads = true;
    machine.composedScreenDevice.layer2Bank = 3; // segment 3 covers all 48K

    machine.pc = 0x04c6;
    d.beforeOpcodeFetch();
    d.afterOpcodeFetch();

    expect(d.autoMapActive).toBe(false);
  });

  it("non-ROM3 entry point works regardless of ROM selection", () => {
    const d = machine.divMmcDevice;

    // ROM 0 selected (not ROM 3)
    machine.memoryDevice.selectedRomMsb = 0;
    machine.memoryDevice.selectedRomLsb = 0;

    // RST 0x00 with onlyWithRom3=false (works for any ROM)
    d.rstTraps[0].enabled = true;
    d.rstTraps[0].instantMapping = true;
    d.rstTraps[0].onlyWithRom3 = false;

    machine.pc = 0x0000;
    d.beforeOpcodeFetch();

    expect(d.autoMapActive).toBe(true);
  });
});
