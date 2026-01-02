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
