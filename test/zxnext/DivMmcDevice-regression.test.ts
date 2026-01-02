import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine, TestZxNextMachine } from "./TestNextMachine";

/**
 * Regression tests for DivMMC CONMEM manual control
 * 
 * Issue #1: Missing Manual CONMEM Control (CRITICAL)
 * The `conmem` bit (bit 7 of port 0xE3) should manually enable/disable DivMMC paging,
 * but beforeOpcodeFetch() never checks this flag.
 */
describe("Next - DivMmcDevice: CONMEM Manual Control (Issue #1)", function () {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    machine.nextRegDevice.directSetRegValue(0x0a, 0x10); // Enable automap feature
    machine.nextRegDevice.directSetRegValue(0x83, 0x01); // Enable DivMMC hardware
  });

  it("conmem=1 should activate DivMMC mapping via beforeOpcodeFetch()", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable all entry points to isolate conmem control
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Set conmem=1 via port 0xE3
    machine.writePort(0x0e3, 0x81);
    
    // Call beforeOpcodeFetch() - should activate automap due to conmem
    divmmc.beforeOpcodeFetch();
    
    // Assert: autoMapActive should be true
    expect(divmmc.autoMapActive).toBe(true);
  });

  it("conmem=1 should persist across multiple beforeOpcodeFetch() calls", async () => {
    const divmmc = machine.divMmcDevice;
    
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    machine.writePort(0x0e3, 0x81);
    divmmc.beforeOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);
    
    // Call again - should stay active
    divmmc.afterOpcodeFetch();
    divmmc.beforeOpcodeFetch();
    
    expect(divmmc.autoMapActive).toBe(true);
  });

  it("conmem=0 should disable DivMMC mapping", async () => {
    const divmmc = machine.divMmcDevice;
    
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // First enable with conmem=1
    machine.writePort(0x0e3, 0x81);
    divmmc.beforeOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);
    
    // Now disable with conmem=0
    machine.writePort(0x0e3, 0x01);
    divmmc.beforeOpcodeFetch();
    
    // Should be disabled
    expect(divmmc.autoMapActive).toBe(false);
  });

  it("conmem=1 should work independent of entry points", async () => {
    const divmmc = machine.divMmcDevice;
    
    // No entry points configured
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    divmmc.automapOn3dxx = false;
    divmmc.automapOn0562 = false;
    
    // Set PC to non-entry-point address
    machine.pc = 0x5000;
    
    // Enable conmem
    machine.writePort(0x0e3, 0x84);
    divmmc.beforeOpcodeFetch();
    
    // Should still be active despite no entry points
    expect(divmmc.autoMapActive).toBe(true);
  });

  it("enableAutomap=false should disable conmem control", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable automap feature globally
    divmmc.enableAutomap = false;
    
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    machine.writePort(0x0e3, 0x82);
    divmmc.beforeOpcodeFetch();
    
    // Should not be active even with conmem=1
    expect(divmmc.autoMapActive).toBe(false);
  });
});

/**
 * Regression tests for RETN instruction detection
 * 
 * Issue #2: Missing RETN Instruction Detection (HIGH)
 * When Z80 executes RETN (0xED 0x45), DivMMC should:
 * - Clear automap_held
 * - Clear automap_hold
 * - Clear conmem bit
 * - Return to normal memory mapping
 */
describe("Next - DivMmcDevice: RETN Instruction Detection (Issue #2)", function () {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    machine.nextRegDevice.directSetRegValue(0x0a, 0x10); // Enable automap feature
    machine.nextRegDevice.directSetRegValue(0x83, 0x01); // Enable DivMMC hardware
  });

  it("RETN should clear automap when conmem-activated", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable all entry points to isolate conmem control
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Activate DivMMC via conmem
    machine.writePort(0x0e3, 0x81);
    divmmc.beforeOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);
    
    // Inject RETN instruction (0xED 0x45) at PC location
    machine.pc = 0x8000;
    machine.initCode([0xed, 0x45, 0x76], 0x8000); // RETN followed by HALT
    
    // Set up return address on stack
    machine.sp = 0xFFFE;
    machine.memoryDevice.writeMemory(0xFFFE, 0x20);
    machine.memoryDevice.writeMemory(0xFFFF, 0x80);
    
    // Execute RETN instruction
    machine.executeOneInstruction();
    
    // After RETN, conmem should be cleared
    expect(divmmc.conmem).toBe(false);
    expect(divmmc.autoMapActive).toBe(false);
  });

  it("RETN should clear conmem flag from port 0xE3", async () => {
    const divmmc = machine.divMmcDevice;
    
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Set conmem=1
    machine.writePort(0x0e3, 0x81);
    expect(divmmc.conmem).toBe(true);
    divmmc.beforeOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);
    
    // Prepare RETN execution
    machine.pc = 0x8000;
    machine.initCode([0xed, 0x45, 0x76], 0x8000);
    machine.sp = 0xFFFE;
    machine.memoryDevice.writeMemory(0xFFFE, 0x20);
    machine.memoryDevice.writeMemory(0xFFFF, 0x80);
    
    // Store original conmem state
    const conmemBefore = divmmc.conmem;
    expect(conmemBefore).toBe(true);
    
    // Execute RETN
    machine.executeOneInstruction();
    
    // conmem should be cleared
    expect(divmmc.conmem).toBe(false);
  });

  it("RETN should work independent of how automap was activated", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Enable RST 0x00 entry point (instant mapping)
    divmmc.rstTraps[0].enabled = true;
    divmmc.rstTraps[0].instantMapping = true;
    divmmc.rstTraps[0].onlyWithRom3 = false;
    
    // Set PC to RST 0x00 address to trigger automap
    machine.pc = 0x0000;
    divmmc.beforeOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);
    
    // Prepare RETN execution
    machine.pc = 0x8000;
    machine.initCode([0xed, 0x45, 0x76], 0x8000);
    machine.sp = 0xFFFE;
    machine.memoryDevice.writeMemory(0xFFFE, 0x20);
    machine.memoryDevice.writeMemory(0xFFFF, 0x80);
    
    // Execute RETN
    machine.executeOneInstruction();
    
    // Automap should be cleared by RETN
    expect(divmmc.autoMapActive).toBe(false);
  });

  it("RETN should clear conmem even without automap active", async () => {
    const divmmc = machine.divMmcDevice;
    
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Set conmem=1
    machine.writePort(0x0e3, 0x81);
    expect(divmmc.conmem).toBe(true);
    
    // Don't call beforeOpcodeFetch, just verify conmem flag
    expect(divmmc.conmem).toBe(true);
    
    // Prepare RETN execution
    machine.pc = 0x8000;
    machine.initCode([0xed, 0x45, 0x76], 0x8000);
    machine.sp = 0xFFFE;
    machine.memoryDevice.writeMemory(0xFFFE, 0x20);
    machine.memoryDevice.writeMemory(0xFFFF, 0x80);
    
    // Execute RETN
    machine.executeOneInstruction();
    
    // conmem should be cleared by RETN execution
    expect(divmmc.conmem).toBe(false);
  });

  it("RETN should clear automap across multiple consecutive instructions", async () => {
    const divmmc = machine.divMmcDevice;
    
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Activate via conmem
    machine.writePort(0x0e3, 0x81);
    divmmc.beforeOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);
    
    // Execute several NOPs to verify automap persists
    machine.pc = 0x8000;
    machine.initCode([
      0x00, // NOP
      0x00, // NOP
      0xed, 0x45, // RETN
      0x76  // HALT
    ], 0x8000);
    machine.sp = 0xFFFE;
    machine.memoryDevice.writeMemory(0xFFFE, 0x04);
    machine.memoryDevice.writeMemory(0xFFFF, 0x80);
    
    // Execute first NOP
    machine.executeOneInstruction();
    expect(divmmc.autoMapActive).toBe(true);
    
    // Execute second NOP
    machine.executeOneInstruction();
    expect(divmmc.autoMapActive).toBe(true);
    
    // Execute RETN
    machine.executeOneInstruction();
    
    // After RETN, everything should be cleared
    expect(divmmc.autoMapActive).toBe(false);
    expect(divmmc.conmem).toBe(false);
  });
});

/**
 * Regression tests for State Machine Implementation
 * 
 * Issue #3: Incomplete State Machine Implementation (HIGH)
 * The automap state machine should have three states:
 * 1. Inactive (automap = 0): Normal operation, monitoring for entry points
 * 2. Hold (automap_hold = 1): Entry point detected during M1 cycle
 * 3. Held (automap_held = 1): Automap active for subsequent instructions
 */
describe("Next - DivMmcDevice: State Machine Implementation (Issue #3)", function () {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    machine.nextRegDevice.directSetRegValue(0x0a, 0x10); // Enable automap feature
    machine.nextRegDevice.directSetRegValue(0x83, 0x01); // Enable DivMMC hardware
  });

  it("Delayed entry point should not activate immediately", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Configure RST 0x00 as delayed entry point (not instant)
    divmmc.rstTraps[0].enabled = true;
    divmmc.rstTraps[0].instantMapping = false; // Delayed
    divmmc.rstTraps[0].onlyWithRom3 = false;
    
    // Set PC to RST 0x00 address
    machine.pc = 0x0000;
    
    // Call beforeOpcodeFetch - should request paging but not activate yet
    divmmc.beforeOpcodeFetch();
    
    // Automap should NOT be active yet (delayed activation)
    expect(divmmc.autoMapActive).toBe(false);
  });

  it("Delayed entry point should activate on next instruction", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Configure RST 0x00 as delayed entry point
    divmmc.rstTraps[0].enabled = true;
    divmmc.rstTraps[0].instantMapping = false; // Delayed
    divmmc.rstTraps[0].onlyWithRom3 = false;
    
    // Set PC to RST 0x00
    machine.pc = 0x0000;
    machine.initCode([0x00, 0x00, 0x76], 0x0000); // NOP, NOP, HALT
    
    // First instruction: detect entry point and request delayed paging
    divmmc.beforeOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(false); // Not active yet
    
    machine.pc = 0x0001; // Advance PC
    
    // Second instruction: afterOpcodeFetch should activate delayed paging
    divmmc.afterOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true); // Now active
  });

  it("Instant entry point should activate immediately", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Configure RST 0x08 as instant entry point
    divmmc.rstTraps[1].enabled = true;
    divmmc.rstTraps[1].instantMapping = true; // Instant
    divmmc.rstTraps[1].onlyWithRom3 = false;
    
    // Set PC to RST 0x08
    machine.pc = 0x0008;
    
    // beforeOpcodeFetch should activate immediately
    divmmc.beforeOpcodeFetch();
    
    // Automap should be active immediately
    expect(divmmc.autoMapActive).toBe(true);
  });

  it("Delayed activation should persist across instruction boundary", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Configure RST 0x10 as delayed entry point
    divmmc.rstTraps[2].enabled = true;
    divmmc.rstTraps[2].instantMapping = false; // Delayed
    divmmc.rstTraps[2].onlyWithRom3 = false;
    
    // First instruction at RST 0x10
    machine.pc = 0x0010;
    divmmc.beforeOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(false); // Not active yet
    
    // Process afterOpcodeFetch to activate delayed paging
    divmmc.afterOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true); // Now active
    
    // Second instruction should still have automap active
    machine.pc = 0x0011;
    divmmc.beforeOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true); // Still active
    divmmc.afterOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true); // Still active
  });

  it("Multiple delayed entry points in sequence should work correctly", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Enable two delayed entry points
    divmmc.rstTraps[0].enabled = true;
    divmmc.rstTraps[0].instantMapping = false; // RST 0x00 - delayed
    divmmc.rstTraps[0].onlyWithRom3 = false;
    
    divmmc.rstTraps[1].enabled = true;
    divmmc.rstTraps[1].instantMapping = false; // RST 0x08 - delayed
    divmmc.rstTraps[1].onlyWithRom3 = false;
    
    // First entry point: RST 0x00
    machine.pc = 0x0000;
    divmmc.beforeOpcodeFetch();
    divmmc.afterOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);
    
    // Move to second entry point: RST 0x08
    machine.pc = 0x0008;
    divmmc.beforeOpcodeFetch();
    divmmc.afterOpcodeFetch();
    
    // Automap should remain active
    expect(divmmc.autoMapActive).toBe(true);
  });

  it("Instant entry point should override delayed request", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Configure mixed instant and delayed entry points
    divmmc.rstTraps[0].enabled = true;
    divmmc.rstTraps[0].instantMapping = false; // RST 0x00 - delayed
    divmmc.rstTraps[0].onlyWithRom3 = false;
    
    divmmc.rstTraps[1].enabled = true;
    divmmc.rstTraps[1].instantMapping = true; // RST 0x08 - instant
    divmmc.rstTraps[1].onlyWithRom3 = false;
    
    // First: delayed entry point request
    machine.pc = 0x0000;
    divmmc.beforeOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(false); // Delayed, not active yet
    
    // Second: instant entry point should activate immediately
    machine.pc = 0x0008;
    divmmc.beforeOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true); // Instant activation
  });

  it("Delayed paging should survive beforeOpcodeFetch calls after activation", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Configure delayed entry point
    divmmc.rstTraps[3].enabled = true;
    divmmc.rstTraps[3].instantMapping = false; // Delayed
    divmmc.rstTraps[3].onlyWithRom3 = false;
    
    // First instruction: request delayed paging at RST 0x18
    machine.pc = 0x0018;
    divmmc.beforeOpcodeFetch();
    divmmc.afterOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);
    
    // Multiple subsequent instructions at different addresses
    for (let i = 0; i < 5; i++) {
      machine.pc = 0x4000 + i; // Non-entry point addresses
      divmmc.beforeOpcodeFetch();
      expect(divmmc.autoMapActive).toBe(true); // Should persist
      divmmc.afterOpcodeFetch();
    }
  });
});

/**
 * Regression tests for ROM 3 Dependency Logic
 * 
 * Issue #4: ROM 3 Dependency Logic Incomplete (MEDIUM)
 * According to VHDL:
 * - i_automap_active triggers regular entry points when ROM3 is NOT present (48K mode)
 * - i_automap_rom3_active triggers ROM3 entry points when ROM3 IS present (128K mode)
 * 
 * RST entry points are configured via NextReg 0xB9:
 * - Bit set to 1 = entry point works in BOTH 48K and 128K modes
 * - Bit set to 0 = entry point works ONLY in 128K mode (ROM3 required)
 * 
 * This means:
 * - If onlyWithRom3=true: should ONLY trigger when ROM3 is present
 * - If onlyWithRom3=false: should trigger ALWAYS (regardless of ROM3 presence)
 */
describe("Next - DivMmcDevice: ROM 3 Dependency Logic (Issue #4)", function () {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    machine.nextRegDevice.directSetRegValue(0x0a, 0x10); // Enable automap feature
    machine.nextRegDevice.directSetRegValue(0x83, 0x01); // Enable DivMMC hardware
  });

  it("RST entry point WITHOUT ROM3 requirement should trigger when ROM3 NOT present", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable all other entry points
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // RST 0x00 WITHOUT ROM3 requirement (onlyWithRom3=false)
    divmmc.rstTraps[0].enabled = true;
    divmmc.rstTraps[0].instantMapping = true;
    divmmc.rstTraps[0].onlyWithRom3 = false;
    
    // Ensure ROM3 is NOT present (48K mode)
    machine.memoryDevice.selectedRomMsb = 0x00;
    machine.memoryDevice.selectedRomLsb = 0x00;
    
    // Set PC to RST 0x00
    machine.pc = 0x0000;
    divmmc.beforeOpcodeFetch();
    
    // Should trigger despite ROM3 not being present
    expect(divmmc.autoMapActive).toBe(true);
  });

  it("RST entry point WITH ROM3 requirement should NOT trigger when ROM3 NOT present", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable all other entry points
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // RST 0x08 WITH ROM3 requirement (onlyWithRom3=true)
    divmmc.rstTraps[1].enabled = true;
    divmmc.rstTraps[1].instantMapping = true;
    divmmc.rstTraps[1].onlyWithRom3 = true;
    
    // Ensure ROM3 is NOT present
    machine.memoryDevice.selectedRomMsb = 0x00;
    machine.memoryDevice.selectedRomLsb = 0x00;
    
    // Set PC to RST 0x08
    machine.pc = 0x0008;
    divmmc.beforeOpcodeFetch();
    
    // Should NOT trigger because ROM3 is required but not present
    expect(divmmc.autoMapActive).toBe(false);
  });

  it("RST entry point WITH ROM3 requirement SHOULD trigger when ROM3 IS present", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable all other entry points
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // RST 0x10 WITH ROM3 requirement (onlyWithRom3=true)
    divmmc.rstTraps[2].enabled = true;
    divmmc.rstTraps[2].instantMapping = true;
    divmmc.rstTraps[2].onlyWithRom3 = true;
    
    // Set ROM3 as present (128K mode)
    machine.memoryDevice.selectedRomMsb = 0x03;
    machine.memoryDevice.selectedRomLsb = 0x03;
    
    // Set PC to RST 0x10
    machine.pc = 0x0010;
    divmmc.beforeOpcodeFetch();
    
    // Should trigger because ROM3 is present
    expect(divmmc.autoMapActive).toBe(true);
  });

  it("Custom entry point 0x04C6 should require ROM3", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Enable 0x04C6 entry point (delayed mode)
    divmmc.automapOn04c6 = true;
    
    // Test: ROM3 NOT present - should NOT trigger
    machine.memoryDevice.port1ffdValue = 0x00; // ROM 0
    machine.memoryDevice.port7ffdValue = 0x10;
    machine.pc = 0x04c6;
    divmmc.beforeOpcodeFetch();
    divmmc.afterOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(false);
  });

  it("Custom entry point 0x04C6 SHOULD trigger when ROM3 IS present", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Enable 0x04C6 entry point (delayed mode)
    divmmc.automapOn04c6 = true;
    
    // ROM3 IS present
    machine.memoryDevice.port1ffdValue = 0x04; // ROM 3
    machine.memoryDevice.port7ffdValue = 0x10;
    machine.pc = 0x04c6;
    divmmc.beforeOpcodeFetch();
    divmmc.afterOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);
  });

  it("Custom entry point 0x0562 should require ROM3", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Enable 0x0562 entry point (delayed mode)
    divmmc.automapOn0562 = true;
    
    // Test: ROM3 NOT present - should NOT trigger
    machine.memoryDevice.port1ffdValue = 0x00; // ROM 0
    machine.memoryDevice.port7ffdValue = 0x10;
    machine.pc = 0x0562;
    divmmc.beforeOpcodeFetch();
    divmmc.afterOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(false);
  });

  it("Custom entry point 0x0562 SHOULD trigger when ROM3 IS present", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Enable 0x0562 entry point (delayed mode)
    divmmc.automapOn0562 = true;
    
    // ROM3 IS present
    machine.memoryDevice.port1ffdValue = 0x04; // ROM 3
    machine.memoryDevice.port7ffdValue = 0x10;
    machine.pc = 0x0562;
    divmmc.beforeOpcodeFetch();
    divmmc.afterOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);
  });

  it("Range 0x3Dxx should require ROM3", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Enable 0x3Dxx range (instant mode)
    divmmc.automapOn3dxx = true;
    
    // Test: ROM3 NOT present - should NOT trigger
    machine.memoryDevice.port1ffdValue = 0x00; // ROM 0
    machine.memoryDevice.port7ffdValue = 0x10;
    machine.pc = 0x3D50;
    divmmc.beforeOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(false);
  });

  it("Range 0x3Dxx SHOULD trigger when ROM3 IS present", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Enable 0x3Dxx range (instant mode)
    divmmc.automapOn3dxx = true;
    
    // ROM3 IS present
    machine.memoryDevice.port1ffdValue = 0x04; // ROM 3
    machine.memoryDevice.port7ffdValue = 0x10;
    machine.pc = 0x3D50;
    divmmc.beforeOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);
  });

  it("Auto-unmap at 0x1FF8-0x1FFF should work regardless of ROM3", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Manually activate via conmem
    machine.writePort(0x0e3, 0x81);
    divmmc.beforeOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);
    
    // Enable auto-unmap at 0x1FF8-0x1FFF
    divmmc.automapOff1ff8 = true;
    
    // Move to auto-unmap address - ROM3 NOT present
    machine.memoryDevice.port1ffdValue = 0x00;
    machine.memoryDevice.port7ffdValue = 0x10;
    machine.pc = 0x1ff8;
    divmmc.beforeOpcodeFetch();
    
    // Auto-unmap is delayed (requests off via _requestAutomapOff)
    // It takes effect in afterOpcodeFetch
    divmmc.afterOpcodeFetch();
    
    // Should unmap after afterOpcodeFetch, regardless of ROM3 state
    expect(divmmc.autoMapActive).toBe(false);
  });

  // Issue #7: Instant Mapping at 0x3Dxx Range
  
  it("0x3Dxx should NOT trigger without ROM3", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Enable 0x3Dxx entry point
    divmmc.automapOn3dxx = true;
    
    // Make sure ROM3 is NOT present
    machine.memoryDevice.port1ffdValue = 0x00;
    machine.memoryDevice.port7ffdValue = 0x00;
    
    // Try to trigger at 0x3D80 (in 0x3Dxx range)
    machine.pc = 0x3d80;
    divmmc.beforeOpcodeFetch();
    
    // Should NOT activate - ROM3 requirement not satisfied
    expect(divmmc.autoMapActive).toBe(false);
  });

  it("0x3Dxx should trigger WHEN ROM3 present", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Enable 0x3Dxx entry point
    divmmc.automapOn3dxx = true;
    
    // Make sure ROM3 IS present
    machine.memoryDevice.port1ffdValue = 0x04; // specialConfig = 0x02
    machine.memoryDevice.port7ffdValue = 0x10; // selectedRomLsb = 1
    // Result: (0x02 | 0x01) = 0x03 = ROM3
    
    // Trigger at 0x3D80 (in 0x3Dxx range)
    machine.pc = 0x3d80;
    divmmc.beforeOpcodeFetch();
    
    // Should activate immediately (instant, not delayed)
    expect(divmmc.autoMapActive).toBe(true);
  });

  it("0x3Dxx at boundary address 0x3D00", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Enable 0x3Dxx entry point
    divmmc.automapOn3dxx = true;
    
    // ROM3 present
    machine.memoryDevice.port1ffdValue = 0x04;
    machine.memoryDevice.port7ffdValue = 0x10;
    
    // Trigger at 0x3D00 (lower boundary)
    machine.pc = 0x3d00;
    divmmc.beforeOpcodeFetch();
    
    expect(divmmc.autoMapActive).toBe(true);
  });

  it("0x3Dxx at boundary address 0x3DFF", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Enable 0x3Dxx entry point
    divmmc.automapOn3dxx = true;
    
    // ROM3 present
    machine.memoryDevice.port1ffdValue = 0x04;
    machine.memoryDevice.port7ffdValue = 0x10;
    
    // Trigger at 0x3DFF (upper boundary)
    machine.pc = 0x3dff;
    divmmc.beforeOpcodeFetch();
    
    expect(divmmc.autoMapActive).toBe(true);
  });

  it("0x3Dxx should NOT trigger when disabled", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Disable 0x3Dxx entry point
    divmmc.automapOn3dxx = false;
    
    // ROM3 present
    machine.memoryDevice.port1ffdValue = 0x04;
    machine.memoryDevice.port7ffdValue = 0x10;
    
    // Try to trigger at 0x3D80
    machine.pc = 0x3d80;
    divmmc.beforeOpcodeFetch();
    
    // Should NOT activate - entry point is disabled
    expect(divmmc.autoMapActive).toBe(false);
  });

  it("0x3Dxx should NOT trigger outside range (0x3CFF)", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Enable 0x3Dxx entry point
    divmmc.automapOn3dxx = true;
    
    // ROM3 present
    machine.memoryDevice.port1ffdValue = 0x04;
    machine.memoryDevice.port7ffdValue = 0x10;
    
    // Try to trigger at 0x3CFF (just outside range)
    machine.pc = 0x3cff;
    divmmc.beforeOpcodeFetch();
    
    // Should NOT activate - outside range
    expect(divmmc.autoMapActive).toBe(false);
  });

  it("0x3Dxx should NOT trigger outside range (0x3E00)", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Enable 0x3Dxx entry point
    divmmc.automapOn3dxx = true;
    
    // ROM3 present
    machine.memoryDevice.port1ffdValue = 0x04;
    machine.memoryDevice.port7ffdValue = 0x10;
    
    // Try to trigger at 0x3E00 (just outside range)
    machine.pc = 0x3e00;
    divmmc.beforeOpcodeFetch();
    
    // Should NOT activate - outside range
    expect(divmmc.autoMapActive).toBe(false);
  });

  it("0x3Dxx persists across instruction boundaries", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Enable 0x3Dxx entry point
    divmmc.automapOn3dxx = true;
    
    // ROM3 present
    machine.memoryDevice.port1ffdValue = 0x04;
    machine.memoryDevice.port7ffdValue = 0x10;
    
    // Trigger at 0x3D80
    machine.pc = 0x3d80;
    divmmc.beforeOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);
    
    // Move to different address (outside 0x3Dxx range)
    machine.pc = 0x4000;
    divmmc.beforeOpcodeFetch();
    
    // Should still be active (instant activation persists)
    expect(divmmc.autoMapActive).toBe(true);
  });

  it("0x3Dxx is instant (not delayed)", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Enable 0x3Dxx entry point
    divmmc.automapOn3dxx = true;
    
    // ROM3 present
    machine.memoryDevice.port1ffdValue = 0x04;
    machine.memoryDevice.port7ffdValue = 0x10;
    
    // Trigger at 0x3D80
    machine.pc = 0x3d80;
    divmmc.beforeOpcodeFetch();
    
    // Should activate immediately (no delay)
    expect(divmmc.autoMapActive).toBe(true);
    
    // Move to another address and run afterOpcodeFetch
    machine.pc = 0x4000;
    divmmc.afterOpcodeFetch();
    
    // Should still be active (instant stayed active, not a delayed request)
    expect(divmmc.autoMapActive).toBe(true);
  });

  // Issue #6: NMI Entry Point (0x0066)

  it("NMI at 0x0066 should NOT trigger without NMI button pressed", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Enable NMI entry point (delayed mode)
    divmmc.automapOn0066Delayed = true;
    divmmc.enableDivMmcNmiByDriveButton = true;  // NMI enabled but button not pressed
    
    // Try to trigger at 0x0066
    machine.pc = 0x0066;
    divmmc.beforeOpcodeFetch();
    
    // Should NOT activate - NMI button not pressed
    expect(divmmc.autoMapActive).toBe(false);
  });

  it("NMI at 0x0066 delayed mode should trigger when NMI button pressed", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Enable NMI entry point (delayed mode)
    divmmc.automapOn0066Delayed = true;
    divmmc.enableDivMmcNmiByDriveButton = true;
    
    // Simulate NMI button press by setting the internal flag
    // Note: In a real machine, this would be set by NMI button hardware
    (divmmc as any)._nmiButtonPressed = true;
    
    // Trigger at 0x0066 (NMI vector)
    machine.pc = 0x0066;
    divmmc.beforeOpcodeFetch();
    
    // Should set request for delayed activation (next instruction)
    expect((divmmc as any)._requestAutomapOn).toBe(true);
    
    // Process the delayed request
    divmmc.afterOpcodeFetch();
    
    // Should activate after afterOpcodeFetch
    expect(divmmc.autoMapActive).toBe(true);
  });

  it("NMI at 0x0066 instant mode should trigger immediately when NMI button pressed", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Enable NMI entry point (instant mode)
    divmmc.automapOn0066 = true;  // instant
    divmmc.automapOn0066Delayed = false;
    divmmc.enableDivMmcNmiByDriveButton = true;
    
    // Simulate NMI button press
    (divmmc as any)._nmiButtonPressed = true;
    
    // Trigger at 0x0066 (NMI vector)
    machine.pc = 0x0066;
    divmmc.beforeOpcodeFetch();
    
    // Should activate immediately (instant mode)
    expect(divmmc.autoMapActive).toBe(true);
  });

  it("NMI entry point should NOT trigger when NMI disabled", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Enable NMI entry point but disable NMI feature
    divmmc.automapOn0066 = true;
    divmmc.enableDivMmcNmiByDriveButton = false;  // NMI disabled
    
    // Simulate NMI button press
    (divmmc as any)._nmiButtonPressed = true;
    
    // Try to trigger at 0x0066
    machine.pc = 0x0066;
    divmmc.beforeOpcodeFetch();
    
    // Should NOT activate - NMI feature disabled
    expect(divmmc.autoMapActive).toBe(false);
  });

  it("NMI entry point with both instant and delayed modes should prefer instant", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Enable BOTH instant and delayed NMI modes
    divmmc.automapOn0066 = true;  // instant
    divmmc.automapOn0066Delayed = true;  // delayed
    divmmc.enableDivMmcNmiByDriveButton = true;
    
    // Simulate NMI button press
    (divmmc as any)._nmiButtonPressed = true;
    
    // Trigger at 0x0066
    machine.pc = 0x0066;
    divmmc.beforeOpcodeFetch();
    
    // Should activate immediately (instant mode preferred/checked first)
    expect(divmmc.autoMapActive).toBe(true);
  });

  it("NMI entry point delayed mode persists across instruction boundaries", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Enable NMI entry point (delayed mode)
    divmmc.automapOn0066Delayed = true;
    divmmc.enableDivMmcNmiByDriveButton = true;
    
    // Simulate NMI button press
    (divmmc as any)._nmiButtonPressed = true;
    
    // Trigger at 0x0066
    machine.pc = 0x0066;
    divmmc.beforeOpcodeFetch();
    expect((divmmc as any)._requestAutomapOn).toBe(true);
    
    // Move to another address
    machine.pc = 0x4000;
    divmmc.afterOpcodeFetch();
    
    // Should activate
    expect(divmmc.autoMapActive).toBe(true);
    
    // Continue to next instruction - should stay active
    machine.pc = 0x4001;
    divmmc.beforeOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(true);
  });

  it("NMI entry point should only trigger at 0x0066 address", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Enable NMI entry point
    divmmc.automapOn0066 = true;
    divmmc.enableDivMmcNmiByDriveButton = true;
    
    // Simulate NMI button press
    (divmmc as any)._nmiButtonPressed = true;
    
    // Try different addresses (near 0x0066 but not exact)
    machine.pc = 0x0065;
    divmmc.beforeOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(false);
    
    machine.pc = 0x0067;
    divmmc.beforeOpcodeFetch();
    expect(divmmc.autoMapActive).toBe(false);
  });

  it("NMI at 0x0066 instant mode should NOT require ROM3", async () => {
    const divmmc = machine.divMmcDevice;
    
    // Disable RST traps
    for (let i = 0; i < 8; i++) {
      divmmc.rstTraps[i].enabled = false;
    }
    
    // Enable NMI entry point (instant mode)
    divmmc.automapOn0066 = true;
    divmmc.enableDivMmcNmiByDriveButton = true;
    
    // Simulate NMI button press
    (divmmc as any)._nmiButtonPressed = true;
    
    // Make sure ROM3 is NOT present
    machine.memoryDevice.port1ffdValue = 0x00;
    machine.memoryDevice.port7ffdValue = 0x00;
    
    // Trigger at 0x0066
    machine.pc = 0x0066;
    divmmc.beforeOpcodeFetch();
    
    // Should still activate - NMI doesn't require ROM3 (unlike ROM3-specific entry points)
    expect(divmmc.autoMapActive).toBe(true);
  });
});
