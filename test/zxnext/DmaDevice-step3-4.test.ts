import { describe, it, expect, beforeEach } from "vitest";
import { DmaDevice } from "@emu/machines/zxNext/DmaDevice";
import { TestZxNextMachine } from "./TestNextMachine";

/**
 * Tests for Step 3 (MAME dispatch bit patterns) and Step 4 (WR0 conditional parameters).
 *
 * MAME dispatch order (z80dma.cpp write()):
 *   1. (data & 0x87) == 0x00  → WR2
 *   2. (data & 0x87) == 0x04  → WR1
 *   3. (data & 0x80) == 0x00  → WR0  (catch-all D7=0)
 *   4. (data & 0x83) == 0x80  → WR3
 *   5. (data & 0x83) == 0x81  → WR4
 *   6. (data & 0xc7) == 0x82  → WR5
 *   7. else                   → WR6
 */
describe("DmaDevice - Step 3: MAME Write Dispatch Bit Patterns", () => {
  let machine: TestZxNextMachine;
  let dma: DmaDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dma = machine.dmaDevice;
  });

  // ── WR2 dispatch ─────────────────────────────────────────────────────────

  it("0x00 should dispatch to WR2 ((0x00 & 0x87) == 0x00)", () => {
    dma.writePort(0x00);
    expect(dma.getRawReg(2, 0)).toBe(0x00);
  });

  it("0x08 should dispatch to WR2 ((0x08 & 0x87) == 0x00)", () => {
    dma.writePort(0x08);
    expect(dma.getRawReg(2, 0)).toBe(0x08);
  });

  it("0x70 should dispatch to WR2 ((0x70 & 0x87) == 0x00)", () => {
    dma.writePort(0x70);
    expect(dma.getRawReg(2, 0)).toBe(0x70);
  });

  // ── WR1 dispatch ─────────────────────────────────────────────────────────

  it("0x04 should dispatch to WR1 ((0x04 & 0x87) == 0x04)", () => {
    dma.writePort(0x04);
    expect(dma.getRawReg(1, 0)).toBe(0x04);
  });

  it("0x14 should dispatch to WR1 ((0x14 & 0x87) == 0x04)", () => {
    dma.writePort(0x14);
    expect(dma.getRawReg(1, 0)).toBe(0x14);
  });

  it("0x7c should dispatch to WR1 ((0x7c & 0x87) == 0x04)", () => {
    dma.writePort(0x7c);
    expect(dma.getRawReg(1, 0)).toBe(0x7c);
  });

  // ── WR0 dispatch (D7=0 catch-all, excluding WR1/WR2 patterns) ────────────

  it("0x01 should dispatch to WR0 (D7=0, not WR1/WR2 pattern)", () => {
    dma.writePort(0x01);
    expect(dma.getRawReg(0, 0)).toBe(0x01);
  });

  it("0x7d should dispatch to WR0 ((0x7d & 0x87) == 0x05, D7=0 catch-all)", () => {
    dma.writePort(0x7d);
    expect(dma.getRawReg(0, 0)).toBe(0x7d);
  });

  it("0x41 should dispatch to WR0 (D7=0, not WR1/WR2 pattern)", () => {
    dma.writePort(0x41);
    expect(dma.getRawReg(0, 0)).toBe(0x41);
  });

  // ── WR3 dispatch (D7=1, the new MAME-only range) ─────────────────────────
  // Under the OLD dispatch these values were routed to WR6 as unknown commands.
  // Under MAME dispatch they correctly go to WR3.

  it("0x80 should dispatch to WR3 ((0x80 & 0x83) == 0x80)", () => {
    dma.writePort(0x80);
    expect(dma.getRawReg(3, 0)).toBe(0x80);
  });

  it("0x98 should dispatch to WR3 ((0x98 & 0x83) == 0x80)", () => {
    dma.writePort(0x98);
    expect(dma.getRawReg(3, 0)).toBe(0x98);
  });

  it("0xbc should dispatch to WR3 ((0xbc & 0x83) == 0x80)", () => {
    dma.writePort(0xbc);
    expect(dma.getRawReg(3, 0)).toBe(0xbc);
  });

  // ── WR4 dispatch ─────────────────────────────────────────────────────────

  it("0x81 should dispatch to WR4 ((0x81 & 0x83) == 0x81)", () => {
    dma.writePort(0x81);
    expect(dma.getRawReg(4, 0)).toBe(0x81);
  });

  it("0xcd should dispatch to WR4 ((0xcd & 0x83) == 0x81)", () => {
    dma.writePort(0xcd);
    expect(dma.getRawReg(4, 0)).toBe(0xcd);
  });

  it("0xdd should dispatch to WR4 ((0xdd & 0x83) == 0x81)", () => {
    dma.writePort(0xdd);
    expect(dma.getRawReg(4, 0)).toBe(0xdd);
  });

  // ── WR5 dispatch (D7=1, the new MAME-only range) ─────────────────────────
  // Under the OLD dispatch these were routed to WR6 as unknown commands.

  it("0x82 should dispatch to WR5 ((0x82 & 0xc7) == 0x82)", () => {
    dma.writePort(0x82);
    expect(dma.getRawReg(5, 0)).toBe(0x82);
  });

  it("0xaa should dispatch to WR5 ((0xaa & 0xc7) == 0x82)", () => {
    dma.writePort(0xaa);
    expect(dma.getRawReg(5, 0)).toBe(0xaa);
  });

  it("0xb2 should dispatch to WR5 ((0xb2 & 0xc7) == 0x82)", () => {
    dma.writePort(0xb2);
    expect(dma.getRawReg(5, 0)).toBe(0xb2);
  });

  // ── WR6 dispatch ─────────────────────────────────────────────────────────

  it("0x83 should dispatch to WR6 ((0x83 & 0x83) == 0x83)", () => {
    // DISABLE_DMA command – does not throw and DMA is disabled
    expect(() => dma.writePort(0x83)).not.toThrow();
    expect(dma.getRawReg(6, 0)).toBe(0x83);
  });

  it("0x87 should dispatch to WR6 (ENABLE_DMA)", () => {
    expect(() => dma.writePort(0x87)).not.toThrow();
    expect(dma.getRawReg(6, 0)).toBe(0x87);
  });

  it("0xcf should dispatch to WR6 (LOAD command)", () => {
    expect(() => dma.writePort(0xcf)).not.toThrow();
    expect(dma.getRawReg(6, 0)).toBe(0xcf);
  });

  // ── Mutual exclusion: different values go to different WRx ───────────────

  it("WR1=0x14 and WR2=0x10 dispatch independently", () => {
    dma.writePort(0x14); // WR1
    dma.writePort(0x10); // WR2
    expect(dma.getRawReg(1, 0)).toBe(0x14);
    expect(dma.getRawReg(2, 0)).toBe(0x10);
  });

  it("WR3=0x80 and WR4=0x81 dispatch independently", () => {
    dma.writePort(0x80); // WR3
    dma.writePort(0x81); // WR4
    expect(dma.getRawReg(3, 0)).toBe(0x80);
    expect(dma.getRawReg(4, 0)).toBe(0x81);
  });
});

/**
 * Tests for Step 4: WR0 conditional parameter bytes via writePort.
 *
 * WR0 follow bits:
 *   D3 → PORTA_ADDRESS_L (REG(0,1))
 *   D4 → PORTA_ADDRESS_H (REG(0,2))
 *   D5 → BLOCKLEN_L      (REG(0,3))
 *   D6 → BLOCKLEN_H      (REG(0,4))
 */
describe("DmaDevice - Step 4: WR0 Conditional Parameter Bytes via writePort", () => {
  let machine: TestZxNextMachine;
  let dma: DmaDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dma = machine.dmaDevice;
  });

  it("WR0=0x79 (D6,D5,D4,D3 all set) consumes exactly 4 follow bytes", () => {
    // 0x79 = 0111 1001: D6=1,D5=1,D4=1,D3=1 → all 4 parameters follow
    dma.writePort(0x79); // base byte
    expect(dma.getNumFollow()).toBe(4);

    dma.writePort(0xAA); // PORTA_ADDRESS_L
    dma.writePort(0xBB); // PORTA_ADDRESS_H
    dma.writePort(0xCC); // BLOCKLEN_L
    dma.writePort(0xDD); // BLOCKLEN_H

    expect(dma.getNumFollow()).toBe(0);
    expect(dma.getRawReg(0, 1)).toBe(0xAA); // PORTA_ADDRESS_L
    expect(dma.getRawReg(0, 2)).toBe(0xBB); // PORTA_ADDRESS_H
    expect(dma.getRawReg(0, 3)).toBe(0xCC); // BLOCKLEN_L
    expect(dma.getRawReg(0, 4)).toBe(0xDD); // BLOCKLEN_H
  });

  it("WR0=0x7d (common setup value) stores all 4 parameters and updates registers", () => {
    // 0x7d = 0111 1101: D6=1,D5=1,D4=1,D3=1 → 4 follows
    dma.writePort(0x7d);
    dma.writePort(0x34); // PORTA_ADDRESS_L
    dma.writePort(0x12); // PORTA_ADDRESS_H
    dma.writePort(0x10); // BLOCKLEN_L
    dma.writePort(0x00); // BLOCKLEN_H

    expect(dma.getRawReg(0, 1)).toBe(0x34);
    expect(dma.getRawReg(0, 2)).toBe(0x12);
    expect(dma.getRawReg(0, 3)).toBe(0x10);
    expect(dma.getRawReg(0, 4)).toBe(0x00);

    const regs = dma.getRegisters();
    expect(regs.portAStartAddress).toBe(0x1234);
    expect(regs.blockLength).toBe(0x0010);
  });

  it("WR0=0x09 (only D3 set) consumes exactly 1 follow byte (PORTA_ADDRESS_L)", () => {
    // 0x09 = 0000 1001: D3=1 only → 1 follow
    dma.writePort(0x09);
    expect(dma.getNumFollow()).toBe(1);

    dma.writePort(0x55); // PORTA_ADDRESS_L — exhausts the queue
    expect(dma.getNumFollow()).toBe(0);

    expect(dma.getRawReg(0, 1)).toBe(0x55); // Only portA addr lo was written
    expect(dma.getRawReg(0, 2)).toBe(0x00); // portA addr hi unchanged
    expect(dma.getRawReg(0, 3)).toBe(0x00); // blockLen lo unchanged
    expect(dma.getRawReg(0, 4)).toBe(0x00); // blockLen hi unchanged
  });

  it("WR0=0x11 (only D4 set) consumes exactly 1 follow byte (PORTA_ADDRESS_H)", () => {
    // 0x11 = 0001 0001: D4=1 only → 1 follow (portA_addr_H)
    dma.writePort(0x11);
    expect(dma.getNumFollow()).toBe(1);

    dma.writePort(0xAB);
    expect(dma.getNumFollow()).toBe(0);

    expect(dma.getRawReg(0, 1)).toBe(0x00); // portA addr lo unchanged
    expect(dma.getRawReg(0, 2)).toBe(0xAB); // portA addr hi written
  });

  it("WR0=0x21 (only D5 set) consumes exactly 1 follow byte (BLOCKLEN_L)", () => {
    // 0x21 = 0010 0001: D5=1 only → 1 follow (blockLen_L)
    dma.writePort(0x21);
    expect(dma.getNumFollow()).toBe(1);

    dma.writePort(0x33);
    expect(dma.getNumFollow()).toBe(0);

    expect(dma.getRawReg(0, 3)).toBe(0x33); // blockLen lo written
    expect(dma.getRawReg(0, 4)).toBe(0x00); // blockLen hi unchanged
  });

  it("WR0=0x41 (only D6 set) consumes exactly 1 follow byte (BLOCKLEN_H)", () => {
    // 0x41 = 0100 0001: D6=1 only → 1 follow (blockLen_H)
    dma.writePort(0x41);
    expect(dma.getNumFollow()).toBe(1);

    dma.writePort(0x77);
    expect(dma.getNumFollow()).toBe(0);

    expect(dma.getRawReg(0, 3)).toBe(0x00); // blockLen lo unchanged
    expect(dma.getRawReg(0, 4)).toBe(0x77); // blockLen hi written
  });

  it("WR0=0x19 (D3+D4 set) consumes exactly 2 follow bytes", () => {
    // 0x19 = 0001 1001: D3=1,D4=1 → enqueue portA_addr_L then portA_addr_H
    dma.writePort(0x19);
    expect(dma.getNumFollow()).toBe(2);

    dma.writePort(0xCA); // PORTA_ADDRESS_L — still 1 more follow remaining
    expect(dma.getNumFollow()).toBe(2); // numFollow holds total; queue exhausted when numFollow resets to 0
    dma.writePort(0xFE); // PORTA_ADDRESS_H — queue now exhausted
    expect(dma.getNumFollow()).toBe(0);

    expect(dma.getRawReg(0, 1)).toBe(0xCA);
    expect(dma.getRawReg(0, 2)).toBe(0xFE);

    const regs = dma.getRegisters();
    expect(regs.portAStartAddress).toBe(0xFECA);
  });

  it("WR0=0x01 (no parameter bits set) consumes 0 follow bytes", () => {
    // 0x01 = 0000 0001: D3-D6 all 0 → no follows
    dma.writePort(0x01);
    expect(dma.getNumFollow()).toBe(0);

    // Next write is a new base byte, not a follow byte
    // 0x09 → WR0 again (D3=1, 1 follow expected)
    dma.writePort(0x09);
    expect(dma.getNumFollow()).toBe(1);
  });

  it("after WR0 follow bytes are consumed, next write is treated as new base byte", () => {
    // Write WR0 with 1 follow (D3 only)
    dma.writePort(0x09);
    dma.writePort(0x11); // Consume the 1 follow byte (portA addr lo = 0x11)

    expect(dma.getNumFollow()).toBe(0);

    // Now write WR2 base byte (0x00) – should be dispatched as WR2, not as WR0 follow
    dma.writePort(0x00);
    expect(dma.getRawReg(2, 0)).toBe(0x00);
  });

  it("WR0 blocks portA address across multiple partial writes", () => {
    // First: set portA addr low only
    dma.writePort(0x09); // D3 only
    dma.writePort(0x78); // portA addr lo = 0x78

    // Second: set portA addr high only
    dma.writePort(0x11); // D4 only
    dma.writePort(0x56); // portA addr hi = 0x56

    const regs = dma.getRegisters();
    expect(regs.portAStartAddress).toBe(0x5678);
  });
});
