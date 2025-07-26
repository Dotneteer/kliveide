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
   * Sets the flags after an SBC (Subtract with Carry) operation
   * @param accumulator The original accumulator value
   * @param operand The value being subtracted
   * @param borrowIn The borrow input (0 if carry set, 1 if carry clear)
   */
  setSbcFlags(accumulator: number, operand: number, borrowIn: number): void {
    const result = accumulator - operand - borrowIn;
    
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
    
    // Set C flag if no borrow occurred
    const minuend = accumulator;
    const subtrahend = operand + borrowIn;
    if (minuend >= subtrahend) {
      this._p |= FlagSetMask6510.C;
    }
    
    // Set V flag if signed overflow occurred
    // In subtraction, overflow occurs when:
    // - Subtracting a negative from a positive gives a negative result
    // - Subtracting a positive from a negative gives a positive result
    const accumulatorSign = accumulator & 0x80;
    const operandSign = operand & 0x80;
    const resultSign = result & 0x80;
    
    if ((accumulatorSign !== operandSign) && (accumulatorSign !== resultSign)) {
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

function jam(cpu: M6510Cpu): void {
  cpu.setJammed();
  cpu.incrementTacts(); // Increment tacts to simulate a cycle
}

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

function dopZp(cpu: M6510Cpu): void {
  cpu.readMemory(cpu.pc++); // Read and discard the zero page address
  cpu.incrementTacts(); // Extra cycle for zero page access (but no actual memory access)
}

function oraZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const value = cpu.readMemory(zpAddress);
  cpu.a = cpu.a | value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

function aslZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const originalValue = cpu.readMemory(zpAddress);
  cpu.incrementTacts(); // Internal operation cycle
  const shiftedValue = (originalValue << 1) & 0xff;
  cpu.writeMemory(zpAddress, shiftedValue);
  cpu.setAslFlags(originalValue, shiftedValue);
}

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

function php(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  // When PHP pushes the status register, the B flag is set in the pushed value
  // but the actual B flag in the processor remains unchanged
  const statusWithBreak = cpu.p | FlagSetMask6510.B | FlagSetMask6510.UNUSED;
  cpu.pushStack(statusWithBreak);
}

function oraImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.a = cpu.a | value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

function aslA(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  const originalValue = cpu.a;
  const shiftedValue = (cpu.a << 1) & 0xff;
  cpu.a = shiftedValue;
  cpu.setAslFlags(originalValue, shiftedValue);
}

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

function topAbs(cpu: M6510Cpu): void {
  // Read the 16-bit address
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  
  // Read from the address but don't use the value (same as other abs instructions)
  cpu.readMemory(address);
}

function oraAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemory(address);
  cpu.a = cpu.a | value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

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

function bpl(cpu: M6510Cpu): void {
  cpu.performBranch(!cpu.isNFlagSet());
}

function oraIndY(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const low = cpu.readMemory(zpAddress);
  const high = cpu.readMemory((zpAddress + 1) & 0xff);
  const address = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(address, cpu.y);
  cpu.a = cpu.a | value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

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

function dopZpX(cpu: M6510Cpu): void {
  cpu.readMemory(cpu.pc++); // Read and discard the zero page address
  cpu.incrementTacts(); // Extra cycle for indexed addressing
  cpu.incrementTacts(); // Extra cycle for zero page access (but no actual memory access)
}

function oraZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts();
  const address = (zpAddress + cpu.x) & 0xff;
  const value = cpu.readMemory(address);
  cpu.a = cpu.a | value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

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

function clc(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.p &= ~FlagSetMask6510.C;
}

function oraAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(address, cpu.y);
  cpu.a = cpu.a | value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

function illegal(_cpu: M6510Cpu): void {
  // TODO: Handle illegal opcodes
}

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

function topAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  
  // Use the same pattern as other abs,X instructions - this handles page boundary automatically
  cpu.readMemoryWithPageBoundary(address, cpu.x);
}

function oraAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(address, cpu.x);
  cpu.a = cpu.a | value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

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

function bitZp(cpu: M6510Cpu): void {
  const address = cpu.readMemory(cpu.pc++);
  const value = cpu.readMemory(address);
  cpu.setBitFlags(cpu.a, value);
}

function andZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const value = cpu.readMemory(zpAddress);
  cpu.a = cpu.a & value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

function rolZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const originalValue = cpu.readMemory(zpAddress);
  cpu.incrementTacts(); // Internal operation cycle
  const carryIn = cpu.isCFlagSet() ? 1 : 0;
  const rotatedValue = ((originalValue << 1) | carryIn) & 0xff;
  cpu.writeMemory(zpAddress, rotatedValue);
  cpu.setRolFlags(originalValue, rotatedValue);
}

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

function plp(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle 1
  cpu.incrementTacts(); // Internal operation cycle 2
  const pulledStatus = cpu.pullStack();
  // When PLP pulls the status register, ignore the B flag from the stack
  // and always set the UNUSED flag (bit 5)
  cpu.p = (pulledStatus & ~FlagSetMask6510.B) | FlagSetMask6510.UNUSED;
}

function andImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.a = cpu.a & value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

function rolA(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  const originalValue = cpu.a;
  const carryIn = cpu.isCFlagSet() ? 1 : 0;
  const rotatedValue = ((cpu.a << 1) | carryIn) & 0xff;
  cpu.a = rotatedValue;
  cpu.setRolFlags(originalValue, rotatedValue);
}

function bitAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemory(address);
  cpu.setBitFlags(cpu.a, value);
}

function andAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemory(address);
  cpu.a = cpu.a & value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

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

function bmi(cpu: M6510Cpu): void {
  cpu.performBranch(cpu.isNFlagSet());
}

function andIndY(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const low = cpu.readMemory(zeroPageAddress);
  const high = cpu.readMemory((zeroPageAddress + 1) & 0xFF); // Handle zero page wrap-around
  const baseAddress = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(baseAddress, cpu.y);
  cpu.a = cpu.a & value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

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

function andZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Increment tacts for indexed addressing
  const value = cpu.readMemory((zpAddress + cpu.x) & 0xFF); // Wrap around in zero page
  cpu.a = cpu.a & value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

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

function sec(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.p |= FlagSetMask6510.C;
}

function andAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(address, cpu.y);
  cpu.a = cpu.a & value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

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

function andAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(address, cpu.x);
  cpu.a = cpu.a & value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

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

function eorZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const value = cpu.readMemory(zpAddress);
  cpu.a = cpu.a ^ value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

function lsrZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const originalValue = cpu.readMemory(zpAddress);
  cpu.incrementTacts(); // Internal operation cycle
  const shiftedValue = originalValue >> 1;
  cpu.writeMemory(zpAddress, shiftedValue);
  cpu.setLsrFlags(originalValue, shiftedValue);
}

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

function pha(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.pushStack(cpu.a);
}

function eorImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.a = cpu.a ^ value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

function lsrA(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  const originalValue = cpu.a;
  const shiftedValue = cpu.a >> 1;
  cpu.a = shiftedValue;
  cpu.setLsrFlags(originalValue, shiftedValue);
}

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

function jmp(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const targetAddress = (high << 8) | low;
  cpu.pc = targetAddress;
}

function eorAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemory(address);
  cpu.a = cpu.a ^ value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

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

function bvc(cpu: M6510Cpu): void {
  cpu.performBranch(!cpu.isVFlagSet());
}

function eorIndY(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const low = cpu.readMemory(zeroPageAddress);
  const high = cpu.readMemory((zeroPageAddress + 1) & 0xFF); // Handle zero page wrap-around
  const baseAddress = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(baseAddress, cpu.y);
  cpu.a = cpu.a ^ value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

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

function eorZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Increment tacts for indexed addressing
  const value = cpu.readMemory((zpAddress + cpu.x) & 0xFF); // Wrap around in zero page
  cpu.a = cpu.a ^ value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

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

function cli(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.p &= ~FlagSetMask6510.I;
}

function eorAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(address, cpu.y);
  cpu.a = cpu.a ^ value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

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

function eorAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(address, cpu.x);
  cpu.a = cpu.a ^ value;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

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

function adcIndX(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const effectiveAddress = (zeroPageAddress + cpu.x) & 0xFF; // Wrap around in zero page
  cpu.incrementTacts(); // Indexed addressing cycle
  const low = cpu.readMemory(effectiveAddress);
  const high = cpu.readMemory((effectiveAddress + 1) & 0xFF); // Handle wrap-around for high byte too
  const targetAddress = (high << 8) | low;
  const operand = cpu.readMemory(targetAddress);
  const carryIn = cpu.isCFlagSet() ? 1 : 0;
  const result = cpu.a + operand + carryIn;
  cpu.setAdcFlags(cpu.a, operand, result);
  cpu.a = result & 0xFF;
}

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

function adcZp(cpu: M6510Cpu): void {
  const address = cpu.readMemory(cpu.pc++);
  const operand = cpu.readMemory(address);
  const carryIn = cpu.isCFlagSet() ? 1 : 0;
  const result = cpu.a + operand + carryIn;
  cpu.setAdcFlags(cpu.a, operand, result);
  cpu.a = result & 0xFF;
}

function rorZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const originalValue = cpu.readMemory(zpAddress);
  cpu.incrementTacts(); // Internal operation cycle
  const carryIn = cpu.isCFlagSet() ? 0x80 : 0;
  const rotatedValue = (originalValue >> 1) | carryIn;
  cpu.writeMemory(zpAddress, rotatedValue);
  cpu.setRorFlags(originalValue, rotatedValue);
}

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

function pla(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle 1
  cpu.incrementTacts(); // Internal operation cycle 2
  cpu.a = cpu.pullStack();
  cpu.setZeroAndNegativeFlags(cpu.a);
}

function adcImm(cpu: M6510Cpu): void {
  const operand = cpu.readMemory(cpu.pc++);
  const carryIn = cpu.isCFlagSet() ? 1 : 0;
  const result = cpu.a + operand + carryIn;
  cpu.setAdcFlags(cpu.a, operand, result);
  cpu.a = result & 0xFF;
}

function rorA(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  const originalValue = cpu.a;
  const carryIn = cpu.isCFlagSet() ? 0x80 : 0;
  const rotatedValue = (cpu.a >> 1) | carryIn;
  cpu.a = rotatedValue;
  cpu.setRorFlags(originalValue, rotatedValue);
}

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

function adcAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const operand = cpu.readMemory(address);
  const carryIn = cpu.isCFlagSet() ? 1 : 0;
  const result = cpu.a + operand + carryIn;
  cpu.setAdcFlags(cpu.a, operand, result);
  cpu.a = result & 0xFF;
}

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

function bvs(cpu: M6510Cpu): void {
  cpu.performBranch(cpu.isVFlagSet());
}

function adcIndY(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const low = cpu.readMemory(zeroPageAddress);
  const high = cpu.readMemory((zeroPageAddress + 1) & 0xFF); // Handle zero page wrap-around
  const baseAddress = (high << 8) | low;
  const operand = cpu.readMemoryWithPageBoundary(baseAddress, cpu.y);
  const carryIn = cpu.isCFlagSet() ? 1 : 0;
  const result = cpu.a + operand + carryIn;
  cpu.setAdcFlags(cpu.a, operand, result);
  cpu.a = result & 0xFF;
}

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

function adcZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const address = (zpAddress + cpu.x) & 0xFF; // Wrap around in zero page
  const operand = cpu.readMemory(address);
  const carryIn = cpu.isCFlagSet() ? 1 : 0;
  const result = cpu.a + operand + carryIn;
  cpu.setAdcFlags(cpu.a, operand, result);
  cpu.a = result & 0xFF;
}

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

function sei(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.p |= FlagSetMask6510.I;
}

function adcAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const operand = cpu.readMemoryWithPageBoundary(baseAddress, cpu.y);
  const carryIn = cpu.isCFlagSet() ? 1 : 0;
  const result = cpu.a + operand + carryIn;
  cpu.setAdcFlags(cpu.a, operand, result);
  cpu.a = result & 0xFF;
}

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

function adcAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const operand = cpu.readMemoryWithPageBoundary(baseAddress, cpu.x);
  const carryIn = cpu.isCFlagSet() ? 1 : 0;
  const result = cpu.a + operand + carryIn;
  cpu.setAdcFlags(cpu.a, operand, result);
  cpu.a = result & 0xFF;
}

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

function dopImm(cpu: M6510Cpu): void {
  cpu.readMemory(cpu.pc++); // Read and discard the immediate value
}

function staIndX(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const effectiveAddress = (zeroPageAddress + cpu.x) & 0xFF; // Wrap around in zero page
  cpu.incrementTacts();
  const low = cpu.readMemory(effectiveAddress);
  const high = cpu.readMemory((effectiveAddress + 1) & 0xFF); // Handle wrap-around for high byte too
  const targetAddress = (high << 8) | low;
  cpu.writeMemory(targetAddress, cpu.a);
}

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

function styZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.writeMemory(zpAddress, cpu.y);
}

function staZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.writeMemory(zpAddress, cpu.a);
}

function stxZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.writeMemory(zpAddress, cpu.x);
}

function saxZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const result = cpu.a & cpu.x;
  cpu.writeMemory(zpAddress, result);
}

function dey(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // One additional cycle for the operation
  cpu.y = (cpu.y - 1) & 0xFF;
  cpu.setZeroAndNegativeFlags(cpu.y);
}

function txa(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.a = cpu.x;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

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

function styAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  cpu.writeMemory(address, cpu.y);
}

function staAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  cpu.writeMemory(address, cpu.a);
}

function stxAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  cpu.writeMemory(address, cpu.x);
}

function saxAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const result = cpu.a & cpu.x;
  cpu.writeMemory(address, result);
}

function bcc(cpu: M6510Cpu): void {
  cpu.performBranch(!cpu.isCFlagSet());
}

function staIndY(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const low = cpu.readMemory(zeroPageAddress);
  const high = cpu.readMemory((zeroPageAddress + 1) & 0xFF); // Handle zero page wrap-around
  const baseAddress = (high << 8) | low;
  const targetAddress = (baseAddress + cpu.y) & 0xffff;
  cpu.incrementTacts(); // Extra cycle for page crossing
  cpu.writeMemory(targetAddress, cpu.a);
}

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

function styZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Increment tacts for indexed addressing
  cpu.writeMemory((zpAddress + cpu.x) & 0xFF, cpu.y); // Wrap around in zero page
}

function staZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Increment tacts for indexed addressing
  cpu.writeMemory((zpAddress + cpu.x) & 0xFF, cpu.a); // Wrap around in zero page
}

function stxZpY(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Increment tacts for indexed addressing
  cpu.writeMemory((zpAddress + cpu.y) & 0xFF, cpu.x); // Wrap around in zero page
}

function saxZpY(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const address = (zpAddress + cpu.y) & 0xFF; // Wrap around in zero page
  const result = cpu.a & cpu.x;
  cpu.writeMemory(address, result);
}

function tya(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.a = cpu.y;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

function staAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const targetAddress = (baseAddress + cpu.y) & 0xffff;
  cpu.incrementTacts(); // Extra cycle for indexed addressing
  cpu.writeMemory(targetAddress, cpu.a);
}

function txs(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.sp = cpu.x;
}

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

function staAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const targetAddress = (baseAddress + cpu.x) & 0xffff;
  cpu.incrementTacts(); // Extra cycle for indexed addressing
  cpu.writeMemory(targetAddress, cpu.a);
}

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

function ldyImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.y = value;
  cpu.setZeroAndNegativeFlags(value);
}

function ldaIndX(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const effectiveAddress = zeroPageAddress + cpu.x;
  cpu.incrementTacts();
  const low = cpu.readMemory(effectiveAddress);
  const high = cpu.readMemory((effectiveAddress + 1));
  cpu.a = cpu.readMemory((high << 8) | low);
  cpu.setZeroAndNegativeFlags(cpu.a);
}

function ldxImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.x = value;
  cpu.setZeroAndNegativeFlags(value);
}

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

function ldyZp(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.y = cpu.readMemory(value);
  cpu.setZeroAndNegativeFlags(cpu.y);
}

function ldaZp(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.a = cpu.readMemory(value);
  cpu.setZeroAndNegativeFlags(cpu.a);
}

function ldxZp(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.x = cpu.readMemory(value);
  cpu.setZeroAndNegativeFlags(cpu.x);
}

function laxZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const value = cpu.readMemory(zpAddress);
  cpu.a = value;
  cpu.x = value;
  cpu.setZeroAndNegativeFlags(value);
}

function tay(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.y = cpu.a;
  cpu.setZeroAndNegativeFlags(cpu.y);
}

function ldaImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.a = value;
  cpu.setZeroAndNegativeFlags(value);
}

function tax(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.x = cpu.a;
  cpu.setZeroAndNegativeFlags(cpu.x);
}

function atxImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  
  // AND with accumulator
  cpu.a = cpu.a & value;
  
  // Transfer accumulator to X
  cpu.x = cpu.a;
  
  // Set N and Z flags based on result
  cpu.setZeroAndNegativeFlags(cpu.a);
}

function ldyAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const addr = (high << 8) | low;
  cpu.y = cpu.readMemory(addr);
  cpu.setZeroAndNegativeFlags(cpu.y);
}

function ldaAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const addr = (high << 8) | low;
  cpu.a = cpu.readMemory(addr);
  cpu.setZeroAndNegativeFlags(cpu.a);
}

function ldxAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const addr = (high << 8) | low;
  cpu.x = cpu.readMemory(addr);
  cpu.setZeroAndNegativeFlags(cpu.x);
}

function laxAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemory(address);
  cpu.a = value;
  cpu.x = value;
  cpu.setZeroAndNegativeFlags(value);
}

function bcs(cpu: M6510Cpu): void {
  cpu.performBranch(cpu.isCFlagSet());
}

function ldaIndY(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const low = cpu.readMemory(zeroPageAddress);
  const high = cpu.readMemory((zeroPageAddress + 1));
  cpu.a = cpu.readMemoryWithPageBoundary((high << 8) | low, cpu.y);
  cpu.setZeroAndNegativeFlags(cpu.a);
}

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

function ldyZpX(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts();
  cpu.y = cpu.readMemory(zeroPageAddress + cpu.x);
  cpu.setZeroAndNegativeFlags(cpu.y);
}

function ldaZpX(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts();
  cpu.a = cpu.readMemory(zeroPageAddress + cpu.x);
  cpu.setZeroAndNegativeFlags(cpu.a);
}

function ldxZpY(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts();
  cpu.x = cpu.readMemory(zeroPageAddress + cpu.y);
  cpu.setZeroAndNegativeFlags(cpu.x);
}

function laxZpY(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const address = (zpAddress + cpu.y) & 0xFF; // Wrap around in zero page
  const value = cpu.readMemory(address);
  cpu.a = value;
  cpu.x = value;
  cpu.setZeroAndNegativeFlags(value);
}

function clv(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.p &= ~FlagSetMask6510.V;
}

function ldaAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const addr = (high << 8) | low;
  cpu.a = cpu.readMemoryWithPageBoundary(addr, cpu.y);
  cpu.setZeroAndNegativeFlags(cpu.a);
}

function tsx(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.x = cpu.sp;
  cpu.setZeroAndNegativeFlags(cpu.x);
}

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

function ldyAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const addr = (high << 8) | low;
  cpu.y = cpu.readMemoryWithPageBoundary(addr, cpu.x);
  cpu.setZeroAndNegativeFlags(cpu.y);
}

function ldaAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const addr = (high << 8) | low;
  cpu.a = cpu.readMemoryWithPageBoundary(addr, cpu.x);
  cpu.setZeroAndNegativeFlags(cpu.a);
}

function ldxAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const addr = (high << 8) | low;
  cpu.x = cpu.readMemoryWithPageBoundary(addr, cpu.y);
  cpu.setZeroAndNegativeFlags(cpu.x);
}

function laxAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(baseAddress, cpu.y);
  cpu.a = value;
  cpu.x = value;
  cpu.setZeroAndNegativeFlags(value);
}

function cpyImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.setCompareFlags(cpu.y, value);
}

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

function cpyZp(cpu: M6510Cpu): void {
  const address = cpu.readMemory(cpu.pc++);
  const value = cpu.readMemory(address);
  cpu.setCompareFlags(cpu.y, value);
}

function cmpZp(cpu: M6510Cpu): void {
  const address = cpu.readMemory(cpu.pc++);
  const value = cpu.readMemory(address);
  cpu.setCompareFlags(cpu.a, value);
}

function decZp(cpu: M6510Cpu): void {
  const address = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const value = cpu.readMemory(address);
  const result = (value - 1) & 0xFF;
  cpu.writeMemory(address, result);
  cpu.setZeroAndNegativeFlags(result);
}

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

function iny(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // One additional cycle for the operation
  cpu.y = (cpu.y + 1) & 0xFF;
  cpu.setZeroAndNegativeFlags(cpu.y);
}

function cmpImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.setCompareFlags(cpu.a, value);
}

function dex(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // One additional cycle for the operation
  cpu.x = (cpu.x - 1) & 0xFF;
  cpu.setZeroAndNegativeFlags(cpu.x);
}

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

function cpyAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemory(address);
  cpu.setCompareFlags(cpu.y, value);
}

function cmpAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemory(address);
  cpu.setCompareFlags(cpu.a, value);
}

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

function bne(cpu: M6510Cpu): void {
  cpu.performBranch(!cpu.isZFlagSet());
}

function cmpIndY(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const targetLow = cpu.readMemory(zpAddress);
  const targetHigh = cpu.readMemory((zpAddress + 1) & 0xFF); // Wrap around in zero page
  const baseAddress = (targetHigh << 8) | targetLow;
  const value = cpu.readMemoryWithPageBoundary(baseAddress, cpu.y);
  cpu.setCompareFlags(cpu.a, value);
}

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

function cmpZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const address = (zpAddress + cpu.x) & 0xFF; // Wrap around in zero page
  const value = cpu.readMemory(address);
  cpu.setCompareFlags(cpu.a, value);
}

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

function cld(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.p &= ~FlagSetMask6510.D;
}

function cmpAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(baseAddress, cpu.y);
  cpu.setCompareFlags(cpu.a, value);
}

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

function cmpAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const value = cpu.readMemoryWithPageBoundary(baseAddress, cpu.x);
  cpu.setCompareFlags(cpu.a, value);
}

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

function cpxImm(cpu: M6510Cpu): void {
  const value = cpu.readMemory(cpu.pc++);
  cpu.setCompareFlags(cpu.x, value);
}

function sbcIndX(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const effectiveAddress = (zeroPageAddress + cpu.x) & 0xFF; // Wrap around in zero page
  cpu.incrementTacts(); // Indexed addressing cycle
  const low = cpu.readMemory(effectiveAddress);
  const high = cpu.readMemory((effectiveAddress + 1) & 0xFF); // Handle wrap-around for high byte too
  const targetAddress = (high << 8) | low;
  const operand = cpu.readMemory(targetAddress);
  const borrowIn = cpu.isCFlagSet() ? 0 : 1; // Borrow is inverted carry
  const result = cpu.a - operand - borrowIn;
  cpu.setSbcFlags(cpu.a, operand, borrowIn);
  cpu.a = result & 0xFF;
}

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
  
  // Now subtract incremented value from accumulator (like SBC)
  const temp = cpu.a - incrementedValue - (cpu.isCFlagSet() ? 0 : 1);
  
  // Set V flag: overflow occurs when the sign of the inputs are the same and differ from the result
  const overflow = ((cpu.a ^ temp) & (~incrementedValue ^ temp) & 0x80) !== 0;
  if (overflow) {
    cpu.p |= FlagSetMask6510.V;
  } else {
    cpu.p &= ~FlagSetMask6510.V;
  }
  
  // Set C flag: carry (no borrow) when result >= 0
  if (temp >= 0) {
    cpu.p |= FlagSetMask6510.C;
  } else {
    cpu.p &= ~FlagSetMask6510.C;
  }
  
  cpu.a = temp & 0xFF;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

function cpxZp(cpu: M6510Cpu): void {
  const address = cpu.readMemory(cpu.pc++);
  const value = cpu.readMemory(address);
  cpu.setCompareFlags(cpu.x, value);
}

function sbcZp(cpu: M6510Cpu): void {
  const address = cpu.readMemory(cpu.pc++);
  const operand = cpu.readMemory(address);
  const borrowIn = cpu.isCFlagSet() ? 0 : 1; // Borrow is inverted carry
  const result = cpu.a - operand - borrowIn;
  cpu.setSbcFlags(cpu.a, operand, borrowIn);
  cpu.a = result & 0xFF;
}

function incZp(cpu: M6510Cpu): void {
  const address = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const value = cpu.readMemory(address);
  const result = (value + 1) & 0xFF;
  cpu.writeMemory(address, result);
  cpu.setZeroAndNegativeFlags(result);
}

function iscZp(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  const originalValue = cpu.readMemory(zpAddress);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const incrementedValue = (originalValue + 1) & 0xFF;
  cpu.writeMemory(zpAddress, incrementedValue);
  
  // Now subtract incremented value from accumulator (like SBC)
  const temp = cpu.a - incrementedValue - (cpu.isCFlagSet() ? 0 : 1);
  
  // Set V flag: overflow occurs when the sign of the inputs are the same and differ from the result
  const overflow = ((cpu.a ^ temp) & (~incrementedValue ^ temp) & 0x80) !== 0;
  if (overflow) {
    cpu.p |= FlagSetMask6510.V;
  } else {
    cpu.p &= ~FlagSetMask6510.V;
  }
  
  // Set C flag: carry (no borrow) when result >= 0
  if (temp >= 0) {
    cpu.p |= FlagSetMask6510.C;
  } else {
    cpu.p &= ~FlagSetMask6510.C;
  }
  
  cpu.a = temp & 0xFF;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

function inx(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // One additional cycle for the operation
  cpu.x = (cpu.x + 1) & 0xFF;
  cpu.setZeroAndNegativeFlags(cpu.x);
}

function sbcImm(cpu: M6510Cpu): void {
  const operand = cpu.readMemory(cpu.pc++);
  const borrowIn = cpu.isCFlagSet() ? 0 : 1; // Borrow is inverted carry
  const result = cpu.a - operand - borrowIn;
  cpu.setSbcFlags(cpu.a, operand, borrowIn);
  cpu.a = result & 0xFF;
}

function nop(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
}

function cpxAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const value = cpu.readMemory(address);
  cpu.setCompareFlags(cpu.x, value);
}

function sbcAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const operand = cpu.readMemory(address);
  const borrowIn = cpu.isCFlagSet() ? 0 : 1; // Borrow is inverted carry
  const result = cpu.a - operand - borrowIn;
  cpu.setSbcFlags(cpu.a, operand, borrowIn);
  cpu.a = result & 0xFF;
}

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

function iscAbs(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const address = (high << 8) | low;
  const originalValue = cpu.readMemory(address);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const incrementedValue = (originalValue + 1) & 0xFF;
  cpu.writeMemory(address, incrementedValue);
  
  // Now subtract incremented value from accumulator (like SBC)
  const temp = cpu.a - incrementedValue - (cpu.isCFlagSet() ? 0 : 1);
  
  // Set V flag: overflow occurs when the sign of the inputs are the same and differ from the result
  const overflow = ((cpu.a ^ temp) & (~incrementedValue ^ temp) & 0x80) !== 0;
  if (overflow) {
    cpu.p |= FlagSetMask6510.V;
  } else {
    cpu.p &= ~FlagSetMask6510.V;
  }
  
  // Set C flag: carry (no borrow) when result >= 0
  if (temp >= 0) {
    cpu.p |= FlagSetMask6510.C;
  } else {
    cpu.p &= ~FlagSetMask6510.C;
  }
  
  cpu.a = temp & 0xFF;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

function beq(cpu: M6510Cpu): void {
  cpu.performBranch(cpu.isZFlagSet());
}

function sbcIndY(cpu: M6510Cpu): void {
  const zeroPageAddress = cpu.readMemory(cpu.pc++);
  const low = cpu.readMemory(zeroPageAddress);
  const high = cpu.readMemory((zeroPageAddress + 1) & 0xFF); // Handle zero page wrap-around
  const baseAddress = (high << 8) | low;
  const operand = cpu.readMemoryWithPageBoundary(baseAddress, cpu.y);
  const borrowIn = cpu.isCFlagSet() ? 0 : 1; // Borrow is inverted carry
  const result = cpu.a - operand - borrowIn;
  cpu.setSbcFlags(cpu.a, operand, borrowIn);
  cpu.a = result & 0xFF;
}

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
  
  // Now subtract incremented value from accumulator (like SBC)
  const temp = cpu.a - incrementedValue - (cpu.isCFlagSet() ? 0 : 1);
  
  // Set V flag: overflow occurs when the sign of the inputs are the same and differ from the result
  const overflow = ((cpu.a ^ temp) & (~incrementedValue ^ temp) & 0x80) !== 0;
  if (overflow) {
    cpu.p |= FlagSetMask6510.V;
  } else {
    cpu.p &= ~FlagSetMask6510.V;
  }
  
  // Set C flag: carry (no borrow) when result >= 0
  if (temp >= 0) {
    cpu.p |= FlagSetMask6510.C;
  } else {
    cpu.p &= ~FlagSetMask6510.C;
  }
  
  cpu.a = temp & 0xFF;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

function sbcZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const address = (zpAddress + cpu.x) & 0xFF; // Wrap around in zero page
  const operand = cpu.readMemory(address);
  const borrowIn = cpu.isCFlagSet() ? 0 : 1; // Borrow is inverted carry
  const result = cpu.a - operand - borrowIn;
  cpu.setSbcFlags(cpu.a, operand, borrowIn);
  cpu.a = result & 0xFF;
}

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

function iscZpX(cpu: M6510Cpu): void {
  const zpAddress = cpu.readMemory(cpu.pc++);
  cpu.incrementTacts(); // Indexed addressing cycle
  const address = (zpAddress + cpu.x) & 0xFF; // Wrap around in zero page
  const originalValue = cpu.readMemory(address);
  cpu.incrementTacts(); // Read-modify-write: extra cycle for internal operations
  const incrementedValue = (originalValue + 1) & 0xFF;
  cpu.writeMemory(address, incrementedValue);
  
  // Now subtract incremented value from accumulator (like SBC)
  const temp = cpu.a - incrementedValue - (cpu.isCFlagSet() ? 0 : 1);
  
  // Set V flag: overflow occurs when the sign of the inputs are the same and differ from the result
  const overflow = ((cpu.a ^ temp) & (~incrementedValue ^ temp) & 0x80) !== 0;
  if (overflow) {
    cpu.p |= FlagSetMask6510.V;
  } else {
    cpu.p &= ~FlagSetMask6510.V;
  }
  
  // Set C flag: carry (no borrow) when result >= 0
  if (temp >= 0) {
    cpu.p |= FlagSetMask6510.C;
  } else {
    cpu.p &= ~FlagSetMask6510.C;
  }
  
  cpu.a = temp & 0xFF;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

function sed(cpu: M6510Cpu): void {
  cpu.incrementTacts(); // Internal operation cycle
  cpu.p |= FlagSetMask6510.D;
}

function sbcAbsY(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const operand = cpu.readMemoryWithPageBoundary(baseAddress, cpu.y);
  const borrowIn = cpu.isCFlagSet() ? 0 : 1; // Borrow is inverted carry
  const result = cpu.a - operand - borrowIn;
  cpu.setSbcFlags(cpu.a, operand, borrowIn);
  cpu.a = result & 0xFF;
}

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
  
  // Now subtract incremented value from accumulator (like SBC)
  const temp = cpu.a - incrementedValue - (cpu.isCFlagSet() ? 0 : 1);
  
  // Set V flag: overflow occurs when the sign of the inputs are the same and differ from the result
  const overflow = ((cpu.a ^ temp) & (~incrementedValue ^ temp) & 0x80) !== 0;
  if (overflow) {
    cpu.p |= FlagSetMask6510.V;
  } else {
    cpu.p &= ~FlagSetMask6510.V;
  }
  
  // Set C flag: carry (no borrow) when result >= 0
  if (temp >= 0) {
    cpu.p |= FlagSetMask6510.C;
  } else {
    cpu.p &= ~FlagSetMask6510.C;
  }
  
  cpu.a = temp & 0xFF;
  cpu.setZeroAndNegativeFlags(cpu.a);
}

function sbcAbsX(cpu: M6510Cpu): void {
  const low = cpu.readMemory(cpu.pc++);
  const high = cpu.readMemory(cpu.pc++);
  const baseAddress = (high << 8) | low;
  const operand = cpu.readMemoryWithPageBoundary(baseAddress, cpu.x);
  const borrowIn = cpu.isCFlagSet() ? 0 : 1; // Borrow is inverted carry
  const result = cpu.a - operand - borrowIn;
  cpu.setSbcFlags(cpu.a, operand, borrowIn);
  cpu.a = result & 0xFF;
}

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
  
  // Now subtract incremented value from accumulator (like SBC)
  const temp = cpu.a - incrementedValue - (cpu.isCFlagSet() ? 0 : 1);
  
  // Set V flag: overflow occurs when the sign of the inputs are the same and differ from the result
  const overflow = ((cpu.a ^ temp) & (~incrementedValue ^ temp) & 0x80) !== 0;
  if (overflow) {
    cpu.p |= FlagSetMask6510.V;
  } else {
    cpu.p &= ~FlagSetMask6510.V;
  }
  
  // Set C flag: carry (no borrow) when result >= 0
  if (temp >= 0) {
    cpu.p |= FlagSetMask6510.C;
  } else {
    cpu.p &= ~FlagSetMask6510.C;
  }
  
  cpu.a = temp & 0xFF;
  cpu.setZeroAndNegativeFlags(cpu.a);
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
