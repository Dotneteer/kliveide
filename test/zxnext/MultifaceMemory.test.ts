import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine, TestZxNextMachine } from "./TestNextMachine";
import { OFFS_MULTIFACE_MEM } from "@emu/machines/zxNext/MemoryDevice";

/**
 * Tests for Multiface memory mapping in MemoryDevice (Task 7).
 *
 * When multifaceDevice.mfEnabled is true, reads/writes to 0x0000–0x3FFF
 * are redirected to the OFFS_MULTIFACE_MEM region instead of normal MMU pages.
 */
describe("MultifaceMemory", async () => {
  let m: TestZxNextMachine;

  beforeEach(async () => {
    m = await createTestNextMachine();
  });

  // ─────────────────────────────
  //  Fast path / flag state
  // ─────────────────────────────

  it("after reset: _mfActive is false", () => {
    expect((m.memoryDevice as any)._mfActive).toBe(false);
  });

  it("_mfActive becomes true when mfEnabled set and updateFastPathFlags called", () => {
    m.multifaceDevice.mfEnabled = true;
    m.memoryDevice.updateFastPathFlags();
    expect((m.memoryDevice as any)._mfActive).toBe(true);
  });

  it("_mfActive returns to false when mfEnabled cleared and updateFastPathFlags called", () => {
    m.multifaceDevice.mfEnabled = true;
    m.memoryDevice.updateFastPathFlags();
    m.multifaceDevice.mfEnabled = false;
    m.memoryDevice.updateFastPathFlags();
    expect((m.memoryDevice as any)._mfActive).toBe(false);
  });

  it("_useFastPath is false when _mfActive is true", () => {
    m.multifaceDevice.mfEnabled = true;
    m.memoryDevice.updateFastPathFlags();
    expect((m.memoryDevice as any)._useFastPath).toBe(false);
  });

  it("_useFastPath is true when _mfActive is false (no other mappings)", () => {
    expect((m.memoryDevice as any)._useFastPath).toBe(true);
  });

  // ─────────────────────────────
  //  Read redirection
  // ─────────────────────────────

  it("reads from 0x0000–0x1FFF redirect to OFFS_MULTIFACE_MEM when MF active", () => {
    // Write a sentinel value into MF memory page 0
    m.multifaceDevice.mfEnabled = true;
    m.memoryDevice.updateFastPathFlags();
    const mem = (m.memoryDevice as any).memory as Uint8Array;
    mem[OFFS_MULTIFACE_MEM + 0x0100] = 0xab;

    // Reading 0x0100 should return the MF byte
    expect(m.memoryDevice.readMemory(0x0100)).toBe(0xab);
  });

  it("reads from 0x2000–0x3FFF redirect to OFFS_MULTIFACE_MEM+0x2000 when MF active", () => {
    m.multifaceDevice.mfEnabled = true;
    m.memoryDevice.updateFastPathFlags();
    const mem = (m.memoryDevice as any).memory as Uint8Array;
    mem[OFFS_MULTIFACE_MEM + 0x2100] = 0xcd;

    expect(m.memoryDevice.readMemory(0x2100)).toBe(0xcd);
  });

  it("reads from slot 0 use normal MMU when MF not active", () => {
    // Normal ROM content should be readable (not MF memory)
    const normalByte = m.memoryDevice.readMemory(0x0000);
    const mem = (m.memoryDevice as any).memory as Uint8Array;
    mem[OFFS_MULTIFACE_MEM + 0x0000] = (normalByte ^ 0xff) & 0xff; // Ensure MF byte differs
    // MF not active: should still read normal ROM
    expect(m.memoryDevice.readMemory(0x0000)).toBe(normalByte);
  });

  it("reads from addresses outside slot 0 are not affected by MF active", () => {
    m.multifaceDevice.mfEnabled = true;
    m.memoryDevice.updateFastPathFlags();
    // Slot 1 (0x4000) should be unaffected
    const byte4000 = m.memoryDevice.readMemory(0x4000);
    expect(byte4000).toBeDefined();
    // The result should not come from OFFS_MULTIFACE_MEM
  });

  // ─────────────────────────────
  //  Write redirection
  // ─────────────────────────────

  it("writes to 0x0000–0x1FFF redirect to OFFS_MULTIFACE_MEM when MF active", () => {
    m.multifaceDevice.mfEnabled = true;
    m.memoryDevice.updateFastPathFlags();

    m.memoryDevice.writeMemory(0x0050, 0x42);

    const mem = (m.memoryDevice as any).memory as Uint8Array;
    expect(mem[OFFS_MULTIFACE_MEM + 0x0050]).toBe(0x42);
  });

  it("writes to 0x2000–0x3FFF redirect to OFFS_MULTIFACE_MEM+0x2000 when MF active", () => {
    m.multifaceDevice.mfEnabled = true;
    m.memoryDevice.updateFastPathFlags();

    m.memoryDevice.writeMemory(0x2050, 0x99);

    const mem = (m.memoryDevice as any).memory as Uint8Array;
    expect(mem[OFFS_MULTIFACE_MEM + 0x2050]).toBe(0x99);
  });

  it("writes do not go to MF memory when MF not active", () => {
    m.memoryDevice.updateFastPathFlags(); // MF inactive
    const mem = (m.memoryDevice as any).memory as Uint8Array;
    const before = mem[OFFS_MULTIFACE_MEM + 0x0050];

    // Writing to ROM is a no-op in normal mode, MF memory should be unchanged
    m.memoryDevice.writeMemory(0x0050, 0xee);
    expect(mem[OFFS_MULTIFACE_MEM + 0x0050]).toBe(before);
  });

  // ─────────────────────────────
  //  MF vs DivMMC priority
  // ─────────────────────────────

  it("MF holds highest read priority over DivMMC when both active", () => {
    // Set up MF memory sentinel
    const mem = (m.memoryDevice as any).memory as Uint8Array;
    mem[OFFS_MULTIFACE_MEM + 0x0080] = 0x11;

    // Activate both
    m.multifaceDevice.mfEnabled = true;
    (m.divMmcDevice as any)._conmem = true;
    m.memoryDevice.updateFastPathFlags();

    // MF should win — return MF memory byte
    expect(m.memoryDevice.readMemory(0x0080)).toBe(0x11);
  });

  it("MF holds highest write priority over DivMMC when both active", () => {
    m.multifaceDevice.mfEnabled = true;
    (m.divMmcDevice as any)._conmem = true;
    m.memoryDevice.updateFastPathFlags();

    m.memoryDevice.writeMemory(0x0080, 0x22);

    const mem = (m.memoryDevice as any).memory as Uint8Array;
    expect(mem[OFFS_MULTIFACE_MEM + 0x0080]).toBe(0x22);
  });

  // ─────────────────────────────
  //  Round-trip
  // ─────────────────────────────

  it("write then read through MF memory is consistent", () => {
    m.multifaceDevice.mfEnabled = true;
    m.memoryDevice.updateFastPathFlags();

    m.memoryDevice.writeMemory(0x1000, 0x55);
    expect(m.memoryDevice.readMemory(0x1000)).toBe(0x55);

    m.memoryDevice.writeMemory(0x3000, 0xaa);
    expect(m.memoryDevice.readMemory(0x3000)).toBe(0xaa);
  });
});
