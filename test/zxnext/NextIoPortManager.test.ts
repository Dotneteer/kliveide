import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";

describe("Next - NextIoPortManager", function () {
  it("Initialization", async () => {
    // --- Act
    const m = await createTestNextMachine();
    const d = m.portManager;

    // --- Assert
    let handler = d.getPortHandler(0x1ffd);
    expect(handler).not.toBeNull();
    expect(handler.readerFns).toBeUndefined();
    expect(handler.writerFns).not.toBeUndefined();
    expect(Array.isArray(handler.writerFns)).toBe(false);
  });

  const cases0x1ffd = [
    { v: 0x00, allRam: false, config: 0, msb: 0 },
    { v: 0x01, allRam: true, config: 0, msb: 0 },
    { v: 0x02, allRam: false, config: 1, msb: 0 },
    { v: 0x03, allRam: true, config: 1, msb: 0 },
    { v: 0x04, allRam: false, config: 2, msb: 2 },
    { v: 0x05, allRam: true, config: 2, msb: 2 },
    { v: 0x06, allRam: false, config: 3, msb: 2 },
    { v: 0x07, allRam: true, config: 3, msb: 2 }
  ];
  cases0x1ffd.forEach((c) => {
    it(`0x1fff with ${c.v.toString(16)}`, async () => {
      // --- Arrange
      const machine = await createTestNextMachine();
      const io = machine.portManager;
      const mem = machine.memoryDevice;

      // --- Act
      io.writePort(0x1ffd, c.v);

      // --- Assert
      expect(mem.allRamMode).toBe(c.allRam);
      expect(mem.specialConfig).toBe(c.config);
      expect(mem.selectedRomMsb).toBe(c.msb);
    });
  });

  it("0x7ffd paging disabled works", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const mem = machine.memoryDevice;
    io.writePort(0x7ffd, 0x3f);

    // --- Act
    io.writePort(0x7ffd, 0x00);
    io.writePort(0x7ffd, 0x10);
    io.writePort(0x7ffd, 0x02);

    // --- Assert
    expect(mem.pagingEnabled).toBe(false);
    expect(mem.useShadowScreen).toBe(true);
    expect(mem.selectedRomLsb).toBe(0x01);
    expect(mem.selectedBankLsb).toBe(0x07);
  });

  const cases0x7ffd = [
    { v: 0x00, rom: 0x00, shadow: false, bank: 0x00 },
    { v: 0x02, rom: 0x00, shadow: false, bank: 0x02 },
    { v: 0x03, rom: 0x00, shadow: false, bank: 0x03 },
    { v: 0x06, rom: 0x00, shadow: false, bank: 0x06 },
    { v: 0x07, rom: 0x00, shadow: false, bank: 0x07 },
    { v: 0x08, rom: 0x00, shadow: true, bank: 0x00 },
    { v: 0x0a, rom: 0x00, shadow: true, bank: 0x02 },
    { v: 0x0b, rom: 0x00, shadow: true, bank: 0x03 },
    { v: 0x0e, rom: 0x00, shadow: true, bank: 0x06 },
    { v: 0x0f, rom: 0x00, shadow: true, bank: 0x07 },
    { v: 0x10, rom: 0x01, shadow: false, bank: 0x00 },
    { v: 0x12, rom: 0x01, shadow: false, bank: 0x02 },
    { v: 0x13, rom: 0x01, shadow: false, bank: 0x03 },
    { v: 0x16, rom: 0x01, shadow: false, bank: 0x06 },
    { v: 0x17, rom: 0x01, shadow: false, bank: 0x07 },
    { v: 0x18, rom: 0x01, shadow: true, bank: 0x00 },
    { v: 0x1a, rom: 0x01, shadow: true, bank: 0x02 },
    { v: 0x1b, rom: 0x01, shadow: true, bank: 0x03 },
    { v: 0x1e, rom: 0x01, shadow: true, bank: 0x06 },
    { v: 0x1f, rom: 0x01, shadow: true, bank: 0x07 },
];
  cases0x7ffd.forEach((c) => {
    it(`0x7ffd with ${c.v.toString(16)}`, async () => {
      // --- Arrange
      const machine = await createTestNextMachine();
      const io = machine.portManager;
      const mem = machine.memoryDevice;

      // --- Act
      io.writePort(0x7ffd, c.v);

      // --- Assert
      expect(mem.pagingEnabled).toBe(true);
      expect(mem.useShadowScreen).toBe(c.shadow);
      expect(mem.selectedRomLsb).toBe(c.rom);
      expect(mem.selectedBankLsb).toBe(c.bank);
    });
  });
});
