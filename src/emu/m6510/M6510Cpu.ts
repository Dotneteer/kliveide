import type { IM6510Cpu } from "../abstractions/IM6510Cpu";
import { FlagSetMask6510 } from "../abstractions/FlagSetMask6510";

/**
 * The function represents a 6510 operation
 */
export type M6510Operation = (cpu: M6510Cpu) => void;

/**
 * This class implements the emulation of the MOS 6510 CPU
 */
export class M6510Cpu implements IM6510Cpu {
  // --- Direct register variables
  private _a: number = 0;
  private _x: number = 0;
  private _y: number = 0;
  private _p: number = 0;
  private _pc: number = 0;
  private _sp: number = 0;

  // --- CPU execution properties
  private _tactsInFrame: number;
  private _tactsInDisplayLine: number;
  private _nmiRequested: boolean;
  private _irqRequested: boolean;
  private _stalled: number;

  /**
   * The stack pointer (alias for S register)
   */
  get sp(): number {
    return this._sp;
  }
  set sp(value: number) {
    this._sp = value & 0xffff;
  }

  baseClockFrequency: number;
  currentFrameTact: number;
  opCode: number;
  stepOutStack: number[];
  stepOutAddress: number;

  markStepOutAddress(): void {
    throw new Error("Method not implemented.");
  }

  totalContentionDelaySinceStart: number;
  contentionDelaySincePause: number;
  opStartAddress: number;
  lastMemoryReads: number[] = [];
  lastMemoryReadValue: number;
  lastMemoryWrites: number[] = [];
  lastMemoryWriteValue: number;
  lastIoReadPort: number;
  lastIoReadValue: number;
  lastIoWritePort: number;
  lastIoWriteValue: number;

  /**
   * Sets the CPU into the stalled state.
   */
  stallCpu(): void {
    this._stalled = 1;
  }

  /**
   * Resumes the CPU from the stalled state.
   */
  releaseCpu(): void {
    this._stalled = 0;
  }

  /**
   * Waits while the CPU gets released from the stalled state.
   */
  waitForCpuRelease(): void {
    while (this._stalled) {
      // --- Wait until the CPU is released
      this.incrementTacts(); // Increment tacts to avoid infinite loop
      this._stalled++;
      if (this._stalled > 1000) {
        console.warn("CPU stalled for too long, releasing...");
        this.releaseCpu();
      }
    }
  }

  /**
   * Call this method to execute a CPU instruction cycle.
   */
  executeCpuCycle(): void {
    if (this._nmiRequested) {
      this.handleNmi();
      this._nmiRequested = false;
    } else if (this._irqRequested && !this.isIFlagSet()) {
      this.handleIrq();
      this._irqRequested = false;
    } else {
      // --- Handle regular CPU cycle
      const opCode = this.readMemory(this._pc);
      this.operationTable[opCode](this);
    }
  }

  private handleNmi() {
    // TODO: Implement NMI handling
  }

  private handleIrq() {
    // TODO: Implement IRQ handling
  }

  /**
   * Execute this method before fetching the opcode of the next instruction
   */
  beforeOpcodeFetch(): void {
    // --- The base 6510 CPU does not have any specific actions before opcode fetch
  }

  /**
   * Execute this method after fetching the opcode of the next instruction
   */
  afterOpcodeFetch(): void {
    // --- The base 6510 CPU does not have any specific actions after opcode fetch
  }

  /**
   * Reads the specified memory address.
   * @param address Memory address to read
   * @returns The byte the CPU has read from the memory
   * If the emulated hardware uses any delay when reading the memory, increment the CPU tacts accordingly.
   */
  readMemory(address: number): number {
    this.delayMemoryRead(address);
    this.lastMemoryReads.push(address);
    return (this.lastMemoryReadValue = this.doReadMemory(address));
  }

  /**
   * Read the byte at the specified memory address.
   * @param _address 16-bit memory address
   * @return The byte read from the memory
   * Note: the default implementation always returns 0xff
   */
  doReadMemory(_address: number): number {
    return 0xff;
  }

  /**
   * This function implements the memory read delay of the CPU.
   */
  delayMemoryRead(_: number): void {
    this.waitForCpuRelease();
  }

  /**
   * Writes a byte to the specfied memory address.
   * @param address Memory address
   * @param data Data byte to write
   * If the emulated hardware uses any delay when writing the memory, increment the CPU tacts accordingly.
   */
  writeMemory(address: number, data: number): void {
    this.delayMemoryWrite(address);
    this.lastMemoryWrites.push(address);
    this.lastMemoryWriteValue = data;
    this.doWriteMemory(address, data);
  }

  /**
   * Write the given byte to the specified memory address.
   * @param _address 16-bit memory address
   * @param _value Byte to write into the memory
   * Note: the default implementation does not write the memory
   */
  doWriteMemory(_address: number, _value: number): void {
    this.waitForCpuRelease();
  }

  /**
   * This function implements the memory write delay of the CPU.
   * @param _address Memory address to write
   */
  delayMemoryWrite(_address: number): void {}

  delayAddressBusAccess(_address: number): void {
    throw new Error("Method not implemented.");
  }

  doReadPort(_address: number): number {
    return 0xff;
  }

  delayPortRead(_address: number): void {}

  doWritePort(_address: number, _value: number): void {}
  delayPortWrite(_address: number): void {}

  onTactIncremented(): void {
    // --- Implement this method in derived classes to handle CPU timing
  }

  isCpuSnoozed(): boolean {
    return false;
  }

  awakeCpu(): void {}

  snoozeCpu(): void {}
  onSnooze(): void {}

  /**
   * The clock multiplier of the CPU
   */
  clockMultiplier: number = 1;

  /**
   * The number of T-states (clock cycles) elapsed since the last reset
   */
  tacts: number = 0;

  /**
   * Show the number of machine frames completed since the CPU started.
   */
  frames: number = 0;

  /**
   * The number of T-states within the current frame
   */
  frameTacts: number = 0;

  /**
   * The number of T-states in a current frame taking clock multiplier into account
   */
  tactsInCurrentFrame: number = 0;

  /**
   * The T-states (clock cycles) when the CPU execution was started last time
   */
  tactsAtLastStart: number = 0;

  // ----------------------------------------------------------------------------------------------------------------
  // Register access

  /**
   * The A register (accumulator)
   */
  get a(): number {
    return this._a;
  }
  set a(value: number) {
    this._a = value & 0xff;
  }

  /**
   * The X register (index register)
   */
  get x(): number {
    return this._x;
  }
  set x(value: number) {
    this._x = value & 0xff;
  }

  /**
   * The Y register (index register)
   */
  get y(): number {
    return this._y;
  }
  set y(value: number) {
    this._y = value & 0xff;
  }

  /**
   * The P register (processor status register)
   * Bit 7: N - Negative flag
   * Bit 6: V - Overflow flag
   * Bit 5: - (always 1)
   * Bit 4: B - Break flag
   * Bit 3: D - Decimal mode flag
   * Bit 2: I - Interrupt disable flag
   * Bit 1: Z - Zero flag
   * Bit 0: C - Carry flag
   */
  get p(): number {
    return this._p | FlagSetMask6510.UNUSED; // Bit 5 is always set
  }
  set p(value: number) {
    this._p = (value & 0xff) | FlagSetMask6510.UNUSED; // Ensure bit 5 is always set
  }

  /**
   * The Program Counter register
   */
  get pc(): number {
    return this._pc;
  }
  set pc(value: number) {
    this._pc = value & 0xffff;
  }

  /**
   * Tests if the Negative flag is set
   */
  isNFlagSet(): boolean {
    return (this._p & FlagSetMask6510.N) !== 0;
  }

  /**
   * Tests if the Overflow flag is set
   */
  isVFlagSet(): boolean {
    return (this._p & FlagSetMask6510.V) !== 0;
  }

  /**
   * Tests if the Break flag is set
   */
  isBFlagSet(): boolean {
    return (this._p & FlagSetMask6510.B) !== 0;
  }

  /**
   * Tests if the Decimal mode flag is set
   */
  isDFlagSet(): boolean {
    return (this._p & FlagSetMask6510.D) !== 0;
  }

  /**
   * Tests if the Interrupt disable flag is set
   */
  isIFlagSet(): boolean {
    return (this._p & FlagSetMask6510.I) !== 0;
  }

  /**
   * Tests if the Zero flag is set
   */
  isZFlagSet(): boolean {
    return (this._p & FlagSetMask6510.Z) !== 0;
  }

  /**
   * Tests if the Carry flag is set
   */
  isCFlagSet(): boolean {
    return (this._p & FlagSetMask6510.C) !== 0;
  }

  /**
   * Get the number of T-states in a machine frame.
   */
  get tactsInFrame(): number {
    return this._tactsInFrame;
  }
  set tactsInFrame(value: number) {
    this._tactsInFrame = value;
  }

  /**
   * Sets the number of tacts within a single machine frame
   * @param tacts Tacts to set
   */
  setTactsInFrame(tacts: number): void {
    this._tactsInFrame = tacts;
    this.tactsInCurrentFrame = tacts * this.clockMultiplier;
  }

  /**
   * Get the number of T-states in a display line (use -1, if this info is not available)
   */
  get tactsInDisplayLine(): number {
    return this._tactsInDisplayLine;
  }

  set tactsInDisplayLine(value: number) {
    this._tactsInDisplayLine = value;
  }

  /**
   * Executes a hard reset as if the machine and the CPU had just been turned on.
   */
  hardReset(): void {
    this.reset();
  }

  /**
   * Handles the active RESET signal of the CPU.
   */
  reset(): void {
    this._nmiRequested = false;
    this._irqRequested = false;

    // Reset CPU registers (similar to hard reset but may preserve some values)
    this._a = 0;
    this._x = 0;
    this._y = 0;
    this._sp = 0xfd;
    this._p = 0x34;
    this._pc = this.doReadMemory(0xfffc) | (this.doReadMemory(0xfffd) << 8);

    // Reset clock multiplier
    this.clockMultiplier = 1; 

    // Reset stalled state
    this._stalled = 0;

    // Reset timing information
    this.tacts = 0;
    this.tactsAtLastStart = 0;
    this.frames = 0;
    this.frameTacts = 0;
    this.setTactsInFrame(1_000_000); // Default value, should be adjusted based on machine
  }

  /**
   * Operation lookup table for the 6510 CPU
   */
  readonly operationTable: M6510Operation[] = [
    brk, // 0x00
    oraIndX, // 0x01
    illegal, // 0x02
    illegal, // 0x03
    illegal, // 0x04
    oraZp, // 0x05
    aslZp, // 0x06
    illegal, // 0x07
    php, // 0x08
    oraImm, // 0x09
    aslA, // 0x0A
    illegal, // 0x0B
    illegal, // 0x0C
    oraAbs, // 0x0D
    aslAbs, // 0x0E
    illegal, // 0x0F
    bpl, // 0x10
    oraIndY, // 0x11
    illegal, // 0x12
    illegal, // 0x13
    illegal, // 0x14
    oraZpX, // 0x15
    aslZpX, // 0x16
    illegal, // 0x17
    clc, // 0x18
    oraAbsY, // 0x19
    illegal, // 0x1A
    illegal, // 0x1B
    illegal, // 0x1C
    oraAbsX, // 0x1D
    aslAbsX, // 0x1E
    illegal, // 0x1F
    jsr, // 0x20
    andIndX, // 0x21
    illegal, // 0x22
    illegal, // 0x23
    bitZp, // 0x24
    andZp, // 0x25
    rolZp, // 0x26
    illegal, // 0x27
    plp, // 0x28
    andImm, // 0x29
    rolA, // 0x2A
    illegal, // 0x2B
    bitAbs, // 0x2C
    andAbs, // 0x2D
    rolAbs, // 0x2E
    illegal, // 0x2F
    bmi, // 0x30
    andIndY, // 0x31
    illegal, // 0x32
    illegal, // 0x33
    illegal, // 0x34
    andZpX, // 0x35
    rolZpX, // 0x36
    illegal, // 0x37
    sec, // 0x38
    andAbsY, // 0x39
    illegal, // 0x3A
    illegal, // 0x3B
    illegal, // 0x3C
    andAbsX, // 0x3D
    rolAbsX, // 0x3E
    illegal, // 0x3F
    rti, // 0x40
    eorIndX, // 0x41
    illegal, // 0x42
    illegal, // 0x43
    illegal, // 0x44
    eorZp, // 0x45
    lsrZp, // 0x46
    illegal, // 0x47
    pha, // 0x48
    eorImm, // 0x49
    lsrA, // 0x4A
    illegal, // 0x4B
    jmp, // 0x4C
    eorAbs, // 0x4D
    lsrAbs, // 0x4E
    illegal, // 0x4F
    bvc, // 0x50
    eorIndY, // 0x51
    illegal, // 0x52
    illegal, // 0x53
    illegal, // 0x54
    eorZpX, // 0x55
    lsrZpX, // 0x56
    illegal, // 0x57
    cli, // 0x58
    eorAbsY, // 0x59
    illegal, // 0x5A
    illegal, // 0x5B
    illegal, // 0x5C
    eorAbsX, // 0x5D
    lsrAbsX, // 0x5E
    illegal, // 0x5F
    rts, // 0x60
    adcIndX, // 0x61
    illegal, // 0x62
    illegal, // 0x63
    illegal, // 0x64
    adcZp, // 0x65
    rorZp, // 0x66
    illegal, // 0x67
    pla, // 0x68
    adcImm, // 0x69
    rorA, // 0x6A
    illegal, // 0x6B
    jmpInd, // 0x6C
    adcAbs, // 0x6D
    rorAbs, // 0x6E
    illegal, // 0x6F
    bvs, // 0x70
    adcIndY, // 0x71
    illegal, // 0x72
    illegal, // 0x73
    illegal, // 0x74
    adcZpX, // 0x75
    rorZpX, // 0x76
    illegal, // 0x77
    sei, // 0x78
    adcAbsY, // 0x79
    illegal, // 0x7A
    illegal, // 0x7B
    illegal, // 0x7C
    adcAbsX, // 0x7D
    rorAbsX, // 0x7E
    illegal, // 0x7F
    illegal, // 0x80
    staIndX, // 0x81
    illegal, // 0x82
    illegal, // 0x83
    styZp, // 0x84
    staZp, // 0x85
    stxZp, // 0x86
    illegal, // 0x87
    dey, // 0x88
    illegal, // 0x89
    txa, // 0x8A
    illegal, // 0x8B
    styAbs, // 0x8C
    staAbs, // 0x8D
    stxAbs, // 0x8E
    illegal, // 0x8F
    bcc, // 0x90
    staIndY, // 0x91
    illegal, // 0x92
    illegal, // 0x93
    styZpX, // 0x94
    staZpX, // 0x95
    stxZpY, // 0x96
    illegal, // 0x97
    tya, // 0x98
    staAbsY, // 0x99
    txs, // 0x9A
    illegal, // 0x9B
    illegal, // 0x9C
    staAbsX, // 0x9D
    illegal, // 0x9E
    illegal, // 0x9F
    ldyImm, // 0xA0
    ldaIndX, // 0xA1
    ldxImm, // 0xA2
    illegal, // 0xA3
    ldyZp, // 0xA4
    ldaZp, // 0xA5
    ldxZp, // 0xA6
    illegal, // 0xA7
    tay, // 0xA8
    ldaImm, // 0xA9
    tax, // 0xAA
    illegal, // 0xAB
    ldyAbs, // 0xAC
    ldaAbs, // 0xAD
    ldxAbs, // 0xAE
    illegal, // 0xAF
    bcs, // 0xB0
    ldaIndY, // 0xB1
    illegal, // 0xB2
    illegal, // 0xB3
    ldyZpX, // 0xB4
    ldaZpX, // 0xB5
    ldxZpY, // 0xB6
    illegal, // 0xB7
    clv, // 0xB8
    ldaAbsY, // 0xB9
    tsx, // 0xBA
    illegal, // 0xBB
    ldyAbsX, // 0xBC
    ldaAbsX, // 0xBD
    ldxAbsY, // 0xBE
    illegal, // 0xBF
    cpyImm, // 0xC0
    cmpIndX, // 0xC1
    illegal, // 0xC2
    illegal, // 0xC3
    cpyZp, // 0xC4
    cmpZp, // 0xC5
    decZp, // 0xC6
    illegal, // 0xC7
    iny, // 0xC8
    cmpImm, // 0xC9
    dex, // 0xCA
    illegal, // 0xCB
    cpyAbs, // 0xCC
    cmpAbs, // 0xCD
    decAbs, // 0xCE
    illegal, // 0xCF
    bne, // 0xD0
    cmpIndY, // 0xD1
    illegal, // 0xD2
    illegal, // 0xD3
    illegal, // 0xD4
    cmpZpX, // 0xD5
    decZpX, // 0xD6
    illegal, // 0xD7
    cld, // 0xD8
    cmpAbsY, // 0xD9
    illegal, // 0xDA
    illegal, // 0xDB
    illegal, // 0xDC
    cmpAbsX, // 0xDD
    decAbsX, // 0xDE
    illegal, // 0xDF
    cpxImm, // 0xE0
    sbcIndX, // 0xE1
    illegal, // 0xE2
    illegal, // 0xE3
    cpxZp, // 0xE4
    sbcZp, // 0xE5
    incZp, // 0xE6
    illegal, // 0xE7
    inx, // 0xE8
    sbcImm, // 0xE9
    nop, // 0xEA
    illegal, // 0xEB
    cpxAbs, // 0xEC
    sbcAbs, // 0xED
    incAbs, // 0xEE
    illegal, // 0xEF
    beq, // 0xF0
    sbcIndY, // 0xF1
    illegal, // 0xF2
    illegal, // 0xF3
    illegal, // 0xF4
    sbcZpX, // 0xF5
    incZpX, // 0xF6
    illegal, // 0xF7
    sed, // 0xF8
    sbcAbsY, // 0xF9
    illegal, // 0xFA
    illegal, // 0xFB
    illegal, // 0xFC
    sbcAbsX, // 0xFD
    incAbsX, // 0xFE
    illegal // 0xFF
  ];

  /**
   * Increments the CPU tacts and updates the frame and current frame tact counters.
   * This method should be called every time a CPU tact is completed.
   */
  private incrementTacts(): void {
    this.tacts++;
    this.frameTacts++;
    if (this.frameTacts >= this.tactsInCurrentFrame) {
      this.frames++;
      this.frameTacts -= this.tactsInCurrentFrame;
    }
    this.currentFrameTact = Math.floor(this.frameTacts / this.clockMultiplier);
    this.onTactIncremented();
  }
}

// --------------------------------------------------------------------------------------------------------------------
// 6510 operation implementations

// 0x00: BRK - Force Break
function brk(_cpu: M6510Cpu): void {
  // TODO: Implement BRK operation
}

// 0x01: ORA (zp,X) - Logical OR with Accumulator (Indexed Indirect)
function oraIndX(_cpu: M6510Cpu): void {
  // TODO: Implement ORA (zp,X) operation
}

// 0x05: ORA zp - Logical OR with Accumulator (Zero Page)
function oraZp(_cpu: M6510Cpu): void {
  // TODO: Implement ORA zp operation
}

// 0x06: ASL zp - Arithmetic Shift Left (Zero Page)
function aslZp(_cpu: M6510Cpu): void {
  // TODO: Implement ASL zp operation
}

// 0x08: PHP - Push Processor Status
function php(_cpu: M6510Cpu): void {
  // TODO: Implement PHP operation
}

// 0x09: ORA # - Logical OR with Accumulator (Immediate)
function oraImm(_cpu: M6510Cpu): void {
  // TODO: Implement ORA # operation
}

// 0x0A: ASL A - Arithmetic Shift Left (Accumulator)
function aslA(_cpu: M6510Cpu): void {
  // TODO: Implement ASL A operation
}

// 0x0D: ORA abs - Logical OR with Accumulator (Absolute)
function oraAbs(_cpu: M6510Cpu): void {
  // TODO: Implement ORA abs operation
}

// 0x0E: ASL abs - Arithmetic Shift Left (Absolute)
function aslAbs(_cpu: M6510Cpu): void {
  // TODO: Implement ASL abs operation
}

// 0x10: BPL - Branch on Plus
function bpl(_cpu: M6510Cpu): void {
  // TODO: Implement BPL operation
}

// 0x11: ORA (zp),Y - Logical OR with Accumulator (Indirect Indexed)
function oraIndY(_cpu: M6510Cpu): void {
  // TODO: Implement ORA (zp),Y operation
}

// 0x15: ORA zp,X - Logical OR with Accumulator (Zero Page,X)
function oraZpX(_cpu: M6510Cpu): void {
  // TODO: Implement ORA zp,X operation
}

// 0x16: ASL zp,X - Arithmetic Shift Left (Zero Page,X)
function aslZpX(_cpu: M6510Cpu): void {
  // TODO: Implement ASL zp,X operation
}

// 0x18: CLC - Clear Carry Flag
function clc(_cpu: M6510Cpu): void {
  // TODO: Implement CLC operation
}

// 0x19: ORA abs,Y - Logical OR with Accumulator (Absolute,Y)
function oraAbsY(_cpu: M6510Cpu): void {
  // TODO: Implement ORA abs,Y operation
}

// 0x1D: ORA abs,X - Logical OR with Accumulator (Absolute,X)
function oraAbsX(_cpu: M6510Cpu): void {
  // TODO: Implement ORA abs,X operation
}

// 0x1E: ASL abs,X - Arithmetic Shift Left (Absolute,X)
function aslAbsX(_cpu: M6510Cpu): void {
  // TODO: Implement ASL abs,X operation
}

// 0x20: JSR - Jump to Subroutine
function jsr(_cpu: M6510Cpu): void {
  // TODO: Implement JSR operation
}

// 0x21: AND (zp,X) - Logical AND with Accumulator (Indexed Indirect)
function andIndX(_cpu: M6510Cpu): void {
  // TODO: Implement AND (zp,X) operation
}

// 0x24: BIT zp - Bit Test (Zero Page)
function bitZp(_cpu: M6510Cpu): void {
  // TODO: Implement BIT zp operation
}

// 0x25: AND zp - Logical AND with Accumulator (Zero Page)
function andZp(_cpu: M6510Cpu): void {
  // TODO: Implement AND zp operation
}

// 0x26: ROL zp - Rotate Left (Zero Page)
function rolZp(_cpu: M6510Cpu): void {
  // TODO: Implement ROL zp operation
}

// 0x28: PLP - Pull Processor Status
function plp(_cpu: M6510Cpu): void {
  // TODO: Implement PLP operation
}

// 0x29: AND # - Logical AND with Accumulator (Immediate)
function andImm(_cpu: M6510Cpu): void {
  // TODO: Implement AND # operation
}

// 0x2A: ROL A - Rotate Left (Accumulator)
function rolA(_cpu: M6510Cpu): void {
  // TODO: Implement ROL A operation
}

// 0x2C: BIT abs - Bit Test (Absolute)
function bitAbs(_cpu: M6510Cpu): void {
  // TODO: Implement BIT abs operation
}

// 0x2D: AND abs - Logical AND with Accumulator (Absolute)
function andAbs(_cpu: M6510Cpu): void {
  // TODO: Implement AND abs operation
}

// 0x2E: ROL abs - Rotate Left (Absolute)
function rolAbs(_cpu: M6510Cpu): void {
  // TODO: Implement ROL abs operation
}

// 0x30: BMI - Branch on Minus
function bmi(_cpu: M6510Cpu): void {
  // TODO: Implement BMI operation
}

// 0x31: AND (zp),Y - Logical AND with Accumulator (Indirect Indexed)
function andIndY(_cpu: M6510Cpu): void {
  // TODO: Implement AND (zp),Y operation
}

// 0x35: AND zp,X - Logical AND with Accumulator (Zero Page,X)
function andZpX(_cpu: M6510Cpu): void {
  // TODO: Implement AND zp,X operation
}

// 0x36: ROL zp,X - Rotate Left (Zero Page,X)
function rolZpX(_cpu: M6510Cpu): void {
  // TODO: Implement ROL zp,X operation
}

// 0x38: SEC - Set Carry Flag
function sec(_cpu: M6510Cpu): void {
  // TODO: Implement SEC operation
}

// 0x39: AND abs,Y - Logical AND with Accumulator (Absolute,Y)
function andAbsY(_cpu: M6510Cpu): void {
  // TODO: Implement AND abs,Y operation
}

// 0x3D: AND abs,X - Logical AND with Accumulator (Absolute,X)
function andAbsX(_cpu: M6510Cpu): void {
  // TODO: Implement AND abs,X operation
}

// 0x3E: ROL abs,X - Rotate Left (Absolute,X)
function rolAbsX(_cpu: M6510Cpu): void {
  // TODO: Implement ROL abs,X operation
}

// 0x40: RTI - Return from Interrupt
function rti(_cpu: M6510Cpu): void {
  // TODO: Implement RTI operation
}

// 0x41: EOR (zp,X) - Exclusive OR with Accumulator (Indexed Indirect)
function eorIndX(_cpu: M6510Cpu): void {
  // TODO: Implement EOR (zp,X) operation
}

// 0x45: EOR zp - Exclusive OR with Accumulator (Zero Page)
function eorZp(_cpu: M6510Cpu): void {
  // TODO: Implement EOR zp operation
}

// 0x46: LSR zp - Logical Shift Right (Zero Page)
function lsrZp(_cpu: M6510Cpu): void {
  // TODO: Implement LSR zp operation
}

// 0x48: PHA - Push Accumulator
function pha(_cpu: M6510Cpu): void {
  // TODO: Implement PHA operation
}

// 0x49: EOR # - Exclusive OR with Accumulator (Immediate)
function eorImm(_cpu: M6510Cpu): void {
  // TODO: Implement EOR # operation
}

// 0x4A: LSR A - Logical Shift Right (Accumulator)
function lsrA(_cpu: M6510Cpu): void {
  // TODO: Implement LSR A operation
}

// 0x4C: JMP - Jump
function jmp(_cpu: M6510Cpu): void {
  // TODO: Implement JMP operation
}

// 0x4D: EOR abs - Exclusive OR with Accumulator (Absolute)
function eorAbs(_cpu: M6510Cpu): void {
  // TODO: Implement EOR abs operation
}

// 0x4E: LSR abs - Logical Shift Right (Absolute)
function lsrAbs(_cpu: M6510Cpu): void {
  // TODO: Implement LSR abs operation
}

// 0x50: BVC - Branch on Overflow Clear
function bvc(_cpu: M6510Cpu): void {
  // TODO: Implement BVC operation
}

// 0x51: EOR (zp),Y - Exclusive OR with Accumulator (Indirect Indexed)
function eorIndY(_cpu: M6510Cpu): void {
  // TODO: Implement EOR (zp),Y operation
}

// 0x55: EOR zp,X - Exclusive OR with Accumulator (Zero Page,X)
function eorZpX(_cpu: M6510Cpu): void {
  // TODO: Implement EOR zp,X operation
}

// 0x56: LSR zp,X - Logical Shift Right (Zero Page,X)
function lsrZpX(_cpu: M6510Cpu): void {
  // TODO: Implement LSR zp,X operation
}

// 0x58: CLI - Clear Interrupt Disable Flag
function cli(_cpu: M6510Cpu): void {
  // TODO: Implement CLI operation
}

// 0x59: EOR abs,Y - Exclusive OR with Accumulator (Absolute,Y)
function eorAbsY(_cpu: M6510Cpu): void {
  // TODO: Implement EOR abs,Y operation
}

// 0x5D: EOR abs,X - Exclusive OR with Accumulator (Absolute,X)
function eorAbsX(_cpu: M6510Cpu): void {
  // TODO: Implement EOR abs,X operation
}

// 0x5E: LSR abs,X - Logical Shift Right (Absolute,X)
function lsrAbsX(_cpu: M6510Cpu): void {
  // TODO: Implement LSR abs,X operation
}

// 0x60: RTS - Return from Subroutine
function rts(_cpu: M6510Cpu): void {
  // TODO: Implement RTS operation
}

// 0x61: ADC (zp,X) - Add with Carry (Indexed Indirect)
function adcIndX(_cpu: M6510Cpu): void {
  // TODO: Implement ADC (zp,X) operation
}

// 0x65: ADC zp - Add with Carry (Zero Page)
function adcZp(_cpu: M6510Cpu): void {
  // TODO: Implement ADC zp operation
}

// 0x66: ROR zp - Rotate Right (Zero Page)
function rorZp(_cpu: M6510Cpu): void {
  // TODO: Implement ROR zp operation
}

// 0x68: PLA - Pull Accumulator
function pla(_cpu: M6510Cpu): void {
  // TODO: Implement PLA operation
}

// 0x69: ADC # - Add with Carry (Immediate)
function adcImm(_cpu: M6510Cpu): void {
  // TODO: Implement ADC # operation
}

// 0x6A: ROR A - Rotate Right (Accumulator)
function rorA(_cpu: M6510Cpu): void {
  // TODO: Implement ROR A operation
}

// 0x6C: JMP () - Jump Indirect
function jmpInd(_cpu: M6510Cpu): void {
  // TODO: Implement JMP () operation
}

// 0x6D: ADC abs - Add with Carry (Absolute)
function adcAbs(_cpu: M6510Cpu): void {
  // TODO: Implement ADC abs operation
}

// 0x6E: ROR abs - Rotate Right (Absolute)
function rorAbs(_cpu: M6510Cpu): void {
  // TODO: Implement ROR abs operation
}

// 0x70: BVS - Branch on Overflow Set
function bvs(_cpu: M6510Cpu): void {
  // TODO: Implement BVS operation
}

// 0x71: ADC (zp),Y - Add with Carry (Indirect Indexed)
function adcIndY(_cpu: M6510Cpu): void {
  // TODO: Implement ADC (zp),Y operation
}

// 0x75: ADC zp,X - Add with Carry (Zero Page,X)
function adcZpX(_cpu: M6510Cpu): void {
  // TODO: Implement ADC zp,X operation
}

// 0x76: ROR zp,X - Rotate Right (Zero Page,X)
function rorZpX(_cpu: M6510Cpu): void {
  // TODO: Implement ROR zp,X operation
}

// 0x78: SEI - Set Interrupt Disable Flag
function sei(_cpu: M6510Cpu): void {
  // TODO: Implement SEI operation
}

// 0x79: ADC abs,Y - Add with Carry (Absolute,Y)
function adcAbsY(_cpu: M6510Cpu): void {
  // TODO: Implement ADC abs,Y operation
}

// 0x7D: ADC abs,X - Add with Carry (Absolute,X)
function adcAbsX(_cpu: M6510Cpu): void {
  // TODO: Implement ADC abs,X operation
}

// 0x7E: ROR abs,X - Rotate Right (Absolute,X)
function rorAbsX(_cpu: M6510Cpu): void {
  // TODO: Implement ROR abs,X operation
}

// 0x81: STA (zp,X) - Store Accumulator (Indexed Indirect)
function staIndX(_cpu: M6510Cpu): void {
  // TODO: Implement STA (zp,X) operation
}

// 0x84: STY zp - Store Y Register (Zero Page)
function styZp(_cpu: M6510Cpu): void {
  // TODO: Implement STY zp operation
}

// 0x85: STA zp - Store Accumulator (Zero Page)
function staZp(_cpu: M6510Cpu): void {
  // TODO: Implement STA zp operation
}

// 0x86: STX zp - Store X Register (Zero Page)
function stxZp(_cpu: M6510Cpu): void {
  // TODO: Implement STX zp operation
}

// 0x88: DEY - Decrement Y Register
function dey(_cpu: M6510Cpu): void {
  // TODO: Implement DEY operation
}

// 0x8A: TXA - Transfer X to Accumulator
function txa(_cpu: M6510Cpu): void {
  // TODO: Implement TXA operation
}

// 0x8C: STY abs - Store Y Register (Absolute)
function styAbs(_cpu: M6510Cpu): void {
  // TODO: Implement STY abs operation
}

// 0x8D: STA abs - Store Accumulator (Absolute)
function staAbs(_cpu: M6510Cpu): void {
  // TODO: Implement STA abs operation
}

// 0x8E: STX abs - Store X Register (Absolute)
function stxAbs(_cpu: M6510Cpu): void {
  // TODO: Implement STX abs operation
}

// 0x90: BCC - Branch on Carry Clear
function bcc(_cpu: M6510Cpu): void {
  // TODO: Implement BCC operation
}

// 0x91: STA (zp),Y - Store Accumulator (Indirect Indexed)
function staIndY(_cpu: M6510Cpu): void {
  // TODO: Implement STA (zp),Y operation
}

// 0x94: STY zp,X - Store Y Register (Zero Page,X)
function styZpX(_cpu: M6510Cpu): void {
  // TODO: Implement STY zp,X operation
}

// 0x95: STA zp,X - Store Accumulator (Zero Page,X)
function staZpX(_cpu: M6510Cpu): void {
  // TODO: Implement STA zp,X operation
}

// 0x96: STX zp,Y - Store X Register (Zero Page,Y)
function stxZpY(_cpu: M6510Cpu): void {
  // TODO: Implement STX zp,Y operation
}

// 0x98: TYA - Transfer Y to Accumulator
function tya(_cpu: M6510Cpu): void {
  // TODO: Implement TYA operation
}

// 0x99: STA abs,Y - Store Accumulator (Absolute,Y)
function staAbsY(_cpu: M6510Cpu): void {
  // TODO: Implement STA abs,Y operation
}

// 0x9A: TXS - Transfer X to Stack Pointer
function txs(_cpu: M6510Cpu): void {
  // TODO: Implement TXS operation
}

// 0x9D: STA abs,X - Store Accumulator (Absolute,X)
function staAbsX(_cpu: M6510Cpu): void {
  // TODO: Implement STA abs,X operation
}

// 0xA0: LDY # - Load Y Register (Immediate)
function ldyImm(_cpu: M6510Cpu): void {
  // TODO: Implement LDY # operation
}

// 0xA1: LDA (zp,X) - Load Accumulator (Indexed Indirect)
function ldaIndX(_cpu: M6510Cpu): void {
  // TODO: Implement LDA (zp,X) operation
}

// 0xA2: LDX # - Load X Register (Immediate)
function ldxImm(_cpu: M6510Cpu): void {
  // TODO: Implement LDX # operation
}

// 0xA4: LDY zp - Load Y Register (Zero Page)
function ldyZp(_cpu: M6510Cpu): void {
  // TODO: Implement LDY zp operation
}

// 0xA5: LDA zp - Load Accumulator (Zero Page)
function ldaZp(_cpu: M6510Cpu): void {
  // TODO: Implement LDA zp operation
}

// 0xA6: LDX zp - Load X Register (Zero Page)
function ldxZp(_cpu: M6510Cpu): void {
  // TODO: Implement LDX zp operation
}

// 0xA8: TAY - Transfer Accumulator to Y
function tay(_cpu: M6510Cpu): void {
  // TODO: Implement TAY operation
}

// 0xA9: LDA # - Load Accumulator (Immediate)
function ldaImm(_cpu: M6510Cpu): void {
  // TODO: Implement LDA # operation
}

// 0xAA: TAX - Transfer Accumulator to X
function tax(_cpu: M6510Cpu): void {
  // TODO: Implement TAX operation
}

// 0xAC: LDY abs - Load Y Register (Absolute)
function ldyAbs(_cpu: M6510Cpu): void {
  // TODO: Implement LDY abs operation
}

// 0xAD: LDA abs - Load Accumulator (Absolute)
function ldaAbs(_cpu: M6510Cpu): void {
  // TODO: Implement LDA abs operation
}

// 0xAE: LDX abs - Load X Register (Absolute)
function ldxAbs(_cpu: M6510Cpu): void {
  // TODO: Implement LDX abs operation
}

// 0xB0: BCS - Branch on Carry Set
function bcs(_cpu: M6510Cpu): void {
  // TODO: Implement BCS operation
}

// 0xB1: LDA (zp),Y - Load Accumulator (Indirect Indexed)
function ldaIndY(_cpu: M6510Cpu): void {
  // TODO: Implement LDA (zp),Y operation
}

// 0xB4: LDY zp,X - Load Y Register (Zero Page,X)
function ldyZpX(_cpu: M6510Cpu): void {
  // TODO: Implement LDY zp,X operation
}

// 0xB5: LDA zp,X - Load Accumulator (Zero Page,X)
function ldaZpX(_cpu: M6510Cpu): void {
  // TODO: Implement LDA zp,X operation
}

// 0xB6: LDX zp,Y - Load X Register (Zero Page,Y)
function ldxZpY(_cpu: M6510Cpu): void {
  // TODO: Implement LDX zp,Y operation
}

// 0xB8: CLV - Clear Overflow Flag
function clv(_cpu: M6510Cpu): void {
  // TODO: Implement CLV operation
}

// 0xB9: LDA abs,Y - Load Accumulator (Absolute,Y)
function ldaAbsY(_cpu: M6510Cpu): void {
  // TODO: Implement LDA abs,Y operation
}

// 0xBA: TSX - Transfer Stack Pointer to X
function tsx(_cpu: M6510Cpu): void {
  // TODO: Implement TSX operation
}

// 0xBC: LDY abs,X - Load Y Register (Absolute,X)
function ldyAbsX(_cpu: M6510Cpu): void {
  // TODO: Implement LDY abs,X operation
}

// 0xBD: LDA abs,X - Load Accumulator (Absolute,X)
function ldaAbsX(_cpu: M6510Cpu): void {
  // TODO: Implement LDA abs,X operation
}

// 0xBE: LDX abs,Y - Load X Register (Absolute,Y)
function ldxAbsY(_cpu: M6510Cpu): void {
  // TODO: Implement LDX abs,Y operation
}

// 0xC0: CPY # - Compare Y Register (Immediate)
function cpyImm(_cpu: M6510Cpu): void {
  // TODO: Implement CPY # operation
}

// 0xC1: CMP (zp,X) - Compare Accumulator (Indexed Indirect)
function cmpIndX(_cpu: M6510Cpu): void {
  // TODO: Implement CMP (zp,X) operation
}

// 0xC4: CPY zp - Compare Y Register (Zero Page)
function cpyZp(_cpu: M6510Cpu): void {
  // TODO: Implement CPY zp operation
}

// 0xC5: CMP zp - Compare Accumulator (Zero Page)
function cmpZp(_cpu: M6510Cpu): void {
  // TODO: Implement CMP zp operation
}

// 0xC6: DEC zp - Decrement Memory (Zero Page)
function decZp(_cpu: M6510Cpu): void {
  // TODO: Implement DEC zp operation
}

// 0xC8: INY - Increment Y Register
function iny(_cpu: M6510Cpu): void {
  // TODO: Implement INY operation
}

// 0xC9: CMP # - Compare Accumulator (Immediate)
function cmpImm(_cpu: M6510Cpu): void {
  // TODO: Implement CMP # operation
}

// 0xCA: DEX - Decrement X Register
function dex(_cpu: M6510Cpu): void {
  // TODO: Implement DEX operation
}

// 0xCC: CPY abs - Compare Y Register (Absolute)
function cpyAbs(_cpu: M6510Cpu): void {
  // TODO: Implement CPY abs operation
}

// 0xCD: CMP abs - Compare Accumulator (Absolute)
function cmpAbs(_cpu: M6510Cpu): void {
  // TODO: Implement CMP abs operation
}

// 0xCE: DEC abs - Decrement Memory (Absolute)
function decAbs(_cpu: M6510Cpu): void {
  // TODO: Implement DEC abs operation
}

// 0xD0: BNE - Branch on Not Equal
function bne(_cpu: M6510Cpu): void {
  // TODO: Implement BNE operation
}

// 0xD1: CMP (zp),Y - Compare Accumulator (Indirect Indexed)
function cmpIndY(_cpu: M6510Cpu): void {
  // TODO: Implement CMP (zp),Y operation
}

// 0xD5: CMP zp,X - Compare Accumulator (Zero Page,X)
function cmpZpX(_cpu: M6510Cpu): void {
  // TODO: Implement CMP zp,X operation
}

// 0xD6: DEC zp,X - Decrement Memory (Zero Page,X)
function decZpX(_cpu: M6510Cpu): void {
  // TODO: Implement DEC zp,X operation
}

// 0xD8: CLD - Clear Decimal Mode Flag
function cld(_cpu: M6510Cpu): void {
  // TODO: Implement CLD operation
}

// 0xD9: CMP abs,Y - Compare Accumulator (Absolute,Y)
function cmpAbsY(_cpu: M6510Cpu): void {
  // TODO: Implement CMP abs,Y operation
}

// 0xDD: CMP abs,X - Compare Accumulator (Absolute,X)
function cmpAbsX(_cpu: M6510Cpu): void {
  // TODO: Implement CMP abs,X operation
}

// 0xDE: DEC abs,X - Decrement Memory (Absolute,X)
function decAbsX(_cpu: M6510Cpu): void {
  // TODO: Implement DEC abs,X operation
}

// 0xE0: CPX # - Compare X Register (Immediate)
function cpxImm(_cpu: M6510Cpu): void {
  // TODO: Implement CPX # operation
}

// 0xE1: SBC (zp,X) - Subtract with Carry (Indexed Indirect)
function sbcIndX(_cpu: M6510Cpu): void {
  // TODO: Implement SBC (zp,X) operation
}

// 0xE4: CPX zp - Compare X Register (Zero Page)
function cpxZp(_cpu: M6510Cpu): void {
  // TODO: Implement CPX zp operation
}

// 0xE5: SBC zp - Subtract with Carry (Zero Page)
function sbcZp(_cpu: M6510Cpu): void {
  // TODO: Implement SBC zp operation
}

// 0xE6: INC zp - Increment Memory (Zero Page)
function incZp(_cpu: M6510Cpu): void {
  // TODO: Implement INC zp operation
}

// 0xE8: INX - Increment X Register
function inx(_cpu: M6510Cpu): void {
  // TODO: Implement INX operation
}

// 0xE9: SBC # - Subtract with Carry (Immediate)
function sbcImm(_cpu: M6510Cpu): void {
  // TODO: Implement SBC # operation
}

// 0xEA: NOP - No Operation
function nop(_cpu: M6510Cpu): void {
  // TODO: Implement NOP operation
}

// 0xEC: CPX abs - Compare X Register (Absolute)
function cpxAbs(_cpu: M6510Cpu): void {
  // TODO: Implement CPX abs operation
}

// 0xED: SBC abs - Subtract with Carry (Absolute)
function sbcAbs(_cpu: M6510Cpu): void {
  // TODO: Implement SBC abs operation
}

// 0xEE: INC abs - Increment Memory (Absolute)
function incAbs(_cpu: M6510Cpu): void {
  // TODO: Implement INC abs operation
}

// 0xF0: BEQ - Branch on Equal
function beq(_cpu: M6510Cpu): void {
  // TODO: Implement BEQ operation
}

// 0xF1: SBC (zp),Y - Subtract with Carry (Indirect Indexed)
function sbcIndY(_cpu: M6510Cpu): void {
  // TODO: Implement SBC (zp),Y operation
}

// 0xF5: SBC zp,X - Subtract with Carry (Zero Page,X)
function sbcZpX(_cpu: M6510Cpu): void {
  // TODO: Implement SBC zp,X operation
}

// 0xF6: INC zp,X - Increment Memory (Zero Page,X)
function incZpX(_cpu: M6510Cpu): void {
  // TODO: Implement INC zp,X operation
}

// 0xF8: SED - Set Decimal Flag
function sed(_cpu: M6510Cpu): void {
  // TODO: Implement SED operation
}

// 0xF9: SBC abs,Y - Subtract with Carry (Absolute,Y)
function sbcAbsY(_cpu: M6510Cpu): void {
  // TODO: Implement SBC abs,Y operation
}

// 0xFD: SBC abs,X - Subtract with Carry (Absolute,X)
function sbcAbsX(_cpu: M6510Cpu): void {
  // TODO: Implement SBC abs,X operation
}

// 0xFE: INC abs,X - Increment Memory (Absolute,X)
function incAbsX(_cpu: M6510Cpu): void {
  // TODO: Implement INC abs,X operation
}

// Used for illegal opcodes
function illegal(_cpu: M6510Cpu): void {
  // TODO: Handle illegal opcodes
}
