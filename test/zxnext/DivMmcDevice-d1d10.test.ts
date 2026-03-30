import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine, TestZxNextMachine } from "./TestNextMachine";
import { OFFS_DIVMMC_ROM, OFFS_DIVMMC_RAM, OFFS_DIVMMC_RAM_BANK_3 } from "../../src/emu/machines/zxNext/MemoryDevice";

/**
 * Tests for DivMMC D1-D10 fix verification.
 * Each describe block covers one discrepancy from divmmc-plan.md.
 */

// ═══════════════════════════════════════════════════════════════════════
// D1 — CONMEM independent of automap state
// ═══════════════════════════════════════════════════════════════════════
describe("D1 — CONMEM independent of automap state", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    machine.nextRegDevice.directSetRegValue(0x83, 0x01); // Enable DivMMC
    machine.nextRegDevice.directSetRegValue(0x0a, 0x10); // Enable automap
  });

  it("conmem=1 should NOT set autoMapActive", () => {
    machine.writePort(0xe3, 0x80); // conmem=1
    expect(machine.divMmcDevice.conmem).toBe(true);
    expect(machine.divMmcDevice.autoMapActive).toBe(false);
  });

  it("conmem should work without enableAutomap", () => {
    machine.divMmcDevice.enableAutomap = false;
    machine.writePort(0xe3, 0x80); // conmem=1
    expect(machine.divMmcDevice.conmem).toBe(true);
    // conmem flag is set regardless of enableAutomap
  });

  it("conmem paging should work for reads (page 0 → DivMMC ROM)", () => {
    // Write a sentinel value into DivMMC ROM
    const sentinel = 0xAB;
    machine.memoryDevice.directWrite(OFFS_DIVMMC_ROM + 0x100, sentinel);

    // Set conmem=1
    machine.writePort(0xe3, 0x80);

    // Reading address 0x0100 should hit DivMMC ROM
    const val = machine.memoryDevice.readMemory(0x0100);
    expect(val).toBe(sentinel);
  });

  it("conmem paging should work for reads (page 1 → DivMMC RAM bank)", () => {
    const bank = 5;
    const sentinel = 0xCD;
    machine.memoryDevice.directWrite(OFFS_DIVMMC_RAM + (bank << 13) + 0x100, sentinel);

    // Set conmem=1, bank=5
    machine.writePort(0xe3, 0x80 | bank);

    // Reading address 0x2100 should hit DivMMC RAM bank 5
    const val = machine.memoryDevice.readMemory(0x2100);
    expect(val).toBe(sentinel);
  });

  it("conmem should NOT affect divMmcNmiHold", () => {
    machine.writePort(0xe3, 0x80); // conmem=1
    // divMmcNmiHold = autoMapActive || nmiButtonPressed
    // conmem does not affect either
    expect(machine.divMmcDevice.divMmcNmiHold).toBe(false);
  });

  it("disabling DivMMC (NR $83 bit 0=0) should suppress conmem paging", () => {
    // Write sentinel to DivMMC ROM
    const sentinel = 0xEE;
    machine.memoryDevice.directWrite(OFFS_DIVMMC_ROM + 0x200, sentinel);

    // Set conmem=1
    machine.writePort(0xe3, 0x80);
    expect(machine.memoryDevice.readMemory(0x0200)).toBe(sentinel);

    // Disable DivMMC
    machine.nextRegDevice.directSetRegValue(0x83, 0x00);

    // Should no longer read from DivMMC ROM
    expect(machine.memoryDevice.readMemory(0x0200)).not.toBe(sentinel);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// D2 — RETN preserves conmem and port E3 shadow
// ═══════════════════════════════════════════════════════════════════════
describe("D2 — RETN preserves conmem and port E3 shadow", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    machine.nextRegDevice.directSetRegValue(0x83, 0x01);
    machine.nextRegDevice.directSetRegValue(0x0a, 0x10);
  });

  it("RETN should preserve conmem flag", () => {
    machine.writePort(0xe3, 0x85); // conmem=1, bank=5
    expect(machine.divMmcDevice.conmem).toBe(true);
    expect(machine.divMmcDevice.bank).toBe(5);

    machine.divMmcDevice.handleRetnExecution();

    // conmem, mapram, bank should be preserved
    expect(machine.divMmcDevice.conmem).toBe(true);
    expect(machine.divMmcDevice.bank).toBe(5);
  });

  it("RETN should preserve mapram flag", () => {
    machine.writePort(0xe3, 0xC3); // conmem=1, mapram=1, bank=3
    expect(machine.divMmcDevice.mapram).toBe(true);

    machine.divMmcDevice.handleRetnExecution();

    expect(machine.divMmcDevice.mapram).toBe(true);
  });

  it("RETN should clear autoMapActive", () => {
    // Activate automap via RST trap
    const divmmc = machine.divMmcDevice;
    divmmc.rstTraps[0].enabled = true;
    divmmc.rstTraps[0].instantMapping = true;
    divmmc.rstTraps[0].onlyWithRom3 = false;
    machine.pc = 0x0000;
    divmmc.beforeOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);

    divmmc.handleRetnExecution();
    expect(divmmc.autoMapActive).toBe(false);
  });

  it("RETN should clear nmiButtonPressed", () => {
    machine.divMmcDevice.armNmiButton();
    expect(machine.divMmcDevice.divMmcNmiHold).toBe(true);

    machine.divMmcDevice.handleRetnExecution();
    // divMmcNmiHold = autoMapActive || nmiButtonPressed, both cleared
    expect(machine.divMmcDevice.divMmcNmiHold).toBe(false);
  });

  it("port0xe3Value readback should preserve value after RETN", () => {
    machine.writePort(0xe3, 0x8A); // conmem=1, bank=10
    const valueBefore = machine.divMmcDevice.port0xe3Value;

    machine.divMmcDevice.handleRetnExecution();

    expect(machine.divMmcDevice.port0xe3Value).toBe(valueBefore);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// D3 — CONMEM + MAPRAM page 0 reads RAM bank 3
// ═══════════════════════════════════════════════════════════════════════
describe("D3 — CONMEM + MAPRAM page 0 reads RAM bank 3", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    machine.nextRegDevice.directSetRegValue(0x83, 0x01);
    machine.nextRegDevice.directSetRegValue(0x0a, 0x10);
  });

  it("conmem + !mapram + page0 → DivMMC ROM", () => {
    const sentinel = 0xA1;
    machine.memoryDevice.directWrite(OFFS_DIVMMC_ROM + 0x10, sentinel);

    machine.writePort(0xe3, 0x80); // conmem=1, mapram=0
    expect(machine.memoryDevice.readMemory(0x0010)).toBe(sentinel);
  });

  it("conmem + mapram + page0 → DivMMC RAM bank 3", () => {
    const sentinelRom = 0xB2;
    const sentinelRam3 = 0xC3;
    machine.memoryDevice.directWrite(OFFS_DIVMMC_ROM + 0x10, sentinelRom);
    machine.memoryDevice.directWrite(OFFS_DIVMMC_RAM_BANK_3 + 0x10, sentinelRam3);

    // Set mapram first (by writing mapram=1 then conmem+mapram together)
    machine.writePort(0xe3, 0x40); // mapram=1 (latches)
    machine.writePort(0xe3, 0xC0); // conmem=1, mapram=1

    // Page 0 should read from RAM bank 3, not ROM
    expect(machine.memoryDevice.readMemory(0x0010)).toBe(sentinelRam3);
  });

  it("conmem + page1 → DivMMC RAM selected bank", () => {
    const bank = 7;
    const sentinel = 0xD4;
    machine.memoryDevice.directWrite(OFFS_DIVMMC_RAM + (bank << 13) + 0x100, sentinel);

    machine.writePort(0xe3, 0x80 | bank); // conmem=1, bank=7
    expect(machine.memoryDevice.readMemory(0x2100)).toBe(sentinel);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// D4 — CONMEM writes: rdonly = page0 OR (mapram AND bank==3)
// ═══════════════════════════════════════════════════════════════════════
describe("D4 — CONMEM writes rdonly check", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    machine.nextRegDevice.directSetRegValue(0x83, 0x01);
    machine.nextRegDevice.directSetRegValue(0x0a, 0x10);
  });

  it("conmem + page0 should be read-only (writes blocked)", () => {
    machine.writePort(0xe3, 0x80); // conmem=1

    // Write sentinel to address in page 0
    const addr = 0x0100;
    const before = machine.memoryDevice.readMemory(addr);
    machine.memoryDevice.writeMemory(addr, before ^ 0xFF);
    // Write should have been blocked
    expect(machine.memoryDevice.readMemory(addr)).toBe(before);
  });

  it("conmem + page1 + bank!=3 should allow writes", () => {
    const bank = 5;
    machine.writePort(0xe3, 0x80 | bank); // conmem=1, bank=5

    const addr = 0x2100;
    machine.memoryDevice.writeMemory(addr, 0x42);
    expect(machine.memoryDevice.readMemory(addr)).toBe(0x42);
  });

  it("conmem + page1 + mapram + bank=3 should be read-only", () => {
    // Set mapram first (latches high)
    machine.writePort(0xe3, 0x40); // mapram=1
    machine.writePort(0xe3, 0xC3); // conmem=1, mapram=1, bank=3

    const addr = 0x2100;
    const before = machine.memoryDevice.readMemory(addr);
    machine.memoryDevice.writeMemory(addr, before ^ 0xFF);
    // Write should have been blocked
    expect(machine.memoryDevice.readMemory(addr)).toBe(before);
  });

  it("conmem + page1 + mapram + bank!=3 should allow writes", () => {
    machine.writePort(0xe3, 0x40); // mapram=1
    machine.writePort(0xe3, 0xC5); // conmem=1, mapram=1, bank=5

    const addr = 0x2100;
    machine.memoryDevice.writeMemory(addr, 0x77);
    expect(machine.memoryDevice.readMemory(addr)).toBe(0x77);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// D5 — 1FF8-1FFF: no unmap when NR $BB bit 6 = 0
// ═══════════════════════════════════════════════════════════════════════
describe("D5 — 1FF8-1FFF exit disabled when NR $BB bit 6 = 0", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    machine.nextRegDevice.directSetRegValue(0x83, 0x01);
    machine.nextRegDevice.directSetRegValue(0x0a, 0x10);
  });

  it("NR $BB bit 6 = 0: 1FF8 should NOT unmap automap", () => {
    const divmmc = machine.divMmcDevice;

    // Activate automap via RST 0x08 instant
    divmmc.rstTraps[1].enabled = true;
    divmmc.rstTraps[1].instantMapping = true;
    divmmc.rstTraps[1].onlyWithRom3 = false;
    machine.pc = 0x0008;
    divmmc.beforeOpcodeFetch();
    divmmc.afterOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);

    // Disable exit (NR $BB bit 6 = 0)
    divmmc.automapOff1ff8 = false;

    // Fetch at exit address 0x1FF8
    machine.pc = 0x1FF8;
    divmmc.beforeOpcodeFetch();
    divmmc.afterOpcodeFetch();

    // automap should still be active
    expect(divmmc.autoMapActive).toBe(true);
  });

  it("NR $BB bit 6 = 1: 1FF8 should unmap automap (delayed)", () => {
    const divmmc = machine.divMmcDevice;

    // Activate automap via RST
    divmmc.rstTraps[1].enabled = true;
    divmmc.rstTraps[1].instantMapping = true;
    divmmc.rstTraps[1].onlyWithRom3 = false;
    machine.pc = 0x0008;
    divmmc.beforeOpcodeFetch();
    divmmc.afterOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);

    // Enable exit (NR $BB bit 6 = 1)
    divmmc.automapOff1ff8 = true;

    // Fetch at exit address
    machine.pc = 0x1FF8;
    divmmc.beforeOpcodeFetch();
    // Automap still active during this fetch (delayed)
    expect(divmmc.autoMapActive).toBe(true);

    // After opcode fetch, the delayed off takes effect
    divmmc.afterOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(false);
  });

  it("NR $BB bit 6 = 0: 1FFF should NOT unmap either", () => {
    const divmmc = machine.divMmcDevice;
    divmmc.rstTraps[1].enabled = true;
    divmmc.rstTraps[1].instantMapping = true;
    divmmc.rstTraps[1].onlyWithRom3 = false;
    machine.pc = 0x0008;
    divmmc.beforeOpcodeFetch();
    divmmc.afterOpcodeFetch();

    divmmc.automapOff1ff8 = false;
    machine.pc = 0x1FFF;
    divmmc.beforeOpcodeFetch();
    divmmc.afterOpcodeFetch();

    expect(divmmc.autoMapActive).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// D6 — button_nmi cleared when automap becomes held
// ═══════════════════════════════════════════════════════════════════════
describe("D6 — button_nmi cleared when automap held", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    machine.nextRegDevice.directSetRegValue(0x83, 0x01);
    machine.nextRegDevice.directSetRegValue(0x0a, 0x10);
  });

  it("button_nmi cleared after delayed automap activation", () => {
    const divmmc = machine.divMmcDevice;

    // Arm NMI button
    divmmc.armNmiButton();
    expect(divmmc.divMmcNmiHold).toBe(true);

    // Configure delayed RST trap
    divmmc.rstTraps[0].enabled = true;
    divmmc.rstTraps[0].instantMapping = false; // delayed
    divmmc.rstTraps[0].onlyWithRom3 = false;

    // Trigger at RST 0x00
    machine.pc = 0x0000;
    divmmc.beforeOpcodeFetch();
    // Delayed — not active yet, but request set
    expect(divmmc.autoMapActive).toBe(false);

    // After fetch: delayed activation + button_nmi clearing
    divmmc.afterOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);
    // divMmcNmiHold should now be true (autoMapActive=true) but
    // the button is cleared
    expect(divmmc.divMmcNmiHold).toBe(true); // automap is active
  });

  it("button_nmi cleared after instant automap activation in afterOpcodeFetch", () => {
    const divmmc = machine.divMmcDevice;

    // Arm NMI button
    divmmc.armNmiButton();

    // Configure instant RST trap
    divmmc.rstTraps[1].enabled = true;
    divmmc.rstTraps[1].instantMapping = true;
    divmmc.rstTraps[1].onlyWithRom3 = false;

    // Trigger at RST 0x08
    machine.pc = 0x0008;
    divmmc.beforeOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);

    // After fetch: button_nmi cleared because automap is held
    divmmc.afterOpcodeFetch();

    // Now if automap is turned off (e.g. by RETN clearing automap),
    // button_nmi should already be false
    divmmc.handleRetnExecution();
    expect(divmmc.divMmcNmiHold).toBe(false); // both cleared
  });

  it("button_nmi survives if automap not active", () => {
    const divmmc = machine.divMmcDevice;
    divmmc.armNmiButton();

    // Non-entry-point fetch
    machine.pc = 0x5000;
    divmmc.beforeOpcodeFetch();
    divmmc.afterOpcodeFetch();

    // Button should NOT have been cleared — automap is not active
    expect(divmmc.divMmcNmiHold).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// D7 — Pipeline mapping documented (behavioral equivalence test)
// ═══════════════════════════════════════════════════════════════════════
describe("D7 — Pipeline: delayed activation timing", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    machine.nextRegDevice.directSetRegValue(0x83, 0x01);
    machine.nextRegDevice.directSetRegValue(0x0a, 0x10);
  });

  it("delayed entry should not affect current instruction paging", () => {
    const divmmc = machine.divMmcDevice;
    divmmc.rstTraps[0].enabled = true;
    divmmc.rstTraps[0].instantMapping = false; // delayed
    divmmc.rstTraps[0].onlyWithRom3 = false;

    machine.pc = 0x0000;
    divmmc.beforeOpcodeFetch();

    // During the current fetch, automap is NOT active
    expect(divmmc.autoMapActive).toBe(false);
  });

  it("delayed entry activates on MREQ release (afterOpcodeFetch)", () => {
    const divmmc = machine.divMmcDevice;
    divmmc.rstTraps[0].enabled = true;
    divmmc.rstTraps[0].instantMapping = false;
    divmmc.rstTraps[0].onlyWithRom3 = false;

    machine.pc = 0x0000;
    divmmc.beforeOpcodeFetch();
    divmmc.afterOpcodeFetch(); // ≈ MREQ release → automap_held = automap_hold

    expect(divmmc.autoMapActive).toBe(true);
  });

  it("instant entry affects current instruction paging", () => {
    const divmmc = machine.divMmcDevice;
    divmmc.rstTraps[0].enabled = true;
    divmmc.rstTraps[0].instantMapping = true;
    divmmc.rstTraps[0].onlyWithRom3 = false;

    machine.pc = 0x0000;
    divmmc.beforeOpcodeFetch();

    // Automap should be active immediately
    expect(divmmc.autoMapActive).toBe(true);
  });

  it("held state persists through non-entry-point fetches", () => {
    const divmmc = machine.divMmcDevice;
    divmmc.rstTraps[0].enabled = true;
    divmmc.rstTraps[0].instantMapping = true;
    divmmc.rstTraps[0].onlyWithRom3 = false;

    // Activate
    machine.pc = 0x0000;
    divmmc.beforeOpcodeFetch();
    divmmc.afterOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);

    // Fetch at non-entry-point address — should persist
    machine.pc = 0x0500;
    divmmc.beforeOpcodeFetch();
    divmmc.afterOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// D8 — automap gated by device enable
// ═══════════════════════════════════════════════════════════════════════
describe("D8 — automap gated by device enable", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    machine.nextRegDevice.directSetRegValue(0x83, 0x01);
    machine.nextRegDevice.directSetRegValue(0x0a, 0x10);
  });

  it("entry points should not trigger when device disabled (NR $83 bit 0=0)", () => {
    const divmmc = machine.divMmcDevice;
    divmmc.rstTraps[0].enabled = true;
    divmmc.rstTraps[0].instantMapping = true;
    divmmc.rstTraps[0].onlyWithRom3 = false;

    // Disable DivMMC hardware
    machine.nextRegDevice.directSetRegValue(0x83, 0x00);

    machine.pc = 0x0000;
    divmmc.beforeOpcodeFetch();

    expect(divmmc.autoMapActive).toBe(false);
  });

  it("entry points should not trigger when automap disabled (NR $0A bit 4=0)", () => {
    const divmmc = machine.divMmcDevice;
    divmmc.rstTraps[0].enabled = true;
    divmmc.rstTraps[0].instantMapping = true;
    divmmc.rstTraps[0].onlyWithRom3 = false;

    // Disable automap
    divmmc.enableAutomap = false;

    machine.pc = 0x0000;
    divmmc.beforeOpcodeFetch();

    expect(divmmc.autoMapActive).toBe(false);
  });

  it("re-enabling device after disable should allow entry points again", () => {
    const divmmc = machine.divMmcDevice;
    divmmc.rstTraps[0].enabled = true;
    divmmc.rstTraps[0].instantMapping = true;
    divmmc.rstTraps[0].onlyWithRom3 = false;

    // Disable then re-enable
    machine.nextRegDevice.directSetRegValue(0x83, 0x00);
    machine.nextRegDevice.directSetRegValue(0x83, 0x01);

    machine.pc = 0x0000;
    divmmc.beforeOpcodeFetch();

    expect(divmmc.autoMapActive).toBe(true);
  });

  it("disabling DivMMC should suppress memory paging even with conmem", () => {
    // Set conmem
    machine.writePort(0xe3, 0x80);

    // Sentinel in DivMMC ROM
    const sentinel = 0xBB;
    machine.memoryDevice.directWrite(OFFS_DIVMMC_ROM + 0x50, sentinel);
    expect(machine.memoryDevice.readMemory(0x0050)).toBe(sentinel);

    // Disable DivMMC → paging output gated off
    machine.nextRegDevice.directSetRegValue(0x83, 0x00);
    expect(machine.memoryDevice.readMemory(0x0050)).not.toBe(sentinel);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// D9 — checkNmiEntry: button_nmi gating is sufficient
// ═══════════════════════════════════════════════════════════════════════
describe("D9 — NMI entry gated by button_nmi, not enableDivMmcNmiByDriveButton", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    machine.nextRegDevice.directSetRegValue(0x83, 0x01);
    machine.nextRegDevice.directSetRegValue(0x0a, 0x10);
  });

  it("NMI 0x0066 requires button_nmi to be set", () => {
    const divmmc = machine.divMmcDevice;
    for (let i = 0; i < 8; i++) divmmc.rstTraps[i].enabled = false;
    divmmc.automapOn0066 = true;

    // button_nmi NOT set
    machine.pc = 0x0066;
    divmmc.beforeOpcodeFetch();

    expect(divmmc.autoMapActive).toBe(false);
  });

  it("NMI 0x0066 triggers when button_nmi is set (regardless of enableDivMmcNmiByDriveButton)", () => {
    const divmmc = machine.divMmcDevice;
    for (let i = 0; i < 8; i++) divmmc.rstTraps[i].enabled = false;
    divmmc.automapOn0066 = true;
    divmmc.enableDivMmcNmiByDriveButton = false; // D9: this does NOT gate checkNmiEntry

    // Arm button (simulating the NMI state machine having accepted the NMI)
    divmmc.armNmiButton();

    machine.pc = 0x0066;
    divmmc.beforeOpcodeFetch();

    // Should trigger — button_nmi gating is the check, not the enable flag
    expect(divmmc.autoMapActive).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// D10 — NMI 0x0066: both instant and delayed contribute
// ═══════════════════════════════════════════════════════════════════════
describe("D10 — NMI 0x0066: both instant and delayed contribute", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    machine.nextRegDevice.directSetRegValue(0x83, 0x01);
    machine.nextRegDevice.directSetRegValue(0x0a, 0x10);
  });

  it("instant-only NMI: immediate activation", () => {
    const divmmc = machine.divMmcDevice;
    for (let i = 0; i < 8; i++) divmmc.rstTraps[i].enabled = false;
    divmmc.automapOn0066 = true;
    divmmc.automapOn0066Delayed = false;
    divmmc.armNmiButton();

    machine.pc = 0x0066;
    divmmc.beforeOpcodeFetch();

    expect(divmmc.autoMapActive).toBe(true);
  });

  it("delayed-only NMI: activation after fetch", () => {
    const divmmc = machine.divMmcDevice;
    for (let i = 0; i < 8; i++) divmmc.rstTraps[i].enabled = false;
    divmmc.automapOn0066 = false;
    divmmc.automapOn0066Delayed = true;
    divmmc.armNmiButton();

    machine.pc = 0x0066;
    divmmc.beforeOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(false);

    divmmc.afterOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);
  });

  it("both instant+delayed NMI: immediate activation AND hold established", () => {
    const divmmc = machine.divMmcDevice;
    for (let i = 0; i < 8; i++) divmmc.rstTraps[i].enabled = false;
    divmmc.automapOn0066 = true;
    divmmc.automapOn0066Delayed = true;
    divmmc.armNmiButton();

    machine.pc = 0x0066;
    divmmc.beforeOpcodeFetch();

    // Instant: immediate activation
    expect(divmmc.autoMapActive).toBe(true);

    // After fetch: delayed also contributes (no change, already active)
    divmmc.afterOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);
  });

  it("neither instant nor delayed NMI: no activation", () => {
    const divmmc = machine.divMmcDevice;
    for (let i = 0; i < 8; i++) divmmc.rstTraps[i].enabled = false;
    divmmc.automapOn0066 = false;
    divmmc.automapOn0066Delayed = false;
    divmmc.armNmiButton();

    machine.pc = 0x0066;
    divmmc.beforeOpcodeFetch();
    divmmc.afterOpcodeFetch();

    expect(divmmc.autoMapActive).toBe(false);
  });
});
