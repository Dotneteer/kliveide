import { describe, expect, it } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";

describe("M6510 Memory Instructions", () => {
  // LDA <N>, 0xa5, ZP
  it("LDA <N> works #1", () => {
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

  // LDA <N>, 0xa5, ZP
  it("LDA <N> works #2", () => {
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

  // LDA <N>, 0xa5, ZP
  it("LDA <N> works #3", () => {
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

  // LDA <N>, 0xa5, ZP
  it("LDA <N> works with page boundary #1", () => {
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

  // LDA <N>, 0xa5, ZP
  it("LDA <N> works with page boundary #2", () => {
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

  // LDA #<N>, 0xa9
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

  // LDA #<N>, 0xa9
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

  // LDA #<N>, 0xa9
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

  // LDA <N>, 0xad, ABS
  it("LDA <N> works ABS #1", () => {
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

  // LDA <N>, 0xad, ABS
  it("LDA <N> works ABS #2", () => {
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

  // LDA <N>, 0xad, ABS
  it("LDA <N> works ABS #3", () => {
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

  // LDA <N>, 0xad, ABS
  it("LDA <N> works ABS with page boundary #1", () => {
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

  // LDA <N>, 0xad, ABS
  it("LDA <N> works ABS with page boundary #2", () => {
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

  // LDA <N>, 0xb9, ABS,Y
  it("LDA <N> works ABS,Y #1", () => {
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

  // LDA <N>, 0xb9, ABS,Y
  it("LDA <N> works ABS,Y #2", () => {
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

  // LDA <N>, 0xb9, ABS,Y
  it("LDA <N> works ABS,Y #3", () => {
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

  // LDA <N>, 0xb9, ABS,Y
  it("LDA <N> works ABS,Y with page boundary #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb9, 0x80, 0x10], 0x10ff, 0x10ff);
    machine.cpu.y = 0x01; // Set Y to 1
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

  // LDA <N>, 0xb9, ABS,Y
  it("LDA <N> works ABS,Y with page boundary #1", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0xb9, 0x88, 0x10], 0x10ff, 0x10ff);
    machine.cpu.y = 0x80; // Set Y to 80
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

  // LDA <N>, 0xbd, ABS,X
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

  // LDA <N>, 0xbd, ABS,X
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

  // LDA <N>, 0xbd, ABS,X
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

  // LDA <N>, 0xbd, ABS,X
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

  // LDA <N>, 0xbd, ABS,X
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
});
