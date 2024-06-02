import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";

describe("Next - NextIoPortManager", function () {
  it("Initialization", () => {
    // --- Act
    const m = createTestNextMachine();
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
    { v: 0x07, allRam: true, config: 3, msb: 2 },
  ];
  cases0x1ffd.forEach((c) => {
    it(`0x1fff with ${c.v.toString(16)}`, () => {
      // --- Arrange
      const machine = createTestNextMachine();
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
  it("0x1ffd with normal", () => {
    // --- Act
    const m = createTestNextMachine();
    const d = m.portManager;

    // --- Assert
    let handler = d.getPortHandler(0x1ffd);
    expect(handler).not.toBeNull();
    expect(handler.readerFns).toBeUndefined();
    expect(handler.writerFns).not.toBeUndefined();
    expect(Array.isArray(handler.writerFns)).toBe(false);
  });
});
