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
  private _jammed: boolean;

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
    if (this._jammed) {
      return;
    }
    if (this._nmiRequested) {
      this.handleNmi();
      this._nmiRequested = false;
    } else if (this._irqRequested && !this.isIFlagSet()) {
      this.handleIrq();
      this._irqRequested = false;
    } else {
      // --- Handle regular CPU cycle
      const opCode = this.readMemory(this._pc);
      this._pc = (this._pc + 1) & 0xFFFF; // Properly wrap PC to 16 bits
      this.opCode = opCode; // Store the current opcode
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
    const value = (this.lastMemoryReadValue = this.doReadMemory(address));
    return value;
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
    this.incrementTacts();
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
  delayMemoryWrite(_address: number): void {
    this.waitForCpuRelease();
    this.incrementTacts();
  }

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
    this._jammed = false;

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
    jam, // 0x02
    sloIndX, // 0x03 - SLO (zp,X)
    dopZp, // 0x04 - DOP zp
    oraZp, // 0x05
    aslZp, // 0x06
    sloZp, // 0x07 - SLO zp
    php, // 0x08
    oraImm, // 0x09
    aslA, // 0x0A
    aacImm, // 0x0B - AAC #arg
    topAbs, // 0x0C - TOP abs
    oraAbs, // 0x0D
    aslAbs, // 0x0E
    sloAbs, // 0x0F - SLO abs
    bpl, // 0x10
    oraIndY, // 0x11
    jam, // 0x12
    sloIndY, // 0x13 - SLO (zp),Y
    dopZpX, // 0x14 - DOP zp,X
    oraZpX, // 0x15
    aslZpX, // 0x16
    sloZpX, // 0x17 - SLO zp,X
    clc, // 0x18
    oraAbsY, // 0x19
    illegal, // 0x1A
    sloAbsY, // 0x1B - SLO abs,Y
    topAbsX, // 0x1C - TOP abs,X
    oraAbsX, // 0x1D
    aslAbsX, // 0x1E
    sloAbsX, // 0x1F - SLO abs,X
    jsr, // 0x20
    andIndX, // 0x21
    jam, // 0x22
    rlaIndX, // 0x23 - RLA (zp,X)
    bitZp, // 0x24
    andZp, // 0x25
    rolZp, // 0x26
    rlaZp, // 0x27 - RLA zp
    plp, // 0x28
    andImm, // 0x29
    rolA, // 0x2A
    aacImm, // 0x2B - AAC #arg (same as 0x0B)
    bitAbs, // 0x2C
    andAbs, // 0x2D
    rolAbs, // 0x2E
    rlaAbs, // 0x2F - RLA abs
    bmi, // 0x30
    andIndY, // 0x31
    jam, // 0x32
    rlaIndY, // 0x33 - RLA (zp),Y
    dopZpX, // 0x34 - DOP zp,X
    andZpX, // 0x35
    rolZpX, // 0x36
    rlaZpX, // 0x37 - RLA zp,X
    sec, // 0x38
    andAbsY, // 0x39
    illegal, // 0x3A
    rlaAbsY, // 0x3B - RLA abs,Y
    topAbsX, // 0x3C - TOP abs,X
    andAbsX, // 0x3D
    rolAbsX, // 0x3E
    rlaAbsX, // 0x3F - RLA abs,X
    rti, // 0x40
    eorIndX, // 0x41
    jam, // 0x42
    sreIndX, // 0x43 - SRE (zp,X)
    dopZp, // 0x44 - DOP zp
    eorZp, // 0x45
    lsrZp, // 0x46
    sreZp, // 0x47 - SRE zp
    pha, // 0x48
    eorImm, // 0x49
    lsrA, // 0x4A
    asrImm, // 0x4B - ASR #arg
    jmp, // 0x4C
    eorAbs, // 0x4D
    lsrAbs, // 0x4E
    sreAbs, // 0x4F - SRE abs
    bvc, // 0x50
    eorIndY, // 0x51
    jam, // 0x52
    sreIndY, // 0x53 - SRE (zp),Y
    dopZpX, // 0x54 - DOP zp,X
    eorZpX, // 0x55
    lsrZpX, // 0x56
    sreZpX, // 0x57 - SRE zp,X
    cli, // 0x58
    eorAbsY, // 0x59
    illegal, // 0x5A
    sreAbsY, // 0x5B - SRE abs,Y
    topAbsX, // 0x5C - TOP abs,X
    eorAbsX, // 0x5D
    lsrAbsX, // 0x5E
    sreAbsX, // 0x5F - SRE abs,X
    rts, // 0x60
    adcIndX, // 0x61
    jam, // 0x62
    rraIndX, // 0x63 - RRA (zp,X)
    dopZp, // 0x64 - DOP zp
    adcZp, // 0x65
    rorZp, // 0x66
    rraZp, // 0x67 - RRA zp
    pla, // 0x68
    adcImm, // 0x69
    rorA, // 0x6A
    arrImm, // 0x6B - ARR #arg
    jmpInd, // 0x6C
    adcAbs, // 0x6D
    rorAbs, // 0x6E
    rraAbs, // 0x6F - RRA abs
    bvs, // 0x70
    adcIndY, // 0x71
    jam, // 0x72
    rraIndY, // 0x73 - RRA (zp),Y
    illegal, // 0x74
    adcZpX, // 0x75
    rorZpX, // 0x76
    rraZpX, // 0x77 - RRA zp,X
    sei, // 0x78
    adcAbsY, // 0x79
    illegal, // 0x7A
    rraAbsY, // 0x7B - RRA abs,Y
    topAbsX, // 0x7C - TOP abs,X
    adcAbsX, // 0x7D
    rorAbsX, // 0x7E
    rraAbsX, // 0x7F - RRA abs,X
    dopImm, // 0x80 - DOP #arg
    staIndX, // 0x81
    dopImm, // 0x82 - DOP #arg
    saxIndX, // 0x83 - SAX (zp,X)
    styZp, // 0x84
    staZp, // 0x85
    stxZp, // 0x86
    saxZp, // 0x87 - SAX zp
    dey, // 0x88
    dopImm, // 0x89 - DOP #arg
    txa, // 0x8A
    xaaImm, // 0x8B - XAA #arg
    styAbs, // 0x8C
    staAbs, // 0x8D
    stxAbs, // 0x8E
    saxAbs, // 0x8F - SAX abs
    bcc, // 0x90
    staIndY, // 0x91
    jam, // 0x92
    axaIndY, // 0x93 - AXA (zp),Y
    styZpX, // 0x94
    staZpX, // 0x95
    stxZpY, // 0x96
    saxZpY, // 0x97 - SAX zp,Y
    tya, // 0x98
    staAbsY, // 0x99
    txs, // 0x9A
    xasAbsY, // 0x9B - XAS abs,Y
    syaAbsX, // 0x9C - SYA abs,X
    staAbsX, // 0x9D
    sxaAbsY, // 0x9E - SXA abs,Y
    axaAbsY, // 0x9F - AXA abs,Y
    ldyImm, // 0xA0
    ldaIndX, // 0xA1
    ldxImm, // 0xA2
    laxIndX, // 0xA3
    ldyZp, // 0xA4
    ldaZp, // 0xA5
    ldxZp, // 0xA6
    laxZp, // 0xA7
    tay, // 0xA8
    ldaImm, // 0xA9
    tax, // 0xAA
    atxImm, // 0xAB - ATX #arg
    ldyAbs, // 0xAC
    ldaAbs, // 0xAD
    ldxAbs, // 0xAE
    laxAbs, // 0xAF
    bcs, // 0xB0
    ldaIndY, // 0xB1
    jam, // 0xB2
    laxIndY, // 0xB3
    ldyZpX, // 0xB4
    ldaZpX, // 0xB5
    ldxZpY, // 0xB6
    laxZpY, // 0xB7
    clv, // 0xB8
    ldaAbsY, // 0xB9
    tsx, // 0xBA
    larAbsY, // 0xBB - LAR abs,Y
    ldyAbsX, // 0xBC
    ldaAbsX, // 0xBD
    ldxAbsY, // 0xBE
    laxAbsY, // 0xBF
    cpyImm, // 0xC0
    cmpIndX, // 0xC1
    dopImm, // 0xC2 - DOP #arg
    dcpIndX, // 0xC3 - DCP (zp,X)
    cpyZp, // 0xC4
    cmpZp, // 0xC5
    decZp, // 0xC6
    dcpZp, // 0xC7 - DCP zp
    iny, // 0xC8
    cmpImm, // 0xC9
    dex, // 0xCA
    axsImm, // 0xCB - AXS #arg
    cpyAbs, // 0xCC
    cmpAbs, // 0xCD
    decAbs, // 0xCE
    dcpAbs, // 0xCF - DCP abs
    bne, // 0xD0
    cmpIndY, // 0xD1
    jam, // 0xD2
    dcpIndY, // 0xD3 - DCP (zp),Y
    dopZpX, // 0xD4 - DOP zp,X
    cmpZpX, // 0xD5
    decZpX, // 0xD6
    dcpZpX, // 0xD7 - DCP zp,X
    cld, // 0xD8
    cmpAbsY, // 0xD9
    illegal, // 0xDA
    dcpAbsY, // 0xDB - DCP abs,Y
    topAbsX, // 0xDC - TOP abs,X
    cmpAbsX, // 0xDD
    decAbsX, // 0xDE
    dcpAbsX, // 0xDF - DCP abs,X
    cpxImm, // 0xE0
    sbcIndX, // 0xE1
    dopImm, // 0xE2 - DOP #arg
    iscIndX, // 0xE3 - ISC (zp,X)
    cpxZp, // 0xE4
    sbcZp, // 0xE5
    incZp, // 0xE6
    iscZp, // 0xE7 - ISC zp
    inx, // 0xE8
    sbcImm, // 0xE9
    nop, // 0xEA
    sbcImm, // 0xEB - SBC #imm (undocumented duplicate)
    cpxAbs, // 0xEC
    sbcAbs, // 0xED
    incAbs, // 0xEE
    iscAbs, // 0xEF - ISC abs
    beq, // 0xF0
    sbcIndY, // 0xF1
    jam, // 0xF2
    iscIndY, // 0xF3 - ISC (zp),Y
    dopZpX, // 0xF4 - DOP zp,X
    sbcZpX, // 0xF5
    incZpX, // 0xF6
    iscZpX, // 0xF7 - ISC zp,X
    sed, // 0xF8
    sbcAbsY, // 0xF9
    illegal, // 0xFA
    iscAbsY, // 0xFB - ISC abs,Y
    topAbsX, // 0xFC - TOP abs,X
    sbcAbsX, // 0xFD
    incAbsX, // 0xFE
    iscAbsX // 0xFF - ISC abs,X
  ];

  // ------------------------------------------------------------------------------------------------------------------
  // 6510 operation helpers

  /**
   * Sets the Zero and Negative flags according to the value.
   * @param value The value to test
   */
  setZeroAndNegativeFlags(value: number): void {
    // Clear Z and N flags
    this._p &= ~(FlagSetMask6510.Z | FlagSetMask6510.N);
    // Set Z flag if value is zero
    if ((value & 0xff) === 0) {
      this._p |= FlagSetMask6510.Z;
    }
    // Set N flag if bit 7 is set
    if ((value & 0x80) !== 0) {
      this._p |= FlagSetMask6510.N;
    }
  }

  /**
   * Sets the Carry, Zero and Negative flags for ASL operations.
   * @param originalValue The original value before shifting
   * @param shiftedValue The value after shifting
   */
  setAslFlags(originalValue: number, shiftedValue: number): void {
    // Clear C, Z and N flags
    this._p &= ~(FlagSetMask6510.C | FlagSetMask6510.Z | FlagSetMask6510.N | FlagSetMask6510.B);
    // Set C flag if bit 7 of original value was set
    if ((originalValue & 0x80) !== 0) {
      this._p |= FlagSetMask6510.C;
    }
    // Set Z flag if shifted value is zero
    if ((shiftedValue & 0xff) === 0) {
      this._p |= FlagSetMask6510.Z;
    }
    // Set N flag if bit 7 of shifted value is set
    if ((shiftedValue & 0x80) !== 0) {
      this._p |= FlagSetMask6510.N;
    }
  }

  /**
   * Sets the flags after an LSR operation
   * @param originalValue The original value before the operation
   * @param shiftedValue The value after the shift operation
   */
  setLsrFlags(originalValue: number, shiftedValue: number): void {
    // Clear C, Z and N flags
    this._p &= ~(FlagSetMask6510.C | FlagSetMask6510.Z | FlagSetMask6510.N);
    // Set C flag if bit 0 of original value was set
    if ((originalValue & 0x01) !== 0) {
      this._p |= FlagSetMask6510.C;
    }
    // Set Z flag if shifted value is zero
    if ((shiftedValue & 0xff) === 0) {
      this._p |= FlagSetMask6510.Z;
    }
    // N flag is always clear after LSR (bit 7 of result is always 0)
  }

  /**
   * Sets the flags after a ROL operation
   * @param originalValue The original value before the operation
   * @param rotatedValue The value after the rotate operation
   */
  setRolFlags(originalValue: number, rotatedValue: number): void {
    // Clear C, Z and N flags
    this._p &= ~(FlagSetMask6510.C | FlagSetMask6510.Z | FlagSetMask6510.N);
    // Set C flag if bit 7 of original value was set
    if ((originalValue & 0x80) !== 0) {
      this._p |= FlagSetMask6510.C;
    }
    // Set Z flag if rotated value is zero
    if ((rotatedValue & 0xff) === 0) {
      this._p |= FlagSetMask6510.Z;
    }
    // Set N flag if bit 7 of rotated value is set
    if ((rotatedValue & 0x80) !== 0) {
      this._p |= FlagSetMask6510.N;
    }
  }

  /**
   * Sets the flags after a ROR operation
   * @param originalValue The original value before the operation
   * @param rotatedValue The value after the rotate operation
   */
  setRorFlags(originalValue: number, rotatedValue: number): void {
    // Clear C, Z and N flags
    this._p &= ~(FlagSetMask6510.C | FlagSetMask6510.Z | FlagSetMask6510.N);
    // Set C flag if bit 0 of original value was set
    if ((originalValue & 0x01) !== 0) {
      this._p |= FlagSetMask6510.C;
    }
    // Set Z flag if rotated value is zero
    if ((rotatedValue & 0xff) === 0) {
      this._p |= FlagSetMask6510.Z;
    }
    // Set N flag if bit 7 of rotated value is set
    if ((rotatedValue & 0x80) !== 0) {
      this._p |= FlagSetMask6510.N;
    }
  }

  /**
   * Sets the flags after a compare operation (CMP, CPX, CPY)
   * Performs a subtraction without storing the result and sets C, Z, N flags
   * @param registerValue The value of the register being compared
   * @param compareValue The value being compared against
   */
  setCompareFlags(registerValue: number, compareValue: number): void {
    const result = (registerValue - compareValue) & 0x1ff; // Include carry bit
    
    // Clear C, Z and N flags
    this._p &= ~(FlagSetMask6510.C | FlagSetMask6510.Z | FlagSetMask6510.N);
    
    // Set C flag if no borrow occurred (register >= compare value)
    if (registerValue >= compareValue) {
      this._p |= FlagSetMask6510.C;
    }
    
    // Set Z flag if values are equal
    if ((result & 0xff) === 0) {
      this._p |= FlagSetMask6510.Z;
    }
    
    // Set N flag if bit 7 of result is set
    if ((result & 0x80) !== 0) {
      this._p |= FlagSetMask6510.N;
    }
  }

  /**
   * Sets the flags after an ADC (Add with Carry) operation
   * @param accumulator The original accumulator value
   * @param operand The value being added
   * @param result The 9-bit result (including carry out)
   */
  setAdcFlags(accumulator: number, operand: number, result: number): void {
    // Clear N, V, Z, C flags
    this._p &= ~(FlagSetMask6510.N | FlagSetMask6510.V | FlagSetMask6510.Z | FlagSetMask6510.C);
    
    // Set N flag if bit 7 of result is set
    if ((result & 0x80) !== 0) {
      this._p |= FlagSetMask6510.N;
    }
    
    // Set Z flag if result is zero
    if ((result & 0xFF) === 0) {
      this._p |= FlagSetMask6510.Z;
    }
    
    // Set C flag if result > 255 (carry out)
    if (result > 0xFF) {
      this._p |= FlagSetMask6510.C;
    }
    
    // Set V flag if signed overflow occurred
    // Overflow occurs when:
    // - Adding two positive numbers gives a negative result
    // - Adding two negative numbers gives a positive result
    const accumulatorSign = accumulator & 0x80;
    const operandSign = operand & 0x80;
    const resultSign = result & 0x80;
    
    if ((accumulatorSign === operandSign) && (accumulatorSign !== resultSign)) {
      this._p |= FlagSetMask6510.V;
    }
  }

  /**
   * Performs SBC (Subtract with Carry) operation with decimal mode support
   * @param operand The value being subtracted
   * @returns The result to store in the accumulator
   */
  performSbc(operand: number): number {
    const borrowIn = this.isCFlagSet() ? 0 : 1;
    const tmp = this.a - operand - borrowIn;
    
    if (this.isDFlagSet()) {
      // Decimal mode (BCD)
      let tmpA = (this.a & 0x0F) - (operand & 0x0F) - borrowIn;
      if (tmpA & 0x10) {
        tmpA = ((tmpA - 6) & 0x0F) | ((this.a & 0xF0) - (operand & 0xF0) - 0x10);
      } else {
        tmpA = (tmpA & 0x0F) | ((this.a & 0xF0) - (operand & 0xF0));
      }
      if (tmpA & 0x100) {
        tmpA -= 0x60;
      }
      
      // Set flags based on binary operation but use BCD result for accumulator
      this.setSbcFlagsDecimal(this.a, operand, tmp);
      return tmpA & 0xFF;
    } else {
      // Binary mode
      this.setSbcFlagsBinary(this.a, operand, tmp);
      return tmp & 0xFF;
    }
  }

  /**
   * Sets flags for SBC operation in binary mode
   */
  private setSbcFlagsBinary(accumulator: number, operand: number, result: number): void {
    // Clear N, V, Z, C flags
    this._p &= ~(FlagSetMask6510.N | FlagSetMask6510.V | FlagSetMask6510.Z | FlagSetMask6510.C);
    
    // Set N and Z flags based on 8-bit result
    const result8 = result & 0xFF;
    if (result8 === 0) {
      this._p |= FlagSetMask6510.Z;
    }
    if (result8 & 0x80) {
      this._p |= FlagSetMask6510.N;
    }
    
    // Set C flag if no borrow occurred (result >= 0)
    if (result >= 0) {
      this._p |= FlagSetMask6510.C;
    }
    
    // Set V flag if signed overflow occurred
    // Overflow in subtraction: (A ^ result) & 0x80 && (A ^ operand) & 0x80
    if (((accumulator ^ result) & 0x80) && ((accumulator ^ operand) & 0x80)) {
      this._p |= FlagSetMask6510.V;
    }
  }

  /**
   * Sets flags for SBC operation in decimal mode
   */
  private setSbcFlagsDecimal(accumulator: number, operand: number, binaryResult: number): void {
    // Clear N, V, Z, C flags
    this._p &= ~(FlagSetMask6510.N | FlagSetMask6510.V | FlagSetMask6510.Z | FlagSetMask6510.C);
    
    // N and Z flags are set based on binary result
    const result8 = binaryResult & 0xFF;
    if (result8 === 0) {
      this._p |= FlagSetMask6510.Z;
    }
    if (result8 & 0x80) {
      this._p |= FlagSetMask6510.N;
    }
    
    // Set C flag if no borrow occurred in binary operation
    if (binaryResult >= 0) {
      this._p |= FlagSetMask6510.C;
    }
    
    // Set V flag based on binary operation
    if (((accumulator ^ binaryResult) & 0x80) && ((accumulator ^ operand) & 0x80)) {
      this._p |= FlagSetMask6510.V;
    }
  }

  /**
   * Performs ADC (Add with Carry) operation with decimal mode support
   * @param operand The value being added
   * @returns The result to store in the accumulator
   */
  performAdc(operand: number): number {
    const carryIn = this.isCFlagSet() ? 1 : 0;
    
    if (this.isDFlagSet()) {
      // Decimal mode (BCD) - exact VICE algorithm
      let tmp = (this.a & 0x0F) + (operand & 0x0F) + carryIn;
      if (tmp > 0x09) {
        tmp += 0x06;
      }
      if (tmp <= 0x0F) {
        tmp = (tmp & 0x0F) + (this.a & 0xF0) + (operand & 0xF0);
      } else {
        tmp = (tmp & 0x0F) + (this.a & 0xF0) + (operand & 0xF0) + 0x10;
      }
      
      // Check for tens digit carry BEFORE adjustment
      const needsCarry = (tmp & 0x1F0) > 0x90;
      if (needsCarry) {
        tmp += 0x60;
      }
      
      // The final BCD result is tmp & 0xFF (after all adjustments)
      const finalBcdResult = tmp & 0xFF;
      
      // Set flags based on binary operation for Z and V, N based on final BCD result
      const binaryResult = this.a + operand + carryIn;
      this.setAdcFlagsDecimal(this.a, operand, binaryResult, finalBcdResult);
      
      // Set carry flag based on whether tens digit needed adjustment
      if (needsCarry) {
        this._p |= FlagSetMask6510.C;
      } else {
        this._p &= ~FlagSetMask6510.C;
      }
      
      return tmp & 0xFF;
    } else {
      // Binary mode
      const result = this.a + operand + carryIn;
      this.setAdcFlagsBinary(this.a, operand, result);
      return result & 0xFF;
    }
  }

  /**
   * Sets flags for ADC operation in binary mode
   */
  private setAdcFlagsBinary(accumulator: number, operand: number, result: number): void {
    // Clear N, V, Z, C flags
    this._p &= ~(FlagSetMask6510.N | FlagSetMask6510.V | FlagSetMask6510.Z | FlagSetMask6510.C);
    
    // Set N and Z flags based on 8-bit result
    const result8 = result & 0xFF;
    if (result8 === 0) {
      this._p |= FlagSetMask6510.Z;
    }
    if (result8 & 0x80) {
      this._p |= FlagSetMask6510.N;
    }
    
    // Set C flag if result > 255 (carry out)
    if (result > 0xFF) {
      this._p |= FlagSetMask6510.C;
    }
    
    // Set V flag if signed overflow occurred
    // Overflow: !((A ^ operand) & 0x80) && ((A ^ result) & 0x80)
    if (!((accumulator ^ operand) & 0x80) && ((accumulator ^ result) & 0x80)) {
      this._p |= FlagSetMask6510.V;
    }
  }

  /**
   * Sets flags for ADC operation in decimal mode
   */
  private setAdcFlagsDecimal(accumulator: number, operand: number, binaryResult: number, bcdResult: number): void {
    // Clear N, V, Z flags (C is handled separately in decimal mode)
    this._p &= ~(FlagSetMask6510.N | FlagSetMask6510.V | FlagSetMask6510.Z);
    
    // Z flag is set based on binary result (per 6502 specification)
    if ((binaryResult & 0xFF) === 0) {
      this._p |= FlagSetMask6510.Z;
    }
    
    // N flag is set based on BCD result
    if (bcdResult & 0x80) {
      this._p |= FlagSetMask6510.N;
    }
    
    // V flag based on binary operation: !((A ^ operand) & 0x80) && ((A ^ result) & 0x80)
    if (!((accumulator ^ operand) & 0x80) && ((accumulator ^ binaryResult) & 0x80)) {
      this._p |= FlagSetMask6510.V;
    }
  }

  /**
   * Sets the flags after a BIT operation
   * Performs A AND operand test without storing result
   * @param accumulatorValue The value of the accumulator
   * @param memoryValue The value from memory being tested
   */
  setBitFlags(accumulatorValue: number, memoryValue: number): void {
    const result = accumulatorValue & memoryValue;
    
    // Clear Z, V and N flags
    this._p &= ~(FlagSetMask6510.Z | FlagSetMask6510.V | FlagSetMask6510.N);
    
    // Set Z flag if result of A AND operand is zero
    if ((result & 0xff) === 0) {
      this._p |= FlagSetMask6510.Z;
    }
    
    // Set V flag to bit 6 of memory value
    if ((memoryValue & 0x40) !== 0) {
      this._p |= FlagSetMask6510.V;
    }
    
    // Set N flag to bit 7 of memory value
    if ((memoryValue & 0x80) !== 0) {
      this._p |= FlagSetMask6510.N;
    }
  }

  /**
   * Pushes a byte onto the stack
   * @param value The byte to push onto the stack
   */
  pushStack(value: number): void {
    const stackAddress = 0x0100 + this._sp;
    this.writeMemory(stackAddress, value & 0xFF);
    this._sp = (this._sp - 1) & 0xFF;
  }

  /**
   * Pulls a byte from the stack
   * @returns The byte pulled from the stack
   */
  pullStack(): number {
    this._sp = (this._sp + 1) & 0xFF;
    const stackAddress = 0x0100 + this._sp;
    return this.readMemory(stackAddress);
  }

  /**
   * Performs a conditional branch operation
   * @param condition True if the branch should be taken
   */
  performBranch(condition: boolean): void {
    const offset = this.readMemory(this.pc++);
    
    if (condition) {
      // Branch taken - add extra cycle
      this.incrementTacts();
      
      // Store the current page BEFORE modifying PC for page boundary check
      const currentPage = this.pc & 0xFF00;
      
      // Calculate new PC (offset is signed 8-bit value)
      const signedOffset = offset > 127 ? offset - 256 : offset;
      this.pc = (this.pc + signedOffset) & 0xFFFF;
      
      // Check for page boundary crossing - adds another cycle
      const newPage = this.pc & 0xFF00;
      if (currentPage !== newPage) {
        this.incrementTacts();
      }
    }
    // If branch not taken, we already incremented PC past the offset
  }

  readMemoryWithPageBoundary(address: number, index: number): number {
    // Read memory at the specified address with index applied
    const effectiveAddress = (address + index) & 0xffff;
    // Check for page boundary crossing
    if ((address & 0xff00) !== (effectiveAddress & 0xff00)) {
      // Page boundary crossed, handle any required delays or operations
      this.incrementTacts();
    }
    return this.readMemory(effectiveAddress);
  }

  writeMemoryIndexed(address: number, index: number, value: number): void {
    // Write memory at the specified address with index applied
    const effectiveAddress = (address + index) & 0xffff;
    // Check for page boundary crossing
    if ((address & 0xff00) !== (effectiveAddress & 0xff00)) {
      // Page boundary crossed, handle any required delays or operations
      this.incrementTacts();
    }
    this.writeMemory(effectiveAddress, value);
  }

  incrementTacts(): void {
    this.tacts++;
    this.frameTacts++;
    if (this.frameTacts >= this.tactsInCurrentFrame) {
      this.frames++;
      this.frameTacts -= this.tactsInCurrentFrame;
    }
    this.currentFrameTact = Math.floor(this.frameTacts / this.clockMultiplier);
    this.onTactIncremented();
  }

  setJammed(): void {
    this._jammed = true;
  }

  // ------------------------------------------------------------------------------------------------------------------
  // 6510 private helpers
  /**
   * Increments the CPU tacts and updates the frame and current frame tact counters.
   * This method should be called every time a CPU tact is completed.
   */
}

// --------------------------------------------------------------------------------------------------------------------
// 6510 operation implementations

/**
 * BRK - Break (software IRQ) - Opcode: $00
 * 
 * Operation: push PC+2 to stack, push NV11DIZC flags to stack, PC = ($FFFE)
 * 
 * Description: 
 * BRK triggers a software interrupt request (IRQ). Unlike hardware IRQs, BRK executes
 * even when the interrupt disable flag is set. It pushes the return address (PC+2) and
 * processor status (with B flag set) to the stack, sets the interrupt disable flag, 
 * and jumps to the IRQ vector at $FFFE/$FFFF. The return address skips the byte after
 * the BRK opcode, making it effectively a 2-byte instruction.
 * 
 * Flags affected:
 * - I (Interrupt disable): Set to 1 after old flags are pushed to stack
 * - B (Break): Pushed as 1 to stack (exists only in pushed flags, not in CPU)
 * 
 * Timing: 7 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Read next byte (unused operand), increment PC
 * - Cycle 3: Push PCH to stack
 * - Cycle 4: Push PCL to stack  
 * - Cycle 5: Push P (with B=1) to stack
 * - Cycle 6: Fetch IRQ vector low byte from $FFFE
 * - Cycle 7: Fetch IRQ vector high byte from $FFFF
 * 
 * Addressing mode: Implied (though considered 2-byte due to unused operand)
 */
function brk(cpu: M6510Cpu): void {
  // BRK is a 2-byte instruction, increment PC to point past the BRK operand
  cpu.pc++;
  
  // Push return address to stack (PC after BRK operand)
  cpu.pushStack((cpu.pc >> 8) & 0xFF); // Push high byte of PC
  cpu.pushStack(cpu.pc & 0xFF); // Push low byte of PC
  
  // Push status register with B flag set
  const statusWithBreak = cpu.p | FlagSetMask6510.B | FlagSetMask6510.UNUSED;
  cpu.pushStack(statusWithBreak);
  
  // Set interrupt disable flag
  cpu.p |= FlagSetMask6510.I;
  
  // Jump to BRK/IRQ vector at 0xFFFE/0xFFFF
  const vectorLow = cpu.readMemory(0xFFFE);
  const vectorHigh = cpu.readMemory(0xFFFF);
  cpu.pc = (vectorHigh << 8) | vectorLow;
}

/**
 * ORA - Bitwise OR (Indirect,X) - Opcode: $01
 * 
 * Operation: A = A | memory
 * 
 * Description:
 * ORA performs a bitwise OR operation between the accumulator and a memory value.
 * If either input bit is 1, the resulting bit is 1; otherwise it is 0. This
 * instruction uses indexed indirect addressing: the zero page address is added
 * to the X register, then the result is used as a pointer to the actual operand.
 * 
 * Flags affected:
 * - N (Negative): Set to result bit 7
 * - Z (Zero): Set if result == 0
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address, increment PC
 * - Cycle 3: Add X to zero page address (internal operation)
 * - Cycle 4: Fetch effective address low byte from (zp+X)
 * - Cycle 5: Fetch effective address high byte from (zp+X+1)
 * - Cycle 6: Fetch operand from effective address, perform OR
 * 
 * Addressing mode: (Indirect,X) - 2 bytes
 */
function oraIndX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const indAddress = (zpAddress + cpu.x) & 0xff;
  cpu.incrementTacts();
  const low = cpu.readMemory(indAddress);
  const high = cpu.readMemory((indAddress + 1) & 0xff);
  const address = (high << 8) | low;
  const value = cpu.readMemory(address);
  cpu.a = cpu.a | value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * JAM (KIL/HLT) - Jam Processor - Opcodes: $02, $12, $22, $32, $42, $52, $62, $72, $92, $B2, $D2, $F2
 * 
 * Operation: Stop program counter (processor lock up)
 * 
 * Description:
 * JAM is an undocumented instruction that halts the processor by jamming the
 * program counter. The CPU enters an infinite loop and stops executing
 * instructions. The only way to recover from this state is through a hardware
 * reset or NMI interrupt. This instruction has multiple opcodes that all
 * perform the same jamming operation.
 * 
 * Flags affected: None
 * 
 * Timing: Varies (processor stops normal execution)
 * - Cycle 1: Fetch opcode
 * - Subsequent cycles: Processor jammed, no further execution
 * 
 * Addressing mode: Implied - 1 byte
 * Alternative names: KIL, HLT
 */
function jam(cpu: M6510Cpu): void {
  cpu.setJammed();
  cpu.incrementTacts(); // Increment tacts to simulate a cycle
}

/**
 * SLO - Shift Left then OR (Indirect,X) - Opcode: $03
 * 
 * Operation: memory = memory << 1, A = A | memory
 * 
 * Description:
 * SLO is an undocumented instruction that performs two operations in sequence:
 * first it shifts the memory value left by one bit (same as ASL), then it
 * performs a bitwise OR between the accumulator and the shifted memory value.
 * This is a read-modify-write instruction that uses indexed indirect addressing.
 * 
 * Flags affected:
 * - C (Carry): Set to original memory bit 7 (from the shift operation)
 * - N (Negative): Set to result bit 7 (from the OR operation)  
 * - Z (Zero): Set if result == 0 (from the OR operation)
 * 
 * Timing: 8 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address, increment PC
 * - Cycle 3: Add X to zero page address (internal operation)
 * - Cycle 4: Fetch effective address low byte from (zp+X)
 * - Cycle 5: Fetch effective address high byte from (zp+X+1)
 * - Cycle 6: Read original value from effective address
 * - Cycle 7: Perform shift operation (internal operation)
 * - Cycle 8: Write shifted value back, OR with accumulator
 * 
 * Addressing mode: (Indirect,X) - 2 bytes
 * Alternative names: ASO
 */
function sloIndX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const indirectAddress = (zpAddress + cpu.x) & 0xFF; // Wrap around in zero page
  const targetLow = cpu.readMemory(indirectAddress);
  const targetHigh = cpu.readMemory((indirectAddress + 1) & 0xFF); // Wrap around
  const targetAddress = (targetHigh << 8) | targetLow;
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const shiftedValue = (originalValue << 1) & 0xFF;
  cpu.writeMemory(targetAddress, shiftedValue);
  // Set ASL flags first
  cpu.setAslFlags(originalValue, shiftedValue);
  // Then OR with accumulator
  cpu.a = cpu.a | shiftedValue;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * DOP - Double NOP (Zero Page) - Opcode: $04
 * 
 * Operation: No operation (reads zero page address but ignores value)
 * 
 * Description:
 * DOP is an undocumented instruction that performs no operation but takes
 * 2 bytes and extra cycles compared to regular NOP. It reads a zero page
 * address as its operand but discards the value. This instruction is useful
 * for timing delays or as padding in code where a 2-byte NOP is needed.
 * 
 * Flags affected: None
 * 
 * Timing: 3 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address, increment PC
 * - Cycle 3: Internal operation (no memory access)
 * 
 * Addressing mode: Zero Page - 2 bytes
 * Alternative names: NOP, SKB
 */
function dopZp(cpu: M6510Cpu): void {
  cpu.readMemory(cpu.pc++); // Read and discard the zero page address
  cpu.incrementTacts(); // Extra cycle for zero page access (but no actual memory access)
}

/**
 * ORA - Bitwise OR (Zero Page) - Opcode: $05
 * 
 * Operation: A = A | memory
 * 
 * Description:
 * ORA performs a bitwise OR operation between the accumulator and a memory value
 * from zero page. If either input bit is 1, the resulting bit is 1; otherwise
 * it is 0. Zero page addressing provides faster access than absolute addressing
 * due to the single-byte address.
 * 
 * Flags affected:
 * - N (Negative): Set to result bit 7
 * - Z (Zero): Set if result == 0
 * 
 * Timing: 3 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address, increment PC
 * - Cycle 3: Fetch operand from zero page, perform OR
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function oraZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const value = cpu.readMemory(zpAddress);
  cpu.a = cpu.a | value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * ASL - Arithmetic Shift Left - Opcode: $06 (Zero Page)
 * 
 * Operation: C = M[7]; M = M << 1; M[0] = 0
 * 
 * Description:
 * Shifts the value at the zero page memory location one bit to the left.
 * Bit 7 is shifted into the carry flag, and bit 0 is filled with zero.
 * This performs a multiplication by 2 on the memory value (for unsigned
 * values or positive signed values).
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 7 before shifting
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 5 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read value from zero page address
 * - Cycle 4: Internal operation, perform shift
 * - Cycle 5: Write shifted value back to zero page address
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function aslZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const originalValue = cpu.readMemory(zpAddress);
  cpu.incrementTacts(); // Internal operation cycle
  const shiftedValue = (originalValue << 1) & 0xff;
  cpu.writeMemory(zpAddress, shiftedValue);
  cpu.setAslFlags(originalValue, shiftedValue);
}

/**
 * SLO - Shift Left then OR - Opcode: $07 (Zero Page) - Undocumented
 * 
 * Operation: M = M << 1; A = A | M
 * 
 * Description:
 * SLO is an undocumented instruction that combines ASL and ORA operations.
 * It first performs an arithmetic shift left on the zero page memory location
 * (bit 7 → carry, bit 0 ← 0), then ORs the shifted result with the accumulator.
 * This instruction is also known as ASO in some references.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 7 before shifting
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 5 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read value from zero page address
 * - Cycle 4: Internal operation, perform shift and OR
 * - Cycle 5: Write shifted value back to zero page address
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function sloZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const originalValue = cpu.readMemory(zpAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const shiftedValue = (originalValue << 1) & 0xFF;
  cpu.writeMemory(zpAddress, shiftedValue);
  // Set ASL flags first
  cpu.setAslFlags(originalValue, shiftedValue);
  // Then OR with accumulator
  cpu.a = cpu.a | shiftedValue;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * PHP - Push Processor Status - Opcode: $08
 * 
 * Operation: ($0100 + SP) = NV11DIZC, SP = SP - 1
 * 
 * Description:
 * PHP pushes the processor status register onto the stack and decrements the
 * stack pointer. The B flag and unused bit are both pushed as 1, even though
 * the actual B flag in the processor is not set. This allows interrupt handlers
 * to distinguish between hardware interrupts and software BRK instructions by
 * checking the B flag in the pushed status byte.
 * 
 * Flags affected:
 * - B (Break): Pushed as 1 to stack (exists only in pushed flags, not in CPU)
 * 
 * Timing: 3 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation
 * - Cycle 3: Push status register to stack, decrement SP
 * 
 * Addressing mode: Implied - 1 byte
 */
function php(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  // When PHP pushes the status register, the B flag is set in the pushed value
  // but the actual B flag in the processor remains unchanged
  const statusWithBreak = cpu.p | FlagSetMask6510.B | FlagSetMask6510.UNUSED;
  cpu.pushStack(statusWithBreak);
}

/**
 * ORA - Bitwise OR (Immediate) - Opcode: $09
 * 
 * Operation: A = A | memory
 * 
 * Description:
 * ORA performs a bitwise OR operation between the accumulator and an immediate
 * value. If either input bit is 1, the resulting bit is 1; otherwise it is 0.
 * Immediate addressing provides the fastest execution as the operand is directly
 * embedded in the instruction stream.
 * 
 * Flags affected:
 * - N (Negative): Set to result bit 7
 * - Z (Zero): Set if result == 0
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch immediate operand, increment PC, perform OR
 * 
 * Addressing mode: Immediate - 2 bytes
 */
function oraImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.a = cpu.a | value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * ASL - Arithmetic Shift Left - Opcode: $0A (Accumulator)
 * 
 * Operation: C = A[7]; A = A << 1; A[0] = 0
 * 
 * Description:
 * Shifts the accumulator one bit to the left. Bit 7 is shifted into the
 * carry flag, and bit 0 is filled with zero. This performs a multiplication
 * by 2 on the accumulator value (for unsigned values or positive signed values).
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 7 before shifting
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation, perform shift
 * 
 * Addressing mode: Accumulator - 1 byte
 */
function aslA(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  const originalValue = cpu.a;
  const shiftedValue = (cpu.a << 1) & 0xff;
  cpu.a = shiftedValue;
  cpu.setAslFlags(originalValue, shiftedValue);
}

/**
 * AAC (ANC) - AND with Carry - Opcode: $0B, $2B
 * 
 * Operation: A = A AND memory, C = A[7]
 * 
 * Description:
 * AAC is an undocumented instruction that performs a bitwise AND operation between
 * the accumulator and an immediate value. After the AND operation, if the result
 * is negative (bit 7 set), the carry flag is set; otherwise it is cleared. This
 * instruction effectively combines AND with a carry flag update based on the sign
 * of the result. The instruction has two opcodes ($0B and $2B) that perform 
 * identical operations.
 * 
 * Flags affected:
 * - N (Negative): Set to result bit 7
 * - Z (Zero): Set if result == 0
 * - C (Carry): Set if result is negative (bit 7 set), cleared otherwise
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch immediate operand, increment PC, perform AND and set flags
 * 
 * Addressing mode: Immediate - 2 bytes
 * Alternative names: ANC
 */
function aacImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.a = cpu.a & value;
  cpu.setZeroAndNegativeFlags(cpu.a);
  
  // Set carry flag if result is negative (bit 7 set)
  if (cpu.a & 0x80) {
    cpu.p |= FlagSetMask6510.C;
  } else {
    cpu.p &= ~FlagSetMask6510.C;
  }
}

/**
 * TOP - Triple NOP (Absolute) - Opcode: $0C
 * 
 * Operation: No operation (reads absolute address but ignores value)
 * 
 * Description:
 * TOP is an undocumented instruction that performs no operation but takes
 * 3 bytes and extra cycles compared to regular NOP. It reads a 16-bit absolute
 * address and then reads from that address but discards the value. This
 * instruction is useful for timing delays or as padding in code where a 3-byte
 * NOP is needed.
 * 
 * Flags affected: None
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch address low byte, increment PC
 * - Cycle 3: Fetch address high byte, increment PC
 * - Cycle 4: Read from address (value discarded)
 * 
 * Addressing mode: Absolute - 3 bytes
 * Alternative names: NOP, SKW
 */
function topAbs(cpu: M6510Cpu): void {
  // Read the 16-bit address
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  
  // Read from the address but don't use the value (same as other abs instructions)
  cpu.readMemory(address);
}

/**
 * ORA - Bitwise OR - Opcode: $0D (Absolute)
 * 
 * Operation: A = A | M
 * 
 * Description:
 * Performs a bitwise OR between the accumulator and the value at the
 * absolute memory location. Each bit position in the accumulator is ORed
 * with the corresponding bit in the memory value. The result is stored
 * in the accumulator.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Fetch value from address and perform OR
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function oraAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemory(address);
  cpu.a = cpu.a | value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * ASL - Arithmetic Shift Left - Opcode: $0E (Absolute)
 * 
 * Operation: C = M[7]; M = M << 1; M[0] = 0
 * 
 * Description:
 * Shifts the value at the absolute memory location one bit to the left.
 * Bit 7 is shifted into the carry flag, and bit 0 is filled with zero.
 * This performs a multiplication by 2 on the memory value.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 7 before shifting
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from address
 * - Cycle 5: Internal operation, perform shift
 * - Cycle 6: Write shifted value back to address
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function aslAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const originalValue = cpu.readMemory(address);
  cpu.incrementTacts(); // Internal operation cycle
  const shiftedValue = (originalValue << 1) & 0xff;
  cpu.writeMemory(address, shiftedValue);
  cpu.setAslFlags(originalValue, shiftedValue);
}

/**
 * SLO - Shift Left then OR - Opcode: $0F (Absolute) - Undocumented
 * 
 * Operation: M = M << 1; A = A | M
 * 
 * Description:
 * SLO is an undocumented instruction that combines ASL and ORA operations.
 * It first performs an arithmetic shift left on the memory byte at the
 * absolute address (bit 7 → carry, bit 0 ← 0), then ORs the shifted result
 * with the accumulator. This instruction always takes 6 cycles.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 7 before shifting
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from address
 * - Cycle 5: Internal operation, perform shift and OR
 * - Cycle 6: Write shifted value back to address
 * 
 * Addressing mode: Absolute - 3 bytes
 * Alternative names: ASO
 */
function sloAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const originalValue = cpu.readMemory(address);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const shiftedValue = (originalValue << 1) & 0xFF;
  cpu.writeMemory(address, shiftedValue);
  // Set ASL flags first
  cpu.setAslFlags(originalValue, shiftedValue);
  // Then OR with accumulator
  cpu.a = cpu.a | shiftedValue;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * BPL - Branch if Plus - Opcode: $10
 * 
 * Operation: PC = PC + 2 + memory (signed) if N = 0
 * 
 * Description:
 * BPL branches to a nearby location if the negative flag is clear (result is
 * positive or zero). The branch offset is a signed 8-bit value with range
 * [-128, 127] relative to the instruction following the branch. All instructions
 * that modify A, X, or Y set or clear the negative flag based on bit 7.
 * 
 * Flags affected: None
 * 
 * Timing: 2 cycles (3 if branch taken, 4 if page crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch branch offset, increment PC, check condition
 * - Cycle 3: Add offset to PC if branch taken
 * - Cycle 4: Fix PC high byte if page boundary crossed
 * 
 * Addressing mode: Relative - 2 bytes
 */
function bpl(cpu: M6510Cpu): void {
  cpu.performBranch(!cpu.isNFlagSet());
}

/**
 * ORA - Bitwise OR (Indirect),Y - Opcode: $11
 * 
 * Operation: A = A | memory
 * 
 * Description:
 * ORA performs a bitwise OR operation between the accumulator and a memory value
 * using indirect indexed addressing. The zero page address points to a 16-bit
 * base address, then Y is added to form the effective address. If either input
 * bit is 1, the resulting bit is 1; otherwise it is 0.
 * 
 * Flags affected:
 * - N (Negative): Set to result bit 7
 * - Z (Zero): Set if result == 0
 * 
 * Timing: 5 cycles (6 if page crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address, increment PC
 * - Cycle 3: Fetch base address low byte from zero page
 * - Cycle 4: Fetch base address high byte from zero page+1
 * - Cycle 5: Fetch operand from base address+Y, perform OR
 * - Cycle 6: Extra cycle if page boundary crossed when adding Y
 * 
 * Addressing mode: (Indirect),Y - 2 bytes
 */
function oraIndY(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const low = cpu.readMemory(zpAddress);
  const high = cpu.readMemory((zpAddress + 1) & 0xff);
  const address = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(address, cpu.y);
  cpu.a = cpu.a | value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * SLO - Shift Left then OR (Indirect),Y - Opcode: $13
 * 
 * Operation: memory = memory << 1, A = A | memory
 * 
 * Description:
 * SLO is an undocumented instruction that performs two operations in sequence:
 * first it shifts the memory value left by one bit (same as ASL), then it
 * performs a bitwise OR between the accumulator and the shifted memory value.
 * This is a read-modify-write instruction using indirect indexed addressing.
 * 
 * Flags affected:
 * - C (Carry): Set to original memory bit 7 (from the shift operation)
 * - N (Negative): Set to result bit 7 (from the OR operation)
 * - Z (Zero): Set if result == 0 (from the OR operation)
 * 
 * Timing: 8 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address, increment PC
 * - Cycle 3: Fetch base address low byte from zero page
 * - Cycle 4: Fetch base address high byte from zero page+1
 * - Cycle 5: Check for page boundary crossing
 * - Cycle 6: Read original value from base address+Y
 * - Cycle 7: Perform shift operation (internal operation)
 * - Cycle 8: Write shifted value back, OR with accumulator
 * 
 * Addressing mode: (Indirect),Y - 2 bytes
 * Alternative names: ASO
 */
function sloIndY(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const low = cpu.readMemory(zpAddress);
  const high = cpu.readMemory((zpAddress + 1) & 0xFF);
  const baseAddress = (high << 8) | low;
  const targetAddress = (baseAddress + cpu.y) & 0xFFFF;
  cpu.incrementTacts(); // Page boundary check for read
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const shiftedValue = (originalValue << 1) & 0xFF;
  cpu.writeMemory(targetAddress, shiftedValue);
  // Set ASL flags first
  cpu.setAslFlags(originalValue, shiftedValue);
  // Then OR with accumulator
  cpu.a = cpu.a | shiftedValue;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * DOP - Double NOP (Zero Page,X) - Opcode: $14, $34, $54, $74, $D4, $F4 - Undocumented
 * 
 * Operation: No operation (reads zero page address but ignores value)
 * 
 * Description:
 * DOP is an undocumented instruction that performs no operation but takes
 * 2 bytes and extra cycles compared to regular NOP. It reads a zero page
 * address as its operand, adds X to it, but discards the value. This instruction
 * is useful for timing delays or as padding in code where a 2-byte NOP with
 * indexed addressing timing is needed.
 * 
 * Flags affected: None
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address, increment PC
 * - Cycle 3: Add X to address (internal operation)
 * - Cycle 4: Internal operation (no memory access)
 * 
 * Addressing mode: Zero Page,X - 2 bytes
 * Alternative names: NOP, SKB
 */
function dopZpX(cpu: M6510Cpu): void {
  cpu.readMemory(cpu.pc++); // Read and discard the zero page address
  cpu.incrementTacts(); // Extra cycle for indexed addressing
  cpu.incrementTacts(); // Extra cycle for zero page access (but no actual memory access)
}

/**
 * ORA - Bitwise OR - Opcode: $15 (Zero Page,X)
 * 
 * Operation: A = A | M
 * 
 * Description:
 * Performs a bitwise OR between the accumulator and the value at the
 * zero page memory location indexed by the X register. The effective address
 * is calculated by adding X to the zero page base address, wrapping around
 * within the zero page (result is masked with 0xFF).
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page base address
 * - Cycle 3: Add X to base address (internal operation)
 * - Cycle 4: Fetch value from (base + X) & 0xFF and perform OR
 * 
 * Addressing mode: Zero Page,X - 2 bytes
 */
function oraZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts();
  const address = (zpAddress + cpu.x) & 0xff;
  const value = cpu.readMemory(address);
  cpu.a = cpu.a | value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * ASL - Arithmetic Shift Left - Opcode: $16 (Zero Page,X)
 * 
 * Operation: C = M[7]; M = M << 1; M[0] = 0
 * 
 * Description:
 * Shifts the value at the zero page memory location indexed by X one bit to
 * the left. The effective address is calculated by adding X to the zero page
 * base address, wrapping around within the zero page. Bit 7 is shifted into
 * the carry flag, and bit 0 is filled with zero.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 7 before shifting
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page base address
 * - Cycle 3: Add X to base address (internal operation)
 * - Cycle 4: Read value from (base + X) & 0xFF
 * - Cycle 5: Internal operation, perform shift
 * - Cycle 6: Write shifted value back to address
 * 
 * Addressing mode: Zero Page,X - 2 bytes
 */
function aslZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts();
  const address = (zpAddress + cpu.x) & 0xff;
  const originalValue = cpu.readMemory(address);
  cpu.incrementTacts(); // Internal operation cycle
  const shiftedValue = (originalValue << 1) & 0xff;
  cpu.writeMemory(address, shiftedValue);
  cpu.setAslFlags(originalValue, shiftedValue);
}

/**
 * SLO - Shift Left then OR - Opcode: $17 (Zero Page,X) - Undocumented
 * 
 * Operation: M = M << 1; A = A | M
 * 
 * Description:
 * SLO is an undocumented instruction that combines ASL and ORA operations.
 * It first performs an arithmetic shift left on the zero page memory location
 * indexed by X (bit 7 → carry, bit 0 ← 0), then ORs the shifted result with
 * the accumulator. The effective address wraps around within the zero page.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 7 before shifting
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page base address
 * - Cycle 3: Add X to base address (internal operation)
 * - Cycle 4: Read value from (base + X) & 0xFF
 * - Cycle 5: Internal operation, perform shift and OR
 * - Cycle 6: Write shifted value back to address
 * 
 * Addressing mode: Zero Page,X - 2 bytes
 * Alternative names: ASO
 */
function sloZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const address = (zpAddress + cpu.x) & 0xFF; // Wrap around in zero page
  const originalValue = cpu.readMemory(address);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const shiftedValue = (originalValue << 1) & 0xFF;
  cpu.writeMemory(address, shiftedValue);
  // Set ASL flags first
  cpu.setAslFlags(originalValue, shiftedValue);
  // Then OR with accumulator
  cpu.a = cpu.a | shiftedValue;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * CLC - Clear Carry - Opcode: $18
 * 
 * Operation: C = 0
 * 
 * Description:
 * CLC clears the carry flag to 0. This is typically done before adding the
 * low byte of a multi-byte value with ADC to ensure the carry flag is in a
 * known state and doesn't add an unwanted extra 1 to the result.
 * 
 * Flags affected:
 * - C (Carry): Set to 0
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation, clear carry flag
 * 
 * Addressing mode: Implied - 1 byte
 */
function clc(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.p &= ~FlagSetMask6510.C;
}

/**
 * ORA - Bitwise OR (Absolute,Y) - Opcode: $19
 * 
 * Operation: A = A | memory
 * 
 * Description:
 * ORA performs a bitwise OR operation between the accumulator and a memory value
 * using absolute indexed addressing with the Y register. If either input bit is
 * 1, the resulting bit is 1; otherwise it is 0. An extra cycle is added if the
 * Y index causes a page boundary crossing.
 * 
 * Flags affected:
 * - N (Negative): Set to result bit 7
 * - Z (Zero): Set if result == 0
 * 
 * Timing: 4 cycles (5 if page crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch address low byte, increment PC
 * - Cycle 3: Fetch address high byte, increment PC
 * - Cycle 4: Fetch operand from address+Y, perform OR
 * - Cycle 5: Extra cycle if page boundary crossed when adding Y
 * 
 * Addressing mode: Absolute,Y - 3 bytes
 */
function oraAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(address, cpu.y);
  cpu.a = cpu.a | value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * ILLEGAL - Illegal Opcode - Opcodes: $1A, $3A, $5A, $7A, $DA, $FA
 * 
 * Operation: No operation (behaves like NOP)
 * 
 * Description:
 * ILLEGAL represents undocumented opcodes that behave like single-byte NOP
 * instructions. These opcodes perform no operation and simply advance the
 * program counter. In this implementation, they are treated as placeholders
 * for potential future functionality or debugging purposes.
 * 
 * Flags affected: None
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation (no effect)
 * 
 * Addressing mode: Implied - 1 byte
 * Alternative names: NOP
 */
function illegal(_cpu: M6510Cpu): void {
  // TODO: Handle illegal opcodes
}

/**
 * SLO - Shift Left then OR - Opcode: $1B (Absolute,Y) - Undocumented
 * 
 * Operation: M = M << 1; A = A | M
 * 
 * Description:
 * SLO is an undocumented instruction that combines ASL and ORA operations.
 * It first performs an arithmetic shift left on the absolute memory location
 * indexed by Y (bit 7 → carry, bit 0 ← 0), then ORs the shifted result with
 * the accumulator. Always takes an extra cycle for indexed addressing.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 7 before shifting
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 7 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of base address
 * - Cycle 3: Fetch high byte of base address
 * - Cycle 4: Add Y to base address (internal operation)
 * - Cycle 5: Read value from (base + Y)
 * - Cycle 6: Internal operation, perform shift and OR
 * - Cycle 7: Write shifted value back to address
 * 
 * Addressing mode: Absolute,Y - 3 bytes
 */
function sloAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const targetAddress = (baseAddress + cpu.y) & 0xFFFF;
  cpu.incrementTacts(); // Page boundary check for read
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const shiftedValue = (originalValue << 1) & 0xFF;
  cpu.writeMemory(targetAddress, shiftedValue);
  // Set ASL flags first
  cpu.setAslFlags(originalValue, shiftedValue);
  // Then OR with accumulator
  cpu.a = cpu.a | shiftedValue;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * TOP - Triple NOP - Opcode: $1C (Absolute,X) - Undocumented
 * 
 * Operation: None (dummy read)
 * 
 * Description:
 * TOP is an undocumented instruction that performs a "triple NOP" operation.
 * It reads from the absolute address indexed by X but does not modify any
 * registers or memory. The read is performed to maintain the proper timing
 * behavior, making it a 3-byte, 4-cycle NOP instruction. If the index crosses
 * a page boundary, an additional cycle is used.
 * 
 * Flags affected: None
 * 
 * Timing: 4+ cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Dummy read from (address + X)
 * - +1 cycle if page boundary crossed
 * 
 * Addressing mode: Absolute,X - 3 bytes
 * Alternative names: NOP
 */
function topAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  
  // Use the same pattern as other abs,X instructions - this handles page boundary automatically
  cpu.readMemoryWithPageBoundary(address, cpu.x);
}

/**
 * ORA - Bitwise OR with Accumulator - Opcode: $1D (Absolute,X)
 * 
 * Operation: A = A | M
 * 
 * Description:
 * Performs a bitwise OR operation between the accumulator and a byte read
 * from the absolute memory address indexed by the X register. The result
 * is stored in the accumulator. If the index crosses a page boundary,
 * an additional cycle is used.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 4+ cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from (address + X)
 * - +1 cycle if page boundary crossed
 * 
 * Addressing mode: Absolute,X - 3 bytes
 */
function oraAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(address, cpu.x);
  cpu.a = cpu.a | value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * ASL - Arithmetic Shift Left - Opcode: $1E (Absolute,X)
 * 
 * Operation: C = M[7]; M = M << 1
 * 
 * Description:
 * Shifts the memory byte at the absolute address indexed by X one bit to the left.
 * Bit 7 is shifted into the carry flag, and bit 0 is cleared. This instruction
 * always takes 7 cycles regardless of page boundary crossing.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 7 before shifting
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 7 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Extra cycle for indexed addressing
 * - Cycle 5: Read value from (address + X)
 * - Cycle 6: Internal operation, perform shift
 * - Cycle 7: Write shifted value back to address
 * 
 * Addressing mode: Absolute,X - 3 bytes
 */
function aslAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  cpu.incrementTacts(); // Extra cycle for indexed addressing
  const effectiveAddress = (address + cpu.x) & 0xffff;
  const originalValue = cpu.readMemory(effectiveAddress);
  cpu.incrementTacts(); // Internal operation cycle
  const shiftedValue = (originalValue << 1) & 0xff;
  cpu.writeMemory(effectiveAddress, shiftedValue);
  cpu.setAslFlags(originalValue, shiftedValue);
}

/**
 * SLO - Shift Left then OR - Opcode: $1F (Absolute,X) - Undocumented
 * 
 * Operation: M = M << 1; A = A | M
 * 
 * Description:
 * SLO is an undocumented instruction that combines ASL and ORA operations.
 * It first performs an arithmetic shift left on the memory byte at the
 * absolute address indexed by X (bit 7 → carry, bit 0 ← 0), then ORs
 * the shifted result with the accumulator. Always takes 7 cycles.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 7 before shifting
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 7 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Page boundary check for read
 * - Cycle 5: Read value from (address + X)
 * - Cycle 6: Internal operation, perform shift and OR
 * - Cycle 7: Write shifted value back to address
 * 
 * Addressing mode: Absolute,X - 3 bytes
 * Alternative names: ASO
 */
function sloAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const targetAddress = (baseAddress + cpu.x) & 0xFFFF;
  cpu.incrementTacts(); // Page boundary check for read
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const shiftedValue = (originalValue << 1) & 0xFF;
  cpu.writeMemory(targetAddress, shiftedValue);
  // Set ASL flags first
  cpu.setAslFlags(originalValue, shiftedValue);
  // Then OR with accumulator
  cpu.a = cpu.a | shiftedValue;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * JSR - Jump to Subroutine - Opcode: $20
 * 
 * Operation: push PC+2 to stack, PC = memory
 * 
 * Description:
 * JSR pushes the return address (current PC - 1) onto the stack and then sets
 * the program counter to the target address. This allows calling a subroutine
 * and returning with RTS. The return address pushed is actually PC - 1, not
 * the exact next instruction address, because RTS increments PC before the
 * next instruction fetch.
 * 
 * Flags affected: None
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch target address low byte, increment PC
 * - Cycle 3: Fetch target address high byte, increment PC
 * - Cycle 4: Internal operation
 * - Cycle 5: Push return address high byte to stack
 * - Cycle 6: Push return address low byte to stack, jump to target
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function jsr(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const targetAddress = (high << 8) | low;
  
  // Push return address - 1 onto stack (JSR pushes PC - 1)
  const returnAddress = cpu.pc - 1;
  cpu.incrementTacts(); // Internal operation cycle
  cpu.pushStack((returnAddress >> 8) & 0xFF); // Push high byte
  cpu.pushStack(returnAddress & 0xFF); // Push low byte
  
  // Jump to target address
  cpu.pc = targetAddress;
}

/**
 * AND - Bitwise AND with Accumulator - Opcode: $21 ((Indirect,X))
 * 
 * Operation: A = A & M
 * 
 * Description:
 * Performs a bitwise AND operation between the accumulator and a byte read
 * from memory using indexed indirect addressing. The zero page address is
 * indexed by X, then the contents of that address pair form the target
 * address. All arithmetic wraps within the zero page.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add X to address (internal operation)
 * - Cycle 4: Read low byte of target address from (zp + X)
 * - Cycle 5: Read high byte of target address from (zp + X + 1)
 * - Cycle 6: Read value from target address and perform AND
 * 
 * Addressing mode: (Indirect,X) - 2 bytes
 */
function andIndX(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const effectiveAddress = (zeroPageAddress + cpu.x) & 0xFF; // Wrap around in zero page
  cpu.incrementTacts();
  const low = cpu.readMemory(effectiveAddress);
  const high = cpu.readMemory((effectiveAddress + 1) & 0xFF); // Handle wrap-around for high byte too
  const targetAddress = (high << 8) | low;
  const value = cpu.readMemory(targetAddress);
  cpu.a = cpu.a & value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * RLA - Rotate Left then AND - Opcode: $23 ((Indirect,X)) - Undocumented
 * 
 * Operation: M = (M << 1) | C; A = A & M
 * 
 * Description:
 * RLA is an undocumented instruction that combines ROL and AND operations.
 * It first performs a rotate left on the memory byte at the address specified
 * by indexed indirect addressing (carry → bit 0, bit 7 → carry), then ANDs
 * the rotated result with the accumulator. Zero page arithmetic wraps around.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 7 before rotation
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 8 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add X to address (internal operation)
 * - Cycle 4: Read low byte of target address from (zp + X)
 * - Cycle 5: Read high byte of target address from (zp + X + 1)
 * - Cycle 6: Read value from target address
 * - Cycle 7: Internal operation, perform rotation and AND
 * - Cycle 8: Write rotated value back to target address
 * 
 * Addressing mode: (Indirect,X) - 2 bytes
 */
function rlaIndX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const indirectAddress = (zpAddress + cpu.x) & 0xFF; // Wrap around in zero page
  const targetLow = cpu.readMemory(indirectAddress);
  const targetHigh = cpu.readMemory((indirectAddress + 1) & 0xFF); // Wrap around
  const targetAddress = (targetHigh << 8) | targetLow;
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const carryIn = cpu.isCFlagSet() ? 1 : 0;
  const rotatedValue = ((originalValue << 1) | carryIn) & 0xFF;
  cpu.writeMemory(targetAddress, rotatedValue);
  // Set ROL flags first
  cpu.setRolFlags(originalValue, rotatedValue);
  // Then AND with accumulator
  cpu.a = cpu.a & rotatedValue;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * BIT - Bit Test - Opcode: $24 (Zero Page)
 * 
 * Operation: A & M (result discarded)
 * 
 * Description:
 * Tests bits in the memory location against the accumulator. The AND result
 * is not stored but only affects the flags. Bit 7 and bit 6 of the memory
 * value are copied directly to the N and V flags respectively, while the
 * Z flag reflects whether the AND result is zero.
 * 
 * Flags affected:
 * - Z (Zero): Set if (A & M) is zero, cleared otherwise
 * - V (Overflow): Set to bit 6 of memory value
 * - N (Negative): Set to bit 7 of memory value
 * 
 * Timing: 3 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read value from zero page address and test bits
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function bitZp(cpu: M6510Cpu): void {
  const address = cpu.readMemory(cpu.pc++);
  const value = cpu.readMemory(address);
  cpu.setBitFlags(cpu.a, value);
}

/**
 * AND - Bitwise AND with Accumulator - Opcode: $25 (Zero Page)
 * 
 * Operation: A = A & M
 * 
 * Description:
 * Performs a bitwise AND operation between the accumulator and a byte read
 * from a zero page memory location. The result is stored in the accumulator.
 * This is the fastest addressing mode for AND operations.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 3 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read value from zero page address and perform AND
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function andZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const value = cpu.readMemory(zpAddress);
  cpu.a = cpu.a & value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * ROL - Rotate Left - Opcode: $26 (Zero Page)
 * 
 * Operation: C = M[7]; M = (M << 1) | C
 * 
 * Description:
 * Rotates the memory byte at the zero page address one bit to the left.
 * Bit 7 is shifted into the carry flag, and the previous carry flag value
 * is shifted into bit 0. This is a 9-bit rotation through the carry flag.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 7 before rotation
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 5 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read value from zero page address
 * - Cycle 4: Internal operation, perform rotation
 * - Cycle 5: Write rotated value back to address
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function rolZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const originalValue = cpu.readMemory(zpAddress);
  cpu.incrementTacts(); // Internal operation cycle
  const carryIn = cpu.isCFlagSet() ? 1 : 0;
  const rotatedValue = ((originalValue << 1) | carryIn) & 0xff;
  cpu.writeMemory(zpAddress, rotatedValue);
  cpu.setRolFlags(originalValue, rotatedValue);
}

/**
 * RLA - Rotate Left then AND - Opcode: $27 (Zero Page) - Undocumented
 * 
 * Operation: M = (M << 1) | C; A = A & M
 * 
 * Description:
 * RLA is an undocumented instruction that combines ROL and AND operations.
 * It first performs a rotate left on the memory byte at the zero page address
 * (carry → bit 0, bit 7 → carry), then ANDs the rotated result with the
 * accumulator. This is a 9-bit rotation through the carry flag.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 7 before rotation
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 5 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read value from zero page address
 * - Cycle 4: Internal operation, perform rotation and AND
 * - Cycle 5: Write rotated value back to address
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function rlaZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const originalValue = cpu.readMemory(zpAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const carryIn = cpu.isCFlagSet() ? 1 : 0;
  const rotatedValue = ((originalValue << 1) | carryIn) & 0xFF;
  cpu.writeMemory(zpAddress, rotatedValue);
  // Set ROL flags first
  cpu.setRolFlags(originalValue, rotatedValue);
  // Then AND with accumulator
  cpu.a = cpu.a & rotatedValue;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * PLP - Pull Processor Status from Stack - Opcode: $28
 * 
 * Operation: P = stack
 * 
 * Description:
 * Pulls the processor status register from the stack. The B flag (break flag)
 * is ignored from the pulled value and the UNUSED flag (bit 5) is always set.
 * This instruction is typically used to restore the processor status after
 * an interrupt or subroutine that saved it with PHP.
 * 
 * Flags affected: All except B flag
 * - C, Z, I, D, V, N flags are restored from stack
 * - B flag remains unchanged (ignored from stack)
 * - UNUSED flag (bit 5) is always set
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation
 * - Cycle 3: Internal operation
 * - Cycle 4: Pull status register from stack
 * 
 * Addressing mode: Implied - 1 byte
 */
function plp(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle 1
  cpu.incrementTacts(); // Internal operation cycle 2
  const pulledStatus = cpu.pullStack();
  // When PLP pulls the status register, ignore the B flag from the stack
  // and always set the UNUSED flag (bit 5)
  cpu.p = (pulledStatus & ~FlagSetMask6510.B) | FlagSetMask6510.UNUSED;
}

/**
 * AND - Bitwise AND with Accumulator - Opcode: $29 (Immediate)
 * 
 * Operation: A = A & M
 * 
 * Description:
 * Performs a bitwise AND operation between the accumulator and an immediate
 * value. The result is stored in the accumulator. This is the fastest form
 * of the AND instruction since the operand is immediately available.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch immediate value and perform AND
 * 
 * Addressing mode: Immediate - 2 bytes
 */
function andImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.a = cpu.a & value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * ROL - Rotate Left - Opcode: $2A (Accumulator)
 * 
 * Operation: C = A[7]; A = (A << 1) | C
 * 
 * Description:
 * Rotates the accumulator one bit to the left. Bit 7 is shifted into the
 * carry flag, and the previous carry flag value is shifted into bit 0.
 * This is a 9-bit rotation through the carry flag.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 7 before rotation
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation, perform rotation
 * 
 * Addressing mode: Accumulator - 1 byte
 */
function rolA(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  const originalValue = cpu.a;
  const carryIn = cpu.isCFlagSet() ? 1 : 0;
  const rotatedValue = ((cpu.a << 1) | carryIn) & 0xff;
  cpu.a = rotatedValue;
  cpu.setRolFlags(originalValue, rotatedValue);
}

/**
 * BIT - Bit Test - Opcode: $2C (Absolute)
 * 
 * Operation: A & M (result discarded)
 * 
 * Description:
 * Tests bits in the memory location at the absolute address against the
 * accumulator. The AND result is not stored but only affects the flags.
 * Bit 7 and bit 6 of the memory value are copied directly to the N and V
 * flags respectively, while the Z flag reflects whether the AND result is zero.
 * 
 * Flags affected:
 * - Z (Zero): Set if (A & M) is zero, cleared otherwise
 * - V (Overflow): Set to bit 6 of memory value
 * - N (Negative): Set to bit 7 of memory value
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from address and test bits
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function bitAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemory(address);
  cpu.setBitFlags(cpu.a, value);
}

/**
 * AND - Bitwise AND with Accumulator - Opcode: $2D (Absolute)
 * 
 * Operation: A = A & M
 * 
 * Description:
 * Performs a bitwise AND operation between the accumulator and a byte read
 * from an absolute memory address. The result is stored in the accumulator.
 * This addressing mode can access any location in the 64KB address space.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from address and perform AND
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function andAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemory(address);
  cpu.a = cpu.a & value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * ROL - Rotate Left - Opcode: $2E (Absolute)
 * 
 * Operation: C = M[7]; M = (M << 1) | C
 * 
 * Description:
 * Rotates the memory byte at the absolute address one bit to the left.
 * Bit 7 is shifted into the carry flag, and the previous carry flag value
 * is shifted into bit 0. This is a 9-bit rotation through the carry flag.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 7 before rotation
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from address
 * - Cycle 5: Internal operation, perform rotation
 * - Cycle 6: Write rotated value back to address
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function rolAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const originalValue = cpu.readMemory(address);
  cpu.incrementTacts(); // Internal operation cycle
  const carryIn = cpu.isCFlagSet() ? 1 : 0;
  const rotatedValue = ((originalValue << 1) | carryIn) & 0xff;
  cpu.writeMemory(address, rotatedValue);
  cpu.setRolFlags(originalValue, rotatedValue);
}

/**
 * RLA - Rotate Left then AND - Opcode: $2F (Absolute) - Undocumented
 * 
 * Operation: M = (M << 1) | C; A = A & M
 * 
 * Description:
 * RLA is an undocumented instruction that combines ROL and AND operations.
 * It first performs a rotate left on the memory byte at the absolute address
 * (carry → bit 0, bit 7 → carry), then ANDs the rotated result with the
 * accumulator. This is a 9-bit rotation through the carry flag.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 7 before rotation
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from address
 * - Cycle 5: Internal operation, perform rotation and AND
 * - Cycle 6: Write rotated value back to address
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function rlaAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const originalValue = cpu.readMemory(address);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const carryIn = cpu.isCFlagSet() ? 1 : 0;
  const rotatedValue = ((originalValue << 1) | carryIn) & 0xFF;
  cpu.writeMemory(address, rotatedValue);
  // Set ROL flags first
  cpu.setRolFlags(originalValue, rotatedValue);
  // Then AND with accumulator
  cpu.a = cpu.a & rotatedValue;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * BMI - Branch if Minus - Opcode: $30
 * 
 * Operation: PC = PC + 2 + memory (signed) if N = 1
 * 
 * Description:
 * BMI branches to a nearby location if the negative flag is set (result is
 * negative). The branch offset is a signed 8-bit value with range [-128, 127]
 * relative to the instruction following the branch. All instructions that
 * modify A, X, or Y set or clear the negative flag based on bit 7 (sign bit).
 * 
 * Flags affected: None
 * 
 * Timing: 2 cycles (3 if branch taken, 4 if page crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch branch offset, increment PC, check condition
 * - Cycle 3: Add offset to PC if branch taken
 * - Cycle 4: Fix PC high byte if page boundary crossed
 * 
 * Addressing mode: Relative - 2 bytes
 */
function bmi(cpu: M6510Cpu): void {
  cpu.performBranch(cpu.isNFlagSet());
}

/**
 * AND - Bitwise AND with Accumulator - Opcode: $31 ((Indirect),Y)
 * 
 * Operation: A = A & M
 * 
 * Description:
 * Performs a bitwise AND operation between the accumulator and a byte read
 * from memory using indirect indexed addressing. The zero page address
 * contains a pointer which is indexed by Y to form the effective address.
 * If indexing crosses a page boundary, an additional cycle is used.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 5+ cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read low byte of base address from zero page
 * - Cycle 4: Read high byte of base address from zero page + 1
 * - Cycle 5: Read value from (base address + Y) and perform AND
 * - +1 cycle if page boundary crossed
 * 
 * Addressing mode: (Indirect),Y - 2 bytes
 */
function andIndY(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const low = cpu.readMemory(zeroPageAddress);
  const high = cpu.readMemory((zeroPageAddress + 1) & 0xFF); // Handle zero page wrap-around
  const baseAddress = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(baseAddress, cpu.y);
  cpu.a = cpu.a & value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * RLA - Rotate Left then AND - Opcode: $33 ((Indirect),Y) - Undocumented
 * 
 * Operation: M = (M << 1) | C; A = A & M
 * 
 * Description:
 * RLA is an undocumented instruction that combines ROL and AND operations.
 * It first performs a rotate left on the memory byte at the address specified
 * by indirect indexed addressing (carry → bit 0, bit 7 → carry), then ANDs
 * the rotated result with the accumulator. Always takes 8 cycles.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 7 before rotation
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 8 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read low byte of base address from zero page
 * - Cycle 4: Read high byte of base address from zero page + 1
 * - Cycle 5: Read value from (base address + Y)
 * - Cycle 6: Internal operation, perform rotation and AND
 * - Cycle 7: Write rotated value back to address
 * - Cycle 8: Page boundary check
 * 
 * Addressing mode: (Indirect),Y - 2 bytes
 */
function rlaIndY(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const low = cpu.readMemory(zpAddress);
  const high = cpu.readMemory((zpAddress + 1) & 0xFF);
  const baseAddress = (high << 8) | low;
  const targetAddress = (baseAddress + cpu.y) & 0xFFFF;
  cpu.incrementTacts(); // Page boundary check for read
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const carryIn = cpu.isCFlagSet() ? 1 : 0;
  const rotatedValue = ((originalValue << 1) | carryIn) & 0xFF;
  cpu.writeMemory(targetAddress, rotatedValue);
  // Set ROL flags first
  cpu.setRolFlags(originalValue, rotatedValue);
  // Then AND with accumulator
  cpu.a = cpu.a & rotatedValue;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * AND - Bitwise AND with Accumulator - Opcode: $35 (Zero Page,X)
 * 
 * Operation: A = A & M
 * 
 * Description:
 * Performs a bitwise AND operation between the accumulator and a byte read
 * from a zero page memory location indexed by the X register. The effective
 * address wraps around within the zero page (addresses $00-$FF).
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page base address
 * - Cycle 3: Add X to base address (internal operation)
 * - Cycle 4: Read value from (base + X) & 0xFF and perform AND
 * 
 * Addressing mode: Zero Page,X - 2 bytes
 */
function andZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Increment tacts for indexed addressing
  const value = cpu.readMemory((zpAddress + cpu.x) & 0xFF); // Wrap around in zero page
  cpu.a = cpu.a & value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * ROL - Rotate Left - Opcode: $36 (Zero Page,X)
 * 
 * Operation: C = M[7]; M = (M << 1) | C
 * 
 * Description:
 * Rotates the memory byte at the zero page address indexed by X one bit to
 * the left. Bit 7 is shifted into the carry flag, and the previous carry
 * flag value is shifted into bit 0. This is a 9-bit rotation through the
 * carry flag. The effective address wraps around within the zero page.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 7 before rotation
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page base address
 * - Cycle 3: Add X to base address (internal operation)
 * - Cycle 4: Read value from (base + X) & 0xFF
 * - Cycle 5: Internal operation, perform rotation
 * - Cycle 6: Write rotated value back to address
 * 
 * Addressing mode: Zero Page,X - 2 bytes
 */
function rolZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts();
  const address = (zpAddress + cpu.x) & 0xff;
  const originalValue = cpu.readMemory(address);
  cpu.incrementTacts(); // Internal operation cycle
  const carryIn = cpu.isCFlagSet() ? 1 : 0;
  const rotatedValue = ((originalValue << 1) | carryIn) & 0xff;
  cpu.writeMemory(address, rotatedValue);
  cpu.setRolFlags(originalValue, rotatedValue);
}

/**
 * RLA - Rotate Left then AND - Opcode: $37 (Zero Page,X) - Undocumented
 * 
 * Operation: M = (M << 1) | C; A = A & M
 * 
 * Description:
 * RLA is an undocumented instruction that combines ROL and AND operations.
 * It first performs a rotate left on the memory byte at the zero page address
 * indexed by X (carry → bit 0, bit 7 → carry), then ANDs the rotated result
 * with the accumulator. The effective address wraps around within the zero page.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 7 before rotation
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page base address
 * - Cycle 3: Add X to base address (internal operation)
 * - Cycle 4: Read value from (base + X) & 0xFF
 * - Cycle 5: Internal operation, perform rotation and AND
 * - Cycle 6: Write rotated value back to address
 * 
 * Addressing mode: Zero Page,X - 2 bytes
 */
function rlaZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const address = (zpAddress + cpu.x) & 0xFF; // Wrap around in zero page
  const originalValue = cpu.readMemory(address);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const carryIn = cpu.isCFlagSet() ? 1 : 0;
  const rotatedValue = ((originalValue << 1) | carryIn) & 0xFF;
  cpu.writeMemory(address, rotatedValue);
  // Set ROL flags first
  cpu.setRolFlags(originalValue, rotatedValue);
  // Then AND with accumulator
  cpu.a = cpu.a & rotatedValue;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * SEC - Set Carry - Opcode: $38
 * 
 * Operation: C = 1
 * 
 * Description:
 * SEC sets the carry flag to 1. This is typically done before subtracting the
 * low byte of a multi-byte value with SBC to ensure the carry flag is in a
 * known state and doesn't subtract an unwanted extra 1 from the result (since
 * SBC subtracts the complement of carry).
 * 
 * Flags affected:
 * - C (Carry): Set to 1
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation, set carry flag
 * 
 * Addressing mode: Implied - 1 byte
 */
function sec(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.p |= FlagSetMask6510.C;
}

/**
 * AND - Bitwise AND with Accumulator - Opcode: $39 (Absolute,Y)
 * 
 * Operation: A = A & M
 * 
 * Description:
 * Performs a bitwise AND operation between the accumulator and a byte read
 * from the absolute memory address indexed by the Y register. The result
 * is stored in the accumulator. If the index crosses a page boundary,
 * an additional cycle is used.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 4+ cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from (address + Y) and perform AND
 * - +1 cycle if page boundary crossed
 * 
 * Addressing mode: Absolute,Y - 3 bytes
 */
function andAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(address, cpu.y);
  cpu.a = cpu.a & value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * RLA - Rotate Left then AND - Opcode: $3B (Absolute,Y) - Undocumented
 * 
 * Operation: M = (M << 1) | C; A = A & M
 * 
 * Description:
 * RLA is an undocumented instruction that combines ROL and AND operations.
 * It first performs a rotate left on the memory byte at the absolute address
 * indexed by Y (carry → bit 0, bit 7 → carry), then ANDs the rotated result
 * with the accumulator. Always takes 7 cycles.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 7 before rotation
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 7 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from (address + Y)
 * - Cycle 5: Internal operation, perform rotation and AND
 * - Cycle 6: Write rotated value back to address
 * - Cycle 7: Page boundary check
 * 
 * Addressing mode: Absolute,Y - 3 bytes
 */
function rlaAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const targetAddress = (baseAddress + cpu.y) & 0xFFFF;
  cpu.incrementTacts(); // Page boundary check for read
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const carryIn = cpu.isCFlagSet() ? 1 : 0;
  const rotatedValue = ((originalValue << 1) | carryIn) & 0xFF;
  cpu.writeMemory(targetAddress, rotatedValue);
  // Set ROL flags first
  cpu.setRolFlags(originalValue, rotatedValue);
  // Then AND with accumulator
  cpu.a = cpu.a & rotatedValue;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * AND - Bitwise AND with Accumulator - Opcode: $3D (Absolute,X)
 * 
 * Operation: A = A & M
 * 
 * Description:
 * Performs a bitwise AND operation between the accumulator and a byte read
 * from the absolute memory address indexed by the X register. The result
 * is stored in the accumulator. If the index crosses a page boundary,
 * an additional cycle is used.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 4+ cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from (address + X) and perform AND
 * - +1 cycle if page boundary crossed
 * 
 * Addressing mode: Absolute,X - 3 bytes
 */
function andAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(address, cpu.x);
  cpu.a = cpu.a & value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * ROL - Rotate Left - Opcode: $3E (Absolute,X)
 * 
 * Operation: C = M[7]; M = (M << 1) | C
 * 
 * Description:
 * Rotates the memory byte at the absolute address indexed by X one bit to
 * the left. Bit 7 is shifted into the carry flag, and the previous carry
 * flag value is shifted into bit 0. This is a 9-bit rotation through the
 * carry flag. Always takes 7 cycles regardless of page boundary crossing.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 7 before rotation
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 7 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Extra cycle for indexed addressing
 * - Cycle 5: Read value from (address + X)
 * - Cycle 6: Internal operation, perform rotation
 * - Cycle 7: Write rotated value back to address
 * 
 * Addressing mode: Absolute,X - 3 bytes
 */
function rolAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  cpu.incrementTacts(); // Extra cycle for indexed addressing
  const effectiveAddress = (address + cpu.x) & 0xffff;
  const originalValue = cpu.readMemory(effectiveAddress);
  cpu.incrementTacts(); // Internal operation cycle
  const carryIn = cpu.isCFlagSet() ? 1 : 0;
  const rotatedValue = ((originalValue << 1) | carryIn) & 0xff;
  cpu.writeMemory(effectiveAddress, rotatedValue);
  cpu.setRolFlags(originalValue, rotatedValue);
}

/**
 * RLA - Rotate Left then AND - Opcode: $3F (Absolute,X) - Undocumented
 * 
 * Operation: M = (M << 1) | C; A = A & M
 * 
 * Description:
 * RLA is an undocumented instruction that combines ROL and AND operations.
 * It first performs a rotate left on the memory byte at the absolute address
 * indexed by X (carry → bit 0, bit 7 → carry), then ANDs the rotated result
 * with the accumulator. Always takes 7 cycles.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 7 before rotation
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 7 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Page boundary check for read
 * - Cycle 5: Read value from (address + X)
 * - Cycle 6: Internal operation, perform rotation and AND
 * - Cycle 7: Write rotated value back to address
 * 
 * Addressing mode: Absolute,X - 3 bytes
 */
function rlaAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const targetAddress = (baseAddress + cpu.x) & 0xFFFF;
  cpu.incrementTacts(); // Page boundary check for read
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const carryIn = cpu.isCFlagSet() ? 1 : 0;
  const rotatedValue = ((originalValue << 1) | carryIn) & 0xFF;
  cpu.writeMemory(targetAddress, rotatedValue);
  // Set ROL flags first
  cpu.setRolFlags(originalValue, rotatedValue);
  // Then AND with accumulator
  cpu.a = cpu.a & rotatedValue;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * RTI - Return from Interrupt - Opcode: $40
 * 
 * Operation: pull NVxxDIZC flags from stack, pull PC from stack
 * 
 * Description:
 * RTI returns from an interrupt handler by first pulling the processor status
 * register from the stack, then pulling the program counter. The B flag from
 * the stack is ignored, and the unused flag (bit 5) is always set. Unlike RTS,
 * the return address is the exact address of the next instruction, not PC-1.
 * Changes to the interrupt disable flag take effect immediately.
 * 
 * Flags affected:
 * - C (Carry): Pulled from stack bit 0
 * - Z (Zero): Pulled from stack bit 1  
 * - I (Interrupt disable): Pulled from stack bit 2 (effect immediate)
 * - D (Decimal): Pulled from stack bit 3
 * - V (Overflow): Pulled from stack bit 6
 * - N (Negative): Pulled from stack bit 7
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation
 * - Cycle 3: Pull processor status from stack
 * - Cycle 4: Pull return address low byte from stack
 * - Cycle 5: Pull return address high byte from stack
 * - Cycle 6: Internal operation, set PC
 * 
 * Addressing mode: Implied - 1 byte
 */
function rti(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle 1
  
  // Pull processor status from stack
  const pulledStatus = cpu.pullStack();
  // When RTI pulls the status register, ignore the B flag from the stack
  // and always set the UNUSED flag (bit 5)
  cpu.p = (pulledStatus & ~FlagSetMask6510.B) | FlagSetMask6510.UNUSED;
  
  // Pull return address from stack
  const low = cpu.pullStack();
  const high = cpu.pullStack();
  cpu.pc = (high << 8) | low;
  cpu.incrementTacts(); // Internal operation cycle 2
}

/**
 * EOR - Exclusive OR - Opcode: $41 (Indexed Indirect X)
 * 
 * Operation: A = A ⊕ M
 * 
 * Description:
 * Performs a bitwise exclusive OR between the accumulator and the value at the
 * memory location addressed by indexed indirect mode. The zero page base address
 * is added to the X register to form an effective address in zero page. This
 * effective address points to the low byte of the target address, with the high
 * byte at the next location. Both pointer reads wrap around in zero page.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page base address
 * - Cycle 3: Add X to base address (internal operation)
 * - Cycle 4: Fetch low byte of target address from (base + X) & 0xFF
 * - Cycle 5: Fetch high byte of target address from (base + X + 1) & 0xFF
 * - Cycle 6: Fetch value from target address and perform EOR
 * 
 * Addressing mode: Indexed Indirect X - 2 bytes
 */
function eorIndX(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const effectiveAddress = (zeroPageAddress + cpu.x) & 0xFF; // Wrap around in zero page
  cpu.incrementTacts();
  const low = cpu.readMemory(effectiveAddress);
  const high = cpu.readMemory((effectiveAddress + 1) & 0xFF); // Handle wrap-around for high byte too
  const targetAddress = (high << 8) | low;
  const value = cpu.readMemory(targetAddress);
  cpu.a = cpu.a ^ value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * SRE - Shift Right then EOR - Opcode: $43 ((Indirect,X)) - Undocumented
 * 
 * Operation: M = M >> 1; A = A ^ M
 * 
 * Description:
 * SRE is an undocumented instruction that combines LSR and EOR operations.
 * It first performs a logical shift right on the memory byte at the address
 * specified by indexed indirect addressing (bit 0 → carry, 0 → bit 7), then
 * EORs the shifted result with the accumulator. Zero page arithmetic wraps around.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 0 before shifting
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 8 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add X to address (internal operation)
 * - Cycle 4: Read low byte of target address from (zp + X)
 * - Cycle 5: Read high byte of target address from (zp + X + 1)
 * - Cycle 6: Read value from target address
 * - Cycle 7: Internal operation, perform shift and EOR
 * - Cycle 8: Write shifted value back to target address
 * 
 * Addressing mode: (Indirect,X) - 2 bytes
 * Alternative names: LSE
 */
function sreIndX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const indirectAddress = (zpAddress + cpu.x) & 0xFF; // Wrap around in zero page
  const targetLow = cpu.readMemory(indirectAddress);
  const targetHigh = cpu.readMemory((indirectAddress + 1) & 0xFF); // Wrap around
  const targetAddress = (targetHigh << 8) | targetLow;
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const shiftedValue = originalValue >> 1;
  cpu.writeMemory(targetAddress, shiftedValue);
  // Set LSR flags first
  cpu.setLsrFlags(originalValue, shiftedValue);
  // Then EOR with accumulator
  cpu.a = cpu.a ^ shiftedValue;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * EOR - Exclusive OR - Opcode: $45 (Zero Page)
 * 
 * Operation: A = A ⊕ M
 * 
 * Description:
 * Performs a bitwise exclusive OR between the accumulator and the value at the
 * zero page memory location. Each bit position in the accumulator is XORed with
 * the corresponding bit in the memory value. The result is stored in the accumulator.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 3 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Fetch value from zero page address and perform EOR
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function eorZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const value = cpu.readMemory(zpAddress);
  cpu.a = cpu.a ^ value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * LSR - Logical Shift Right - Opcode: $46 (Zero Page)
 * 
 * Operation: C = M[0]; M = M >> 1; M[7] = 0
 * 
 * Description:
 * Shifts the value at the zero page memory location one bit to the right.
 * Bit 0 is shifted into the carry flag, and bit 7 is filled with zero.
 * This performs an unsigned division by 2 on the memory value.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 0 before shifting
 * - Z (Zero): Set if result is zero, cleared otherwise  
 * - N (Negative): Always cleared (bit 7 is filled with 0)
 * 
 * Timing: 5 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read value from zero page address
 * - Cycle 4: Internal operation, perform shift
 * - Cycle 5: Write shifted value back to zero page address
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function lsrZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const originalValue = cpu.readMemory(zpAddress);
  cpu.incrementTacts(); // Internal operation cycle
  const shiftedValue = originalValue >> 1;
  cpu.writeMemory(zpAddress, shiftedValue);
  cpu.setLsrFlags(originalValue, shiftedValue);
}

/**
 * SRE - Shift Right then EOR - Opcode: $47 (Zero Page) - Undocumented
 * 
 * Operation: M = M >> 1; A = A ^ M
 * 
 * Description:
 * SRE is an undocumented instruction that combines LSR and EOR operations.
 * It first performs a logical shift right on the memory byte at the zero
 * page address (bit 0 → carry, 0 → bit 7), then EORs the shifted result
 * with the accumulator.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 0 before shifting
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 5 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read value from zero page address
 * - Cycle 4: Internal operation, perform shift and EOR
 * - Cycle 5: Write shifted value back to address
 * 
 * Addressing mode: Zero Page - 2 bytes
 * Alternative names: LSE
 */
function sreZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const originalValue = cpu.readMemory(zpAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const shiftedValue = originalValue >> 1;
  cpu.writeMemory(zpAddress, shiftedValue);
  // Set LSR flags first
  cpu.setLsrFlags(originalValue, shiftedValue);
  // Then EOR with accumulator
  cpu.a = cpu.a ^ shiftedValue;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * PHA - Push Accumulator - Opcode: $48
 * 
 * Operation: ($0100 + SP) = A, SP = SP - 1
 * 
 * Description:
 * PHA pushes the contents of the accumulator onto the stack and decrements
 * the stack pointer. This is commonly used to save the accumulator value
 * before calling subroutines or during interrupt handling to preserve
 * register state.
 * 
 * Flags affected: None
 * 
 * Timing: 3 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation
 * - Cycle 3: Push accumulator to stack, decrement SP
 * 
 * Addressing mode: Implied - 1 byte
 */
function pha(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.pushStack(cpu.a);
}

/**
 * EOR - Exclusive OR (Immediate) - Opcode: $49
 * 
 * Operation: A = A ^ memory
 * 
 * Description:
 * EOR performs a bitwise exclusive OR operation between the accumulator and
 * an immediate value. If the input bits are different, the resulting bit is 1;
 * if they are the same, it is 0. EOR with $FF effectively inverts all bits,
 * making it useful for bitwise NOT operations.
 * 
 * Flags affected:
 * - N (Negative): Set to result bit 7
 * - Z (Zero): Set if result == 0
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch immediate operand, increment PC, perform EOR
 * 
 * Addressing mode: Immediate - 2 bytes
 */
function eorImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.a = cpu.a ^ value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * LSR - Logical Shift Right - Opcode: $4A (Accumulator)
 * 
 * Operation: C = A[0]; A = A >> 1; A[7] = 0
 * 
 * Description:
 * Shifts the accumulator one bit to the right. Bit 0 is shifted into the
 * carry flag, and bit 7 is filled with zero. This performs an unsigned
 * division by 2 on the accumulator value.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 0 before shifting
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Always cleared (bit 7 is filled with 0)
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation, perform shift
 * 
 * Addressing mode: Accumulator - 1 byte
 */
function lsrA(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  const originalValue = cpu.a;
  const shiftedValue = cpu.a >> 1;
  cpu.a = shiftedValue;
  cpu.setLsrFlags(originalValue, shiftedValue);
}

/**
 * ASR - AND then Shift Right - Opcode: $4B (Immediate) - Undocumented
 * 
 * Operation: A = (A & M) >> 1
 * 
 * Description:
 * ASR is an undocumented instruction that combines AND and LSR operations.
 * It first performs a bitwise AND between the accumulator and the immediate
 * value, then performs a logical shift right on the result (bit 0 → carry,
 * 0 → bit 7). The final result is stored in the accumulator.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 0 before shifting
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch immediate value, perform AND and shift
 * 
 * Addressing mode: Immediate - 2 bytes
 * Alternative names: ALR
 */
function asrImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);

  // AND with accumulator
  cpu.a = cpu.a & value;
  
  // Set carry flag based on bit 0 before shifting
  if (cpu.a & 0x01) {
    cpu.p |= FlagSetMask6510.C;
  } else {
    cpu.p &= ~FlagSetMask6510.C;
  }
  
  // Shift right one bit
  cpu.a = (cpu.a >> 1) & 0xFF;
  
  // Set N and Z flags based on result
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * JMP - Jump (Absolute) - Opcode: $4C
 * 
 * Operation: PC = memory
 * 
 * Description:
 * JMP sets the program counter to a new absolute address, causing execution
 * to continue from that location. Unlike JSR, no return address is saved,
 * making this a simple unconditional jump. Use JSR instead if you need to
 * return to the calling location.
 * 
 * Flags affected: None
 * 
 * Timing: 3 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch target address low byte, increment PC
 * - Cycle 3: Fetch target address high byte, set PC to target
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function jmp(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const targetAddress = (high << 8) | low;
  cpu.pc = targetAddress;
}

/**
 * EOR - Exclusive OR - Opcode: $4D (Absolute)
 * 
 * Operation: A = A ⊕ M
 * 
 * Description:
 * Performs a bitwise exclusive OR between the accumulator and the value at the
 * absolute memory location. Each bit position in the accumulator is XORed with
 * the corresponding bit in the memory value. The result is stored in the accumulator.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Fetch value from address and perform EOR
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function eorAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemory(address);
  cpu.a = cpu.a ^ value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * LSR - Logical Shift Right - Opcode: $4E (Absolute)
 * 
 * Operation: C = M[0]; M = M >> 1; M[7] = 0
 * 
 * Description:
 * Shifts the value at the absolute memory location one bit to the right.
 * Bit 0 is shifted into the carry flag, and bit 7 is filled with zero.
 * This performs an unsigned division by 2 on the memory value.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 0 before shifting
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Always cleared (bit 7 is filled with 0)
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from address
 * - Cycle 5: Internal operation, perform shift
 * - Cycle 6: Write shifted value back to address
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function lsrAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const originalValue = cpu.readMemory(address);
  cpu.incrementTacts(); // Internal operation cycle
  const shiftedValue = originalValue >> 1;
  cpu.writeMemory(address, shiftedValue);
  cpu.setLsrFlags(originalValue, shiftedValue);
}

/**
 * SRE - Shift Right then EOR - Opcode: $4F (Absolute) - Undocumented
 * 
 * Operation: M = M >> 1; A = A ^ M
 * 
 * Description:
 * SRE is an undocumented instruction that combines LSR and EOR operations.
 * It first performs a logical shift right on the memory byte at the absolute
 * address (bit 0 → carry, 0 → bit 7), then EORs the shifted result with
 * the accumulator.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 0 before shifting
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from address
 * - Cycle 5: Internal operation, perform shift and EOR
 * - Cycle 6: Write shifted value back to address
 * 
 * Addressing mode: Absolute - 3 bytes
 * Alternative names: LSE
 */
function sreAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const originalValue = cpu.readMemory(address);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const shiftedValue = originalValue >> 1;
  cpu.writeMemory(address, shiftedValue);
  // Set LSR flags first
  cpu.setLsrFlags(originalValue, shiftedValue);
  // Then EOR with accumulator
  cpu.a = cpu.a ^ shiftedValue;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * BVC - Branch if Overflow Clear - Opcode: $50
 * 
 * Operation: PC = PC + 2 + memory (signed) if V = 0
 * 
 * Description:
 * BVC branches to a nearby location if the overflow flag is clear. The branch
 * offset is a signed 8-bit value with range [-128, 127] relative to the
 * instruction following the branch. The overflow flag is modified by few
 * instructions, primarily ADC, SBC, and BIT operations.
 * 
 * Flags affected: None
 * 
 * Timing: 2 cycles (3 if branch taken, 4 if page crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch branch offset, increment PC, check condition
 * - Cycle 3: Add offset to PC if branch taken
 * - Cycle 4: Fix PC high byte if page boundary crossed
 * 
 * Addressing mode: Relative - 2 bytes
 */
function bvc(cpu: M6510Cpu): void {
  cpu.performBranch(!cpu.isVFlagSet());
}

/**
 * EOR - Exclusive OR - Opcode: $51 (Indirect Indexed Y)
 * 
 * Operation: A = A ⊕ M
 * 
 * Description:
 * Performs a bitwise exclusive OR between the accumulator and the value at the
 * memory location addressed by indirect indexed mode. The zero page address
 * points to the low byte of the base address, with the high byte at the next
 * location. The Y register is added to this base address to form the effective
 * address. An extra cycle occurs if a page boundary is crossed.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 5+ cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Fetch low byte of base address from zero page
 * - Cycle 4: Fetch high byte of base address from zero page + 1
 * - Cycle 5: Fetch value from (base + Y), perform EOR
 * - Cycle +1: Add cycle if page boundary crossed by (base + Y)
 * 
 * Addressing mode: Indirect Indexed Y - 2 bytes
 */
function eorIndY(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const low = cpu.readMemory(zeroPageAddress);
  const high = cpu.readMemory((zeroPageAddress + 1) & 0xFF); // Handle zero page wrap-around
  const baseAddress = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(baseAddress, cpu.y);
  cpu.a = cpu.a ^ value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * SRE - Shift Right then EOR - Opcode: $53 ((Indirect),Y) - Undocumented
 * 
 * Operation: M = M >> 1; A = A ^ M
 * 
 * Description:
 * SRE is an undocumented instruction that combines LSR and EOR operations.
 * It first performs a logical shift right on the memory byte at the address
 * specified by indirect indexed addressing (bit 0 → carry, 0 → bit 7), then
 * EORs the shifted result with the accumulator. Always takes 8 cycles.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 0 before shifting
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 8 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read low byte of base address from zero page
 * - Cycle 4: Read high byte of base address from zero page + 1
 * - Cycle 5: Page boundary check for read
 * - Cycle 6: Read value from (base address + Y)
 * - Cycle 7: Internal operation, perform shift and EOR
 * - Cycle 8: Write shifted value back to address
 * 
 * Addressing mode: (Indirect),Y - 2 bytes
 * Alternative names: LSE
 */
function sreIndY(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const low = cpu.readMemory(zpAddress);
  const high = cpu.readMemory((zpAddress + 1) & 0xFF);
  const baseAddress = (high << 8) | low;
  const targetAddress = (baseAddress + cpu.y) & 0xFFFF;
  cpu.incrementTacts(); // Page boundary check for read
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const shiftedValue = originalValue >> 1;
  cpu.writeMemory(targetAddress, shiftedValue);
  // Set LSR flags first
  cpu.setLsrFlags(originalValue, shiftedValue);
  // Then EOR with accumulator
  cpu.a = cpu.a ^ shiftedValue;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * EOR - Exclusive OR - Opcode: $55 (Zero Page,X)
 * 
 * Operation: A = A ⊕ M
 * 
 * Description:
 * Performs a bitwise exclusive OR between the accumulator and the value at the
 * zero page memory location indexed by the X register. The effective address
 * is calculated by adding X to the zero page base address, wrapping around
 * within the zero page (result is masked with 0xFF).
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page base address
 * - Cycle 3: Add X to base address (internal operation)
 * - Cycle 4: Fetch value from (base + X) & 0xFF and perform EOR
 * 
 * Addressing mode: Zero Page,X - 2 bytes
 */
function eorZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Increment tacts for indexed addressing
  const value = cpu.readMemory((zpAddress + cpu.x) & 0xFF); // Wrap around in zero page
  cpu.a = cpu.a ^ value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * LSR - Logical Shift Right - Opcode: $56 (Zero Page,X)
 * 
 * Operation: C = M[0]; M = M >> 1; M[7] = 0
 * 
 * Description:
 * Shifts the value at the zero page memory location indexed by X one bit to
 * the right. The effective address is calculated by adding X to the zero page
 * base address, wrapping around within the zero page. Bit 0 is shifted into
 * the carry flag, and bit 7 is filled with zero.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 0 before shifting
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Always cleared (bit 7 is filled with 0)
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page base address
 * - Cycle 3: Add X to base address (internal operation)
 * - Cycle 4: Read value from (base + X) & 0xFF
 * - Cycle 5: Internal operation, perform shift
 * - Cycle 6: Write shifted value back to address
 * 
 * Addressing mode: Zero Page,X - 2 bytes
 */
function lsrZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts();
  const address = (zpAddress + cpu.x) & 0xff;
  const originalValue = cpu.readMemory(address);
  cpu.incrementTacts(); // Internal operation cycle
  const shiftedValue = originalValue >> 1;
  cpu.writeMemory(address, shiftedValue);
  cpu.setLsrFlags(originalValue, shiftedValue);
}

/**
 * SRE - Shift Right then EOR - Opcode: $57 (Zero Page,X) - Undocumented
 * 
 * Operation: M = M >> 1; A = A ^ M
 * 
 * Description:
 * SRE is an undocumented instruction that combines LSR and EOR operations.
 * It first performs a logical shift right on the memory byte at the zero
 * page address indexed by X (bit 0 → carry, 0 → bit 7), then EORs the
 * shifted result with the accumulator. The effective address wraps around
 * within the zero page.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 0 before shifting
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page base address
 * - Cycle 3: Add X to base address (internal operation)
 * - Cycle 4: Read value from (base + X) & 0xFF
 * - Cycle 5: Internal operation, perform shift and EOR
 * - Cycle 6: Write shifted value back to address
 * 
 * Addressing mode: Zero Page,X - 2 bytes
 * Alternative names: LSE
 */
function sreZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const address = (zpAddress + cpu.x) & 0xFF; // Wrap around in zero page
  const originalValue = cpu.readMemory(address);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const shiftedValue = originalValue >> 1;
  cpu.writeMemory(address, shiftedValue);
  // Set LSR flags first
  cpu.setLsrFlags(originalValue, shiftedValue);
  // Then EOR with accumulator
  cpu.a = cpu.a ^ shiftedValue;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * CLI - Clear Interrupt Disable - Opcode: $58
 * 
 * Operation: I = 0
 * 
 * Description:
 * CLI clears the interrupt disable flag, enabling the CPU to handle hardware
 * IRQs. The effect of changing this flag is delayed one instruction because
 * the flag is checked after the current instruction completes, allowing the
 * next instruction to execute before any pending IRQ is detected and serviced.
 * This flag has no effect on NMI (Non-Maskable Interrupt).
 * 
 * Flags affected:
 * - I (Interrupt disable): Set to 0 (effect delayed 1 instruction)
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation, clear interrupt disable flag
 * 
 * Addressing mode: Implied - 1 byte
 */
function cli(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.p &= ~FlagSetMask6510.I;
}

/**
 * EOR - Exclusive OR - Opcode: $59 (Absolute,Y)
 * 
 * Operation: A = A ⊕ M
 * 
 * Description:
 * Performs a bitwise exclusive OR between the accumulator and the value at the
 * absolute memory location indexed by the Y register. The effective address is
 * calculated by adding Y to the 16-bit base address. An extra cycle occurs if
 * a page boundary is crossed during the address calculation.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 4+ cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of base address
 * - Cycle 3: Fetch high byte of base address
 * - Cycle 4: Fetch value from (base + Y), perform EOR
 * - Cycle +1: Add cycle if page boundary crossed by (base + Y)
 * 
 * Addressing mode: Absolute,Y - 3 bytes
 */
function eorAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(address, cpu.y);
  cpu.a = cpu.a ^ value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * SRE - Shift Right then EOR - Opcode: $5B (Absolute,Y) - Undocumented
 * 
 * Operation: M = M >> 1; A = A ^ M
 * 
 * Description:
 * SRE is an undocumented instruction that combines LSR and EOR operations.
 * It first performs a logical shift right on the memory byte at the absolute
 * address indexed by Y (bit 0 → carry, 0 → bit 7), then EORs the shifted
 * result with the accumulator. Always takes 7 cycles.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 0 before shifting
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 7 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from (address + Y)
 * - Cycle 5: Internal operation, perform shift and EOR
 * - Cycle 6: Write shifted value back to address
 * - Cycle 7: Page boundary check
 * 
 * Addressing mode: Absolute,Y - 3 bytes
 * Alternative names: LSE
 */
function sreAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const targetAddress = (baseAddress + cpu.y) & 0xFFFF;
  cpu.incrementTacts(); // Page boundary check for read
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const shiftedValue = originalValue >> 1;
  cpu.writeMemory(targetAddress, shiftedValue);
  // Set LSR flags first
  cpu.setLsrFlags(originalValue, shiftedValue);
  // Then EOR with accumulator
  cpu.a = cpu.a ^ shiftedValue;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * EOR - Exclusive OR - Opcode: $5D (Absolute,X)
 * 
 * Operation: A = A ⊕ M
 * 
 * Description:
 * Performs a bitwise exclusive OR between the accumulator and the value at the
 * absolute memory location indexed by the X register. The effective address is
 * calculated by adding X to the 16-bit base address. An extra cycle occurs if
 * a page boundary is crossed during the address calculation.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 4+ cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of base address
 * - Cycle 3: Fetch high byte of base address
 * - Cycle 4: Fetch value from (base + X), perform EOR
 * - Cycle +1: Add cycle if page boundary crossed by (base + X)
 * 
 * Addressing mode: Absolute,X - 3 bytes
 */
function eorAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(address, cpu.x);
  cpu.a = cpu.a ^ value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * LSR - Logical Shift Right - Opcode: $5E (Absolute,X)
 * 
 * Operation: C = M[0]; M = M >> 1; M[7] = 0
 * 
 * Description:
 * Shifts the value at the absolute memory location indexed by X one bit to
 * the right. The effective address is calculated by adding X to the 16-bit
 * base address. Bit 0 is shifted into the carry flag, and bit 7 is filled
 * with zero. Always takes an extra cycle for the indexed addressing.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 0 before shifting
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Always cleared (bit 7 is filled with 0)
 * 
 * Timing: 7 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of base address
 * - Cycle 3: Fetch high byte of base address
 * - Cycle 4: Add X to base address (internal operation)
 * - Cycle 5: Read value from (base + X)
 * - Cycle 6: Internal operation, perform shift
 * - Cycle 7: Write shifted value back to address
 * 
 * Addressing mode: Absolute,X - 3 bytes
 */
function lsrAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  cpu.incrementTacts(); // Extra cycle for indexed addressing
  const effectiveAddress = (address + cpu.x) & 0xffff;
  const originalValue = cpu.readMemory(effectiveAddress);
  cpu.incrementTacts(); // Internal operation cycle
  const shiftedValue = originalValue >> 1;
  cpu.writeMemory(effectiveAddress, shiftedValue);
  cpu.setLsrFlags(originalValue, shiftedValue);
}

/**
 * SRE - Shift Right then EOR - Opcode: $5F (Absolute,X) - Undocumented
 * 
 * Operation: M = M >> 1; A = A ^ M
 * 
 * Description:
 * SRE is an undocumented instruction that combines LSR and EOR operations.
 * It first performs a logical shift right on the memory byte at the absolute
 * address indexed by X (bit 0 → carry, 0 → bit 7), then EORs the shifted
 * result with the accumulator. Always takes 7 cycles.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 0 before shifting
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 7 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Page boundary check for read
 * - Cycle 5: Read value from (address + X)
 * - Cycle 6: Internal operation, perform shift and EOR
 * - Cycle 7: Write shifted value back to address
 * 
 * Addressing mode: Absolute,X - 3 bytes
 * Alternative names: LSE
 */
function sreAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const targetAddress = (baseAddress + cpu.x) & 0xFFFF;
  cpu.incrementTacts(); // Page boundary check for read
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const shiftedValue = originalValue >> 1;
  cpu.writeMemory(targetAddress, shiftedValue);
  // Set LSR flags first
  cpu.setLsrFlags(originalValue, shiftedValue);
  // Then EOR with accumulator
  cpu.a = cpu.a ^ shiftedValue;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * RTS - Return from Subroutine - Opcode: $60
 * 
 * Operation: pull PC from stack, PC = PC + 1
 * 
 * Description:
 * RTS pulls a 16-bit address from the stack into the program counter and then
 * increments PC by 1. This is normally used at the end of a subroutine to
 * return to the instruction after the JSR that called it. The increment is
 * necessary because JSR pushes PC-1 rather than the exact return address.
 * 
 * Flags affected: None
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation
 * - Cycle 3: Internal operation
 * - Cycle 4: Pull return address low byte from stack
 * - Cycle 5: Pull return address high byte from stack  
 * - Cycle 6: Internal operation, increment PC
 * 
 * Addressing mode: Implied - 1 byte
 */
function rts(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle 1
  cpu.incrementTacts(); // Internal operation cycle 2
  
  // Pull return address from stack
  const low = cpu.pullStack();
  const high = cpu.pullStack();
  const returnAddress = (high << 8) | low;
  
  cpu.incrementTacts(); // Internal operation cycle 3
  
  // RTS increments the return address by 1 (since JSR pushed PC - 1)
  cpu.pc = (returnAddress + 1) & 0xFFFF;
}

/**
 * ADC - Add with Carry (Indirect,X) - Opcode: $61
 * 
 * Operation: A = A + memory + C
 * 
 * Description:
 * ADC adds the carry flag and a memory value to the accumulator. The carry flag is
 * set to the carry value coming out of bit 7, allowing values larger than 1 byte
 * to be added together by carrying the 1 into the next byte's addition (unsigned
 * overflow). The overflow flag indicates whether signed overflow or underflow
 * occurred - when both inputs are positive and result is negative, or both are
 * negative and result is positive.
 * 
 * Flags affected:
 * - C (Carry): Set if result > $FF (unsigned overflow occurred)
 * - Z (Zero): Set if result == 0
 * - V (Overflow): Set if (result ^ A) & (result ^ memory) & $80 (signed overflow)
 * - N (Negative): Set to result bit 7
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address, increment PC
 * - Cycle 3: Add X to zero page address (internal operation)
 * - Cycle 4: Fetch effective address low byte from (zp+X)
 * - Cycle 5: Fetch effective address high byte from (zp+X+1)
 * - Cycle 6: Fetch operand from effective address, perform addition
 * 
 * Addressing mode: (Indirect,X) - 2 bytes
 */
function adcIndX(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const effectiveAddress = (zeroPageAddress + cpu.x) & 0xFF; // Wrap around in zero page
  cpu.incrementTacts(); // Indexed addressing cycle
  const low = cpu.readMemory(effectiveAddress);
  const high = cpu.readMemory((effectiveAddress + 1) & 0xFF); // Handle wrap-around for high byte too
  const targetAddress = (high << 8) | low;
  const operand = cpu.readMemory(targetAddress);
  cpu.a = cpu.performAdc(operand);
}

/**
 * RRA - Rotate Right then Add - Opcode: $63 ((Indirect,X)) - Undocumented
 * 
 * Operation: M = (M >> 1) | (C << 7); A = A + M + C
 * 
 * Description:
 * RRA is an undocumented instruction that combines ROR and ADC operations.
 * It first performs a rotate right on the memory byte at the address specified
 * by indexed indirect addressing (bit 0 → carry, carry → bit 7), then adds
 * the rotated result to the accumulator with carry. Zero page arithmetic wraps around.
 * 
 * Flags affected:
 * - C (Carry): Set if addition result > 255, cleared otherwise
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - V (Overflow): Set if signed addition overflow occurs, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 8 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add X to address (internal operation)
 * - Cycle 4: Read low byte of target address from (zp + X)
 * - Cycle 5: Read high byte of target address from (zp + X + 1)
 * - Cycle 6: Read value from target address
 * - Cycle 7: Internal operation, perform rotation and addition
 * - Cycle 8: Write rotated value back to target address
 * 
 * Addressing mode: (Indirect,X) - 2 bytes
 */
function rraIndX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const indirectAddress = (zpAddress + cpu.x) & 0xFF; // Wrap around in zero page
  const targetLow = cpu.readMemory(indirectAddress);
  const targetHigh = cpu.readMemory((indirectAddress + 1) & 0xFF); // Wrap around
  const targetAddress = (targetHigh << 8) | targetLow;
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  
  // Perform ROR operation
  const carryIn = cpu.isCFlagSet() ? 0x80 : 0;
  const rotatedValue = (originalValue >> 1) | carryIn;
  cpu.writeMemory(targetAddress, rotatedValue);
  
  // Set ROR flags (this sets the carry flag based on bit 0 of original value)
  cpu.setRorFlags(originalValue, rotatedValue);
  
  // Then perform ADC with accumulator using the carry flag set by ROR
  const adcCarryIn = cpu.isCFlagSet() ? 1 : 0;
  const result = cpu.a + rotatedValue + adcCarryIn;
  cpu.setAdcFlags(cpu.a, rotatedValue, result);
  cpu.a = result & 0xFF;
}

/**
 * ADC - Add with Carry (Zero Page) - Opcode: $65
 * 
 * Operation: A = A + memory + C
 * 
 * Description:
 * ADC adds the carry flag and a memory value to the accumulator. The carry flag is
 * set to the carry value coming out of bit 7, allowing values larger than 1 byte
 * to be added together by carrying the 1 into the next byte's addition (unsigned
 * overflow). The overflow flag indicates whether signed overflow or underflow
 * occurred - when both inputs are positive and result is negative, or both are
 * negative and result is positive.
 * 
 * Flags affected:
 * - C (Carry): Set if result > $FF (unsigned overflow occurred)
 * - Z (Zero): Set if result == 0
 * - V (Overflow): Set if (result ^ A) & (result ^ memory) & $80 (signed overflow)
 * - N (Negative): Set to result bit 7
 * 
 * Timing: 3 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address, increment PC
 * - Cycle 3: Fetch operand from zero page address, perform addition
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function adcZp(cpu: M6510Cpu): void {
  const address = cpu.readMemory(cpu.pc++);
  const operand = cpu.readMemory(address);
  cpu.a = cpu.performAdc(operand);
}

/**
 * ROR - Rotate Right - Opcode: $66 (Zero Page)
 * 
 * Operation: C = M[0]; M = (C << 7) | (M >> 1)
 * 
 * Description:
 * Rotates the value at the zero page memory location one bit to the right.
 * The carry flag is shifted into bit 7, and bit 0 is shifted into the carry
 * flag. This is a 9-bit rotation through the carry flag.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 0 before rotation
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set to the value of the carry flag before rotation
 * 
 * Timing: 5 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read value from zero page address
 * - Cycle 4: Internal operation, perform rotation
 * - Cycle 5: Write rotated value back to zero page address
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function rorZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const originalValue = cpu.readMemory(zpAddress);
  cpu.incrementTacts(); // Internal operation cycle
  const carryIn = cpu.isCFlagSet() ? 0x80 : 0;
  const rotatedValue = (originalValue >> 1) | carryIn;
  cpu.writeMemory(zpAddress, rotatedValue);
  cpu.setRorFlags(originalValue, rotatedValue);
}

/**
 * RRA - Rotate Right then Add - Opcode: $67 (Zero Page) - Undocumented
 * 
 * Operation: M = (M >> 1) | (C << 7); A = A + M + C
 * 
 * Description:
 * RRA is an undocumented instruction that combines ROR and ADC operations.
 * It first performs a rotate right on the memory byte at the zero page address
 * (bit 0 → carry, carry → bit 7), then adds the rotated result to the
 * accumulator with carry. This is a 9-bit rotation through the carry flag.
 * 
 * Flags affected:
 * - C (Carry): Set if addition result > 255, cleared otherwise
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - V (Overflow): Set if signed addition overflow occurs, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 5 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read value from zero page address
 * - Cycle 4: Internal operation, perform rotation and addition
 * - Cycle 5: Write rotated value back to address
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function rraZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const originalValue = cpu.readMemory(zpAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  
  // Perform ROR operation
  const carryIn = cpu.isCFlagSet() ? 0x80 : 0;
  const rotatedValue = (originalValue >> 1) | carryIn;
  cpu.writeMemory(zpAddress, rotatedValue);
  
  // Set ROR flags (this sets the carry flag based on bit 0 of original value)
  cpu.setRorFlags(originalValue, rotatedValue);
  
  // Then perform ADC with accumulator using the carry flag set by ROR
  const adcCarryIn = cpu.isCFlagSet() ? 1 : 0;
  const result = cpu.a + rotatedValue + adcCarryIn;
  cpu.setAdcFlags(cpu.a, rotatedValue, result);
  cpu.a = result & 0xFF;
}

/**
 * PLA - Pull Accumulator - Opcode: $68
 * 
 * Operation: SP = SP + 1, A = ($0100 + SP)
 * 
 * Description:
 * PLA increments the stack pointer and then loads the value at that stack
 * position into the accumulator. This is commonly used to restore the
 * accumulator value that was previously saved with PHA. The flags are
 * updated based on the pulled value.
 * 
 * Flags affected:
 * - N (Negative): Set to result bit 7
 * - Z (Zero): Set if result == 0
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation
 * - Cycle 3: Internal operation, increment SP
 * - Cycle 4: Pull accumulator from stack, set flags
 * 
 * Addressing mode: Implied - 1 byte
 */
function pla(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle 1
  cpu.incrementTacts(); // Internal operation cycle 2
  cpu.a = cpu.pullStack();
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * ADC - Add with Carry (Immediate) - Opcode: $69
 * 
 * Operation: A = A + memory + C
 * 
 * Description:
 * ADC adds the carry flag and a memory value to the accumulator. The carry flag is
 * set to the carry value coming out of bit 7, allowing values larger than 1 byte
 * to be added together by carrying the 1 into the next byte's addition (unsigned
 * overflow). The overflow flag indicates whether signed overflow or underflow
 * occurred - when both inputs are positive and result is negative, or both are
 * negative and result is positive.
 * 
 * Flags affected:
 * - C (Carry): Set if result > $FF (unsigned overflow occurred)
 * - Z (Zero): Set if result == 0
 * - V (Overflow): Set if (result ^ A) & (result ^ memory) & $80 (signed overflow)
 * - N (Negative): Set to result bit 7
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch immediate operand, increment PC, perform addition
 * 
 * Addressing mode: Immediate - 2 bytes
 */
function adcImm(cpu: M6510Cpu): void {
  const operand = cpu.readMemory(cpu.pc++);
  cpu.a = cpu.performAdc(operand);
}

/**
 * ROR - Rotate Right - Opcode: $6A (Accumulator)
 * 
 * Operation: C = A[0]; A = (C << 7) | (A >> 1)
 * 
 * Description:
 * Rotates the accumulator one bit to the right. The carry flag is shifted
 * into bit 7, and bit 0 is shifted into the carry flag. This is a 9-bit
 * rotation through the carry flag.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 0 before rotation
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set to the value of the carry flag before rotation
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation, perform rotation
 * 
 * Addressing mode: Accumulator - 1 byte
 */
function rorA(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  const originalValue = cpu.a;
  const carryIn = cpu.isCFlagSet() ? 0x80 : 0;
  const rotatedValue = (cpu.a >> 1) | carryIn;
  cpu.a = rotatedValue;
  cpu.setRorFlags(originalValue, rotatedValue);
}

/**
 * ARR - AND then Rotate Right - Opcode: $6B (Immediate) - Undocumented
 * 
 * Operation: A = ((A & M) | (C << 8)) >> 1
 * 
 * Description:
 * ARR is an undocumented instruction that combines AND and ROR operations.
 * It first performs a bitwise AND between the accumulator and the immediate
 * value, then performs a rotate right on the result including the carry flag
 * in the rotation (carry → bit 7, bit 0 → carry). The final result is stored
 * in the accumulator.
 * 
 * Flags affected:
 * - C (Carry): Set to bit 0 of the AND result before rotation
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - V (Overflow): Complex behavior based on bits 5 and 6 of result
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch immediate value, perform AND and rotate
 * 
 * Addressing mode: Immediate - 2 bytes
 */
function arrImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);

  // AND with accumulator
  let tmp = cpu.a & value;
  
  // Include current carry in bit 8, then shift right (VICE implementation)
  tmp |= (cpu.isCFlagSet() ? 1 : 0) << 8;
  tmp >>= 1;
  
  // Store result in accumulator
  cpu.a = tmp & 0xFF;
  
  // Set N and Z flags based on result
  cpu.setZeroAndNegativeFlags(cpu.a);
  
  // ARR-specific flag behavior based on VICE implementation:
  // Set C based on bit 6 of result
  if (tmp & 0x40) {
    cpu.p |= FlagSetMask6510.C;
  } else {
    cpu.p &= ~FlagSetMask6510.C;
  }
  
  // Set V based on VICE overflow calculation: (tmp & 0x40) ^ ((tmp & 0x20) << 1)
  const overflowCalc = (tmp & 0x40) ^ ((tmp & 0x20) << 1);
  if (overflowCalc !== 0) {
    cpu.p |= FlagSetMask6510.V;
  } else {
    cpu.p &= ~FlagSetMask6510.V;
  }
}

/**
 * JMP - Jump - Opcode: $6C (Indirect)
 * 
 * Operation: PC = (indirect address)
 * 
 * Description:
 * JMP loads the program counter with the address stored at the specified
 * indirect address. The instruction fetches a 16-bit address from memory
 * and jumps to that location. Contains the famous 6502 page boundary bug:
 * if the indirect address is on a page boundary ($xxFF), the high byte is
 * fetched from $xx00 instead of $(xx+1)00.
 * 
 * Flags affected: None
 * 
 * Timing: 5 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of indirect address
 * - Cycle 3: Fetch high byte of indirect address
 * - Cycle 4: Fetch low byte of target address from indirect address
 * - Cycle 5: Fetch high byte of target address (with page boundary bug)
 * 
 * Addressing mode: Indirect - 3 bytes
 */
function jmpInd(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const indirectAddress = (high << 8) | low;
  
  // Read the target address from the indirect address
  // 6502 bug: if the indirect address is on a page boundary (e.g., $xxFF),
  // the high byte is read from $xx00 instead of $(xx+1)00
  const targetLow = cpu.readMemory(indirectAddress);
  let targetHigh: number;
  
  if ((indirectAddress & 0xFF) === 0xFF) {
    // Page boundary bug: read high byte from same page
    targetHigh = cpu.readMemory(indirectAddress & 0xFF00);
  } else {
    // Normal case: read high byte from next address
    targetHigh = cpu.readMemory(indirectAddress + 1);
  }
  
  const targetAddress = (targetHigh << 8) | targetLow;
  cpu.pc = targetAddress;
}

/**
 * ADC - Add with Carry (Absolute) - Opcode: $6D
 * 
 * Operation: A = A + memory + C
 * 
 * Description:
 * ADC adds the carry flag and a memory value to the accumulator. The carry flag is
 * set to the carry value coming out of bit 7, allowing values larger than 1 byte
 * to be added together by carrying the 1 into the next byte's addition (unsigned
 * overflow). The overflow flag indicates whether signed overflow or underflow
 * occurred - when both inputs are positive and result is negative, or both are
 * negative and result is positive.
 * 
 * Flags affected:
 * - C (Carry): Set if result > $FF (unsigned overflow occurred)
 * - Z (Zero): Set if result == 0
 * - V (Overflow): Set if (result ^ A) & (result ^ memory) & $80 (signed overflow)
 * - N (Negative): Set to result bit 7
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch address low byte, increment PC
 * - Cycle 3: Fetch address high byte, increment PC
 * - Cycle 4: Fetch operand from address, perform addition
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function adcAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const operand = cpu.readMemory(address);
  cpu.a = cpu.performAdc(operand);
}

/**
 * ROR - Rotate Right - Opcode: $6E (Absolute)
 * 
 * Operation: C = M[0]; M = (M >> 1) | (C << 7)
 * 
 * Description:
 * Rotates the memory byte at the absolute address one bit to the right.
 * Bit 0 is shifted into the carry flag, and the previous carry flag value
 * is shifted into bit 7. This is a 9-bit rotation through the carry flag.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 0 before rotation
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from address
 * - Cycle 5: Internal operation, perform rotation
 * - Cycle 6: Write rotated value back to address
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function rorAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const originalValue = cpu.readMemory(address);
  cpu.incrementTacts(); // Internal operation cycle
  const carryIn = cpu.isCFlagSet() ? 0x80 : 0;
  const rotatedValue = (originalValue >> 1) | carryIn;
  cpu.writeMemory(address, rotatedValue);
  cpu.setRorFlags(originalValue, rotatedValue);
}

/**
 * RRA - Rotate Right then Add - Opcode: $6F (Absolute) - Undocumented
 * 
 * Operation: M = (M >> 1) | (C << 7); A = A + M + C
 * 
 * Description:
 * RRA is an undocumented instruction that combines ROR and ADC operations.
 * It first performs a rotate right on the memory byte at the absolute address
 * (bit 0 → carry, carry → bit 7), then adds the rotated result to the
 * accumulator with carry. This is a 9-bit rotation through the carry flag.
 * 
 * Flags affected:
 * - C (Carry): Set if addition result > 255, cleared otherwise
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - V (Overflow): Set if signed addition overflow occurs, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from address
 * - Cycle 5: Internal operation, perform rotation and addition
 * - Cycle 6: Write rotated value back to address
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function rraAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const originalValue = cpu.readMemory(address);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  
  // Perform ROR operation
  const carryIn = cpu.isCFlagSet() ? 0x80 : 0;
  const rotatedValue = (originalValue >> 1) | carryIn;
  cpu.writeMemory(address, rotatedValue);
  
  // Set ROR flags (this sets the carry flag based on bit 0 of original value)
  cpu.setRorFlags(originalValue, rotatedValue);
  
  // Then perform ADC with accumulator using the carry flag set by ROR
  const adcCarryIn = cpu.isCFlagSet() ? 1 : 0;
  const result = cpu.a + rotatedValue + adcCarryIn;
  cpu.setAdcFlags(cpu.a, rotatedValue, result);
  cpu.a = result & 0xFF;
}

/**
 * BVS - Branch if Overflow Set - Opcode: $70
 * 
 * Operation: PC = PC + 2 + memory (signed) if V = 1
 * 
 * Description:
 * BVS branches to a nearby location if the overflow flag is set. The branch
 * offset is a signed 8-bit value with range [-128, 127] relative to the
 * instruction following the branch. The overflow flag is modified by few
 * instructions, primarily ADC, SBC, and BIT operations, and indicates
 * signed arithmetic overflow.
 * 
 * Flags affected: None
 * 
 * Timing: 2 cycles (3 if branch taken, 4 if page crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch branch offset, increment PC, check condition
 * - Cycle 3: Add offset to PC if branch taken
 * - Cycle 4: Fix PC high byte if page boundary crossed
 * 
 * Addressing mode: Relative - 2 bytes
 */
function bvs(cpu: M6510Cpu): void {
  cpu.performBranch(cpu.isVFlagSet());
}

/**
 * ADC - Add with Carry (Indirect,Y) - Opcode: $71
 * 
 * Operation: A = A + memory + C
 * 
 * Description:
 * ADC adds the carry flag and a memory value to the accumulator. The carry flag is
 * set to the carry value coming out of bit 7, allowing values larger than 1 byte
 * to be added together by carrying the 1 into the next byte's addition (unsigned
 * overflow). The overflow flag indicates whether signed overflow or underflow
 * occurred - when both inputs are positive and result is negative, or both are
 * negative and result is positive.
 * 
 * Flags affected:
 * - C (Carry): Set if result > $FF (unsigned overflow occurred)
 * - Z (Zero): Set if result == 0
 * - V (Overflow): Set if (result ^ A) & (result ^ memory) & $80 (signed overflow)
 * - N (Negative): Set to result bit 7
 * 
 * Timing: 5 cycles (6 if page crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address, increment PC
 * - Cycle 3: Fetch effective address low byte from zero page
 * - Cycle 4: Fetch effective address high byte from zero page+1
 * - Cycle 5: Fetch operand from effective address+Y, perform addition
 * - Cycle 6: Extra cycle if page boundary crossed when adding Y
 * 
 * Addressing mode: (Indirect),Y - 2 bytes
 */
function adcIndY(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const low = cpu.readMemory(zeroPageAddress);
  const high = cpu.readMemory((zeroPageAddress + 1) & 0xFF); // Handle zero page wrap-around
  const baseAddress = (high << 8) | low;
  const operand = cpu.readMemoryWithPageBoundary(baseAddress, cpu.y);
  cpu.a = cpu.performAdc(operand);
}

/**
 * RRA - Rotate Right then Add - Opcode: $73 ((Indirect),Y) - Undocumented
 * 
 * Operation: M = (M >> 1) | (C << 7); A = A + M + C
 * 
 * Description:
 * RRA is an undocumented instruction that combines ROR and ADC operations.
 * It first performs a rotate right on the memory byte at the address specified
 * by indirect indexed addressing (bit 0 → carry, carry → bit 7), then adds
 * the rotated result to the accumulator with carry. Always takes 8 cycles.
 * 
 * Flags affected:
 * - C (Carry): Set if addition result > 255, cleared otherwise
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - V (Overflow): Set if signed addition overflow occurs, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 8 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read low byte of base address from zero page
 * - Cycle 4: Read high byte of base address from zero page + 1
 * - Cycle 5: Page boundary check for read
 * - Cycle 6: Read value from (base address + Y)
 * - Cycle 7: Internal operation, perform rotation and addition
 * - Cycle 8: Write rotated value back to address
 * 
 * Addressing mode: (Indirect),Y - 2 bytes
 */
function rraIndY(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const low = cpu.readMemory(zpAddress);
  const high = cpu.readMemory((zpAddress + 1) & 0xFF);
  const baseAddress = (high << 8) | low;
  const targetAddress = (baseAddress + cpu.y) & 0xFFFF;
  cpu.incrementTacts(); // Page boundary check for read
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  
  // Perform ROR operation
  const carryIn = cpu.isCFlagSet() ? 0x80 : 0;
  const rotatedValue = (originalValue >> 1) | carryIn;
  cpu.writeMemory(targetAddress, rotatedValue);
  
  // Set ROR flags (this sets the carry flag based on bit 0 of original value)
  cpu.setRorFlags(originalValue, rotatedValue);
  
  // Then perform ADC with accumulator using the carry flag set by ROR
  const adcCarryIn = cpu.isCFlagSet() ? 1 : 0;
  const result = cpu.a + rotatedValue + adcCarryIn;
  cpu.setAdcFlags(cpu.a, rotatedValue, result);
  cpu.a = result & 0xFF;
}

/**
 * ADC - Add with Carry (Zero Page,X) - Opcode: $75
 * 
 * Operation: A = A + memory + C
 * 
 * Description:
 * ADC adds the carry flag and a memory value to the accumulator. The carry flag is
 * set to the carry value coming out of bit 7, allowing values larger than 1 byte
 * to be added together by carrying the 1 into the next byte's addition (unsigned
 * overflow). The overflow flag indicates whether signed overflow or underflow
 * occurred - when both inputs are positive and result is negative, or both are
 * negative and result is positive.
 * 
 * Flags affected:
 * - C (Carry): Set if result > $FF (unsigned overflow occurred)
 * - Z (Zero): Set if result == 0
 * - V (Overflow): Set if (result ^ A) & (result ^ memory) & $80 (signed overflow)
 * - N (Negative): Set to result bit 7
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address, increment PC
 * - Cycle 3: Add X to zero page address (internal operation)
 * - Cycle 4: Fetch operand from zero page+X, perform addition
 * 
 * Addressing mode: Zero Page,X - 2 bytes
 */
function adcZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const address = (zpAddress + cpu.x) & 0xFF; // Wrap around in zero page
  const operand = cpu.readMemory(address);
  cpu.a = cpu.performAdc(operand);
}

/**
 * ROR - Rotate Right - Opcode: $76 (Zero Page,X)
 * 
 * Operation: C = M[0]; M = (M >> 1) | (C << 7)
 * 
 * Description:
 * Rotates the memory byte at the zero page address indexed by X one bit to
 * the right. Bit 0 is shifted into the carry flag, and the previous carry
 * flag value is shifted into bit 7. This is a 9-bit rotation through the
 * carry flag. The effective address wraps around within the zero page.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 0 before rotation
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page base address
 * - Cycle 3: Add X to base address (internal operation)
 * - Cycle 4: Read value from (base + X) & 0xFF
 * - Cycle 5: Internal operation, perform rotation
 * - Cycle 6: Write rotated value back to address
 * 
 * Addressing mode: Zero Page,X - 2 bytes
 */
function rorZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts();
  const address = (zpAddress + cpu.x) & 0xff;
  const originalValue = cpu.readMemory(address);
  cpu.incrementTacts(); // Internal operation cycle
  const carryIn = cpu.isCFlagSet() ? 0x80 : 0;
  const rotatedValue = (originalValue >> 1) | carryIn;
  cpu.writeMemory(address, rotatedValue);
  cpu.setRorFlags(originalValue, rotatedValue);
}

/**
 * RRA - Rotate Right then Add - Opcode: $77 (Zero Page,X) - Undocumented
 * 
 * Operation: M = (M >> 1) | (C << 7); A = A + M + C
 * 
 * Description:
 * RRA is an undocumented instruction that combines ROR and ADC operations.
 * It first performs a rotate right on the memory byte at the zero page address
 * indexed by X (bit 0 → carry, carry → bit 7), then adds the rotated result
 * to the accumulator with carry. The effective address wraps around within the zero page.
 * 
 * Flags affected:
 * - C (Carry): Set if addition result > 255, cleared otherwise
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - V (Overflow): Set if signed addition overflow occurs, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page base address
 * - Cycle 3: Add X to base address (internal operation)
 * - Cycle 4: Read value from (base + X) & 0xFF
 * - Cycle 5: Internal operation, perform rotation and addition
 * - Cycle 6: Write rotated value back to address
 * 
 * Addressing mode: Zero Page,X - 2 bytes
 */
function rraZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const address = (zpAddress + cpu.x) & 0xFF; // Wrap around in zero page
  const originalValue = cpu.readMemory(address);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  
  // Perform ROR operation
  const carryIn = cpu.isCFlagSet() ? 0x80 : 0;
  const rotatedValue = (originalValue >> 1) | carryIn;
  cpu.writeMemory(address, rotatedValue);
  
  // Set ROR flags (this sets the carry flag based on bit 0 of original value)
  cpu.setRorFlags(originalValue, rotatedValue);
  
  // Then perform ADC with accumulator using the carry flag set by ROR
  const adcCarryIn = cpu.isCFlagSet() ? 1 : 0;
  const result = cpu.a + rotatedValue + adcCarryIn;
  cpu.setAdcFlags(cpu.a, rotatedValue, result);
  cpu.a = result & 0xFF;
}

/**
 * SEI - Set Interrupt Disable - Opcode: $78
 * 
 * Operation: I = 1
 * 
 * Description:
 * SEI sets the interrupt disable flag, preventing the CPU from handling hardware
 * IRQs. The effect of changing this flag is delayed one instruction because the
 * flag is checked after the current instruction completes, allowing an IRQ to
 * be serviced between this instruction and the next if the flag was previously
 * clear. This flag has no effect on NMI (Non-Maskable Interrupt).
 * 
 * Flags affected:
 * - I (Interrupt disable): Set to 1 (effect delayed 1 instruction)
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation, set interrupt disable flag
 * 
 * Addressing mode: Implied - 1 byte
 */
function sei(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.p |= FlagSetMask6510.I;
}

/**
 * ADC - Add with Carry (Absolute,Y) - Opcode: $79
 * 
 * Operation: A = A + memory + C
 * 
 * Description:
 * ADC adds the carry flag and a memory value to the accumulator. The carry flag is
 * set to the carry value coming out of bit 7, allowing values larger than 1 byte
 * to be added together by carrying the 1 into the next byte's addition (unsigned
 * overflow). The overflow flag indicates whether signed overflow or underflow
 * occurred - when both inputs are positive and result is negative, or both are
 * negative and result is positive.
 * 
 * Flags affected:
 * - C (Carry): Set if result > $FF (unsigned overflow occurred)
 * - Z (Zero): Set if result == 0
 * - V (Overflow): Set if (result ^ A) & (result ^ memory) & $80 (signed overflow)
 * - N (Negative): Set to result bit 7
 * 
 * Timing: 4 cycles (5 if page crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch address low byte, increment PC
 * - Cycle 3: Fetch address high byte, increment PC
 * - Cycle 4: Fetch operand from address+Y, perform addition
 * - Cycle 5: Extra cycle if page boundary crossed when adding Y
 * 
 * Addressing mode: Absolute,Y - 3 bytes
 */
function adcAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const operand = cpu.readMemoryWithPageBoundary(baseAddress, cpu.y);
  cpu.a = cpu.performAdc(operand);
}

/**
 * RRA - Rotate Right then Add - Opcode: $7B (Absolute,Y) - Undocumented
 * 
 * Operation: M = (M >> 1) | (C << 7); A = A + M + C
 * 
 * Description:
 * RRA is an undocumented instruction that combines ROR and ADC operations.
 * It first performs a rotate right on the memory byte at the absolute address
 * indexed by Y (bit 0 → carry, carry → bit 7), then adds the rotated result
 * to the accumulator with carry. Always takes 7 cycles.
 * 
 * Flags affected:
 * - C (Carry): Set if addition result > 255, cleared otherwise
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - V (Overflow): Set if signed addition overflow occurs, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 7 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Page boundary check for read
 * - Cycle 5: Read value from (address + Y)
 * - Cycle 6: Internal operation, perform rotation and addition
 * - Cycle 7: Write rotated value back to address
 * 
 * Addressing mode: Absolute,Y - 3 bytes
 */
function rraAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const targetAddress = (baseAddress + cpu.y) & 0xFFFF;
  cpu.incrementTacts(); // Page boundary check for read
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  
  // Perform ROR operation
  const carryIn = cpu.isCFlagSet() ? 0x80 : 0;
  const rotatedValue = (originalValue >> 1) | carryIn;
  cpu.writeMemory(targetAddress, rotatedValue);
  
  // Set ROR flags (this sets the carry flag based on bit 0 of original value)
  cpu.setRorFlags(originalValue, rotatedValue);
  
  // Then perform ADC with accumulator using the carry flag set by ROR
  const adcCarryIn = cpu.isCFlagSet() ? 1 : 0;
  const result = cpu.a + rotatedValue + adcCarryIn;
  cpu.setAdcFlags(cpu.a, rotatedValue, result);
  cpu.a = result & 0xFF;
}

/**
 * ADC - Add with Carry (Absolute,X) - Opcode: $7D
 * 
 * Operation: A = A + memory + C
 * 
 * Description:
 * ADC adds the carry flag and a memory value to the accumulator. The carry flag is
 * set to the carry value coming out of bit 7, allowing values larger than 1 byte
 * to be added together by carrying the 1 into the next byte's addition (unsigned
 * overflow). The overflow flag indicates whether signed overflow or underflow
 * occurred - when both inputs are positive and result is negative, or both are
 * negative and result is positive.
 * 
 * Flags affected:
 * - C (Carry): Set if result > $FF (unsigned overflow occurred)
 * - Z (Zero): Set if result == 0
 * - V (Overflow): Set if (result ^ A) & (result ^ memory) & $80 (signed overflow)
 * - N (Negative): Set to result bit 7
 * 
 * Timing: 4 cycles (5 if page crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch address low byte, increment PC
 * - Cycle 3: Fetch address high byte, increment PC
 * - Cycle 4: Fetch operand from address+X, perform addition
 * - Cycle 5: Extra cycle if page boundary crossed when adding X
 * 
 * Addressing mode: Absolute,X - 3 bytes
 */
function adcAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const operand = cpu.readMemoryWithPageBoundary(baseAddress, cpu.x);
  cpu.a = cpu.performAdc(operand);
}

/**
 * ROR - Rotate Right - Opcode: $7E (Absolute,X)
 * 
 * Operation: C = M[0]; M = (M >> 1) | (C << 7)
 * 
 * Description:
 * Rotates the memory byte at the absolute address indexed by X one bit to
 * the right. Bit 0 is shifted into the carry flag, and the previous carry
 * flag value is shifted into bit 7. This is a 9-bit rotation through the
 * carry flag. Always takes 7 cycles regardless of page boundary crossing.
 * 
 * Flags affected:
 * - C (Carry): Set to the value of bit 0 before rotation
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 7 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Extra cycle for indexed addressing
 * - Cycle 5: Read value from (address + X)
 * - Cycle 6: Internal operation, perform rotation
 * - Cycle 7: Write rotated value back to address
 * 
 * Addressing mode: Absolute,X - 3 bytes
 */
function rorAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  cpu.incrementTacts(); // Extra cycle for indexed addressing
  const effectiveAddress = (address + cpu.x) & 0xffff;
  const originalValue = cpu.readMemory(effectiveAddress);
  cpu.incrementTacts(); // Internal operation cycle
  const carryIn = cpu.isCFlagSet() ? 0x80 : 0;
  const rotatedValue = (originalValue >> 1) | carryIn;
  cpu.writeMemory(effectiveAddress, rotatedValue);
  cpu.setRorFlags(originalValue, rotatedValue);
}

/**
 * RRA - Rotate Right then Add - Opcode: $7F (Absolute,X) - Undocumented
 * 
 * Operation: M = (M >> 1) | (C << 7); A = A + M + C
 * 
 * Description:
 * RRA is an undocumented instruction that combines ROR and ADC operations.
 * It first performs a rotate right on the memory byte at the absolute address
 * indexed by X (bit 0 → carry, carry → bit 7), then adds the rotated result
 * to the accumulator with carry. Always takes 7 cycles.
 * 
 * Flags affected:
 * - C (Carry): Set if addition result > 255, cleared otherwise
 * - Z (Zero): Set if accumulator result is zero, cleared otherwise
 * - V (Overflow): Set if signed addition overflow occurs, cleared otherwise
 * - N (Negative): Set if bit 7 of accumulator result is set, cleared otherwise
 * 
 * Timing: 7 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Extra cycle for indexed addressing
 * - Cycle 5: Read value from (address + X)
 * - Cycle 6: Internal operation, perform rotation and addition
 * - Cycle 7: Write rotated value back to address
 * 
 * Addressing mode: Absolute,X - 3 bytes
 */
function rraAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const targetAddress = (baseAddress + cpu.x) & 0xFFFF;
  cpu.incrementTacts(); // Page boundary check for read
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  
  // Perform ROR operation
  const carryIn = cpu.isCFlagSet() ? 0x80 : 0;
  const rotatedValue = (originalValue >> 1) | carryIn;
  cpu.writeMemory(targetAddress, rotatedValue);
  
  // Set ROR flags (this sets the carry flag based on bit 0 of original value)
  cpu.setRorFlags(originalValue, rotatedValue);
  
  // Then perform ADC with accumulator using the carry flag set by ROR
  const adcCarryIn = cpu.isCFlagSet() ? 1 : 0;
  const result = cpu.a + rotatedValue + adcCarryIn;
  cpu.setAdcFlags(cpu.a, rotatedValue, result);
  cpu.a = result & 0xFF;
}

/**
 * DOP - Double NOP - Opcode: $80, $82, $89, $C2, $E2 (Immediate) - Undocumented
 * 
 * Operation: None (dummy read)
 * 
 * Description:
 * DOP is an undocumented instruction that performs a "double NOP" operation.
 * It reads the immediate value but does not use it for any operation. This
 * instruction effectively skips the next byte, making it a 2-byte, 2-cycle
 * NOP instruction. The immediate value is fetched but discarded.
 * 
 * Flags affected: None
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch and discard immediate value
 * 
 * Addressing mode: Immediate - 2 bytes
 * Alternative names: NOP, SKB (Skip Byte)
 */
function dopImm(cpu: M6510Cpu): void {
  cpu.readMemory(cpu.pc++); // Read and discard the immediate value
}

/**
 * STA - Store Accumulator - Opcode: $81 (Indexed Indirect X)
 * 
 * Operation: M = A
 * 
 * Description:
 * Stores the contents of the accumulator to the memory location addressed
 * by indexed indirect mode. The zero page base address is added to the X
 * register to form an effective address in zero page. This effective address
 * points to the low byte of the target address, with the high byte at the
 * next location. Both pointer reads wrap around in zero page.
 * 
 * Flags affected: None
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page base address
 * - Cycle 3: Add X to base address (internal operation)
 * - Cycle 4: Fetch low byte of target address from (base + X) & 0xFF
 * - Cycle 5: Fetch high byte of target address from (base + X + 1) & 0xFF
 * - Cycle 6: Store accumulator to target address
 * 
 * Addressing mode: Indexed Indirect X - 2 bytes
 */
function staIndX(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const effectiveAddress = (zeroPageAddress + cpu.x) & 0xFF; // Wrap around in zero page
  cpu.incrementTacts();
  const low = cpu.readMemory(effectiveAddress);
  const high = cpu.readMemory((effectiveAddress + 1) & 0xFF); // Handle wrap-around for high byte too
  const targetAddress = (high << 8) | low;
  cpu.writeMemory(targetAddress, cpu.a);
}

/**
 * SAX - Store A AND X - Opcode: $83 ((Indirect,X)) - Undocumented
 * 
 * Operation: M = A & X
 * 
 * Description:
 * SAX is an undocumented instruction that stores the bitwise AND of the
 * accumulator and X register to memory using indexed indirect addressing.
 * The zero page address is indexed by X, then the contents of that address
 * pair form the target address. All arithmetic wraps within the zero page.
 * 
 * Flags affected: None
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add X to address (internal operation)
 * - Cycle 4: Read low byte of target address from (zp + X)
 * - Cycle 5: Read high byte of target address from (zp + X + 1)
 * - Cycle 6: Store (A & X) to target address
 * 
 * Addressing mode: (Indirect,X) - 2 bytes
 * Alternative names: AXS
 */
function saxIndX(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const effectiveAddress = (zeroPageAddress + cpu.x) & 0xFF; // Wrap around in zero page
  cpu.incrementTacts();
  const low = cpu.readMemory(effectiveAddress);
  const high = cpu.readMemory((effectiveAddress + 1) & 0xFF); // Handle wrap-around for high byte too
  const targetAddress = (high << 8) | low;
  const result = cpu.a & cpu.x;
  cpu.writeMemory(targetAddress, result);
}

/**
 * STY - Store Y Register - Opcode: $84 (Zero Page)
 * 
 * Operation: M = Y
 * 
 * Description:
 * Stores the contents of the Y register to the specified zero page memory
 * location. This is a simple store operation that transfers the Y register
 * value directly to memory without affecting any processor flags.
 * 
 * Flags affected: None
 * 
 * Timing: 3 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Store Y register to zero page address
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function styZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.writeMemory(zpAddress, cpu.y);
}

/**
 * STA - Store Accumulator - Opcode: $85 (Zero Page)
 * 
 * Operation: M = A
 * 
 * Description:
 * Stores the contents of the accumulator to the specified zero page memory
 * location. This is a simple store operation that transfers the accumulator
 * value directly to memory without affecting any processor flags.
 * 
 * Flags affected: None
 * 
 * Timing: 3 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Store accumulator to zero page address
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function staZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.writeMemory(zpAddress, cpu.a);
}

/**
 * STX - Store X Register - Opcode: $86 (Zero Page)
 * 
 * Operation: M = X
 * 
 * Description:
 * Stores the contents of the X register to the specified zero page memory
 * location. This is a simple store operation that transfers the X register
 * value directly to memory without affecting any processor flags.
 * 
 * Flags affected: None
 * 
 * Timing: 3 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Store X register to zero page address
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function stxZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.writeMemory(zpAddress, cpu.x);
}

/**
 * SAX - Store A AND X - Opcode: $87 (Zero Page) - Undocumented
 * 
 * Operation: M = A & X
 * 
 * Description:
 * SAX is an undocumented instruction that stores the bitwise AND of the
 * accumulator and X register to a zero page memory location. This is the
 * fastest addressing mode for SAX operations.
 * 
 * Flags affected: None
 * 
 * Timing: 3 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Store (A & X) to zero page address
 * 
 * Addressing mode: Zero Page - 2 bytes
 * Alternative names: AXS
 */
function saxZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const result = cpu.a & cpu.x;
  cpu.writeMemory(zpAddress, result);
}

/**
 * DEY - Decrement Y Register - Opcode: $88
 * 
 * Operation: Y = Y - 1
 * 
 * Description:
 * Decrements the Y register by one. The decrement wraps around from $00 to $FF.
 * This instruction is commonly used in loops for counting down or in indexed
 * addressing operations where the index needs to be decremented.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation, decrement Y register
 * 
 * Addressing mode: Implied - 1 byte
 */
function dey(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // One additional cycle for the operation
  cpu.y = (cpu.y - 1) & 0xFF;
  cpu.setZeroAndNegativeFlags(cpu.y);
}

/**
 * TXA - Transfer X to Accumulator - Opcode: $8A
 * 
 * Operation: A = X
 * 
 * Description:
 * Copies the contents of the X register to the accumulator. This is a
 * register transfer operation commonly used to move data between registers
 * for arithmetic operations or to prepare values for memory storage.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation, transfer X to accumulator
 * 
 * Addressing mode: Implied - 1 byte
 */
function txa(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.a = cpu.x;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * XAA - X and Accumulator AND - Opcode: $8B (Immediate) - Undocumented
 * 
 * Operation: A = (A | CONST) & X & M
 * 
 * Description:
 * XAA is a highly unstable undocumented instruction that performs a complex
 * operation involving the accumulator, X register, and immediate operand.
 * The instruction ORs the accumulator with a magic constant (typically 0xEE,
 * 0xEF, or 0xFF depending on the chip), then ANDs the result with X and the
 * immediate operand. Due to hardware quirks, behavior can vary between chips.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if result is zero
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch immediate operand and execute
 * 
 * Addressing mode: Immediate - 2 bytes
 * Alternative names: ANE
 * 
 * Note: This instruction is highly unstable and may behave differently
 * on different 6502/6510 chips. Use with extreme caution.
 */
function xaaImm(cpu: M6510Cpu): void {
  const operand = cpu.readMemory(cpu.pc++);
  
  // This instruction has unstable behavior, but a common implementation is:
  // A = (A | CONST) & X & operand
  // Where CONST is typically 0xEE, 0xEF, or 0xFF depending on the chip
  // For consistency, we'll use 0xEE
  const MAGIC_CONST = 0xEE;
  
  cpu.a = (cpu.a | MAGIC_CONST) & cpu.x & operand;
  
  // Set flags based on the result
  cpu.p &= ~(FlagSetMask6510.Z | FlagSetMask6510.N);
  
  if (cpu.a === 0) {
    cpu.p |= FlagSetMask6510.Z;
  }
  
  if (cpu.a & 0x80) {
    cpu.p |= FlagSetMask6510.N;
  }
}

/**
 * STY - Store Y Register - Opcode: $8C (Absolute)
 * 
 * Operation: M = Y
 * 
 * Description:
 * Stores the contents of the Y register to the specified absolute memory
 * location. The instruction reads a 16-bit address and stores the Y register
 * value to that location without affecting any processor flags.
 * 
 * Flags affected: None
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Store Y register to address
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function styAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  cpu.writeMemory(address, cpu.y);
}

/**
 * STA - Store Accumulator - Opcode: $8D (Absolute)
 * 
 * Operation: M = A
 * 
 * Description:
 * Stores the contents of the accumulator to the specified absolute memory
 * location. The instruction reads a 16-bit address and stores the accumulator
 * value to that location without affecting any processor flags.
 * 
 * Flags affected: None
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Store accumulator to address
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function staAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  cpu.writeMemory(address, cpu.a);
}

/**
 * STX - Store X Register - Opcode: $8E (Absolute)
 * 
 * Operation: M = X
 * 
 * Description:
 * Stores the contents of the X register to the specified absolute memory
 * location. The instruction reads a 16-bit address and stores the X register
 * value to that location without affecting any processor flags.
 * 
 * Flags affected: None
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Store X register to address
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function stxAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  cpu.writeMemory(address, cpu.x);
}

/**
 * SAX - Store A AND X - Opcode: $8F (Absolute) - Undocumented
 * 
 * Operation: M = A & X
 * 
 * Description:
 * SAX is an undocumented instruction that stores the bitwise AND of the
 * accumulator and X register to an absolute memory location. This addressing
 * mode allows storing the result anywhere in the 64K address space.
 * 
 * Flags affected: None
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Store (A & X) to absolute address
 * 
 * Addressing mode: Absolute - 3 bytes
 * Alternative names: AXS
 */
function saxAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const result = cpu.a & cpu.x;
  cpu.writeMemory(address, result);
}

/**
 * BCC - Branch if Carry Clear - Opcode: $90
 * 
 * Operation: If C = 0, PC = PC + offset
 * 
 * Description:
 * BCC tests the carry flag and branches if it is clear (0). The branch
 * target is calculated by adding the signed 8-bit offset to the program
 * counter. This instruction is commonly used after comparison or arithmetic
 * operations to test for "less than" conditions in unsigned comparisons
 * or to check if no carry occurred in addition operations.
 * 
 * Flags affected: None
 * 
 * Timing: 2+ cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch offset, branch decision
 * - Cycle +1: Add cycle if branch taken
 * - Cycle +1: Add cycle if page boundary crossed
 * 
 * Addressing mode: Relative - 2 bytes
 */
function bcc(cpu: M6510Cpu): void {
  cpu.performBranch(!cpu.isCFlagSet());
}

/**
 * STA - Store Accumulator - Opcode: $91 (Indirect Indexed Y)
 * 
 * Operation: M = A
 * 
 * Description:
 * Stores the contents of the accumulator to the memory location addressed
 * by indirect indexed mode. The zero page address points to the low byte
 * of the base address, with the high byte at the next location. The Y
 * register is added to this base address to form the effective address.
 * Always takes an extra cycle for the indexed addressing calculation.
 * 
 * Flags affected: None
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Fetch low byte of base address from zero page
 * - Cycle 4: Fetch high byte of base address from zero page + 1
 * - Cycle 5: Add Y to base address (internal operation)
 * - Cycle 6: Store accumulator to (base + Y)
 * 
 * Addressing mode: Indirect Indexed Y - 2 bytes
 */
function staIndY(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const low = cpu.readMemory(zeroPageAddress);
  const high = cpu.readMemory((zeroPageAddress + 1) & 0xFF); // Handle zero page wrap-around
  const baseAddress = (high << 8) | low;
  const targetAddress = (baseAddress + cpu.y) & 0xffff;
  cpu.incrementTacts(); // Extra cycle for page crossing
  cpu.writeMemory(targetAddress, cpu.a);
}

/**
 * AXA - A AND X AND High Byte - Opcode: $93 (Indirect Indexed Y) - Undocumented
 * 
 * Operation: M = A & X & (H + 1)
 * 
 * Description:
 * AXA is an unstable undocumented instruction that stores the result of
 * A AND X AND (high byte of target address + 1) to memory. The target
 * address is calculated using indirect indexed Y addressing mode. This
 * instruction can produce unpredictable results and is hardware-dependent.
 * 
 * Flags affected: None
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read low byte from zero page
 * - Cycle 4: Read high byte from zero page
 * - Cycle 5: Page boundary check for Y indexing
 * - Cycle 6: Store result to target address
 * 
 * Addressing mode: Indirect Indexed Y - 2 bytes
 * Alternative names: SHA, AHX
 * 
 * Note: This instruction is unstable and may behave differently
 * on different 6502/6510 chips. The high byte calculation can vary.
 */
function axaIndY(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const low = cpu.readMemory(zpAddress);
  const high = cpu.readMemory((zpAddress + 1) & 0xFF);
  const baseAddress = (high << 8) | low;
  cpu.incrementTacts(); // Page boundary check for indexed addressing
  const targetAddress = (baseAddress + cpu.y) & 0xFFFF;
  
  // AXA behavior: A AND X AND (high byte of target address + 1)
  const result = cpu.a & cpu.x & ((targetAddress >> 8) + 1);
  cpu.writeMemory(targetAddress, result & 0xFF);
}

/**
 * STY - Store Y Register - Opcode: $94 (Zero Page X)
 * 
 * Operation: M = Y
 * 
 * Description:
 * STY stores the contents of the Y register to memory at the specified
 * zero page address plus the X register offset. The address wraps around
 * within the zero page if the sum exceeds $FF.
 * 
 * Flags affected: None
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add X to address (internal operation)
 * - Cycle 4: Store Y to (zero page address + X) & $FF
 * 
 * Addressing mode: Zero Page X - 2 bytes
 */
function styZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Increment tacts for indexed addressing
  cpu.writeMemory((zpAddress + cpu.x) & 0xFF, cpu.y); // Wrap around in zero page
}

/**
 * STA - Store Accumulator - Opcode: $95 (Zero Page X)
 * 
 * Operation: M = A
 * 
 * Description:
 * STA stores the contents of the accumulator to memory at the specified
 * zero page address plus the X register offset. The address wraps around
 * within the zero page if the sum exceeds $FF.
 * 
 * Flags affected: None
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add X to address (internal operation)
 * - Cycle 4: Store A to (zero page address + X) & $FF
 * 
 * Addressing mode: Zero Page X - 2 bytes
 */
function staZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Increment tacts for indexed addressing
  cpu.writeMemory((zpAddress + cpu.x) & 0xFF, cpu.a); // Wrap around in zero page
}

/**
 * STX - Store X Register - Opcode: $96 (Zero Page Y)
 * 
 * Operation: M = X
 * 
 * Description:
 * STX stores the contents of the X register to memory at the specified
 * zero page address plus the Y register offset. The address wraps around
 * within the zero page if the sum exceeds $FF.
 * 
 * Flags affected: None
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add Y to address (internal operation)
 * - Cycle 4: Store X to (zero page address + Y) & $FF
 * 
 * Addressing mode: Zero Page Y - 2 bytes
 */
function stxZpY(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Increment tacts for indexed addressing
  cpu.writeMemory((zpAddress + cpu.y) & 0xFF, cpu.x); // Wrap around in zero page
}

/**
 * SAX - Store A AND X - Opcode: $97 (Zero Page Y) - Undocumented
 * 
 * Operation: M = A & X
 * 
 * Description:
 * SAX is an undocumented instruction that stores the bitwise AND of the
 * accumulator and X register to a zero page memory location indexed by Y.
 * The address wraps around within the zero page if the sum exceeds $FF.
 * 
 * Flags affected: None
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add Y to address (internal operation)
 * - Cycle 4: Store (A & X) to (zero page address + Y) & $FF
 * 
 * Addressing mode: Zero Page Y - 2 bytes
 * Alternative names: AXS
 */
function saxZpY(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const address = (zpAddress + cpu.y) & 0xFF; // Wrap around in zero page
  const result = cpu.a & cpu.x;
  cpu.writeMemory(address, result);
}

/**
 * TYA - Transfer Y to Accumulator - Opcode: $98
 * 
 * Operation: A = Y
 * 
 * Description:
 * Copies the contents of the Y register to the accumulator. This is a
 * register transfer operation commonly used to move data between registers
 * for arithmetic operations or to prepare values for memory storage.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation, transfer Y to accumulator
 * 
 * Addressing mode: Implied - 1 byte
 */
function tya(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.a = cpu.y;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * STA - Store Accumulator - Opcode: $99 (Absolute Y)
 * 
 * Operation: M = A
 * 
 * Description:
 * STA stores the contents of the accumulator to memory at the specified
 * absolute address plus the Y register offset. This instruction always
 * takes an extra cycle for the indexed addressing, regardless of page
 * boundary crossing.
 * 
 * Flags affected: None
 * 
 * Timing: 5 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Add Y to address (indexed addressing)
 * - Cycle 5: Store A to target address
 * 
 * Addressing mode: Absolute Y - 3 bytes
 */
function staAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const targetAddress = (baseAddress + cpu.y) & 0xffff;
  cpu.incrementTacts(); // Extra cycle for indexed addressing
  cpu.writeMemory(targetAddress, cpu.a);
}

/**
 * TXS - Transfer X to Stack Pointer - Opcode: $9A
 * 
 * Operation: SP = X
 * 
 * Description:
 * Copies the contents of the X register to the stack pointer. This instruction
 * is used to set up or modify the stack pointer, typically during stack
 * manipulation or when switching between different stack areas. Note that
 * this instruction does not affect any processor flags.
 * 
 * Flags affected: None
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation, transfer X to stack pointer
 * 
 * Addressing mode: Implied - 1 byte
 */
function txs(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.sp = cpu.x;
}

/**
 * SYA - Store Y AND High Byte - Opcode: $9C (Absolute X) - Undocumented
 * 
 * Operation: M = Y & (H + 1)
 * 
 * Description:
 * SYA is an unstable undocumented instruction that stores the result of
 * Y AND (high byte of target address + 1) to memory. The target address
 * is calculated using absolute X addressing mode. This instruction can
 * produce unpredictable results and is hardware-dependent.
 * 
 * Flags affected: None
 * 
 * Timing: 5 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Add X to address (indexed addressing)
 * - Cycle 5: Store result to target address
 * 
 * Addressing mode: Absolute X - 3 bytes
 * Alternative names: SHY
 * 
 * Note: This instruction is unstable and may behave differently
 * on different 6502/6510 chips. The high byte calculation can vary.
 */
function syaAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const targetAddress = (baseAddress + cpu.x) & 0xFFFF;
  
  // Extra read cycle for indexed addressing
  cpu.incrementTacts();
  
  // Calculate the high byte of the target address + 1
  const highBytePlusOne = ((targetAddress >> 8) + 1) & 0xFF;
  
  // Store Y AND (high byte + 1)
  const result = cpu.y & highBytePlusOne;
  cpu.writeMemory(targetAddress, result);
}

/**
 * STA - Store Accumulator - Opcode: $9D (Absolute X)
 * 
 * Operation: M = A
 * 
 * Description:
 * STA stores the contents of the accumulator to memory at the specified
 * absolute address plus the X register offset. This instruction always
 * takes an extra cycle for the indexed addressing, regardless of page
 * boundary crossing.
 * 
 * Flags affected: None
 * 
 * Timing: 5 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Add X to address (indexed addressing)
 * - Cycle 5: Store A to target address
 * 
 * Addressing mode: Absolute X - 3 bytes
 */
function staAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const targetAddress = (baseAddress + cpu.x) & 0xffff;
  cpu.incrementTacts(); // Extra cycle for indexed addressing
  cpu.writeMemory(targetAddress, cpu.a);
}

/**
 * SXA - Store X AND High Byte - Opcode: $9E (Absolute Y) - Undocumented
 * 
 * Operation: M = X & (H + 1)
 * 
 * Description:
 * SXA is an unstable undocumented instruction that stores the result of
 * X AND (high byte of target address + 1) to memory. The target address
 * is calculated using absolute Y addressing mode. This instruction can
 * produce unpredictable results and is hardware-dependent.
 * 
 * Flags affected: None
 * 
 * Timing: 5 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Add Y to address (indexed addressing)
 * - Cycle 5: Store result to target address
 * 
 * Addressing mode: Absolute Y - 3 bytes
 * Alternative names: SHX
 * 
 * Note: This instruction is unstable and may behave differently
 * on different 6502/6510 chips. The high byte calculation can vary.
 */
function sxaAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const targetAddress = (baseAddress + cpu.y) & 0xFFFF;
  
  // Extra read cycle for indexed addressing
  cpu.incrementTacts();
  
  // Calculate the high byte of the target address + 1
  const highBytePlusOne = ((targetAddress >> 8) + 1) & 0xFF;
  
  // Store X AND (high byte + 1)
  const result = cpu.x & highBytePlusOne;
  cpu.writeMemory(targetAddress, result);
}

/**
 * AXA - A AND X AND High Byte - Opcode: $9F (Absolute Y) - Undocumented
 * 
 * Operation: M = A & X & (H + 1)
 * 
 * Description:
 * AXA is an unstable undocumented instruction that stores the result of
 * A AND X AND (high byte of target address + 1) to memory. The target
 * address is calculated using absolute Y addressing mode. This instruction
 * can produce unpredictable results and is hardware-dependent.
 * 
 * Flags affected: None
 * 
 * Timing: 5 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Add Y to address (indexed addressing)
 * - Cycle 5: Store result to target address
 * 
 * Addressing mode: Absolute Y - 3 bytes
 * Alternative names: SHA, AHX
 * 
 * Note: This instruction is unstable and may behave differently
 * on different 6502/6510 chips. The high byte calculation can vary.
 */
function axaAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  cpu.incrementTacts(); // Extra cycle for indexed addressing
  const targetAddress = (baseAddress + cpu.y) & 0xFFFF;
  
  // AXA behavior: A AND X AND (high byte of target address + 1)
  const result = cpu.a & cpu.x & ((targetAddress >> 8) + 1);
  cpu.writeMemory(targetAddress, result & 0xFF);
}

/**
 * LDY - Load Y Register - Opcode: $A0 (Immediate)
 * 
 * Operation: Y = M
 * 
 * Description:
 * Loads an immediate 8-bit value into the Y register. This instruction is
 * commonly used to initialize the Y register with a constant value for
 * use in indexed addressing modes or as a counter in loops.
 * 
 * Flags affected:
 * - Z (Zero): Set if loaded value is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of loaded value is set, cleared otherwise
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch immediate value, load into Y register
 * 
 * Addressing mode: Immediate - 2 bytes
 */
function ldyImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.y = value;
  cpu.setZeroAndNegativeFlags(value);
}

/**
 * LDA - Load Accumulator - Opcode: $A1 (Indexed Indirect X)
 * 
 * Operation: A = M
 * 
 * Description:
 * Loads a value into the accumulator from the memory location addressed
 * by indexed indirect mode. The zero page base address is added to the X
 * register to form an effective address in zero page. This effective address
 * points to the low byte of the target address, with the high byte at the
 * next location.
 * 
 * Flags affected:
 * - Z (Zero): Set if loaded value is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of loaded value is set, cleared otherwise
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page base address
 * - Cycle 3: Add X to base address (internal operation)
 * - Cycle 4: Fetch low byte of target address from (base + X)
 * - Cycle 5: Fetch high byte of target address from (base + X + 1)
 * - Cycle 6: Load value from target address into accumulator
 * 
 * Addressing mode: Indexed Indirect X - 2 bytes
 */
function ldaIndX(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const effectiveAddress = zeroPageAddress + cpu.x;
  cpu.incrementTacts();
  const low = cpu.readMemory(effectiveAddress);
  const high = cpu.readMemory((effectiveAddress + 1));
  cpu.a = cpu.readMemory((high << 8) | low);
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * LDX - Load X Register - Opcode: $A2 (Immediate)
 * 
 * Operation: X = M
 * 
 * Description:
 * Loads an immediate 8-bit value into the X register. This instruction is
 * commonly used to initialize the X register with a constant value for
 * use in indexed addressing modes or as a counter in loops.
 * 
 * Flags affected:
 * - Z (Zero): Set if loaded value is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of loaded value is set, cleared otherwise
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch immediate value, load into X register
 * 
 * Addressing mode: Immediate - 2 bytes
 */
function ldxImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.x = value;
  cpu.setZeroAndNegativeFlags(value);
}

/**
 * LAX - Load A and X - Opcode: $A3 (Indexed Indirect X) - Undocumented
 * 
 * Operation: A = M, X = M
 * 
 * Description:
 * LAX is an undocumented instruction that loads the same value from memory
 * into both the accumulator and X register. It uses indexed indirect
 * addressing mode where the zero page address is added to X, then the
 * resulting address is used to fetch a 16-bit pointer to the target data.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if loaded value is zero
 * - N: Set if bit 7 of loaded value is set
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add X to zero page address
 * - Cycle 4: Read low byte of target address from (zp + X)
 * - Cycle 5: Read high byte of target address from (zp + X + 1)
 * - Cycle 6: Read value from target address
 * 
 * Addressing mode: Indexed Indirect X - 2 bytes
 */
function laxIndX(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const effectiveAddress = (zeroPageAddress + cpu.x) & 0xFF; // Wrap around in zero page
  cpu.incrementTacts();
  const low = cpu.readMemory(effectiveAddress);
  const high = cpu.readMemory((effectiveAddress + 1) & 0xFF); // Handle wrap-around for high byte too
  const targetAddress = (high << 8) | low;
  const value = cpu.readMemory(targetAddress);
  cpu.a = value;
  cpu.x = value;
  cpu.setZeroAndNegativeFlags(value);
}

/**
 * LDY - Load Y Register - Opcode: $A4 (Zero Page)
 * 
 * Operation: Y = M
 * 
 * Description:
 * LDY loads a value from zero page memory into the Y register.
 * This is the fastest addressing mode for loading the Y register.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if loaded value is zero
 * - N: Set if bit 7 of loaded value is set
 * 
 * Timing: 3 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read value from zero page address
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function ldyZp(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.y = cpu.readMemory(value);
  cpu.setZeroAndNegativeFlags(cpu.y);
}

/**
 * LDA - Load Accumulator - Opcode: $A5 (Zero Page)
 * 
 * Operation: A = M
 * 
 * Description:
 * LDA loads a value from zero page memory into the accumulator.
 * This is the fastest addressing mode for loading the accumulator.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if loaded value is zero
 * - N: Set if bit 7 of loaded value is set
 * 
 * Timing: 3 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read value from zero page address
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function ldaZp(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.a = cpu.readMemory(value);
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * LDX - Load X Register - Opcode: $A6 (Zero Page)
 * 
 * Operation: X = M
 * 
 * Description:
 * LDX loads a value from zero page memory into the X register.
 * This is the fastest addressing mode for loading the X register.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if loaded value is zero
 * - N: Set if bit 7 of loaded value is set
 * 
 * Timing: 3 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read value from zero page address
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function ldxZp(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.x = cpu.readMemory(value);
  cpu.setZeroAndNegativeFlags(cpu.x);
}

/**
 * LAX - Load A and X - Opcode: $A7 (Zero Page) - Undocumented
 * 
 * Operation: A = M, X = M
 * 
 * Description:
 * LAX is an undocumented instruction that loads the same value from zero
 * page memory into both the accumulator and X register. This provides a
 * fast way to load both registers with the same value.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if loaded value is zero
 * - N: Set if bit 7 of loaded value is set
 * 
 * Timing: 3 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read value from zero page address
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function laxZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const value = cpu.readMemory(zpAddress);
  cpu.a = value;
  cpu.x = value;
  cpu.setZeroAndNegativeFlags(value);
}

/**
 * TAY - Transfer Accumulator to Y - Opcode: $A8
 * 
 * Operation: Y = A
 * 
 * Description:
 * Copies the contents of the accumulator to the Y register. This is a
 * register transfer operation commonly used to move data between registers
 * for use in indexed addressing modes or as a backup of the accumulator value.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation, transfer accumulator to Y
 * 
 * Addressing mode: Implied - 1 byte
 */
function tay(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.y = cpu.a;
  cpu.setZeroAndNegativeFlags(cpu.y);
}

/**
 * LDA - Load Accumulator - Opcode: $A9 (Immediate)
 * 
 * Operation: A = M
 * 
 * Description:
 * Loads an immediate 8-bit value into the accumulator. This is one of the
 * most commonly used instructions for initializing the accumulator with
 * a constant value for arithmetic operations, comparisons, or memory storage.
 * 
 * Flags affected:
 * - Z (Zero): Set if loaded value is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of loaded value is set, cleared otherwise
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch immediate value, load into accumulator
 * 
 * Addressing mode: Immediate - 2 bytes
 */
function ldaImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.a = value;
  cpu.setZeroAndNegativeFlags(value);
}

/**
 * TAX - Transfer Accumulator to X - Opcode: $AA
 * 
 * Operation: X = A
 * 
 * Description:
 * Copies the contents of the accumulator to the X register. This is a
 * register transfer operation commonly used to move data between registers
 * for use in indexed addressing modes or as a backup of the accumulator value.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation, transfer accumulator to X
 * 
 * Addressing mode: Implied - 1 byte
 */
function tax(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.x = cpu.a;
  cpu.setZeroAndNegativeFlags(cpu.x);
}

/**
 * ATX - AND Then Transfer X - Opcode: $AB (Immediate) - Undocumented
 * 
 * Operation: A = A & M, X = A
 * 
 * Description:
 * ATX is an undocumented instruction that performs an AND operation between
 * the accumulator and immediate operand, then transfers the result to the
 * X register. This combines the functionality of AND immediate and TAX
 * in a single instruction.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if result is zero
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch immediate operand and execute
 * 
 * Addressing mode: Immediate - 2 bytes
 * Alternative names: LXA, OAL
 */
function atxImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  
  // AND with accumulator
  cpu.a = cpu.a & value;
  
  // Transfer accumulator to X
  cpu.x = cpu.a;
  
  // Set N and Z flags based on result
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * LDY - Load Y Register - Opcode: $AC (Absolute)
 * 
 * Operation: Y = M
 * 
 * Description:
 * LDY loads a value from absolute memory into the Y register.
 * This addressing mode allows loading from any location in the
 * 64K address space.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if loaded value is zero
 * - N: Set if bit 7 of loaded value is set
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from absolute address
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function ldyAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const addr = (high << 8) | low;
  cpu.y = cpu.readMemory(addr);
  cpu.setZeroAndNegativeFlags(cpu.y);
}

/**
 * LDA - Load Accumulator - Opcode: $AD (Absolute)
 * 
 * Operation: A = M
 * 
 * Description:
 * LDA loads a value from absolute memory into the accumulator.
 * This addressing mode allows loading from any location in the
 * 64K address space.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if loaded value is zero
 * - N: Set if bit 7 of loaded value is set
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from absolute address
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function ldaAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const addr = (high << 8) | low;
  cpu.a = cpu.readMemory(addr);
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * LDX - Load X Register - Opcode: $AE (Absolute)
 * 
 * Operation: X = M
 * 
 * Description:
 * LDX loads a value from absolute memory into the X register.
 * This addressing mode allows loading from any location in the
 * 64K address space.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if loaded value is zero
 * - N: Set if bit 7 of loaded value is set
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from absolute address
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function ldxAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const addr = (high << 8) | low;
  cpu.x = cpu.readMemory(addr);
  cpu.setZeroAndNegativeFlags(cpu.x);
}

/**
 * LAX - Load A and X - Opcode: $AF (Absolute) - Undocumented
 * 
 * Operation: A = M, X = M
 * 
 * Description:
 * LAX is an undocumented instruction that loads the same value from
 * absolute memory into both the accumulator and X register. This
 * addressing mode allows loading from any location in the 64K address space.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if loaded value is zero
 * - N: Set if bit 7 of loaded value is set
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from absolute address
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function laxAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemory(address);
  cpu.a = value;
  cpu.x = value;
  cpu.setZeroAndNegativeFlags(value);
}

/**
 * BCS - Branch if Carry Set - Opcode: $B0
 * 
 * Operation: If C = 1, PC = PC + offset
 * 
 * Description:
 * BCS tests the carry flag and branches if it is set (1). The branch
 * target is calculated by adding the signed 8-bit offset to the program
 * counter. This instruction is commonly used after comparison or arithmetic
 * operations to test for "greater than or equal" conditions in unsigned
 * comparisons or to check if a carry occurred in addition operations.
 * 
 * Flags affected: None
 * 
 * Timing: 2+ cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch offset, branch decision
 * - Cycle +1: Add cycle if branch taken
 * - Cycle +1: Add cycle if page boundary crossed
 * 
 * Addressing mode: Relative - 2 bytes
 */
function bcs(cpu: M6510Cpu): void {
  cpu.performBranch(cpu.isCFlagSet());
}

/**
 * LDA - Load Accumulator - Opcode: $B1 (Indirect Indexed Y)
 * 
 * Operation: A = M
 * 
 * Description:
 * LDA loads a value from memory into the accumulator using indirect indexed Y
 * addressing. The zero page address contains a 16-bit pointer, which is added
 * to the Y register to form the final address. An extra cycle is added if a
 * page boundary is crossed during Y indexing.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if loaded value is zero
 * - N: Set if bit 7 of loaded value is set
 * 
 * Timing: 5 cycles (+1 if page boundary crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read low byte of target address from zero page
 * - Cycle 4: Read high byte of target address from zero page + 1
 * - Cycle 5: Read value from (target address + Y)
 * - Cycle 6: Page boundary penalty (if crossing occurs)
 * 
 * Addressing mode: Indirect Indexed Y - 2 bytes
 */
function ldaIndY(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const low = cpu.readMemory(zeroPageAddress);
  const high = cpu.readMemory((zeroPageAddress + 1));
  cpu.a = cpu.readMemoryWithPageBoundary((high << 8) | low, cpu.y);
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * LAX - Load A and X - Opcode: $B3 (Indirect Indexed Y) - Undocumented
 * 
 * Operation: A = M, X = M
 * 
 * Description:
 * LAX is an undocumented instruction that loads the same value from memory
 * into both the accumulator and X register using indirect indexed Y addressing.
 * The zero page address contains a 16-bit pointer, which is added to the Y
 * register to form the final address. An extra cycle is added if a page
 * boundary is crossed during Y indexing.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if loaded value is zero
 * - N: Set if bit 7 of loaded value is set
 * 
 * Timing: 5 cycles (+1 if page boundary crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read low byte of target address from zero page
 * - Cycle 4: Read high byte of target address from zero page + 1
 * - Cycle 5: Read value from (target address + Y)
 * - Cycle 6: Page boundary penalty (if crossing occurs)
 * 
 * Addressing mode: Indirect Indexed Y - 2 bytes
 */
function laxIndY(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const low = cpu.readMemory(zeroPageAddress);
  const high = cpu.readMemory((zeroPageAddress + 1) & 0xFF); // Handle wrap-around
  const baseAddress = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(baseAddress, cpu.y);
  cpu.a = value;
  cpu.x = value;
  cpu.setZeroAndNegativeFlags(value);
}

/**
 * LDY - Load Y Register - Opcode: $B4 (Zero Page X)
 * 
 * Operation: Y = M
 * 
 * Description:
 * LDY loads a value from zero page memory into the Y register using X
 * register indexing. The final address is (zero page address + X) with
 * wraparound within the zero page if the sum exceeds $FF.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if loaded value is zero
 * - N: Set if bit 7 of loaded value is set
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add X to address (internal operation)
 * - Cycle 4: Read value from (zero page address + X) & $FF
 * 
 * Addressing mode: Zero Page X - 2 bytes
 */
function ldyZpX(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts();
  cpu.y = cpu.readMemory(zeroPageAddress + cpu.x);
  cpu.setZeroAndNegativeFlags(cpu.y);
}

/**
 * LDA - Load Accumulator - Opcode: $B5 (Zero Page X)
 * 
 * Operation: A = M
 * 
 * Description:
 * LDA loads a value from zero page memory into the accumulator using X
 * register indexing. The final address is (zero page address + X) with
 * wraparound within the zero page if the sum exceeds $FF.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if loaded value is zero
 * - N: Set if bit 7 of loaded value is set
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add X to address (internal operation)
 * - Cycle 4: Read value from (zero page address + X) & $FF
 * 
 * Addressing mode: Zero Page X - 2 bytes
 */
function ldaZpX(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts();
  cpu.a = cpu.readMemory(zeroPageAddress + cpu.x);
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * LDX - Load X Register - Opcode: $B6 (Zero Page Y)
 * 
 * Operation: X = M
 * 
 * Description:
 * LDX loads a value from zero page memory into the X register using Y
 * register indexing. The final address is (zero page address + Y) with
 * wraparound within the zero page if the sum exceeds $FF.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if loaded value is zero
 * - N: Set if bit 7 of loaded value is set
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add Y to address (internal operation)
 * - Cycle 4: Read value from (zero page address + Y) & $FF
 * 
 * Addressing mode: Zero Page Y - 2 bytes
 */
function ldxZpY(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts();
  cpu.x = cpu.readMemory(zeroPageAddress + cpu.y);
  cpu.setZeroAndNegativeFlags(cpu.x);
}

/**
 * LAX - Load A and X - Opcode: $B7 (Zero Page Y) - Undocumented
 * 
 * Operation: A = M, X = M
 * 
 * Description:
 * LAX is an undocumented instruction that loads the same value from zero
 * page memory into both the accumulator and X register using Y register
 * indexing. The final address is (zero page address + Y) with wraparound
 * within the zero page if the sum exceeds $FF.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if loaded value is zero
 * - N: Set if bit 7 of loaded value is set
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add Y to address (internal operation)
 * - Cycle 4: Read value from (zero page address + Y) & $FF
 * 
 * Addressing mode: Zero Page Y - 2 bytes
 */
function laxZpY(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const address = (zpAddress + cpu.y) & 0xFF; // Wrap around in zero page
  const value = cpu.readMemory(address);
  cpu.a = value;
  cpu.x = value;
  cpu.setZeroAndNegativeFlags(value);
}

/**
 * CLV - Clear Overflow Flag - Opcode: $B8
 * 
 * Operation: V = 0
 * 
 * Description:
 * CLV clears the overflow flag. This instruction is used to reset the
 * overflow flag after it has been set by arithmetic operations (ADC, SBC)
 * or the BIT instruction. The overflow flag indicates when signed arithmetic
 * operations produce results outside the valid range (-128 to +127).
 * 
 * Flags affected:
 * - V (Overflow): Set to 0
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation, clear overflow flag
 * 
 * Addressing mode: Implied - 1 byte
 */
function clv(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.p &= ~FlagSetMask6510.V;
}

/**
 * LDA - Load Accumulator - Opcode: $B9 (Absolute Y)
 * 
 * Operation: A = M
 * 
 * Description:
 * LDA loads a value from absolute memory into the accumulator using Y
 * register indexing. An extra cycle is added if a page boundary is
 * crossed during the Y indexing operation.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if loaded value is zero
 * - N: Set if bit 7 of loaded value is set
 * 
 * Timing: 4 cycles (+1 if page boundary crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from (absolute address + Y)
 * - Cycle 5: Page boundary penalty (if crossing occurs)
 * 
 * Addressing mode: Absolute Y - 3 bytes
 */
function ldaAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const addr = (high << 8) | low;
  cpu.a = cpu.readMemoryWithPageBoundary(addr, cpu.y);
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * TSX - Transfer Stack Pointer to X - Opcode: $BA
 * 
 * Operation: X = SP
 * 
 * Description:
 * Copies the contents of the stack pointer to the X register. This instruction
 * is used to read the current stack pointer value, typically for stack
 * manipulation routines or to save the stack pointer state. The flags are
 * updated based on the transferred value.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation, transfer stack pointer to X
 * 
 * Addressing mode: Implied - 1 byte
 */
function tsx(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.x = cpu.sp;
  cpu.setZeroAndNegativeFlags(cpu.x);
}

/**
 * LAR - Load A, X, and SP - Opcode: $BB (Absolute Y) - Undocumented
 * 
 * Operation: A = SP & M, X = SP & M, SP = SP & M
 * 
 * Description:
 * LAR is a highly unstable undocumented instruction that ANDs the stack
 * pointer with memory, then stores the result in the accumulator, X register,
 * and stack pointer. This instruction can severely disrupt normal program
 * execution by modifying the stack pointer. An extra cycle is added if a
 * page boundary is crossed during Y indexing.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if result is zero
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 4 cycles (+1 if page boundary crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value and perform operation
 * - Cycle 5: Page boundary penalty (if crossing occurs)
 * 
 * Addressing mode: Absolute Y - 3 bytes
 * Alternative names: LAS, LAE
 * 
 * Warning: This instruction modifies the stack pointer and should be
 * used with extreme caution as it can crash the system.
 */
function larAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const targetAddress = (baseAddress + cpu.y) & 0xFFFF;
  
  // Check for page boundary crossing
  if ((baseAddress & 0xFF00) !== (targetAddress & 0xFF00)) {
    cpu.incrementTacts(); // Extra cycle for page boundary crossing
  }
  
  const memoryValue = cpu.readMemory(targetAddress);
  const result = cpu.sp & memoryValue;
  
  cpu.a = result;
  cpu.x = result;
  cpu.sp = result;
  
  cpu.setZeroAndNegativeFlags(result);
}

/**
 * LDY - Load Y Register - Opcode: $BC (Absolute X)
 * 
 * Operation: Y = M
 * 
 * Description:
 * LDY loads a value from absolute memory into the Y register using X
 * register indexing. An extra cycle is added if a page boundary is
 * crossed during the X indexing operation.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if loaded value is zero
 * - N: Set if bit 7 of loaded value is set
 * 
 * Timing: 4 cycles (+1 if page boundary crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from (absolute address + X)
 * - Cycle 5: Page boundary penalty (if crossing occurs)
 * 
 * Addressing mode: Absolute X - 3 bytes
 */
function ldyAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const addr = (high << 8) | low;
  cpu.y = cpu.readMemoryWithPageBoundary(addr, cpu.x);
  cpu.setZeroAndNegativeFlags(cpu.y);
}

/**
 * LDA - Load Accumulator - Opcode: $BD (Absolute X)
 * 
 * Operation: A = M
 * 
 * Description:
 * LDA loads a value from absolute memory into the accumulator using X
 * register indexing. An extra cycle is added if a page boundary is
 * crossed during the X indexing operation.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if loaded value is zero
 * - N: Set if bit 7 of loaded value is set
 * 
 * Timing: 4 cycles (+1 if page boundary crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from (absolute address + X)
 * - Cycle 5: Page boundary penalty (if crossing occurs)
 * 
 * Addressing mode: Absolute X - 3 bytes
 */
function ldaAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const addr = (high << 8) | low;
  cpu.a = cpu.readMemoryWithPageBoundary(addr, cpu.x);
  cpu.setZeroAndNegativeFlags(cpu.a);
}

/**
 * LDX - Load X Register - Opcode: $BE (Absolute Y)
 * 
 * Operation: X = M
 * 
 * Description:
 * LDX loads a value from absolute memory into the X register using Y
 * register indexing. An extra cycle is added if a page boundary is
 * crossed during the Y indexing operation.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if loaded value is zero
 * - N: Set if bit 7 of loaded value is set
 * 
 * Timing: 4 cycles (+1 if page boundary crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from (absolute address + Y)
 * - Cycle 5: Page boundary penalty (if crossing occurs)
 * 
 * Addressing mode: Absolute Y - 3 bytes
 */
function ldxAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const addr = (high << 8) | low;
  cpu.x = cpu.readMemoryWithPageBoundary(addr, cpu.y);
  cpu.setZeroAndNegativeFlags(cpu.x);
}

/**
 * LAX - Load A and X - Opcode: $BF (Absolute Y) - Undocumented
 * 
 * Operation: A = M, X = M
 * 
 * Description:
 * LAX is an undocumented instruction that loads the same value from
 * absolute memory into both the accumulator and X register using Y
 * register indexing. An extra cycle is added if a page boundary is
 * crossed during the Y indexing operation.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if loaded value is zero
 * - N: Set if bit 7 of loaded value is set
 * 
 * Timing: 4 cycles (+1 if page boundary crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from (absolute address + Y)
 * - Cycle 5: Page boundary penalty (if crossing occurs)
 * 
 * Addressing mode: Absolute Y - 3 bytes
 */
function laxAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(baseAddress, cpu.y);
  cpu.a = value;
  cpu.x = value;
  cpu.setZeroAndNegativeFlags(value);
}

/**
 * CPY - Compare Y Register - Opcode: $C0 (Immediate)
 * 
 * Operation: Y - M
 * 
 * Description:
 * Compares the contents of the Y register with an immediate value by performing
 * a subtraction without storing the result. The comparison sets the flags to
 * indicate the relationship between the Y register and the operand: equal,
 * less than, or greater than (for both signed and unsigned interpretations).
 * 
 * Flags affected:
 * - C (Carry): Set if Y >= M (unsigned), cleared if Y < M
 * - Z (Zero): Set if Y = M, cleared otherwise
 * - N (Negative): Set if bit 7 of (Y - M) is set, cleared otherwise
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch immediate value, perform comparison
 * 
 * Addressing mode: Immediate - 2 bytes
 */
function cpyImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.setCompareFlags(cpu.y, value);
}

/**
 * CMP - Compare Accumulator - Opcode: $C1 (Indexed Indirect X)
 * 
 * Operation: A - M
 * 
 * Description:
 * Compares the contents of the accumulator with the value at the memory
 * location addressed by indexed indirect mode. The zero page base address
 * is added to the X register to form an effective address in zero page.
 * This effective address points to the low byte of the target address,
 * with the high byte at the next location.
 * 
 * Flags affected:
 * - C (Carry): Set if A >= M (unsigned), cleared if A < M
 * - Z (Zero): Set if A = M, cleared otherwise
 * - N (Negative): Set if bit 7 of (A - M) is set, cleared otherwise
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page base address
 * - Cycle 3: Add X to base address (internal operation)
 * - Cycle 4: Fetch low byte of target address from (base + X) & 0xFF
 * - Cycle 5: Fetch high byte of target address from (base + X + 1) & 0xFF
 * - Cycle 6: Fetch value from target address and perform comparison
 * 
 * Addressing mode: Indexed Indirect X - 2 bytes
 */
function cmpIndX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const indirectAddress = (zpAddress + cpu.x) & 0xFF; // Wrap around in zero page
  const targetLow = cpu.readMemory(indirectAddress);
  const targetHigh = cpu.readMemory((indirectAddress + 1) & 0xFF); // Wrap around
  const targetAddress = (targetHigh << 8) | targetLow;
  const value = cpu.readMemory(targetAddress);
  cpu.setCompareFlags(cpu.a, value);
}

/**
 * DCP - Decrement then Compare - Opcode: $C3 (Indexed Indirect X) - Undocumented
 * 
 * Operation: M = M - 1, then compare A with M
 * 
 * Description:
 * DCP is an undocumented instruction that decrements a memory location and
 * then compares the result with the accumulator. It uses indexed indirect X
 * addressing where the zero page address is added to X, then the resulting
 * address is used to fetch a 16-bit pointer to the target memory location.
 * This combines DEC and CMP in a single instruction.
 * 
 * Flags affected: C (Carry), Z (Zero), N (Negative)
 * - C: Set if A >= M (unsigned comparison)
 * - Z: Set if A = M
 * - N: Set if bit 7 of (A - M) is set
 * 
 * Timing: 8 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add X to zero page address
 * - Cycle 4: Read low byte of target address from (zp + X)
 * - Cycle 5: Read high byte of target address from (zp + X + 1)
 * - Cycle 6: Read original value from target address
 * - Cycle 7: Internal operation (decrement)
 * - Cycle 8: Write decremented value back to target address
 * 
 * Addressing mode: Indexed Indirect X - 2 bytes
 * Alternative names: DCM
 */
function dcpIndX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const indirectAddress = (zpAddress + cpu.x) & 0xFF; // Wrap around in zero page
  const targetLow = cpu.readMemory(indirectAddress);
  const targetHigh = cpu.readMemory((indirectAddress + 1) & 0xFF); // Wrap around
  const targetAddress = (targetHigh << 8) | targetLow;
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const decrementedValue = (originalValue - 1) & 0xFF;
  cpu.writeMemory(targetAddress, decrementedValue);
  
  // Now compare decremented value with accumulator (like CMP)
  const result = cpu.a - decrementedValue;
  
  // Set flags based on comparison
  cpu.setZeroAndNegativeFlags(result & 0xFF);
  if (cpu.a >= decrementedValue) {
    cpu.p |= FlagSetMask6510.C;
  } else {
    cpu.p &= ~FlagSetMask6510.C;
  }
}

/**
 * CPY - Compare Y Register - Opcode: $C4 (Zero Page)
 * 
 * Operation: Y - M
 * 
 * Description:
 * Compares the contents of the Y register with the value at the specified
 * zero page memory location by performing a subtraction without storing
 * the result. The comparison sets the flags to indicate the relationship
 * between the Y register and the memory operand.
 * 
 * Flags affected:
 * - C (Carry): Set if Y >= M (unsigned), cleared if Y < M
 * - Z (Zero): Set if Y = M, cleared otherwise
 * - N (Negative): Set if bit 7 of (Y - M) is set, cleared otherwise
 * 
 * Timing: 3 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Fetch value from zero page address and perform comparison
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function cpyZp(cpu: M6510Cpu): void {
  const address = cpu.readMemory(cpu.pc++);
  const value = cpu.readMemory(address);
  cpu.setCompareFlags(cpu.y, value);
}

/**
 * CMP - Compare Accumulator - Opcode: $C5 (Zero Page)
 * 
 * Operation: A - M
 * 
 * Description:
 * Compares the contents of the accumulator with the value at the specified
 * zero page memory location by performing a subtraction without storing
 * the result. The comparison sets the flags to indicate the relationship
 * between the accumulator and the memory operand.
 * 
 * Flags affected:
 * - C (Carry): Set if A >= M (unsigned), cleared if A < M
 * - Z (Zero): Set if A = M, cleared otherwise
 * - N (Negative): Set if bit 7 of (A - M) is set, cleared otherwise
 * 
 * Timing: 3 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Fetch value from zero page address and perform comparison
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function cmpZp(cpu: M6510Cpu): void {
  const address = cpu.readMemory(cpu.pc++);
  const value = cpu.readMemory(address);
  cpu.setCompareFlags(cpu.a, value);
}

/**
 * DEC - Decrement Memory - Opcode: $C6 (Zero Page)
 * 
 * Operation: M = M - 1
 * 
 * Description:
 * Decrements the value at the specified zero page memory location by one.
 * The decrement wraps around from $00 to $FF. This is a read-modify-write
 * operation that requires an extra internal cycle to perform the operation.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 5 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read value from zero page address
 * - Cycle 4: Internal operation, perform decrement
 * - Cycle 5: Write decremented value back to zero page address
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function decZp(cpu: M6510Cpu): void {
  const address = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const value = cpu.readMemory(address);
  const result = (value - 1) & 0xFF;
  cpu.writeMemory(address, result);
  cpu.setZeroAndNegativeFlags(result);
}

/**
 * DCP - Decrement then Compare - Opcode: $C7 (Zero Page) - Undocumented
 * 
 * Operation: M = M - 1, then compare A with M
 * 
 * Description:
 * DCP is an undocumented instruction that decrements a zero page memory
 * location and then compares the result with the accumulator. This combines
 * the functionality of DEC and CMP in a single instruction, providing a
 * fast way to decrement and test memory values.
 * 
 * Flags affected: C (Carry), Z (Zero), N (Negative)
 * - C: Set if A >= M (unsigned comparison)
 * - Z: Set if A = M
 * - N: Set if bit 7 of (A - M) is set
 * 
 * Timing: 5 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read original value from zero page
 * - Cycle 4: Internal operation (decrement)
 * - Cycle 5: Write decremented value back to zero page
 * 
 * Addressing mode: Zero Page - 2 bytes
 * Alternative names: DCM
 */
function dcpZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const originalValue = cpu.readMemory(zpAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const decrementedValue = (originalValue - 1) & 0xFF;
  cpu.writeMemory(zpAddress, decrementedValue);
  
  // Now compare decremented value with accumulator
  const result = cpu.a - decrementedValue;
  
  // Set flags based on comparison
  cpu.setZeroAndNegativeFlags(result & 0xFF);
  if (cpu.a >= decrementedValue) {
    cpu.p |= FlagSetMask6510.C;
  } else {
    cpu.p &= ~FlagSetMask6510.C;
  }
}

/**
 * INY - Increment Y Register - Opcode: $C8
 * 
 * Operation: Y = Y + 1
 * 
 * Description:
 * Increments the Y register by one. The increment wraps around from $FF to $00.
 * This instruction is commonly used in loops for counting up or in indexed
 * addressing operations where the index needs to be incremented.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation, increment Y register
 * 
 * Addressing mode: Implied - 1 byte
 */
function iny(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // One additional cycle for the operation
  cpu.y = (cpu.y + 1) & 0xFF;
  cpu.setZeroAndNegativeFlags(cpu.y);
}

/**
 * CMP - Compare Accumulator - Opcode: $C9 (Immediate)
 * 
 * Operation: A - M
 * 
 * Description:
 * Compares the contents of the accumulator with an immediate value by
 * performing a subtraction without storing the result. The comparison
 * sets the flags to indicate the relationship between the accumulator
 * and the operand: equal, less than, or greater than.
 * 
 * Flags affected:
 * - C (Carry): Set if A >= M (unsigned), cleared if A < M
 * - Z (Zero): Set if A = M, cleared otherwise
 * - N (Negative): Set if bit 7 of (A - M) is set, cleared otherwise
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch immediate value, perform comparison
 * 
 * Addressing mode: Immediate - 2 bytes
 */
function cmpImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.setCompareFlags(cpu.a, value);
}

/**
 * DEX - Decrement X Register - Opcode: $CA
 * 
 * Operation: X = X - 1
 * 
 * Description:
 * Decrements the X register by one. The decrement wraps around from $00 to $FF.
 * This instruction is commonly used in loops for counting down or in indexed
 * addressing operations where the index needs to be decremented.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation, decrement X register
 * 
 * Addressing mode: Implied - 1 byte
 */
function dex(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // One additional cycle for the operation
  cpu.x = (cpu.x - 1) & 0xFF;
  cpu.setZeroAndNegativeFlags(cpu.x);
}

/**
 * AXS - A AND X then Subtract - Opcode: $CB (Immediate) - Undocumented
 * 
 * Operation: X = (A & X) - M
 * 
 * Description:
 * AXS is an undocumented instruction that ANDs the accumulator with the X
 * register, then subtracts the immediate operand from the result and stores
 * it in the X register. This is essentially a combination of AND and SBC
 * without the carry flag being considered for the subtraction.
 * 
 * Flags affected: C (Carry), Z (Zero), N (Negative)
 * - C: Set if no borrow occurred (result >= 0)
 * - Z: Set if result is zero
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch immediate operand and execute
 * 
 * Addressing mode: Immediate - 2 bytes
 * Alternative names: SBX, SAX
 */
function axsImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  
  // AND X with A
  const temp = (cpu.a & cpu.x) & 0xFF;
  
  // Subtract immediate value (without borrow/carry)
  const result = temp - value;
  
  // Store result in X register
  cpu.x = result & 0xFF;
  
  // Set flags
  cpu.setZeroAndNegativeFlags(cpu.x);
  
  // Set carry flag if no borrow occurred (result >= 0)
  if (result >= 0) {
    cpu.p |= FlagSetMask6510.C;
  } else {
    cpu.p &= ~FlagSetMask6510.C;
  }
}

/**
 * CPY - Compare Y Register - Opcode: $CC (Absolute)
 * 
 * Operation: Y - M
 * 
 * Description:
 * CPY compares the Y register with a value in absolute memory by performing
 * a subtraction (Y - M) and setting flags based on the result. The contents
 * of the Y register are unchanged. This allows testing Y against any value
 * in the 64K address space.
 * 
 * Flags affected: C (Carry), Z (Zero), N (Negative)
 * - C: Set if Y >= M (unsigned comparison)
 * - Z: Set if Y = M
 * - N: Set if bit 7 of (Y - M) is set
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from absolute address and compare
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function cpyAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemory(address);
  cpu.setCompareFlags(cpu.y, value);
}

/**
 * CMP - Compare Accumulator - Opcode: $CD (Absolute)
 * 
 * Operation: A - M
 * 
 * Description:
 * CMP compares the accumulator with a value in absolute memory by performing
 * a subtraction (A - M) and setting flags based on the result. The contents
 * of the accumulator are unchanged. This allows testing A against any value
 * in the 64K address space.
 * 
 * Flags affected: C (Carry), Z (Zero), N (Negative)
 * - C: Set if A >= M (unsigned comparison)
 * - Z: Set if A = M
 * - N: Set if bit 7 of (A - M) is set
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from absolute address and compare
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function cmpAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemory(address);
  cpu.setCompareFlags(cpu.a, value);
}

/**
 * DEC - Decrement Memory - Opcode: $CE (Absolute)
 * 
 * Operation: M = M - 1
 * 
 * Description:
 * DEC decrements the value at an absolute memory location by one. This is
 * a read-modify-write operation that takes an extra cycle for the internal
 * modification. The addressing mode allows decrementing any location in
 * the 64K address space.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if result is zero
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read original value from absolute address
 * - Cycle 5: Internal operation (decrement)
 * - Cycle 6: Write decremented value back to absolute address
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function decAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const value = cpu.readMemory(address);
  const result = (value - 1) & 0xFF;
  cpu.writeMemory(address, result);
  cpu.setZeroAndNegativeFlags(result);
}

/**
 * DCP - Decrement then Compare - Opcode: $CF (Absolute) - Undocumented
 * 
 * Operation: M = M - 1, then compare A with M
 * 
 * Description:
 * DCP is an undocumented instruction that decrements an absolute memory
 * location and then compares the result with the accumulator. This combines
 * the functionality of DEC and CMP in a single instruction, allowing
 * decrement and test operations anywhere in the 64K address space.
 * 
 * Flags affected: C (Carry), Z (Zero), N (Negative)
 * - C: Set if A >= M (unsigned comparison)
 * - Z: Set if A = M
 * - N: Set if bit 7 of (A - M) is set
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read original value from absolute address
 * - Cycle 5: Internal operation (decrement)
 * - Cycle 6: Write decremented value back to absolute address
 * 
 * Addressing mode: Absolute - 3 bytes
 * Alternative names: DCM
 */
function dcpAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const originalValue = cpu.readMemory(address);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const decrementedValue = (originalValue - 1) & 0xFF;
  cpu.writeMemory(address, decrementedValue);
  
  // Now compare decremented value with accumulator
  const result = cpu.a - decrementedValue;
  
  // Set flags based on comparison
  cpu.setZeroAndNegativeFlags(result & 0xFF);
  if (cpu.a >= decrementedValue) {
    cpu.p |= FlagSetMask6510.C;
  } else {
    cpu.p &= ~FlagSetMask6510.C;
  }
}

/**
 * BNE - Branch if Not Equal - Opcode: $D0
 * 
 * Operation: If Z = 0, PC = PC + offset
 * 
 * Description:
 * BNE tests the zero flag and branches if it is clear (0). The branch
 * target is calculated by adding the signed 8-bit offset to the program
 * counter. This instruction is commonly used after comparison operations
 * to test for "not equal" conditions or after operations that affect
 * the zero flag to check if the result was non-zero.
 * 
 * Flags affected: None
 * 
 * Timing: 2+ cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch offset, branch decision
 * - Cycle +1: Add cycle if branch taken
 * - Cycle +1: Add cycle if page boundary crossed
 * 
 * Addressing mode: Relative - 2 bytes
 */
function bne(cpu: M6510Cpu): void {
  cpu.performBranch(!cpu.isZFlagSet());
}

/**
 * CMP - Compare Accumulator - Opcode: $D1 (Indirect Indexed Y)
 * 
 * Operation: A - M
 * 
 * Description:
 * CMP compares the accumulator with a value in memory using indirect indexed Y
 * addressing. The zero page address contains a 16-bit pointer, which is added
 * to the Y register to form the final address. An extra cycle is added if a
 * page boundary is crossed during Y indexing. The contents of the accumulator
 * are unchanged.
 * 
 * Flags affected: C (Carry), Z (Zero), N (Negative)
 * - C: Set if A >= M (unsigned comparison)
 * - Z: Set if A = M
 * - N: Set if bit 7 of (A - M) is set
 * 
 * Timing: 5 cycles (+1 if page boundary crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read low byte of target address from zero page
 * - Cycle 4: Read high byte of target address from zero page + 1
 * - Cycle 5: Read value from (target address + Y) and compare
 * - Cycle 6: Page boundary penalty (if crossing occurs)
 * 
 * Addressing mode: Indirect Indexed Y - 2 bytes
 */
function cmpIndY(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const targetLow = cpu.readMemory(zpAddress);
  const targetHigh = cpu.readMemory((zpAddress + 1) & 0xFF); // Wrap around in zero page
  const baseAddress = (targetHigh << 8) | targetLow;
  const value = cpu.readMemoryWithPageBoundary(baseAddress, cpu.y);
  cpu.setCompareFlags(cpu.a, value);
}

/**
 * DCP - Decrement then Compare - Opcode: $D3 (Indirect Indexed Y) - Undocumented
 * 
 * Operation: M = M - 1, then compare A with M
 * 
 * Description:
 * DCP is an undocumented instruction that decrements a memory location and
 * then compares the result with the accumulator using indirect indexed Y
 * addressing. The zero page address contains a 16-bit pointer, which is added
 * to the Y register to form the final address. This combines DEC and CMP
 * functionality in a single instruction.
 * 
 * Flags affected: C (Carry), Z (Zero), N (Negative)
 * - C: Set if A >= M (unsigned comparison)
 * - Z: Set if A = M
 * - N: Set if bit 7 of (A - M) is set
 * 
 * Timing: 8 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read low byte of target address from zero page
 * - Cycle 4: Read high byte of target address from zero page + 1
 * - Cycle 5: Add Y to target address
 * - Cycle 6: Read original value from final address
 * - Cycle 7: Internal operation (decrement)
 * - Cycle 8: Write decremented value back to final address
 * 
 * Addressing mode: Indirect Indexed Y - 2 bytes
 * Alternative names: DCM
 */
function dcpIndY(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const low = cpu.readMemory(zpAddress);
  const high = cpu.readMemory((zpAddress + 1) & 0xFF);
  const baseAddress = (high << 8) | low;
  cpu.incrementTacts(); // Page boundary check for indexed addressing
  const targetAddress = (baseAddress + cpu.y) & 0xFFFF;
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const decrementedValue = (originalValue - 1) & 0xFF;
  cpu.writeMemory(targetAddress, decrementedValue);
  
  // Now compare decremented value with accumulator
  const result = cpu.a - decrementedValue;
  
  // Set flags based on comparison
  cpu.setZeroAndNegativeFlags(result & 0xFF);
  if (cpu.a >= decrementedValue) {
    cpu.p |= FlagSetMask6510.C;
  } else {
    cpu.p &= ~FlagSetMask6510.C;
  }
}

/**
 * CMP - Compare Accumulator - Opcode: $D5 (Zero Page X)
 * 
 * Operation: A - M
 * 
 * Description:
 * CMP compares the accumulator with a value in zero page memory using X
 * register indexing. The final address is (zero page address + X) with
 * wraparound within the zero page if the sum exceeds $FF. The contents
 * of the accumulator are unchanged.
 * 
 * Flags affected: C (Carry), Z (Zero), N (Negative)
 * - C: Set if A >= M (unsigned comparison)
 * - Z: Set if A = M
 * - N: Set if bit 7 of (A - M) is set
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add X to address (internal operation)
 * - Cycle 4: Read value from (zero page address + X) & $FF and compare
 * 
 * Addressing mode: Zero Page X - 2 bytes
 */
function cmpZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const address = (zpAddress + cpu.x) & 0xFF; // Wrap around in zero page
  const value = cpu.readMemory(address);
  cpu.setCompareFlags(cpu.a, value);
}

/**
 * DEC - Decrement Memory - Opcode: $D6 (Zero Page X)
 * 
 * Operation: M = M - 1
 * 
 * Description:
 * DEC decrements the value at a zero page memory location by one using X
 * register indexing. The final address is (zero page address + X) with
 * wraparound within the zero page if the sum exceeds $FF. This is a
 * read-modify-write operation that takes extra cycles for the internal
 * modification and indexed addressing.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if result is zero
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add X to address (internal operation)
 * - Cycle 4: Read original value from (zero page address + X) & $FF
 * - Cycle 5: Internal operation (decrement)
 * - Cycle 6: Write decremented value back to address
 * 
 * Addressing mode: Zero Page X - 2 bytes
 */
function decZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const address = (zpAddress + cpu.x) & 0xFF; // Wrap around in zero page
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const value = cpu.readMemory(address);
  const result = (value - 1) & 0xFF;
  cpu.writeMemory(address, result);
  cpu.setZeroAndNegativeFlags(result);
}

/**
 * DCP - Decrement then Compare - Opcode: $D7 (Zero Page X) - Undocumented
 * 
 * Operation: M = M - 1, then compare A with M
 * 
 * Description:
 * DCP is an undocumented instruction that decrements a zero page memory
 * location and then compares the result with the accumulator using X
 * register indexing. The final address is (zero page address + X) with
 * wraparound within the zero page if the sum exceeds $FF. This combines
 * DEC and CMP functionality in a single instruction.
 * 
 * Flags affected: C (Carry), Z (Zero), N (Negative)
 * - C: Set if A >= M (unsigned comparison)
 * - Z: Set if A = M
 * - N: Set if bit 7 of (A - M) is set
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add X to address (internal operation)
 * - Cycle 4: Read original value from (zero page address + X) & $FF
 * - Cycle 5: Internal operation (decrement)
 * - Cycle 6: Write decremented value back to address
 * 
 * Addressing mode: Zero Page X - 2 bytes
 * Alternative names: DCM
 */
function dcpZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const address = (zpAddress + cpu.x) & 0xFF; // Wrap around in zero page
  const originalValue = cpu.readMemory(address);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const decrementedValue = (originalValue - 1) & 0xFF;
  cpu.writeMemory(address, decrementedValue);
  
  // Now compare decremented value with accumulator
  const result = cpu.a - decrementedValue;
  
  // Set flags based on comparison
  cpu.setZeroAndNegativeFlags(result & 0xFF);
  if (cpu.a >= decrementedValue) {
    cpu.p |= FlagSetMask6510.C;
  } else {
    cpu.p &= ~FlagSetMask6510.C;
  }
}

/**
 * CLD - Clear Decimal Mode - Opcode: $D8
 * 
 * Operation: D = 0
 * 
 * Description:
 * CLD clears the decimal mode flag. In the 6502, this would disable BCD
 * (Binary Coded Decimal) mode for ADC and SBC operations. However, the
 * 6510 CPU in the Commodore 64 does not implement decimal mode, so this
 * instruction has no functional effect other than clearing the flag bit.
 * 
 * Flags affected:
 * - D (Decimal): Set to 0
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation, clear decimal flag
 * 
 * Addressing mode: Implied - 1 byte
 */
function cld(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.p &= ~FlagSetMask6510.D;
}

/**
 * CMP - Compare Accumulator - Opcode: $D9 (Absolute Y)
 * 
 * Operation: A - M
 * 
 * Description:
 * CMP compares the accumulator with a value in absolute memory using Y
 * register indexing. An extra cycle is added if a page boundary is
 * crossed during the Y indexing operation. The contents of the accumulator
 * are unchanged.
 * 
 * Flags affected: C (Carry), Z (Zero), N (Negative)
 * - C: Set if A >= M (unsigned comparison)
 * - Z: Set if A = M
 * - N: Set if bit 7 of (A - M) is set
 * 
 * Timing: 4 cycles (+1 if page boundary crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from (absolute address + Y) and compare
 * - Cycle 5: Page boundary penalty (if crossing occurs)
 * 
 * Addressing mode: Absolute Y - 3 bytes
 */
function cmpAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(baseAddress, cpu.y);
  cpu.setCompareFlags(cpu.a, value);
}

/**
 * DCP - Decrement then Compare - Opcode: $DB (Absolute Y) - Undocumented
 * 
 * Operation: M = M - 1, then compare A with M
 * 
 * Description:
 * DCP is an undocumented instruction that decrements an absolute memory
 * location and then compares the result with the accumulator using Y
 * register indexing. This instruction always takes an extra cycle for
 * the indexed addressing, regardless of page boundary crossing. This
 * combines DEC and CMP functionality in a single instruction.
 * 
 * Flags affected: C (Carry), Z (Zero), N (Negative)
 * - C: Set if A >= M (unsigned comparison)
 * - Z: Set if A = M
 * - N: Set if bit 7 of (A - M) is set
 * 
 * Timing: 7 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Add Y to address (indexed addressing)
 * - Cycle 5: Read original value from final address
 * - Cycle 6: Internal operation (decrement)
 * - Cycle 7: Write decremented value back to final address
 * 
 * Addressing mode: Absolute Y - 3 bytes
 * Alternative names: DCM
 */
function dcpAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  cpu.incrementTacts(); // Extra cycle for indexed addressing
  const targetAddress = (baseAddress + cpu.y) & 0xFFFF;
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const decrementedValue = (originalValue - 1) & 0xFF;
  cpu.writeMemory(targetAddress, decrementedValue);
  
  // Now compare decremented value with accumulator
  const result = cpu.a - decrementedValue;
  
  // Set flags based on comparison
  cpu.setZeroAndNegativeFlags(result & 0xFF);
  if (cpu.a >= decrementedValue) {
    cpu.p |= FlagSetMask6510.C;
  } else {
    cpu.p &= ~FlagSetMask6510.C;
  }
}

/**
 * CMP - Compare Accumulator - Opcode: $DD (Absolute X)
 * 
 * Operation: A - M
 * 
 * Description:
 * CMP compares the accumulator with a value in absolute memory using X
 * register indexing. An extra cycle is added if a page boundary is
 * crossed during the X indexing operation. The contents of the accumulator
 * are unchanged.
 * 
 * Flags affected: C (Carry), Z (Zero), N (Negative)
 * - C: Set if A >= M (unsigned comparison)
 * - Z: Set if A = M
 * - N: Set if bit 7 of (A - M) is set
 * 
 * Timing: 4 cycles (+1 if page boundary crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from (absolute address + X) and compare
 * - Cycle 5: Page boundary penalty (if crossing occurs)
 * 
 * Addressing mode: Absolute X - 3 bytes
 */
function cmpAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(baseAddress, cpu.x);
  cpu.setCompareFlags(cpu.a, value);
}

/**
 * DEC - Decrement Memory - Opcode: $DE (Absolute X)
 * 
 * Operation: M = M - 1
 * 
 * Description:
 * DEC decrements the value at an absolute memory location by one using X
 * register indexing. This instruction always takes an extra cycle for
 * the indexed addressing, regardless of page boundary crossing. This is
 * a read-modify-write operation that takes additional cycles for the
 * internal modification.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if result is zero
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 7 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Add X to address (indexed addressing)
 * - Cycle 5: Read original value from final address
 * - Cycle 6: Internal operation (decrement)
 * - Cycle 7: Write decremented value back to final address
 * 
 * Addressing mode: Absolute X - 3 bytes
 */
function decAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const address = (baseAddress + cpu.x) & 0xFFFF;
  cpu.incrementTacts(); // Indexed addressing cycle
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const value = cpu.readMemory(address);
  const result = (value - 1) & 0xFF;
  cpu.writeMemory(address, result);
  cpu.setZeroAndNegativeFlags(result);
}

/**
 * DCP - Decrement then Compare - Opcode: $DF (Absolute X) - Undocumented
 * 
 * Operation: M = M - 1, then compare A with M
 * 
 * Description:
 * DCP is an undocumented instruction that decrements an absolute memory
 * location and then compares the result with the accumulator using X
 * register indexing. This instruction always takes an extra cycle for
 * the indexed addressing, regardless of page boundary crossing. This
 * combines DEC and CMP functionality in a single instruction.
 * 
 * Flags affected: C (Carry), Z (Zero), N (Negative)
 * - C: Set if A >= M (unsigned comparison)
 * - Z: Set if A = M
 * - N: Set if bit 7 of (A - M) is set
 * 
 * Timing: 7 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Add X to address (indexed addressing)
 * - Cycle 5: Read original value from final address
 * - Cycle 6: Internal operation (decrement)
 * - Cycle 7: Write decremented value back to final address
 * 
 * Addressing mode: Absolute X - 3 bytes
 * Alternative names: DCM
 */
function dcpAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  cpu.incrementTacts(); // Extra cycle for indexed addressing
  const targetAddress = (baseAddress + cpu.x) & 0xFFFF;
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const decrementedValue = (originalValue - 1) & 0xFF;
  cpu.writeMemory(targetAddress, decrementedValue);
  
  // Now compare decremented value with accumulator
  const result = cpu.a - decrementedValue;
  
  // Set flags based on comparison
  cpu.setZeroAndNegativeFlags(result & 0xFF);
  if (cpu.a >= decrementedValue) {
    cpu.p |= FlagSetMask6510.C;
  } else {
    cpu.p &= ~FlagSetMask6510.C;
  }
}

/**
 * CPX - Compare X Register - Opcode: $E0 (Immediate)
 * 
 * Operation: X - M
 * 
 * Description:
 * Compares the contents of the X register with an immediate value by performing
 * a subtraction without storing the result. The comparison sets the flags to
 * indicate the relationship between the X register and the operand: equal,
 * less than, or greater than (for both signed and unsigned interpretations).
 * 
 * Flags affected:
 * - C (Carry): Set if X >= M (unsigned), cleared if X < M
 * - Z (Zero): Set if X = M, cleared otherwise
 * - N (Negative): Set if bit 7 of (X - M) is set, cleared otherwise
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch immediate value, perform comparison
 * 
 * Addressing mode: Immediate - 2 bytes
 */
function cpxImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.setCompareFlags(cpu.x, value);
}

/**
 * SBC - Subtract with Carry - Opcode: $E1 (Indexed Indirect X)
 * 
 * Operation: A = A - M - (1 - C)
 * 
 * Description:
 * SBC subtracts a memory value and the complement of the carry flag from
 * the accumulator using indexed indirect X addressing. The zero page address
 * is added to X, then the resulting address is used to fetch a 16-bit
 * pointer to the target data. The carry flag acts as an inverted borrow.
 * 
 * Flags affected: C (Carry), Z (Zero), V (Overflow), N (Negative)
 * - C: Set if no borrow occurred (A >= M + borrow)
 * - Z: Set if result is zero
 * - V: Set if signed overflow occurred
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add X to zero page address
 * - Cycle 4: Read low byte of target address from (zp + X)
 * - Cycle 5: Read high byte of target address from (zp + X + 1)
 * - Cycle 6: Read operand from target address and execute
 * 
 * Addressing mode: Indexed Indirect X - 2 bytes
 */
function sbcIndX(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const effectiveAddress = (zeroPageAddress + cpu.x) & 0xFF; // Wrap around in zero page
  cpu.incrementTacts(); // Indexed addressing cycle
  const low = cpu.readMemory(effectiveAddress);
  const high = cpu.readMemory((effectiveAddress + 1) & 0xFF); // Handle wrap-around for high byte too
  const targetAddress = (high << 8) | low;
  const operand = cpu.readMemory(targetAddress);
  cpu.a = cpu.performSbc(operand);
}

/**
 * ISC - Increment then Subtract with Carry - Opcode: $E3 (Indexed Indirect X) - Undocumented
 * 
 * Operation: M = M + 1, then A = A - M - (1 - C)
 * 
 * Description:
 * ISC is an undocumented instruction that increments a memory location and
 * then subtracts the result (plus borrow) from the accumulator using indexed
 * indirect X addressing. The zero page address is added to X, then the
 * resulting address is used to fetch a 16-bit pointer to the target memory.
 * This combines INC and SBC functionality in a single instruction.
 * 
 * Flags affected: C (Carry), Z (Zero), V (Overflow), N (Negative)
 * - C: Set if no borrow occurred (A >= M + borrow)
 * - Z: Set if result is zero
 * - V: Set if signed overflow occurred
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 8 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add X to zero page address
 * - Cycle 4: Read low byte of target address from (zp + X)
 * - Cycle 5: Read high byte of target address from (zp + X + 1)
 * - Cycle 6: Read original value from target address
 * - Cycle 7: Internal operation (increment)
 * - Cycle 8: Write incremented value back and perform SBC
 * 
 * Addressing mode: Indexed Indirect X - 2 bytes
 * Alternative names: INS, ISB
 */
function iscIndX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const indirectAddress = (zpAddress + cpu.x) & 0xFF; // Wrap around in zero page
  const targetLow = cpu.readMemory(indirectAddress);
  const targetHigh = cpu.readMemory((indirectAddress + 1) & 0xFF); // Wrap around
  const targetAddress = (targetHigh << 8) | targetLow;
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const incrementedValue = (originalValue + 1) & 0xFF;
  cpu.writeMemory(targetAddress, incrementedValue);
  
  // Now subtract incremented value from accumulator (using proper SBC implementation)
  cpu.a = cpu.performSbc(incrementedValue);
}

/**
 * CPX - Compare X Register - Opcode: $E4 (Zero Page)
 * 
 * Operation: X - M
 * 
 * Description:
 * CPX compares the X register with a value in zero page memory by performing
 * a subtraction (X - M) and setting flags based on the result. The contents
 * of the X register are unchanged. This is the fastest addressing mode
 * for comparing the X register.
 * 
 * Flags affected: C (Carry), Z (Zero), N (Negative)
 * - C: Set if X >= M (unsigned comparison)
 * - Z: Set if X = M
 * - N: Set if bit 7 of (X - M) is set
 * 
 * Timing: 3 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read value from zero page address and compare
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function cpxZp(cpu: M6510Cpu): void {
  const address = cpu.readMemory(cpu.pc++);
  const value = cpu.readMemory(address);
  cpu.setCompareFlags(cpu.x, value);
}

/**
 * SBC - Subtract with Carry - Opcode: $E5 (Zero Page)
 * 
 * Operation: A = A - M - (1 - C)
 * 
 * Description:
 * SBC subtracts a zero page memory value and the complement of the carry
 * flag from the accumulator. The carry flag acts as an inverted borrow:
 * when clear, an additional 1 is subtracted. This is the fastest addressing
 * mode for subtraction operations.
 * 
 * Flags affected: C (Carry), Z (Zero), V (Overflow), N (Negative)
 * - C: Set if no borrow occurred (A >= M + borrow)
 * - Z: Set if result is zero
 * - V: Set if signed overflow occurred
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 3 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read operand from zero page and execute
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function sbcZp(cpu: M6510Cpu): void {
  const address = cpu.readMemory(cpu.pc++);
  const operand = cpu.readMemory(address);
  cpu.a = cpu.performSbc(operand);
}

/**
 * INC - Increment Memory - Opcode: $E6 (Zero Page)
 * 
 * Operation: M = M + 1
 * 
 * Description:
 * Increments the value at the specified zero page memory location by one.
 * The increment wraps around from $FF to $00. This is a read-modify-write
 * operation that requires an extra internal cycle to perform the operation.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 5 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read value from zero page address
 * - Cycle 4: Internal operation, perform increment
 * - Cycle 5: Write incremented value back to zero page address
 * 
 * Addressing mode: Zero Page - 2 bytes
 */
function incZp(cpu: M6510Cpu): void {
  const address = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const value = cpu.readMemory(address);
  const result = (value + 1) & 0xFF;
  cpu.writeMemory(address, result);
  cpu.setZeroAndNegativeFlags(result);
}

/**
 * ISC - Increment then Subtract with Carry - Opcode: $E7 (Zero Page) - Undocumented
 * 
 * Operation: M = M + 1, then A = A - M - (1 - C)
 * 
 * Description:
 * ISC is an undocumented instruction that increments a zero page memory
 * location and then subtracts the result (plus borrow) from the accumulator.
 * This combines the functionality of INC and SBC in a single instruction,
 * providing a fast way to increment and subtract memory values.
 * 
 * Flags affected: C (Carry), Z (Zero), V (Overflow), N (Negative)
 * - C: Set if no borrow occurred (A >= M + borrow)
 * - Z: Set if result is zero
 * - V: Set if signed overflow occurred
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 5 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read original value from zero page
 * - Cycle 4: Internal operation (increment)
 * - Cycle 5: Write incremented value back and perform SBC
 * 
 * Addressing mode: Zero Page - 2 bytes
 * Alternative names: INS, ISB
 */
function iscZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const originalValue = cpu.readMemory(zpAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const incrementedValue = (originalValue + 1) & 0xFF;
  cpu.writeMemory(zpAddress, incrementedValue);
  
  // Now subtract incremented value from accumulator (using proper SBC implementation)
  cpu.a = cpu.performSbc(incrementedValue);
}

/**
 * INX - Increment X Register - Opcode: $E8
 * 
 * Operation: X = X + 1
 * 
 * Description:
 * Increments the X register by one. The increment wraps around from $FF to $00.
 * This instruction is commonly used in loops for counting up or in indexed
 * addressing operations where the index needs to be incremented.
 * 
 * Flags affected:
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation, increment X register
 * 
 * Addressing mode: Implied - 1 byte
 */
function inx(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // One additional cycle for the operation
  cpu.x = (cpu.x + 1) & 0xFF;
  cpu.setZeroAndNegativeFlags(cpu.x);
}

/**
 * SBC - Subtract with Carry - Opcode: $E9 (Immediate)
 * 
 * Operation: A = A - M - (1 - C)
 * 
 * Description:
 * SBC subtracts an immediate value and the complement of the carry flag from
 * the accumulator. The carry flag acts as an inverted borrow: when clear,
 * an additional 1 is subtracted. This allows multi-byte subtraction by
 * carrying the borrow from lower to higher bytes.
 * 
 * Flags affected:
 * - C (Carry): Set if no borrow occurred (A >= M + borrow), cleared if borrow
 * - Z (Zero): Set if result is zero, cleared otherwise
 * - V (Overflow): Set if signed overflow occurred, cleared otherwise
 * - N (Negative): Set if bit 7 of result is set, cleared otherwise
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch immediate operand, perform subtraction
 * 
 * Addressing mode: Immediate - 2 bytes
 */
function sbcImm(cpu: M6510Cpu): void {
  const operand = cpu.readMemory(cpu.pc++);
  cpu.a = cpu.performSbc(operand);
}

/**
 * NOP - No Operation - Opcode: $EA
 * 
 * Operation: (none)
 * 
 * Description:
 * NOP performs no operation other than consuming 2 cycles of execution time.
 * It is commonly used for timing delays, as placeholder space for future
 * code modifications, or to align code to specific memory boundaries.
 * The program counter is incremented by 1 and no flags are affected.
 * 
 * Flags affected: None
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation (no-op)
 * 
 * Addressing mode: Implied - 1 byte
 */
function nop(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
}

/**
 * CPX - Compare X Register - Opcode: $EC (Absolute)
 * 
 * Operation: X - M
 * 
 * Description:
 * CPX compares the X register with a value in absolute memory by performing
 * a subtraction (X - M) and setting flags based on the result. The contents
 * of the X register are unchanged. This addressing mode allows comparing
 * X against any value in the 64K address space.
 * 
 * Flags affected: C (Carry), Z (Zero), N (Negative)
 * - C: Set if X >= M (unsigned comparison)
 * - Z: Set if X = M
 * - N: Set if bit 7 of (X - M) is set
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read value from absolute address and compare
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function cpxAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemory(address);
  cpu.setCompareFlags(cpu.x, value);
}

/**
 * SBC - Subtract with Carry - Opcode: $ED (Absolute)
 * 
 * Operation: A = A - M - (1 - C)
 * 
 * Description:
 * SBC subtracts an absolute memory value and the complement of the carry
 * flag from the accumulator. The carry flag acts as an inverted borrow:
 * when clear, an additional 1 is subtracted. This addressing mode allows
 * subtraction from any location in the 64K address space.
 * 
 * Flags affected: C (Carry), Z (Zero), V (Overflow), N (Negative)
 * - C: Set if no borrow occurred (A >= M + borrow)
 * - Z: Set if result is zero
 * - V: Set if signed overflow occurred
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read operand from absolute address and execute
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function sbcAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const operand = cpu.readMemory(address);
  cpu.a = cpu.performSbc(operand);
}

/**
 * INC - Increment Memory - Opcode: $EE (Absolute)
 * 
 * Operation: M = M + 1
 * 
 * Description:
 * INC increments the value at an absolute memory location by one. This is
 * a read-modify-write operation that takes an extra cycle for the internal
 * modification. The addressing mode allows incrementing any location in
 * the 64K address space.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if result is zero
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read original value from absolute address
 * - Cycle 5: Internal operation (increment)
 * - Cycle 6: Write incremented value back to absolute address
 * 
 * Addressing mode: Absolute - 3 bytes
 */
function incAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const value = cpu.readMemory(address);
  const result = (value + 1) & 0xFF;
  cpu.writeMemory(address, result);
  cpu.setZeroAndNegativeFlags(result);
}

/**
 * ISC - Increment then Subtract with Carry - Opcode: $EF (Absolute) - Undocumented
 * 
 * Operation: M = M + 1, then A = A - M - (1 - C)
 * 
 * Description:
 * ISC is an undocumented instruction that increments an absolute memory
 * location and then subtracts the result (plus borrow) from the accumulator.
 * This combines the functionality of INC and SBC in a single instruction,
 * allowing increment and subtract operations anywhere in the 64K address space.
 * 
 * Flags affected: C (Carry), Z (Zero), V (Overflow), N (Negative)
 * - C: Set if no borrow occurred (A >= M + borrow)
 * - Z: Set if result is zero
 * - V: Set if signed overflow occurred
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read original value from absolute address
 * - Cycle 5: Internal operation (increment)
 * - Cycle 6: Write incremented value back and perform SBC
 * 
 * Addressing mode: Absolute - 3 bytes
 * Alternative names: INS, ISB
 */
function iscAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const originalValue = cpu.readMemory(address);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const incrementedValue = (originalValue + 1) & 0xFF;
  cpu.writeMemory(address, incrementedValue);
  
  // Now subtract incremented value from accumulator (using proper SBC implementation)
  cpu.a = cpu.performSbc(incrementedValue);
}

/**
 * BEQ - Branch if Equal - Opcode: $F0
 * 
 * Operation: If Z = 1, PC = PC + offset
 * 
 * Description:
 * BEQ tests the zero flag and branches if it is set (1). The branch
 * target is calculated by adding the signed 8-bit offset to the program
 * counter. This instruction is commonly used after comparison operations
 * to test for "equal" conditions or after operations that affect the
 * zero flag to check if the result was zero.
 * 
 * Flags affected: None
 * 
 * Timing: 2+ cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch offset, branch decision
 * - Cycle +1: Add cycle if branch taken
 * - Cycle +1: Add cycle if page boundary crossed
 * 
 * Addressing mode: Relative - 2 bytes
 */
function beq(cpu: M6510Cpu): void {
  cpu.performBranch(cpu.isZFlagSet());
}

/**
 * SBC - Subtract with Carry - Opcode: $F1 (Indirect Indexed Y)
 * 
 * Operation: A = A - M - (1 - C)
 * 
 * Description:
 * SBC subtracts a memory value and the complement of the carry flag from
 * the accumulator using indirect indexed Y addressing. The zero page address
 * contains a 16-bit pointer, which is added to the Y register to form the
 * final address. An extra cycle is added if a page boundary is crossed
 * during Y indexing. The carry flag acts as an inverted borrow.
 * 
 * Flags affected: C (Carry), Z (Zero), V (Overflow), N (Negative)
 * - C: Set if no borrow occurred (A >= M + borrow)
 * - Z: Set if result is zero
 * - V: Set if signed overflow occurred
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 5 cycles (+1 if page boundary crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read low byte of target address from zero page
 * - Cycle 4: Read high byte of target address from zero page + 1
 * - Cycle 5: Read operand from (target address + Y) and execute
 * - Cycle 6: Page boundary penalty (if crossing occurs)
 * 
 * Addressing mode: Indirect Indexed Y - 2 bytes
 */
function sbcIndY(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const low = cpu.readMemory(zeroPageAddress);
  const high = cpu.readMemory((zeroPageAddress + 1) & 0xFF); // Handle zero page wrap-around
  const baseAddress = (high << 8) | low;
  const operand = cpu.readMemoryWithPageBoundary(baseAddress, cpu.y);
  cpu.a = cpu.performSbc(operand);
}

/**
 * ISC - Increment then Subtract with Carry - Opcode: $F3 (Indirect Indexed Y) - Undocumented
 * 
 * Operation: M = M + 1, then A = A - M - (1 - C)
 * 
 * Description:
 * ISC is an undocumented instruction that increments a memory location and
 * then subtracts the result (plus borrow) from the accumulator using indirect
 * indexed Y addressing. The zero page address contains a 16-bit pointer, which
 * is added to the Y register to form the final address. This combines INC
 * and SBC functionality in a single instruction.
 * 
 * Flags affected: C (Carry), Z (Zero), V (Overflow), N (Negative)
 * - C: Set if no borrow occurred (A >= M + borrow)
 * - Z: Set if result is zero
 * - V: Set if signed overflow occurred
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 8 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Read low byte of target address from zero page
 * - Cycle 4: Read high byte of target address from zero page + 1
 * - Cycle 5: Add Y to target address
 * - Cycle 6: Read original value from final address
 * - Cycle 7: Internal operation (increment)
 * - Cycle 8: Write incremented value back and perform SBC
 * 
 * Addressing mode: Indirect Indexed Y - 2 bytes
 * Alternative names: INS, ISB
 */
function iscIndY(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const low = cpu.readMemory(zpAddress);
  const high = cpu.readMemory((zpAddress + 1) & 0xFF);
  const baseAddress = (high << 8) | low;
  cpu.incrementTacts(); // Page boundary check for indexed addressing
  const targetAddress = (baseAddress + cpu.y) & 0xFFFF;
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const incrementedValue = (originalValue + 1) & 0xFF;
  cpu.writeMemory(targetAddress, incrementedValue);
  
  // Now subtract incremented value from accumulator (using proper SBC implementation)
  cpu.a = cpu.performSbc(incrementedValue);
}

/**
 * SBC - Subtract with Carry - Opcode: $F5 (Zero Page X)
 * 
 * Operation: A = A - M - (1 - C)
 * 
 * Description:
 * SBC subtracts a zero page memory value and the complement of the carry
 * flag from the accumulator using X register indexing. The final address
 * is (zero page address + X) with wraparound within the zero page if the
 * sum exceeds $FF. The carry flag acts as an inverted borrow.
 * 
 * Flags affected: C (Carry), Z (Zero), V (Overflow), N (Negative)
 * - C: Set if no borrow occurred (A >= M + borrow)
 * - Z: Set if result is zero
 * - V: Set if signed overflow occurred
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 4 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add X to address (internal operation)
 * - Cycle 4: Read operand from (zero page address + X) & $FF and execute
 * 
 * Addressing mode: Zero Page X - 2 bytes
 */
function sbcZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const address = (zpAddress + cpu.x) & 0xFF; // Wrap around in zero page
  const operand = cpu.readMemory(address);
  cpu.a = cpu.performSbc(operand);
}

/**
 * INC - Increment Memory - Opcode: $F6 (Zero Page X)
 * 
 * Operation: M = M + 1
 * 
 * Description:
 * INC increments the value at a zero page memory location by one using X
 * register indexing. The final address is (zero page address + X) with
 * wraparound within the zero page if the sum exceeds $FF. This is a
 * read-modify-write operation that takes extra cycles for the internal
 * modification and indexed addressing.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if result is zero
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add X to address (internal operation)
 * - Cycle 4: Read original value from (zero page address + X) & $FF
 * - Cycle 5: Internal operation (increment)
 * - Cycle 6: Write incremented value back to address
 * 
 * Addressing mode: Zero Page X - 2 bytes
 */
function incZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const address = (zpAddress + cpu.x) & 0xFF; // Wrap around in zero page
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const value = cpu.readMemory(address);
  const result = (value + 1) & 0xFF;
  cpu.writeMemory(address, result);
  cpu.setZeroAndNegativeFlags(result);
}

/**
 * ISC - Increment then Subtract with Carry - Opcode: $F7 (Zero Page X) - Undocumented
 * 
 * Operation: M = M + 1, then A = A - M - (1 - C)
 * 
 * Description:
 * ISC is an undocumented instruction that increments a zero page memory
 * location and then subtracts the result (plus borrow) from the accumulator
 * using X register indexing. The final address is (zero page address + X)
 * with wraparound within the zero page. This combines INC and SBC
 * functionality in a single instruction.
 * 
 * Flags affected: C (Carry), Z (Zero), V (Overflow), N (Negative)
 * - C: Set if no borrow occurred (A >= M + borrow)
 * - Z: Set if result is zero
 * - V: Set if signed overflow occurred
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 6 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch zero page address
 * - Cycle 3: Add X to address (internal operation)
 * - Cycle 4: Read original value from (zero page address + X) & $FF
 * - Cycle 5: Internal operation (increment)
 * - Cycle 6: Write incremented value back and perform SBC
 * 
 * Addressing mode: Zero Page X - 2 bytes
 * Alternative names: INS, ISB
 */
function iscZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const address = (zpAddress + cpu.x) & 0xFF; // Wrap around in zero page
  const originalValue = cpu.readMemory(address);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const incrementedValue = (originalValue + 1) & 0xFF;
  cpu.writeMemory(address, incrementedValue);
  
  // Now subtract incremented value from accumulator (using proper SBC implementation)
  cpu.a = cpu.performSbc(incrementedValue);
}

/**
 * SED - Set Decimal Mode - Opcode: $F8
 * 
 * Operation: D = 1
 * 
 * Description:
 * SED sets the decimal mode flag. In the 6502, this would enable BCD
 * (Binary Coded Decimal) mode for ADC and SBC operations. However, the
 * 6510 CPU in the Commodore 64 does not implement decimal mode, so this
 * instruction has no functional effect other than setting the flag bit.
 * 
 * Flags affected:
 * - D (Decimal): Set to 1
 * 
 * Timing: 2 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Internal operation, set decimal flag
 * 
 * Addressing mode: Implied - 1 byte
 */
function sed(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.p |= FlagSetMask6510.D;
}

/**
 * SBC - Subtract with Carry - Opcode: $F9 (Absolute Y)
 * 
 * Operation: A = A - M - (1 - C)
 * 
 * Description:
 * SBC subtracts an absolute memory value and the complement of the carry
 * flag from the accumulator using Y register indexing. An extra cycle is
 * added if a page boundary is crossed during the Y indexing operation.
 * The carry flag acts as an inverted borrow: when clear, an additional
 * 1 is subtracted.
 * 
 * Flags affected: C (Carry), Z (Zero), V (Overflow), N (Negative)
 * - C: Set if no borrow occurred (A >= M + borrow)
 * - Z: Set if result is zero
 * - V: Set if signed overflow occurred
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 4 cycles (+1 if page boundary crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read operand from (absolute address + Y) and execute
 * - Cycle 5: Page boundary penalty (if crossing occurs)
 * 
 * Addressing mode: Absolute Y - 3 bytes
 */
function sbcAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const operand = cpu.readMemoryWithPageBoundary(baseAddress, cpu.y);
  cpu.a = cpu.performSbc(operand);
}

/**
 * ISC - Increment then Subtract with Carry - Opcode: $FB (Absolute Y) - Undocumented
 * 
 * Operation: M = M + 1, then A = A - M - (1 - C)
 * 
 * Description:
 * ISC is an undocumented instruction that increments an absolute memory
 * location and then subtracts the result (plus borrow) from the accumulator
 * using Y register indexing. This instruction always takes an extra cycle
 * for the indexed addressing, regardless of page boundary crossing. This
 * combines INC and SBC functionality in a single instruction.
 * 
 * Flags affected: C (Carry), Z (Zero), V (Overflow), N (Negative)
 * - C: Set if no borrow occurred (A >= M + borrow)
 * - Z: Set if result is zero
 * - V: Set if signed overflow occurred
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 7 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Add Y to address (indexed addressing)
 * - Cycle 5: Read original value from final address
 * - Cycle 6: Internal operation (increment)
 * - Cycle 7: Write incremented value back and perform SBC
 * 
 * Addressing mode: Absolute Y - 3 bytes
 * Alternative names: INS, ISB
 */
function iscAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  cpu.incrementTacts(); // Extra cycle for indexed addressing
  const targetAddress = (baseAddress + cpu.y) & 0xFFFF;
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const incrementedValue = (originalValue + 1) & 0xFF;
  cpu.writeMemory(targetAddress, incrementedValue);
  
  // Now subtract incremented value from accumulator (using proper SBC implementation)
  cpu.a = cpu.performSbc(incrementedValue);
}

/**
 * SBC - Subtract with Carry - Opcode: $FD (Absolute X)
 * 
 * Operation: A = A - M - (1 - C)
 * 
 * Description:
 * SBC subtracts an absolute memory value and the complement of the carry
 * flag from the accumulator using X register indexing. An extra cycle is
 * added if a page boundary is crossed during the X indexing operation.
 * The carry flag acts as an inverted borrow: when clear, an additional
 * 1 is subtracted.
 * 
 * Flags affected: C (Carry), Z (Zero), V (Overflow), N (Negative)
 * - C: Set if no borrow occurred (A >= M + borrow)
 * - Z: Set if result is zero
 * - V: Set if signed overflow occurred
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 4 cycles (+1 if page boundary crossed)
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Read operand from (absolute address + X) and execute
 * - Cycle 5: Page boundary penalty (if crossing occurs)
 * 
 * Addressing mode: Absolute X - 3 bytes
 */
function sbcAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const operand = cpu.readMemoryWithPageBoundary(baseAddress, cpu.x);
  cpu.a = cpu.performSbc(operand);
}

/**
 * INC - Increment Memory - Opcode: $FE (Absolute X)
 * 
 * Operation: M = M + 1
 * 
 * Description:
 * INC increments the value at an absolute memory location by one using X
 * register indexing. This instruction always takes an extra cycle for
 * the indexed addressing, regardless of page boundary crossing. This is
 * a read-modify-write operation that takes additional cycles for the
 * internal modification.
 * 
 * Flags affected: Z (Zero), N (Negative)
 * - Z: Set if result is zero
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 7 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Add X to address (indexed addressing)
 * - Cycle 5: Read original value from final address
 * - Cycle 6: Internal operation (increment)
 * - Cycle 7: Write incremented value back to final address
 * 
 * Addressing mode: Absolute X - 3 bytes
 */
function incAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const address = (baseAddress + cpu.x) & 0xFFFF;
  cpu.incrementTacts(); // Indexed addressing cycle
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const value = cpu.readMemory(address);
  const result = (value + 1) & 0xFF;
  cpu.writeMemory(address, result);
  cpu.setZeroAndNegativeFlags(result);
}

/**
 * ISC - Increment then Subtract with Carry - Opcode: $FF (Absolute X) - Undocumented
 * 
 * Operation: M = M + 1, then A = A - M - (1 - C)
 * 
 * Description:
 * ISC is an undocumented instruction that increments an absolute memory
 * location and then subtracts the result (plus borrow) from the accumulator
 * using X register indexing. This instruction always takes an extra cycle
 * for the indexed addressing, regardless of page boundary crossing. This
 * combines INC and SBC functionality in a single instruction.
 * 
 * Flags affected: C (Carry), Z (Zero), V (Overflow), N (Negative)
 * - C: Set if no borrow occurred (A >= M + borrow)
 * - Z: Set if result is zero
 * - V: Set if signed overflow occurred
 * - N: Set if bit 7 of result is set
 * 
 * Timing: 7 cycles
 * - Cycle 1: Fetch opcode
 * - Cycle 2: Fetch low byte of address
 * - Cycle 3: Fetch high byte of address
 * - Cycle 4: Add X to address (indexed addressing)
 * - Cycle 5: Read original value from final address
 * - Cycle 6: Internal operation (increment)
 * - Cycle 7: Write incremented value back and perform SBC
 * 
 * Addressing mode: Absolute X - 3 bytes
 * Alternative names: INS, ISB
 */
function iscAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  cpu.incrementTacts(); // Extra cycle for indexed addressing
  const targetAddress = (baseAddress + cpu.x) & 0xFFFF;
  const originalValue = cpu.readMemory(targetAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const incrementedValue = (originalValue + 1) & 0xFF;
  cpu.writeMemory(targetAddress, incrementedValue);
  
  // Now subtract incremented value from accumulator (using proper SBC implementation)
  cpu.a = cpu.performSbc(incrementedValue);
}


// XAS (SHS/TAS) - Complex instruction affecting stack pointer and memory
// 0x9B: XAS abs,Y - Store result of X AND A in stack pointer, then store SP AND (high+1) in memory
function xasAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const targetAddress = (baseAddress + cpu.y) & 0xFFFF;
  
  // Extra read cycle for indexed addressing
  cpu.incrementTacts();
  
  // Step 1: Set stack pointer to X AND A
  cpu.sp = cpu.x & cpu.a;
  
  // Step 2: Calculate the high byte of the target address + 1
  const highBytePlusOne = ((targetAddress >> 8) + 1) & 0xFF;
  
  // Step 3: Store stack pointer AND (high byte + 1) in memory
  const result = cpu.sp & highBytePlusOne;
  cpu.writeMemory(targetAddress, result);
}
