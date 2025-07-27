import {
  M6510DisassemblyItem,
  M6510DisassemblyOutput,
  M6510MemorySection,
  M6510MemorySectionType,
  intToX2,
  intToX4,
  toSbyte,
  M6510DisassemblyOptions,
  toDecimal3,
  toDecimal5
} from "./disassembly-helper";

/**
 * This class implements the M6510 disassembler
 */
export class M6510Disassembler {
  private _output = new M6510DisassemblyOutput();
  private _offset = 0;
  private _opOffset = 0;
  private _currentOpCodes: number[] = [];
  private _opCode = 0;
  private _decimalMode = false;
  private _overflow = false;
  private _baseAddress = 0;

  /**
   * Initializes a new instance of the disassembler
   * @param memorySections Memory map for disassembly
   * @param memoryContents The contents of the memory to disassemble
   * @param options Disassembly options
   * @param baseAddress The base address where the memory contents start (default: 0)
   */
  constructor(
    public readonly memorySections: M6510MemorySection[],
    public readonly memoryContents: Uint8Array,
    public readonly options?: M6510DisassemblyOptions,
    baseAddress: number = 0
  ) {
    this.memorySections = memorySections;
    this.memoryContents = memoryContents;
    this._decimalMode = options?.decimalMode ?? false;
    this._baseAddress = baseAddress;
  }

  /**
   * Disassembles the memory from the specified start address with the given endAddress
   * @param startAddress The start address of the disassembly
   * @param endAddress The end address of the disassembly
   * @returns The disassembly output, if finished; or null, if cancelled
   */
  async disassemble(startAddress = 0x0000, endAddress = 0xffff): Promise<M6510DisassemblyOutput | null> {
    this._output = new M6510DisassemblyOutput();
    const maxAddress = this._baseAddress + this.memoryContents.length - 1;
    if (endAddress > maxAddress) {
      endAddress = maxAddress;
    }
    const refSection = new M6510MemorySection(startAddress, endAddress);

    // --- Let's go through the memory sections
    for (const section of this.memorySections) {
      const toDisassemble = section.intersect(refSection);
      if (!toDisassemble) {
        continue;
      }
      switch (section.sectionType) {
        case M6510MemorySectionType.Disassemble:
          await this.disassembleSection(toDisassemble);
          break;

        case M6510MemorySectionType.ByteArray:
          await this.generateByteArray(toDisassemble);
          break;

        case M6510MemorySectionType.WordArray:
          await this.generateWordArray(toDisassemble);
          break;

        case M6510MemorySectionType.Skip:
          this.generateSkipOutput(toDisassemble);
          break;
      }
    }
    return this._output;
  }

  /**
   * Creates disassembler output for the specified section
   * @param section Section information
   */
  private async disassembleSection(section: M6510MemorySection): Promise<void> {
    this._offset = section.startAddress;
    this._overflow = false;
    const endOffset = section.endAddress;
    while (this._offset <= endOffset && !this._overflow) {
      // --- Disassemble the current item
      const item = this.disassembleOperation();
      if (item) {
        this._output.addItem(item);
      }
    }
    this.labelFixup();
  }

  /**
   * Generates byte array output for the specified section
   * @param section Section information
   */
  private async generateByteArray(section: M6510MemorySection): Promise<void> {
    const length = section.endAddress - section.startAddress + 1;
    for (let i = 0; i < length; i += 8) {
      let bytes: string[] = [];
      for (let j = 0; j < 8; j++) {
        if (i + j >= length) {
          break;
        }
        const memoryIndex = (section.startAddress + i + j) - this._baseAddress;
        const byte = this.memoryContents[memoryIndex];
        bytes.push(this._decimalMode ? toDecimal3(byte) : `$${intToX2(byte)}`);
      }

      const startAddress = (section.startAddress + i) & 0xffff;
      this._output.addItem({
        address: startAddress,
        instruction: ".byte " + bytes.join(", ")
      });
    }
  }

  /**
   * Generates word array output for the specified section
   * @param section Section information
   */
  private async generateWordArray(section: M6510MemorySection): Promise<void> {
    const length = section.endAddress - section.startAddress + 1;
    for (let i = 0; i < length; i += 8) {
      if (i + 1 >= length) {
        break;
      }
      let words: string[] = [];
      for (let j = 0; j < 8; j += 2) {
        if (i + j + 1 >= length) {
          break;
        }
        const memoryIndex1 = (section.startAddress + i + j) - this._baseAddress;
        const memoryIndex2 = (section.startAddress + i + j + 1) - this._baseAddress;
        const value =
          this.memoryContents[memoryIndex1] +
          (this.memoryContents[memoryIndex2] << 8);
        words.push(this._decimalMode ? (value & 0xffff).toString(10) : `$${intToX4(value & 0xffff)}`);
      }

      const startAddress = (section.startAddress + i) & 0xffff;
      this._output.addItem({
        address: startAddress,
        instruction: ".word " + words.join(", ")
      });
    }
    if (length % 2 === 1) {
      this.generateByteArray(new M6510MemorySection(section.endAddress, section.endAddress));
    }
  }

  /**
   * Generates skip output for the specified section
   * @param section Section information
   */
  private generateSkipOutput(section: M6510MemorySection): void {
    this._output.addItem({
      address: section.startAddress,
      instruction:
        ".skip " + (this._decimalMode
          ? (section.endAddress - section.startAddress + 1).toString(10)
          : `$${intToX4(section.endAddress - section.startAddress + 1)}`)
    });
  }

  /**
   * Disassembles a single instruction
   */
  private disassembleOperation(): M6510DisassemblyItem {
    this._opOffset = this._offset;
    this._currentOpCodes = [];
    const address = this._offset & 0xffff;
    let defaultCycles = 2;

    // --- We should generate a normal instruction disassembly
    this._opCode = this.fetch();
    const decodeInfo = m6510Instructions[this._opCode] ?? "???";
    
    return this.decodeInstruction(address, decodeInfo, defaultCycles);
  }

  /**
   * Fetches the next byte to disassemble
   */
  private fetch(): number {
    const memoryIndex = this._offset - this._baseAddress;
    if (memoryIndex >= this.memoryContents.length || memoryIndex < 0) {
      this._overflow = true;
      return 0;
    }
    const value = this.memoryContents[memoryIndex];
    this._currentOpCodes.push(value);
    this._offset++;
    return value;
  }

  /**
   * Fetches the next word to disassemble (little endian)
   */
  private fetchWord(): number {
    const l = this.fetch();
    const h = this.fetch();
    return ((h << 8) | l) & 0xffff;
  }



  /**
   * Decodes the specified instruction
   * @param address Instruction address
   * @param opInfo Operation information
   * @param defaultCycles Default cycle count
   */
  private decodeInstruction(
    address: number,
    opInfo: string,
    defaultCycles: number
  ): M6510DisassemblyItem {
    // --- By default, unknown codes are ??? operations
    const disassemblyItem: M6510DisassemblyItem = {
      address: address & 0xffff,
      opCodes: this._currentOpCodes,
      instruction: "???",
      cycles: defaultCycles
    };

    const parts = opInfo.split("|");
    const pattern = parts[0];
    let cycles = defaultCycles;
    if (parts.length > 1) {
      cycles = parseInt(parts[1]);
    }

    // --- We have a real operation, it's time to decode it
    let pragmaCount = 0;
    disassemblyItem.instruction = pattern;
    disassemblyItem.cycles = cycles;
    if (disassemblyItem.instruction) {
      do {
        const pragmaIndex = disassemblyItem.instruction.indexOf("^");
        if (pragmaIndex < 0) {
          break;
        }
        pragmaCount++;
        this.processPragma(disassemblyItem, pragmaIndex);
      } while (pragmaCount < 4);
    }

    // --- We've fully processed the instruction
    disassemblyItem.opCodes = this._currentOpCodes;
    return disassemblyItem;
  }

  /**
   * Processes pragma information within an operation map
   * @param disassemblyItem Disassembly item to process
   * @param pragmaIndex Index of the pragma within the instruction string
   */
  private processPragma(disassemblyItem: M6510DisassemblyItem, pragmaIndex: number): void {
    const instruction = disassemblyItem.instruction;
    if (!instruction || pragmaIndex >= instruction.length) {
      return;
    }

    const pragma = instruction[pragmaIndex + 1];
    let replacement = "";
    let symbolPresent = false;
    let symbolValue = 0x000;
    switch (pragma) {
      case "I": // Immediate value
        var value = this.fetch();
        replacement = this._decimalMode ? `#${value}` : `#$${intToX2(value)}`;
        symbolPresent = true;
        symbolValue = value;
        break;
      case "Z": // Zero page address
        var zpAddr = this.fetch();
        replacement = this._decimalMode ? zpAddr.toString(10) : `$${intToX2(zpAddr)}`;
        symbolPresent = true;
        symbolValue = zpAddr;
        break;
      case "X": // Zero page,X
        var zpAddrX = this.fetch();
        replacement = this._decimalMode ? `${zpAddrX},x` : `$${intToX2(zpAddrX)},x`;
        symbolPresent = true;
        symbolValue = zpAddrX;
        break;
      case "Y": // Zero page,Y
        var zpAddrY = this.fetch();
        replacement = this._decimalMode ? `${zpAddrY},y` : `$${intToX2(zpAddrY)},y`;
        symbolPresent = true;
        symbolValue = zpAddrY;
        break;
      case "A": // Absolute address
        var absAddr = this.fetchWord();
        replacement = this._decimalMode ? absAddr.toString(10) : `$${intToX4(absAddr)}`;
        symbolPresent = true;
        symbolValue = absAddr;
        break;
      case "J": // Absolute address for jump (creates label)
        var jumpAddr = this.fetchWord();
        this._output.createLabel(jumpAddr, this._opOffset);
        replacement = `${this.options?.noLabelPrefix ?? false ? "$" : "L"}${this._decimalMode ? toDecimal5(jumpAddr) : intToX4(jumpAddr)}`;
        symbolPresent = true;
        disassemblyItem.hasLabelSymbol = true;
        symbolValue = jumpAddr;
        break;
      case "U": // Absolute,X
        var absAddrX = this.fetchWord();
        replacement = this._decimalMode ? `${absAddrX},x` : `$${intToX4(absAddrX)},x`;
        symbolPresent = true;
        symbolValue = absAddrX;
        break;
      case "V": // Absolute,Y
        var absAddrY = this.fetchWord();
        replacement = this._decimalMode ? `${absAddrY},y` : `$${intToX4(absAddrY)},y`;
        symbolPresent = true;
        symbolValue = absAddrY;
        break;
      case "R": // Relative address
        var distance = this.fetch();
        var labelAddr = (this._opOffset + 2 + toSbyte(distance)) & 0xffff;
        this._output.createLabel(labelAddr, this._opOffset);
        replacement = `${this.options?.noLabelPrefix ?? false ? "$" : "L"}${this._decimalMode ? toDecimal5(labelAddr) : intToX4(labelAddr)}`;
        symbolPresent = true;
        disassemblyItem.hasLabelSymbol = true;
        symbolValue = labelAddr;
        break;
      case "N": // (Indirect,X) - ($ZZ,X)
        var indX = this.fetch();
        replacement = this._decimalMode ? `(${indX},x)` : `($${intToX2(indX)},x)`;
        symbolPresent = true;
        symbolValue = indX;
        break;
      case "M": // (Indirect),Y - ($ZZ),Y
        var indY = this.fetch();
        replacement = this._decimalMode ? `(${indY}),y` : `($${intToX2(indY)}),y`;
        symbolPresent = true;
        symbolValue = indY;
        break;
      case "P": // (Indirect) - ($AAAA) for JMP
        var indAddr = this.fetchWord();
        replacement = this._decimalMode ? `(${indAddr})` : `($${intToX4(indAddr)})`;
        symbolPresent = true;
        symbolValue = indAddr;
        break;
    }

    if (symbolPresent && replacement && replacement.length > 0) {
      disassemblyItem.tokenPosition = pragmaIndex;
      disassemblyItem.tokenLength = replacement.length;
      disassemblyItem.hasSymbol = true;
      disassemblyItem.symbolValue = symbolValue;
    }
    disassemblyItem.instruction =
      instruction.substring(0, pragmaIndex) +
      (replacement ? replacement : "") +
      instruction.substring(pragmaIndex + 2);
  }

  /**
   * Fixes the labels within the disassembly output
   */
  private labelFixup(): void {
    for (const label of this._output.labels) {
      const outputItem = this._output.get(label[0]);
      if (outputItem) {
        outputItem.hasLabel = true;
      }
    }
  }
}

/**
 * M6510 instruction patterns with pragma codes:
 * ^I - Immediate value (#$nn)
 * ^Z - Zero page address ($nn)
 * ^X - Zero page,X ($nn,X)
 * ^Y - Zero page,Y ($nn,Y)
 * ^A - Absolute address ($nnnn)
 * ^J - Absolute address for jump (creates label)
 * ^U - Absolute,X ($nnnn,X)
 * ^V - Absolute,Y ($nnnn,Y)
 * ^R - Relative address (creates label)
 * ^N - (Indirect,X) (($nn,X))
 * ^M - (Indirect),Y (($nn),Y)
 * ^P - (Indirect) (($nnnn))
 */
const m6510Instructions: string[] = [
  /* 0x00 */ "brk|7",
  /* 0x01 */ "ora ^N|6",         // ORA (zp,X)
  /* 0x02 */ "jam|2",            // JAM (KIL/HLT)
  /* 0x03 */ "slo ^N|8",         // SLO (zp,X) - undocumented
  /* 0x04 */ "nop ^Z|3",         // NOP zp (DOP) - undocumented
  /* 0x05 */ "ora ^Z|3",         // ORA zp
  /* 0x06 */ "asl ^Z|5",         // ASL zp
  /* 0x07 */ "slo ^Z|5",         // SLO zp - undocumented
  /* 0x08 */ "php|3",
  /* 0x09 */ "ora ^I|2",         // ORA #imm
  /* 0x0A */ "asl|2",            // ASL A
  /* 0x0B */ "aac ^I|2",         // AAC #imm (ANC) - undocumented
  /* 0x0C */ "nop ^A|4",         // NOP abs (TOP) - undocumented
  /* 0x0D */ "ora ^A|4",         // ORA abs
  /* 0x0E */ "asl ^A|6",         // ASL abs
  /* 0x0F */ "slo ^A|6",         // SLO abs - undocumented

  /* 0x10 */ "bpl ^R|2",
  /* 0x11 */ "ora ^M|5",         // ORA (zp),Y
  /* 0x12 */ "jam|2",            // JAM (KIL/HLT)
  /* 0x13 */ "slo ^M|8",         // SLO (zp),Y - undocumented
  /* 0x14 */ "nop ^X|4",         // NOP zp,X (DOP) - undocumented
  /* 0x15 */ "ora ^X|4",         // ORA zp,X
  /* 0x16 */ "asl ^X|6",         // ASL zp,X
  /* 0x17 */ "slo ^X|6",         // SLO zp,X - undocumented
  /* 0x18 */ "clc|2",
  /* 0x19 */ "ora ^V|4",         // ORA abs,Y
  /* 0x1A */ "nop|2",            // NOP - undocumented
  /* 0x1B */ "slo ^V|7",         // SLO abs,Y - undocumented
  /* 0x1C */ "nop ^U|4",         // NOP abs,X (TOP) - undocumented
  /* 0x1D */ "ora ^U|4",         // ORA abs,X
  /* 0x1E */ "asl ^U|7",         // ASL abs,X
  /* 0x1F */ "slo ^U|7",         // SLO abs,X - undocumented

  /* 0x20 */ "jsr ^J|6",
  /* 0x21 */ "and ^N|6",         // AND (zp,X)
  /* 0x22 */ "jam|2",            // JAM (KIL/HLT)
  /* 0x23 */ "rla ^N|8",         // RLA (zp,X) - undocumented
  /* 0x24 */ "bit ^Z|3",         // BIT zp
  /* 0x25 */ "and ^Z|3",         // AND zp
  /* 0x26 */ "rol ^Z|5",         // ROL zp
  /* 0x27 */ "rla ^Z|5",         // RLA zp - undocumented
  /* 0x28 */ "plp|4",
  /* 0x29 */ "and ^I|2",         // AND #imm
  /* 0x2A */ "rol|2",            // ROL A
  /* 0x2B */ "aac ^I|2",         // AAC #imm (ANC) - undocumented
  /* 0x2C */ "bit ^A|4",         // BIT abs
  /* 0x2D */ "and ^A|4",         // AND abs
  /* 0x2E */ "rol ^A|6",         // ROL abs
  /* 0x2F */ "rla ^A|6",         // RLA abs - undocumented

  /* 0x30 */ "bmi ^R|2",
  /* 0x31 */ "and ^M|5",         // AND (zp),Y
  /* 0x32 */ "jam|2",            // JAM (KIL/HLT)
  /* 0x33 */ "rla ^M|8",         // RLA (zp),Y - undocumented
  /* 0x34 */ "nop ^X|4",         // NOP zp,X (DOP) - undocumented
  /* 0x35 */ "and ^X|4",         // AND zp,X
  /* 0x36 */ "rol ^X|6",         // ROL zp,X
  /* 0x37 */ "rla ^X|6",         // RLA zp,X - undocumented
  /* 0x38 */ "sec|2",
  /* 0x39 */ "and ^V|4",         // AND abs,Y
  /* 0x3A */ "nop|2",            // NOP - undocumented
  /* 0x3B */ "rla ^V|7",         // RLA abs,Y - undocumented
  /* 0x3C */ "nop ^U|4",         // NOP abs,X (TOP) - undocumented
  /* 0x3D */ "and ^U|4",         // AND abs,X
  /* 0x3E */ "rol ^U|7",         // ROL abs,X
  /* 0x3F */ "rla ^U|7",         // RLA abs,X - undocumented

  /* 0x40 */ "rti|6",
  /* 0x41 */ "eor ^N|6",         // EOR (zp,X)
  /* 0x42 */ "jam|2",            // JAM (KIL/HLT)
  /* 0x43 */ "sre ^N|8",         // SRE (zp,X) - undocumented
  /* 0x44 */ "nop ^Z|3",         // NOP zp (DOP) - undocumented
  /* 0x45 */ "eor ^Z|3",         // EOR zp
  /* 0x46 */ "lsr ^Z|5",         // LSR zp
  /* 0x47 */ "sre ^Z|5",         // SRE zp - undocumented
  /* 0x48 */ "pha|3",
  /* 0x49 */ "eor ^I|2",         // EOR #imm
  /* 0x4A */ "lsr|2",            // LSR A
  /* 0x4B */ "asr ^I|2",         // ASR #imm (ALR) - undocumented
  /* 0x4C */ "jmp ^J|3",
  /* 0x4D */ "eor ^A|4",         // EOR abs
  /* 0x4E */ "lsr ^A|6",         // LSR abs
  /* 0x4F */ "sre ^A|6",         // SRE abs - undocumented

  /* 0x50 */ "bvc ^R|2",
  /* 0x51 */ "eor ^M|5",         // EOR (zp),Y
  /* 0x52 */ "jam|2",            // JAM (KIL/HLT)
  /* 0x53 */ "sre ^M|8",         // SRE (zp),Y - undocumented
  /* 0x54 */ "nop ^X|4",         // NOP zp,X (DOP) - undocumented
  /* 0x55 */ "eor ^X|4",         // EOR zp,X
  /* 0x56 */ "lsr ^X|6",         // LSR zp,X
  /* 0x57 */ "sre ^X|6",         // SRE zp,X - undocumented
  /* 0x58 */ "cli|2",
  /* 0x59 */ "eor ^V|4",         // EOR abs,Y
  /* 0x5A */ "nop|2",            // NOP - undocumented
  /* 0x5B */ "sre ^V|7",         // SRE abs,Y - undocumented
  /* 0x5C */ "nop ^U|4",         // NOP abs,X (TOP) - undocumented
  /* 0x5D */ "eor ^U|4",         // EOR abs,X
  /* 0x5E */ "lsr ^U|7",         // LSR abs,X
  /* 0x5F */ "sre ^U|7",         // SRE abs,X - undocumented

  /* 0x60 */ "rts|6",
  /* 0x61 */ "adc ^N|6",         // ADC (zp,X)
  /* 0x62 */ "jam|2",            // JAM (KIL/HLT)
  /* 0x63 */ "rra ^N|8",         // RRA (zp,X) - undocumented
  /* 0x64 */ "nop ^Z|3",         // NOP zp (DOP) - undocumented
  /* 0x65 */ "adc ^Z|3",         // ADC zp
  /* 0x66 */ "ror ^Z|5",         // ROR zp
  /* 0x67 */ "rra ^Z|5",         // RRA zp - undocumented
  /* 0x68 */ "pla|4",
  /* 0x69 */ "adc ^I|2",         // ADC #imm
  /* 0x6A */ "ror|2",            // ROR A
  /* 0x6B */ "arr ^I|2",         // ARR #imm - undocumented
  /* 0x6C */ "jmp ^P|5",         // JMP (abs)
  /* 0x6D */ "adc ^A|4",         // ADC abs
  /* 0x6E */ "ror ^A|6",         // ROR abs
  /* 0x6F */ "rra ^A|6",         // RRA abs - undocumented

  /* 0x70 */ "bvs ^R|2",
  /* 0x71 */ "adc ^M|5",         // ADC (zp),Y
  /* 0x72 */ "jam|2",            // JAM (KIL/HLT)
  /* 0x73 */ "rra ^M|8",         // RRA (zp),Y - undocumented
  /* 0x74 */ "nop ^X|4",         // NOP zp,X (DOP) - undocumented
  /* 0x75 */ "adc ^X|4",         // ADC zp,X
  /* 0x76 */ "ror ^X|6",         // ROR zp,X
  /* 0x77 */ "rra ^X|6",         // RRA zp,X - undocumented
  /* 0x78 */ "sei|2",
  /* 0x79 */ "adc ^V|4",         // ADC abs,Y
  /* 0x7A */ "nop|2",            // NOP - undocumented
  /* 0x7B */ "rra ^V|7",         // RRA abs,Y - undocumented
  /* 0x7C */ "nop ^U|4",         // NOP abs,X (TOP) - undocumented
  /* 0x7D */ "adc ^U|4",         // ADC abs,X
  /* 0x7E */ "ror ^U|7",         // ROR abs,X
  /* 0x7F */ "rra ^U|7",         // RRA abs,X - undocumented

  /* 0x80 */ "nop ^I|2",         // NOP #imm (DOP) - undocumented
  /* 0x81 */ "sta ^N|6",         // STA (zp,X)
  /* 0x82 */ "nop ^I|2",         // NOP #imm (DOP) - undocumented
  /* 0x83 */ "sax ^N|6",         // SAX (zp,X) - undocumented
  /* 0x84 */ "sty ^Z|3",         // STY zp
  /* 0x85 */ "sta ^Z|3",         // STA zp
  /* 0x86 */ "stx ^Z|3",         // STX zp
  /* 0x87 */ "sax ^Z|3",         // SAX zp - undocumented
  /* 0x88 */ "dey|2",
  /* 0x89 */ "nop ^I|2",         // NOP #imm (DOP) - undocumented
  /* 0x8A */ "txa|2",
  /* 0x8B */ "xaa ^I|2",         // XAA #imm (ANE) - undocumented
  /* 0x8C */ "sty ^A|4",         // STY abs
  /* 0x8D */ "sta ^A|4",         // STA abs
  /* 0x8E */ "stx ^A|4",         // STX abs
  /* 0x8F */ "sax ^A|4",         // SAX abs - undocumented

  /* 0x90 */ "bcc ^R|2",
  /* 0x91 */ "sta ^M|6",         // STA (zp),Y
  /* 0x92 */ "jam|2",            // JAM (KIL/HLT)
  /* 0x93 */ "axa ^M|6",         // AXA (zp),Y (AHX/SHA) - undocumented
  /* 0x94 */ "sty ^X|4",         // STY zp,X
  /* 0x95 */ "sta ^X|4",         // STA zp,X
  /* 0x96 */ "stx ^Y|4",         // STX zp,Y
  /* 0x97 */ "sax ^Y|4",         // SAX zp,Y - undocumented
  /* 0x98 */ "tya|2",
  /* 0x99 */ "sta ^V|5",         // STA abs,Y
  /* 0x9A */ "txs|2",
  /* 0x9B */ "xas ^V|5",         // XAS abs,Y (TAS/SHS) - undocumented
  /* 0x9C */ "sya ^U|5",         // SYA abs,X (SHY) - undocumented
  /* 0x9D */ "sta ^U|5",         // STA abs,X
  /* 0x9E */ "sxa ^V|5",         // SXA abs,Y (SHX) - undocumented
  /* 0x9F */ "axa ^V|5",         // AXA abs,Y (AHX/SHA) - undocumented

  /* 0xA0 */ "ldy ^I|2",         // LDY #imm
  /* 0xA1 */ "lda ^N|6",         // LDA (zp,X)
  /* 0xA2 */ "ldx ^I|2",         // LDX #imm
  /* 0xA3 */ "lax ^N|6",         // LAX (zp,X) - undocumented
  /* 0xA4 */ "ldy ^Z|3",         // LDY zp
  /* 0xA5 */ "lda ^Z|3",         // LDA zp
  /* 0xA6 */ "ldx ^Z|3",         // LDX zp
  /* 0xA7 */ "lax ^Z|3",         // LAX zp - undocumented
  /* 0xA8 */ "tay|2",
  /* 0xA9 */ "lda ^I|2",         // LDA #imm
  /* 0xAA */ "tax|2",
  /* 0xAB */ "atx ^I|2",         // ATX #imm (LAX/LXA) - undocumented
  /* 0xAC */ "ldy ^A|4",         // LDY abs
  /* 0xAD */ "lda ^A|4",         // LDA abs
  /* 0xAE */ "ldx ^A|4",         // LDX abs
  /* 0xAF */ "lax ^A|4",         // LAX abs - undocumented

  /* 0xB0 */ "bcs ^R|2",
  /* 0xB1 */ "lda ^M|5",         // LDA (zp),Y
  /* 0xB2 */ "jam|2",            // JAM (KIL/HLT)
  /* 0xB3 */ "lax ^M|5",         // LAX (zp),Y - undocumented
  /* 0xB4 */ "ldy ^X|4",         // LDY zp,X
  /* 0xB5 */ "lda ^X|4",         // LDA zp,X
  /* 0xB6 */ "ldx ^Y|4",         // LDX zp,Y
  /* 0xB7 */ "lax ^Y|4",         // LAX zp,Y - undocumented
  /* 0xB8 */ "clv|2",
  /* 0xB9 */ "lda ^V|4",         // LDA abs,Y
  /* 0xBA */ "tsx|2",
  /* 0xBB */ "lar ^V|4",         // LAR abs,Y (LAS) - undocumented
  /* 0xBC */ "ldy ^U|4",         // LDY abs,X
  /* 0xBD */ "lda ^U|4",         // LDA abs,X
  /* 0xBE */ "ldx ^V|4",         // LDX abs,Y
  /* 0xBF */ "lax ^V|4",         // LAX abs,Y - undocumented

  /* 0xC0 */ "cpy ^I|2",         // CPY #imm
  /* 0xC1 */ "cmp ^N|6",         // CMP (zp,X)
  /* 0xC2 */ "nop ^I|2",         // NOP #imm (DOP) - undocumented
  /* 0xC3 */ "dcp ^N|8",         // DCP (zp,X) - undocumented
  /* 0xC4 */ "cpy ^Z|3",         // CPY zp
  /* 0xC5 */ "cmp ^Z|3",         // CMP zp
  /* 0xC6 */ "dec ^Z|5",         // DEC zp
  /* 0xC7 */ "dcp ^Z|5",         // DCP zp - undocumented
  /* 0xC8 */ "iny|2",
  /* 0xC9 */ "cmp ^I|2",         // CMP #imm
  /* 0xCA */ "dex|2",
  /* 0xCB */ "axs ^I|2",         // AXS #imm (SBX) - undocumented
  /* 0xCC */ "cpy ^A|4",         // CPY abs
  /* 0xCD */ "cmp ^A|4",         // CMP abs
  /* 0xCE */ "dec ^A|6",         // DEC abs
  /* 0xCF */ "dcp ^A|6",         // DCP abs - undocumented

  /* 0xD0 */ "bne ^R|2",
  /* 0xD1 */ "cmp ^M|5",         // CMP (zp),Y
  /* 0xD2 */ "jam|2",            // JAM (KIL/HLT)
  /* 0xD3 */ "dcp ^M|8",         // DCP (zp),Y - undocumented
  /* 0xD4 */ "nop ^X|4",         // NOP zp,X (DOP) - undocumented
  /* 0xD5 */ "cmp ^X|4",         // CMP zp,X
  /* 0xD6 */ "dec ^X|6",         // DEC zp,X
  /* 0xD7 */ "dcp ^X|6",         // DCP zp,X - undocumented
  /* 0xD8 */ "cld|2",
  /* 0xD9 */ "cmp ^V|4",         // CMP abs,Y
  /* 0xDA */ "nop|2",            // NOP - undocumented
  /* 0xDB */ "dcp ^V|7",         // DCP abs,Y - undocumented
  /* 0xDC */ "nop ^U|4",         // NOP abs,X (TOP) - undocumented
  /* 0xDD */ "cmp ^U|4",         // CMP abs,X
  /* 0xDE */ "dec ^U|7",         // DEC abs,X
  /* 0xDF */ "dcp ^U|7",         // DCP abs,X - undocumented

  /* 0xE0 */ "cpx ^I|2",         // CPX #imm
  /* 0xE1 */ "sbc ^N|6",         // SBC (zp,X)
  /* 0xE2 */ "nop ^I|2",         // NOP #imm (DOP) - undocumented
  /* 0xE3 */ "isc ^N|8",         // ISC (zp,X) - undocumented
  /* 0xE4 */ "cpx ^Z|3",         // CPX zp
  /* 0xE5 */ "sbc ^Z|3",         // SBC zp
  /* 0xE6 */ "inc ^Z|5",         // INC zp
  /* 0xE7 */ "isc ^Z|5",         // ISC zp - undocumented
  /* 0xE8 */ "inx|2",
  /* 0xE9 */ "sbc ^I|2",         // SBC #imm
  /* 0xEA */ "nop|2",
  /* 0xEB */ "sbc ^I|2",         // SBC #imm (undocumented duplicate)
  /* 0xEC */ "cpx ^A|4",         // CPX abs
  /* 0xED */ "sbc ^A|4",         // SBC abs
  /* 0xEE */ "inc ^A|6",         // INC abs
  /* 0xEF */ "isc ^A|6",         // ISC abs - undocumented

  /* 0xF0 */ "beq ^R|2",
  /* 0xF1 */ "sbc ^M|5",         // SBC (zp),Y
  /* 0xF2 */ "jam|2",            // JAM (KIL/HLT)
  /* 0xF3 */ "isc ^M|8",         // ISC (zp),Y - undocumented
  /* 0xF4 */ "nop ^X|4",         // NOP zp,X (DOP) - undocumented
  /* 0xF5 */ "sbc ^X|4",         // SBC zp,X
  /* 0xF6 */ "inc ^X|6",         // INC zp,X
  /* 0xF7 */ "isc ^X|6",         // ISC zp,X - undocumented
  /* 0xF8 */ "sed|2",
  /* 0xF9 */ "sbc ^V|4",         // SBC abs,Y
  /* 0xFA */ "nop|2",            // NOP - undocumented
  /* 0xFB */ "isc ^V|7",         // ISC abs,Y - undocumented
  /* 0xFC */ "nop ^U|4",         // NOP abs,X (TOP) - undocumented
  /* 0xFD */ "sbc ^U|4",         // SBC abs,X
  /* 0xFE */ "inc ^U|7",         // INC abs,X
  /* 0xFF */ "isc ^U|7"          // ISC abs,X - undocumented
];
