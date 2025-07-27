import { describe, expect, it } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";

describe("M6510 Registers load instructions", () => {
  // LDY #<N>: 0xa0
  it("LDY #<N> works #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xa0, 0x34], 0x1000, 0x1000);

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x34);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(2);
  });

  // LDY #<N>: 0xa0
  it("LDY #<N> works #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xa0, 0x00], 0x1000, 0x1000);

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x00);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(2);
  });

  // LDY #<N>: 0xa0
  it("LDY #<N> works #3", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xa0, 0x8a], 0x1000, 0x1000);

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x8a);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(2);
  });

  // LDY #<N>: 0xa0
  it("LDY #<N> works with page boundary #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    // Load Y with 0x80, which is on the page boundary
    machine.initCode([0xa0, 0x80], 0x10ff, 0x10ff);

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x80);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1101);

    expect(machine.cpu.tacts).toBe(2);
  });

  // LDY #<N>: 0xa0
  it("LDY #<N> works with page boundary #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    // Load Y with 0x7f, which is on the page boundary
    machine.initCode([0xa0, 0x7f], 0x10fe, 0x10fe);

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x7f);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1100);

    expect(machine.cpu.tacts).toBe(2);
  });

  // LDA (zp,X): 0xa1
  it("LDA (zp,X) works #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xa1, 0x34], 0x1000, 0x1000);
    machine.cpu.x = 0x05; // Set X to 1
    machine.memory[0x34 + machine.cpu.x] = 0x62; // Load memory at address 0x34 + X with 0x62
    machine.memory[0x35 + machine.cpu.x] = 0x23; // Load next byte for indirect addressing
    machine.memory[0x2362] = 0x12; // Load next byte for indirect addressing

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x12); // A should be loaded with 0x12
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002); // PC should be increment by 2

    expect(machine.cpu.tacts).toBe(6); // 6 tacts for LDA (zp,X)
  });

  // LDA (zp,X): 0xa1
  it("LDA (zp,X) works #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xa1, 0x34], 0x1000, 0x1000);
    machine.cpu.x = 0x05; // Set X to 5
    machine.memory[0x34 + machine.cpu.x] = 0x62; // Load memory at address 0x34 + X with 0x62
    machine.memory[0x35 + machine.cpu.x] = 0x23; // Load next byte for indirect addressing
    machine.memory[0x2362] = 0x00; // Load next byte for indirect addressing

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00); // A should be loaded with 0x00
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002); // PC should be incremented by 2

    expect(machine.cpu.tacts).toBe(6); // 6 tacts for LDA (zp,X)
  });

  // LDA (zp,X): 0xa1
  it("LDA (zp,X) works #3", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xa1, 0x34], 0x1000, 0x1000);
    machine.cpu.x = 0x05; // Set X to 5
    machine.memory[0x34 + machine.cpu.x] = 0x62; // Load memory at address 0x34 + X with 0x62
    machine.memory[0x35 + machine.cpu.x] = 0x23; // Load next byte for indirect addressing
    machine.memory[0x2362] = 0x8a; // Load next byte for indirect addressing

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x8a); // A should be loaded with 0x8a
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002); // PC should be incremented by 2

    expect(machine.cpu.tacts).toBe(6); // 6 tacts for LDA (zp,X)
  });

  // LDA (zp,X): 0xa1
  it("LDA (zp,X) works with page boundary #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xa1, 0x80], 0x10ff, 0x10ff);
    machine.cpu.x = 0x01; // Set X to 1
    machine.memory[0x80 + machine.cpu.x] = 0x80; // Load memory at address 0x80 + X with 0x80
    machine.memory[0x81 + machine.cpu.x] = 0x10; // Load next byte for indirect addressing
    machine.memory[0x1080] = 0x80; // Load next byte for indirect addressing

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80); // A should be loaded with 0x80
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1101); // PC should be incremented by 2

    expect(machine.cpu.tacts).toBe(6); // 6 tacts for LDA (zp,X)
  });

  // LDA (zp,X): 0xa1
  it("LDA (zp,X) works with page boundary #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xa1, 0x7f], 0x10fe, 0x10fe);
    machine.cpu.x = 0x80; // Set X to 80
    machine.memory[0x7f + machine.cpu.x] = 0x7f; // Load memory at address 0x7f + X with 0x7f
    machine.memory[0x80 + machine.cpu.x] = 0x10; // Load next byte for indirect addressing
    machine.memory[0x107f] = 0x7f; // Load next byte for indirect addressing

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x7f); // A should be loaded with 0x7f
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1100); // PC should be incremented by 2

    expect(machine.cpu.tacts).toBe(6); // 6 tacts for LDA (zp,X)
  });

  // LDX #<N>: 0xa2
  it("LDX #<N> works #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xa2, 0x34], 0x1000, 0x1000);

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x34);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(2);
  });

  // LDX #<N>: 0xa2
  it("LDX #<N> works #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xa2, 0x00], 0x1000, 0x1000);

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x00);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(2);
  });

  // LDX #<N>: 0xa2
  it("LDX #<N> works #3", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xa2, 0x8a], 0x1000, 0x1000);

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x8a);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(2);
  });

  // LDX #<N>: 0xa2
  it("LDX #<N> works with page boundary #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    // Load X with 0x80, which is on the page boundary
    machine.initCode([0xa2, 0x80], 0x10ff, 0x10ff);

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x80);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1101);

    expect(machine.cpu.tacts).toBe(2);
  });

  // LDX #<N>: 0xa2
  it("LDX #<N> works with page boundary #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    // Load X with 0x7f, which is on the page boundary
    machine.initCode([0xa2, 0x7f], 0x10fe, 0x10fe);

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x7f);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1100);

    expect(machine.cpu.tacts).toBe(2);
  });

  // LDY <zp>: 0xa4
  it("LDY <zp> works #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xa4, 0x34], 0x1000, 0x1000);
    machine.memory[0x34] = 0x62;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x62);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(3);
  });

  // LDY <zp>: 0xa4
  it("LDY <zp> works #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xa4, 0x34], 0x1000, 0x1000);
    machine.memory[0x34] = 0x00;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x00);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(3);
  });

  // LDY <zp>: 0xa4
  it("LDY <zp> works #3", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xa4, 0x34], 0x1000, 0x1000);
    machine.memory[0x34] = 0x8a;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x8a);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(3);
  });

  // LDY <zp>: 0xa4
  it("LDY <zp> works with page boundary #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xa4, 0x80], 0x10ff, 0x10ff);
    machine.memory[0x80] = 0x80;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x80);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1101);

    expect(machine.cpu.tacts).toBe(3);
  });

  // LDY <zp>: 0xa4
  it("LDY <zp> works with page boundary #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xa4, 0x7f], 0x10fe, 0x10fe);
    machine.memory[0x7f] = 0x7f;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x7f);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1100);

    expect(machine.cpu.tacts).toBe(3);
  });

  // LDA <zp>: 0xa5
  it("LDA <zp> works #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xa5, 0x34], 0x1000, 0x1000);
    machine.memory[0x34] = 0x62;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x62);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(3);
  });

  // LDA <zp>: 0xa5
  it("LDA <zp> works #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xa5, 0x34], 0x1000, 0x1000);
    machine.memory[0x34] = 0x00;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(3);
  });

  // LDA <zp>: 0xa5
  it("LDA <zp> works #3", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xa5, 0x34], 0x1000, 0x1000);
    machine.memory[0x34] = 0x8a;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x8a);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(3);
  });

  // LDA <zp>: 0xa5
  it("LDA <zp> works with page boundary #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xa5, 0x80], 0x10ff, 0x10ff);
    machine.memory[0x80] = 0x80;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1101);

    expect(machine.cpu.tacts).toBe(3);
  });

  // LDA <zp>: 0xa5
  it("LDA <zp> works with page boundary #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xa5, 0x7f], 0x10fe, 0x10fe);
    machine.memory[0x7f] = 0x7f;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x7f);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1100);

    expect(machine.cpu.tacts).toBe(3);
  });

  // LDX <zp>: 0xa6
  it("LDX <zp> works #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xa6, 0x34], 0x1000, 0x1000);
    machine.memory[0x34] = 0x62;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x62);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(3);
  });

  // LDX <zp>: 0xa6
  it("LDX <zp> works #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xa6, 0x34], 0x1000, 0x1000);
    machine.memory[0x34] = 0x00;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x00);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(3);
  });

  // LDX <zp>: 0xa6,
  it("LDX <zp> works #3", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xa6, 0x34], 0x1000, 0x1000);
    machine.memory[0x34] = 0x8a;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x8a);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(3);
  });

  // LDX <zp>: 0xa6
  it("LDX <zp> works with page boundary #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xa6, 0x80], 0x10ff, 0x10ff);
    machine.memory[0x80] = 0x80;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x80);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1101);

    expect(machine.cpu.tacts).toBe(3);
  });

  // LDX <zp>: 0xa6
  it("LDX <zp> works with page boundary #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xa6, 0x7f], 0x10fe, 0x10fe);
    machine.memory[0x7f] = 0x7f;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x7f);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1100);

    expect(machine.cpu.tacts).toBe(3);
  });

  // LDA #<N>: 0xa9
  it("LDA #<N> works #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xa9, 0x34], 0x1000, 0x1000);

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x34);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(2);
  });

  // LDA #<N>: 0xa9
  it("LDA #<N> works #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xa9, 0x00], 0x1000, 0x1000);

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(2);
  });

  // LDA #<N>: 0xa9
  it("LDA #<N> works #3", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xa9, 0x00], 0x1000, 0x1000);

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(2);
  });

  // LDA #<N>: 0xa9
  it("LDA #<N> works #3", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xa9, 0x00], 0x1000, 0x1000);

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(2);
  });

  // LDA #<N>: 0xa9
  it("LDA #<N> works #4", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xa9, 0x8a], 0x1000, 0x1000);

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x8a);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(2);
  });

  // LDA #<N>: 0xa9
  it("LDA #<N> works with page boundary #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    // Load A with 0x80, which is on the page boundary
    machine.initCode([0xa9, 0x80], 0x10ff, 0x10ff);

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1101);

    expect(machine.cpu.tacts).toBe(2);
  });

  // LDA #<N>: 0xa9
  it("LDA #<N> works with page boundary #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    // Load A with 0x7f, which is on the page boundary
    machine.initCode([0xa9, 0x7f], 0x10fe, 0x10fe);

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x7f);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1100);

    expect(machine.cpu.tacts).toBe(2);
  });

  // LDY <abs>: 0xac
  it("LDY <abs> works #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xac, 0x34, 0x12], 0x1000, 0x1000);
    machine.memory[0x1234] = 0x62;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x62);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDY <abs>: 0xac
  it("LDY <abs> works #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xac, 0x34, 0x12], 0x1000, 0x1000);
    machine.memory[0x1234] = 0x00;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x00);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDY <abs>: 0xac
  it("LDY <abs> works #3", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xac, 0x34, 0x12], 0x1000, 0x1000);
    machine.memory[0x1234] = 0x8a;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x8a);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1003);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDY <abs>: 0xac
  it("LDY <abs> works with page boundary #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xac, 0x80, 0x10], 0x10ff, 0x10ff);
    machine.memory[0x1080] = 0x80;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x80);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1102);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDY <abs>: 0xac
  it("LDY <abs> works with page boundary #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xac, 0x7f, 0x10], 0x10fe, 0x10fe);
    machine.memory[0x107f] = 0x7f;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x7f);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1101);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDA <abs>: 0xad
  it("LDA <abs> works #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xad, 0x34, 0x12], 0x1000, 0x1000);
    machine.memory[0x1234] = 0x62;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x62);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDA <abs>: 0xad
  it("LDA <abs> works #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xad, 0x34, 0x12], 0x1000, 0x1000);
    machine.memory[0x1234] = 0x00;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDA <abs>: 0xad
  it("LDA <abs> works #3", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xad, 0x34, 0x12], 0x1000, 0x1000);
    machine.memory[0x1234] = 0x8a;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x8a);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1003);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDA <abs>: 0xad
  it("LDA <abs> works with page boundary #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xad, 0x80, 0x10], 0x10ff, 0x10ff);
    machine.memory[0x1080] = 0x80;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1102);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDA <abs>: 0xad
  it("LDA <abs> works with page boundary #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xad, 0x7f, 0x10], 0x10fe, 0x10fe);
    machine.memory[0x107f] = 0x7f;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x7f);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1101);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDX <abs>: 0xae
  it("LDX <abs> works #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xae, 0x34, 0x12], 0x1000, 0x1000);
    machine.memory[0x1234] = 0x62;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x62);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDX <abs>: 0xae
  it("LDX <abs> works #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xae, 0x34, 0x12], 0x1000, 0x1000);
    machine.memory[0x1234] = 0x00;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x00);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDX <abs>: 0xae
  it("LDX <abs> works #3", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xae, 0x34, 0x12], 0x1000, 0x1000);
    machine.memory[0x1234] = 0x8a;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x8a);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1003);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDX <abs>: 0xae
  it("LDX <abs> works with page boundary #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xae, 0x80, 0x10], 0x10ff, 0x10ff);
    machine.memory[0x1080] = 0x80;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x80);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1102);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDX <abs>: 0xae
  it("LDX <abs> works with page boundary #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xae, 0x7f, 0x10], 0x10fe, 0x10fe);
    machine.memory[0x107f] = 0x7f;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x7f);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1101);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDA (zp),Y: 0xb1
  it("LDA (zp),Y works #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb1, 0x34], 0x1000, 0x1000);
    machine.cpu.y = 0x05; // Set Y to 5
    machine.memory[0x34] = 0x62; // Load memory at address 0x34 with 0x62
    machine.memory[0x35] = 0x23; // Load next byte for indirect addressing
    machine.memory[0x2362 + machine.cpu.y] = 0x12; // Load next byte for indirect addressing

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x12);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(5);
  });

  // LDA (zp),Y: 0xb1
  it("LDA (zp),Y works #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb1, 0x34], 0x1000, 0x1000);
    machine.cpu.y = 0x05; // Set Y to 5
    machine.memory[0x34] = 0x62; // Load memory at address 0x34 with 0x62
    machine.memory[0x35] = 0x23; // Load next byte for indirect addressing
    machine.memory[0x2362 + machine.cpu.y] = 0x00; // Load next byte for indirect addressing

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(5);
  });

  // LDA (zp),Y: 0xb1
  it("LDA (zp),Y works #3", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb1, 0x34], 0x1000, 0x1000);
    machine.cpu.y = 0x05; // Set Y to 5
    machine.memory[0x34] = 0x62; // Load memory at address 0x34 with 0x62
    machine.memory[0x35] = 0x23; // Load next byte for indirect addressing
    machine.memory[0x2362 + machine.cpu.y] = 0x8a; // Load next byte for indirect addressing

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x8a);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(5);
  });

  // LDA (zp),Y: 0xb1
  it("LDA (zp),Y works with page boundary #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xb1, 0x80], 0x1000, 0x1000);
    machine.cpu.y = 0x01; // Set Y to 1
    machine.memory[0x80] = 0x80; // Load memory at address 0x80 with 0x80
    machine.memory[0x81] = 0x10; // Load next byte for indirect addressing
    machine.memory[0x1080 + machine.cpu.y] = 0x80; // Load next byte for indirect addressing

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(5);
  });

  // LDA (zp),Y: 0xb1
  it("LDA (zp),Y works with page boundary #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb1, 0x7f], 0x1000, 0x1000);
    machine.cpu.y = 0x88; // Set Y to 80
    machine.memory[0x7f] = 0x7f; // Load memory at address 0x7f with 0x7f
    machine.memory[0x80] = 0x10; // Load next byte for indirect addressing
    machine.memory[0x107f + machine.cpu.y] = 0x7f; // Load next byte

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x7f);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(6);
  });

  // LDY <zp>,X: 0xb4
  it("LDY <zp>,X works #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb4, 0x34], 0x1000, 0x1000);
    machine.cpu.x = 0x01; // Set X to 1
    machine.memory[0x35] = 0x62; // Load memory at address 0x35 with 0x62

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x62);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDY <zp>,X: 0xb4
  it("LDY <zp>,X works #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb4, 0x34], 0x1000, 0x1000);
    machine.cpu.x = 0x01; // Set X to 1
    machine.memory[0x35] = 0x00; // Load memory at address 0x35 with 0x00

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x00);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDY <zp>,X: 0xb4
  it("LDY <zp>,X works #3", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb4, 0x34], 0x1000, 0x1000);
    machine.cpu.x = 0x01; // Set X to 1
    machine.memory[0x35] = 0x8a; // Load memory at address 0x35 with 0x8a

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x8a);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDY <zp>,X: 0xb4
  it("LDY <zp>,X works ZP,X with page boundary #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb4, 0x34], 0x10ff, 0x10ff);
    machine.cpu.x = 0x01; // Set X to 1
    machine.memory[0x35] = 0x8a; // Load memory at address 0x35 with 0x8a

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x8a);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1101);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDY <zp>,X: 0xb4
  it("LDY <zp>,X works with page boundary #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb4, 0x34], 0x10fe, 0x10fe);
    machine.cpu.x = 0x01; // Set X to 1
    machine.memory[0x35] = 0x8a; // Load memory at address 0x35 with 0x8a

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x8a);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1100);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDA <zp>,X: 0xb5
  it("LDA <zp>,X works #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb5, 0x34], 0x1000, 0x1000);
    machine.cpu.x = 0x01; // Set X to 1
    machine.memory[0x35] = 0x62; // Load memory at address 0x35 with 0x62

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x62);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDA <zp>,X: 0xb5
  it("LDA <zp>,X works #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb5, 0x34], 0x1000, 0x1000);
    machine.cpu.x = 0x01; // Set X to 1
    machine.memory[0x35] = 0x00; // Load memory at address 0x35 with 0x00

    // --- Act
    machine.run();
    // --- Assert
    expect(machine.cpu.a).toBe(0x00);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDA <zp>,X: 0xb5
  it("LDA <zp>,X works #3", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb5, 0x34], 0x1000, 0x1000);
    machine.cpu.x = 0x01; // Set X to 1
    machine.memory[0x35] = 0x8a; // Load memory at address 0x35 with 0x8a

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x8a);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDA <zp>,X: 0xb5
  it("LDA <zp>,X works with page boundary #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb5, 0x80], 0x10ff, 0x10ff);
    machine.cpu.x = 0x01; // Set X to 1
    machine.memory[0x81] = 0x80; // Load memory at address 0x81 with 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1101);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDA <zp>,X: 0xb5
  it("LDA <zp>,X works with page boundary #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb5, 0x7f], 0x10fe, 0x10fe);
    machine.cpu.x = 0x88; // Set X to 88
    machine.memory[0x7f + 0x88] = 0x7f; // Load memory at address 0x7f + 0x88  with 0x7f

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x7f);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1100);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDX <zp>,Y: 0xb6
  it("LDX <zp>,Y works #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb6, 0x34], 0x1000, 0x1000);
    machine.cpu.y = 0x01; // Set Y to 1
    machine.memory[0x35] = 0x62; // Load memory at address 0x35 with 0x62

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x62);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDX <zp>,Y: 0xb6
  it("LDX <zp>,Y works #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb6, 0x34], 0x1000, 0x1000);
    machine.cpu.y = 0x01; // Set Y to 1
    machine.memory[0x35] = 0x00; // Load memory at address 0x35 with 0x00

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x00);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDX <zp>,Y: 0xb6, ZP,Y
  it("LDX <zp>,Y works #3", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb6, 0x34], 0x1000, 0x1000);
    machine.cpu.y = 0x01; // Set Y to 1
    machine.memory[0x35] = 0x8a; // Load memory at address 0x35 with 0x8a

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x8a);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDX <zp>,Y: 0xb6
  it("LDX <zp>,Y works with page boundary #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb6, 0x34], 0x10ff, 0x10ff);
    machine.cpu.y = 0x01; // Set Y to 1
    machine.memory[0x35] = 0x8a; // Load memory at address 0x35 with 0x8a

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x8a);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1101);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDX <zp>,Y: 0xb6
  it("LDX <zp>,Y works with page boundary #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb6, 0x34], 0x10fe, 0x10fe);
    machine.cpu.y = 0x01; // Set Y to 1
    machine.memory[0x35] = 0x8a; // Load memory at address 0x35 with 0x8a

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x8a);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1100);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDA <abs>,Y: 0xb9
  it("LDA <abs>,Y works #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xb9, 0x34, 0x12], 0x1000, 0x1000);
    machine.cpu.y = 0x01; // Set Y to 1
    machine.memory[0x1235] = 0x62;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x62);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDA <abs>,Y: 0xb9
  it("LDA <abs>,Y works #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xb9, 0x34, 0x12], 0x1000, 0x1000);
    machine.cpu.y = 0x01; // Set Y to 1
    machine.memory[0x1235] = 0x00;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDA <abs>,Y: 0xb9
  it("LDA <abs>,Y works #3", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb9, 0x34, 0x12], 0x1000, 0x1000);
    machine.cpu.y = 0x01; // Set Y to 1
    machine.memory[0x1235] = 0x8a;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x8a);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1003);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDA <abs>,Y: 0xb9
  it("LDA <abs>,Y works with page boundary #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb9, 0x80, 0x10], 0x10ff, 0x10ff);
    machine.cpu.y = 0x01; // Set Y to 1
    machine.memory[0x1081] = 0x80; // Load memory at address 0x1081 with 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1102);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDA <abs>,Y: 0xb9
  it("LDA <abs>,Y works with page boundary #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb9, 0x88, 0x10], 0x10fe, 0x10fe);
    machine.cpu.y = 0x80; // Set Y to 80
    machine.memory[0x1088 + 0x80] = 0x80; // Load memory at address 0x1088 + 0x80 with 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1101);

    expect(machine.cpu.tacts).toBe(5);
  });

  // LDY <abs>,X: 0xbc
  it("LDY <abs>,X works #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xbc, 0x34, 0x12], 0x1000, 0x1000);
    machine.cpu.x = 0x01; // Set X to 1
    machine.memory[0x1235] = 0x62;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x62);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDY <abs>,X: 0xbc
  it("LDY <abs>,X works #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xbc, 0x34, 0x12], 0x1000, 0x1000);
    machine.cpu.x = 0x01; // Set X to 1
    machine.memory[0x1235] = 0x00;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x00);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDY <abs>,X: 0xbc
  it("LDY <abs>,X works #3", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xbc, 0x34, 0x12], 0x1000, 0x1000);
    machine.cpu.x = 0x01; // Set X to 1
    machine.memory[0x1235] = 0x8a;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x8a);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1003);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDY <abs>,X: 0xbc
  it("LDY <abs>,X works with page boundary #1", () => {
    // --- Arrange
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xbc, 0x80, 0x10], 0x10ff, 0x10ff);
    machine.cpu.x = 0x01; // Set Y to 1
    machine.memory[0x1081] = 0x80; // Load memory at address 0x1081 with 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x80);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1102);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDY <abs>,X: 0xbc
  it("LDY <abs>,X works with page boundary #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xbc, 0x88, 0x10], 0x10fe, 0x10fe);
    machine.cpu.x = 0x80; // Set Y to 80
    machine.memory[0x1088 + 0x80] = 0x80; // Load memory at address 0x1088 + 0x80 with 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.y).toBe(0x80);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1101);

    expect(machine.cpu.tacts).toBe(5);
  });

  // LDA <N>,X: 0xbd
  it("LDA <N> works ABS,X #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xbd, 0x34, 0x12], 0x1000, 0x1000);
    machine.cpu.x = 0x01; // Set X to 1
    machine.memory[0x1235] = 0x62;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x62);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDA <N>,X 0xbd, ABS
  it("LDA <N> works ABS,X #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xbd, 0x34, 0x12], 0x1000, 0x1000);
    machine.cpu.x = 0x01; // Set X to 1
    machine.memory[0x1235] = 0x00;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x00);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDA <N>,X 0xbd, ABS,X
  it("LDA <N> works ABS,X #3", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xbd, 0x34, 0x12], 0x1000, 0x1000);
    machine.cpu.x = 0x01; // Set X to 1
    machine.memory[0x1235] = 0x8a;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x8a);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1003);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDA <N>,X 0xbd, ABS
  it("LDA <N> works ABS,X with page boundary #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xbd, 0x80, 0x10], 0x10ff, 0x10ff);
    machine.cpu.x = 0x01; // Set X to 1
    machine.memory[0x1081] = 0x80;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1102);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDA <N>,X 0xbd, ABS
  it("LDA <N> works ABS,X with page boundary #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xbd, 0x88, 0x10], 0x10ff, 0x10ff);
    machine.cpu.x = 0x80; // Set X to 80
    machine.memory[0x1088 + 0x80] = 0x80;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x80);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1102);

    expect(machine.cpu.tacts).toBe(5);
  });

  // LDX <N>,Y 0xbe, ABS
  it("LDX <N> works ABS,Y #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xbe, 0x34, 0x12], 0x1000, 0x1000);
    machine.cpu.y = 0x01; // Set Y to 1
    machine.memory[0x1235] = 0x62;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x62);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDX <N>,Y 0xbe, ABS
  it("LDX <N> works ABS,Y #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0xbe, 0x34, 0x12], 0x1000, 0x1000);
    machine.cpu.y = 0x01; // Set Y to 1
    machine.memory[0x1235] = 0x00;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x00);
    expect(machine.cpu.isZFlagSet()).toBe(true);
    expect(machine.cpu.isNFlagSet()).toBe(false);
    expect(machine.cpu.pc).toBe(0x1003);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDX <N>,Y 0xbe, ABS
  it("LDX <N> works ABS,Y #3", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xbe, 0x34, 0x12], 0x1000, 0x1000);
    machine.cpu.y = 0x01; // Set Y to 1
    machine.memory[0x1235] = 0x8a;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x8a);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1003);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDX <N>,Y 0xbe, ABS,Y
  it("LDX <N>,Y works ABS,Y with page boundary #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xbe, 0x80, 0x10], 0x10ff, 0x10ff);
    machine.cpu.y = 0x01; // Set Y to 1
    machine.memory[0x1081] = 0x80; // Load memory at address 0x1081 with 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x80);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1102);

    expect(machine.cpu.tacts).toBe(4);
  });

  // LDX <N>,Y 0xbe, ABS
  it("LDX <N>,Y works ABS,Y with page boundary #2", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xbe, 0x88, 0x10], 0x10fe, 0x10fe);
    machine.cpu.y = 0x80; // Set Y to 80
    machine.memory[0x1088 + 0x80] = 0x80; // Load memory at address 0x1088 + 0x80 with 0x80

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.x).toBe(0x80);
    expect(machine.cpu.isZFlagSet()).toBe(false);
    expect(machine.cpu.isNFlagSet()).toBe(true);
    expect(machine.cpu.pc).toBe(0x1101);

    expect(machine.cpu.tacts).toBe(5);
  });
});
