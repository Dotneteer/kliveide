import { ICustomDisassembler } from "./custom-disassembly";
import {
  DisassemblyItem,
  DisassemblyOutput,
  MemorySection,
  MemorySectionType,
  intToX2,
  intToX4,
  toSbyte,
  FetchResult,
  DisassemblyOptions
} from "./disassembly-helper";

/**
 * This class implements the Z80 disassembler
 */
export class Z80Disassembler {
  private _customDisassembler: ICustomDisassembler | null;
  private _output = new DisassemblyOutput();
  private _offset = 0;
  private _opOffset = 0;
  private _currentOpCodes = "";
  private _displacement: number | undefined;
  private _opCode = 0;
  private _indexMode = 0;
  private _overflow = false;
  private _addressOffset = 0;

  /**
   * Initializes a new instance of the disassembler
   * @param memorySections Memory map for disassembly
   * @param memoryContents The contents of the memory to disassemble
   *
   */
  constructor (
    public readonly memorySections: MemorySection[],
    public readonly memoryContents: Uint8Array,
    public readonly partitionLabels?: string[],
    public readonly options?: DisassemblyOptions
  ) {
    this.memorySections = memorySections;
    this.memoryContents = memoryContents;
  }

  /**
   * Sets the address offset for the disassembly
   * @param addressOffset Address offset to use
   */
  setAddressOffset (addressOffset: number): void {
    this._addressOffset = addressOffset;
  }

  /**
   * Allows to set a custom disassembler
   * @param custom
   */
  setCustomDisassembler (custom: ICustomDisassembler): void {
    this._customDisassembler = custom;
    custom.setDisassemblyApi({
      getMemoryContents: () => this.memoryContents,
      getOffset: () => this._offset,
      fetch: () => this._apiFetch(),
      peek: (ahead?: number) => this._peek(ahead),
      addDisassemblyItem: (item: DisassemblyItem) => this._output.addItem(item),
      createLabel: (address: number) => this._output.createLabel(address)
    });
  }

  /**
   * Disassembles the memory from the specified start address with the given endAddress
   * @param startAddress The start address of the disassembly
   * @param endAddress The end address of the disassembly
   * @param cancellationToken Cancellation token to abort disassembly
   * @param batchPause Optional break after a disassembly batch
   * @returns The disassembly output, if finished; or null, if cancelled
   */
  async disassemble (
    startAddress = 0x0000,
    endAddress = 0xffff
  ): Promise<DisassemblyOutput | null> {
    this._output = new DisassemblyOutput();
    if (endAddress > this.memoryContents.length) {
      endAddress = this.memoryContents.length - 1;
    }
    const refSection = new MemorySection(startAddress, endAddress);

    // --- Let's go through the memory sections
    for (const section of this.memorySections) {
      const toDisassemble = section.intersect(refSection);
      if (!toDisassemble) {
        continue;
      }
      switch (section.sectionType) {
        case MemorySectionType.Disassemble:
          await this._disassembleSection(toDisassemble);
          break;

        case MemorySectionType.ByteArray:
          await this._generateByteArray(toDisassemble);
          break;

        case MemorySectionType.WordArray:
          await this._generateWordArray(toDisassemble);
          break;

        case MemorySectionType.Skip:
          this._generateSkipOutput(toDisassemble);
          break;
      }
    }
    return this._output;
  }

  /**
   * Creates disassembler output for the specified section
   * @param section Section information
   */
  private async _disassembleSection (section: MemorySection): Promise<void> {
    this._customDisassembler?.startSectionDisassembly(section);
    this._offset = section.startAddress;
    this._overflow = false;
    const endOffset = section.endAddress;
    while (this._offset <= endOffset && !this._overflow) {
      // --- Disassemble the current item
      const customTakes =
        this._customDisassembler?.beforeInstruction(this._peek()) ?? false;
      if (!customTakes) {
        const item = this._disassembleOperation();
        if (item) {
          this._output.addItem(item);
        }
        this._customDisassembler?.afterInstruction(item);
      }
    }
    this._labelFixup();
  }

  /**
   * Generates byte array output for the specified section
   * @param section Section information
   */
  private async _generateByteArray (section: MemorySection): Promise<void> {
    const length = section.endAddress - section.startAddress + 1;
    for (let i = 0; i < length; i += 8) {
      let bytes: string[] = [];
      for (let j = 0; j < 8; j++) {
        if (i + j >= length) {
          break;
        }
        bytes.push(
          `$${intToX2(this.memoryContents[section.startAddress + i + j])}`
        );
      }

      const startAddress = (section.startAddress + i) & 0xffff;
      this._output.addItem({
        partition: this.partitionLabels?.[startAddress >> 13] ?? undefined,
        address: startAddress,
        instruction: ".defb " + bytes.join(", ")
      });
    }
  }

  /**
   * Generates word array output for the specified section
   * @param section Section information
   */
  private async _generateWordArray (section: MemorySection): Promise<void> {
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
        const value =
          this.memoryContents[section.startAddress + i + j * 2] +
          (this.memoryContents[section.startAddress + i + j * 2 + 1] << 8);
        words.push(`$${intToX4(value & 0xffff)}`);
      }

      const startAddress = (section.startAddress + i) & 0xffff;
      this._output.addItem({
        partition: this.partitionLabels?.[startAddress >> 13] ?? undefined,
        address: startAddress,
        instruction: ".defw " + words.join(", ")
      });
    }
    if (length % 2 === 1) {
      this._generateByteArray(
        new MemorySection(section.endAddress, section.endAddress)
      );
    }
  }

  /**
   * Generates skip output for the specified section
   * @param section Section information
   */
  private _generateSkipOutput (section: MemorySection): void {
    this._output.addItem({
      partition: this.partitionLabels?.[section.startAddress >> 13] ?? undefined,
      address: section.startAddress,
      instruction: `.skip $${intToX4(
        section.endAddress - section.startAddress + 1
      )}`
    });
  }

  /**
   * Disassembles a single instruction
   */
  private _disassembleOperation (): DisassemblyItem {
    this._opOffset = this._offset;
    this._currentOpCodes = "";
    this._displacement = undefined;
    this._indexMode = 0; // No index
    let decodeInfo: string | undefined;
    const address = this._offset & 0xffff;

    // --- We should generate a normal instruction disassembly
    this._opCode = this._fetch();
    if (this._opCode === 0xed) {
      // --- Decode extended instruction set

      this._opCode = this._fetch();
      decodeInfo =
        !(this.options?.allowExtendedSet ?? false) && z80NextSet[this._opCode]
          ? "nop"
          : extendedInstructions[this._opCode] ?? "nop";
    } else if (this._opCode === 0xcb) {
      // --- Decode bit operations

      this._opCode = this._fetch();
      if (this._opCode < 0x40) {
        switch (this._opCode >> 3) {
          case 0x00:
            decodeInfo = "rlc ^s";
            break;
          case 0x01:
            decodeInfo = "rrc ^s";
            break;
          case 0x02:
            decodeInfo = "rl ^s";
            break;
          case 0x03:
            decodeInfo = "rr ^s";
            break;
          case 0x04:
            decodeInfo = "sla ^s";
            break;
          case 0x05:
            decodeInfo = "sra ^s";
            break;
          case 0x06:
            decodeInfo = "sll ^s";
            break;
          case 0x07:
            decodeInfo = "srl ^s";
            break;
        }
      } else if (this._opCode < 0x80) {
        decodeInfo = "bit ^b,^s";
      } else if (this._opCode < 0xc0) {
        decodeInfo = "res ^b,^s";
      } else {
        decodeInfo = "set ^b,^s";
      }
    } else if (this._opCode === 0xdd) {
      // --- Decode IX-indexed operations

      this._indexMode = 1; // IX
      this._opCode = this._fetch();
      decodeInfo = this._disassembleIndexedOperation();
    } else if (this._opCode === 0xfd) {
      // --- Decode IY-indexed operations

      this._indexMode = 2; // IY
      this._opCode = this._fetch();
      decodeInfo = this._disassembleIndexedOperation();
    } else {
      // --- Decode standard operations
      decodeInfo = standardInstructions[this._opCode];
    }
    return this._decodeInstruction(address, decodeInfo);
  }

  /**
   * Gets the operation map for an indexed operation
   */
  private _disassembleIndexedOperation (): string | undefined {
    if (this._opCode !== 0xcb) {
      let decodeInfo =
        indexedInstructions[this._opCode] ?? standardInstructions[this._opCode];
      if (decodeInfo && decodeInfo.indexOf("^D") >= 0) {
        // --- The instruction used displacement, get it
        this._displacement = this._fetch();
      }
      return decodeInfo;
    }
    this._displacement = this._fetch();
    this._opCode = this._fetch();

    if (this._opCode < 0x40) {
      let pattern = "";
      switch (this._opCode >> 3) {
        case 0x00:
          pattern = "rlc (^X^D)";
          break;
        case 0x01:
          pattern = "rrc (^X^D)";
          break;
        case 0x02:
          pattern = "rl (^X^D)";
          break;
        case 0x03:
          pattern = "rr (^X^D)";
          break;
        case 0x04:
          pattern = "sla (^X^D)";
          break;
        case 0x05:
          pattern = "sra (^X^D)";
          break;
        case 0x06:
          pattern = "sll (^X^D)";
          break;
        case 0x07:
          pattern = "srl (^X^D)";
          break;
      }
      if ((this._opCode & 0x07) !== 0x06) {
        pattern += ",^s";
      }
      return pattern;
    } else if (this._opCode < 0x80) {
      return "bit ^b,(^X^D)";
    } else if (this._opCode < 0xc0) {
      return (this._opCode & 0x07) === 0x06
        ? "res ^b,(^X^D)"
        : "res ^b,(^X^D),^s";
    }
    return (this._opCode & 0x07) === 0x06
      ? "set ^b,(^X^D)"
      : "set ^b,(^X^D),^s";
  }

  /**
   * Fetches the next byte to disassemble
   */
  private _fetch (): number {
    if (this._offset >= this.memoryContents.length) {
      this._offset = 0;
      this._overflow = true;
    }
    const value = this.memoryContents[this._offset++];
    this._currentOpCodes += `${intToX2(value)} `;
    return value;
  }

  /**
   * Fetches the next word to disassemble
   */
  private _fetchWord (): number {
    const l = this._fetch();
    const h = this._fetch();
    return ((h << 8) | l) & 0xffff;
  }

  /**
   * Fetches the next byte to disassemble (for the custom API)
   */
  private _apiFetch (): FetchResult {
    const opcode = this._fetch();
    return {
      offset: this._offset,
      overflow: this._overflow,
      opcode
    };
  }

  /**
   * Fetches the next byte from the stream to disassemble
   */
  private _peek (ahead?: number): FetchResult {
    let overflow = false;
    ahead = ahead ?? 0;
    let offset = this._offset + ahead;
    if (offset >= this.memoryContents.length) {
      offset = offset % this.memoryContents.length;
      overflow = true;
    }
    const opcode = this.memoryContents[offset];
    return {
      offset,
      overflow,
      opcode
    };
  }

  /**
   * Decodes the specified instruction
   * @param address Instruction address
   * @param opInfo Operation inforamtion
   */
  private _decodeInstruction (
    address: number,
    opInfo: string | undefined
  ): DisassemblyItem {
    // --- By default, unknown codes are NOP operations
    const disassemblyItem: DisassemblyItem = {
      partition: this.partitionLabels?.[address >> 13] ?? undefined,
      address: (address + this._addressOffset) & 0xffff,
      opCodes: this._currentOpCodes,
      instruction: "nop"
    };

    let pattern = opInfo ?? "";

    // --- We have a real operation, it's time to decode it
    let pragmaCount = 0;
    disassemblyItem.instruction = pattern;
    if (disassemblyItem.instruction) {
      do {
        const pragmaIndex = disassemblyItem.instruction.indexOf("^");
        if (pragmaIndex < 0) {
          break;
        }
        pragmaCount++;
        this._processPragma(disassemblyItem, pragmaIndex);
      } while (pragmaCount < 4);
    }

    // --- We've fully processed the instruction
    disassemblyItem.opCodes = this._currentOpCodes;
    return disassemblyItem;
  }

  /**
   * Processes pragma informations within an operation map
   * @param disassemblyItem Disassembly item to process
   * @param pragmaIndex Index of the pragma within the instruction string
   */
  private _processPragma (
    disassemblyItem: DisassemblyItem,
    pragmaIndex: number
  ): void {
    const instruction = disassemblyItem.instruction;
    if (!instruction || pragmaIndex >= instruction.length) {
      return;
    }

    const pragma = instruction[pragmaIndex + 1];
    let replacement = "";
    let symbolPresent = false;
    let symbolValue = 0x000;
    switch (pragma) {
      case "b":
        // --- #b: bit index defined on bit 3, 4 and 5 in bit operations
        var bit = (this._opCode & 0x38) >> 3;
        replacement = bit.toString();
        break;
      case "r":
        // --- #r: relative label (8 bit offset)
        var distance = this._fetch();
        var labelAddr = (this._addressOffset + this._opOffset + 2 + toSbyte(distance)) & 0xffff;
        this._output.createLabel(labelAddr, this._opOffset);
        replacement = `${
          this.options?.noLabelPrefix ?? false ? "$" : "L"
        }${intToX4(labelAddr)}`;
        symbolPresent = true;
        disassemblyItem.hasLabelSymbol = true;
        symbolValue = labelAddr;
        break;
      case "L":
        // --- #L: absolute label (16 bit address)
        var target = this._fetchWord();
        this._output.createLabel(target, this._opOffset);
        replacement = `${
          this.options?.noLabelPrefix ?? false ? "$" : "L"
        }${intToX4(target)}`;
        symbolPresent = true;
        disassemblyItem.hasLabelSymbol = true;
        symbolValue = target;
        break;
      case "s":
        // --- #q: 8-bit registers named on bit 0, 1 and 2 (B, C, ..., (HL), A)
        var regsIndex = this._opCode & 0x07;
        replacement = q8Regs[regsIndex];
        break;
      case "B":
        // --- #B: 8-bit value from the code
        var value = this._fetch();
        replacement = `$${intToX2(value)}`;
        symbolPresent = true;
        symbolValue = value;
        break;
      case "W":
        // --- #W: 16-bit word from the code
        var word = this._fetchWord();
        replacement = `$${intToX4(word)}`;
        symbolPresent = true;
        symbolValue = word;
        break;
      case "w":
        // --- #W: 16-bit word from the code, big endian
        var word = (this._fetch() << 8) | this._fetch();
        replacement = `$${intToX4(word)}`;
        symbolPresent = true;
        symbolValue = word;
        break;
      case "X":
        // --- #X: Index register (IX or IY) according to current index mode
        replacement = this._indexMode === 1 ? "ix" : "iy";
        break;
      case "l":
        // --- #l: Lowest 8 bit index register (XL or YL) according to current index mode
        replacement = this._indexMode === 1 ? "xl" : "yl";
        break;
      case "h":
        // --- #h: Highest 8 bit index register (XH or YH) according to current index mode
        replacement = this._indexMode === 1 ? "xh" : "yh";
        break;
      case "D":
        // --- #D: Index operation displacement
        if (this._displacement) {
          replacement =
            toSbyte(this._displacement) < 0
              ? `-$${intToX2(0x100 - this._displacement)}`
              : `+$${intToX2(this._displacement)}`;
        }
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
  private _labelFixup (): void {
    for (const label of this._output.labels) {
      const outputItem = this._output.get(label[0]);
      if (outputItem) {
        outputItem.hasLabel = true;
      }
    }
  }
}

/**
 * 8-bit register pairs for the ^s pragma
 */
const q8Regs: string[] = ["b", "c", "d", "e", "h", "l", "(hl)", "a"];

/**
 * Disassembly stumps for standard instructions
 */
const standardInstructions: string[] = [
  /* 0x00 */ "nop",
  /* 0x01 */ "ld bc,^W",
  /* 0x02 */ "ld (bc),a",
  /* 0x03 */ "inc bc",
  /* 0x04 */ "inc b",
  /* 0x05 */ "dec b",
  /* 0x06 */ "ld b,^B",
  /* 0x07 */ "rlca",
  /* 0x08 */ "ex af,af'",
  /* 0x09 */ "add hl,bc",
  /* 0x0a */ "ld a,(bc)",
  /* 0x0b */ "dec bc",
  /* 0x0c */ "inc c",
  /* 0x0d */ "dec c",
  /* 0x0e */ "ld c,^B",
  /* 0x0f */ "rrca",

  /* 0x10 */ "djnz ^r",
  /* 0x11 */ "ld de,^W",
  /* 0x12 */ "ld (de),a",
  /* 0x13 */ "inc de",
  /* 0x14 */ "inc d",
  /* 0x15 */ "dec d",
  /* 0x16 */ "ld d,^B",
  /* 0x17 */ "rla",
  /* 0x18 */ "jr ^r",
  /* 0x19 */ "add hl,de",
  /* 0x1a */ "ld a,(de)",
  /* 0x1b */ "dec de",
  /* 0x1c */ "inc e",
  /* 0x1d */ "dec e",
  /* 0x1e */ "ld e,^B",
  /* 0x1f */ "rra",

  /* 0x20 */ "jr nz,^r",
  /* 0x21 */ "ld hl,^W",
  /* 0x22 */ "ld (^W),hl",
  /* 0x23 */ "inc hl",
  /* 0x24 */ "inc h",
  /* 0x25 */ "dec h",
  /* 0x26 */ "ld h,^B",
  /* 0x27 */ "daa",
  /* 0x28 */ "jr z,^r",
  /* 0x29 */ "add hl,hl",
  /* 0x2a */ "ld hl,(^W)",
  /* 0x1b */ "dec hl",
  /* 0x1c */ "inc l",
  /* 0x1d */ "dec l",
  /* 0x2e */ "ld l,^B",
  /* 0x2f */ "cpl",

  /* 0x30 */ "jr nc,^r",
  /* 0x31 */ "ld sp,^W",
  /* 0x32 */ "ld (^W),a",
  /* 0x33 */ "inc sp",
  /* 0x34 */ "inc (hl)",
  /* 0x35 */ "dec (hl)",
  /* 0x36 */ "ld (hl),^B",
  /* 0x37 */ "scf",
  /* 0x38 */ "jr c,^r",
  /* 0x39 */ "add hl,sp",
  /* 0x3a */ "ld a,(^W)",
  /* 0x3b */ "dec sp",
  /* 0x3c */ "inc a",
  /* 0x3d */ "dec a",
  /* 0x3e */ "ld a,^B",
  /* 0x3f */ "ccf",

  /* 0x40 */ "ld b,b",
  /* 0x41 */ "ld b,c",
  /* 0x42 */ "ld b,d",
  /* 0x43 */ "ld b,e",
  /* 0x44 */ "ld b,h",
  /* 0x45 */ "ld b,l",
  /* 0x46 */ "ld b,(hl)",
  /* 0x47 */ "ld b,a",
  /* 0x48 */ "ld c,b",
  /* 0x49 */ "ld c,c",
  /* 0x4a */ "ld c,d",
  /* 0x4b */ "ld c,e",
  /* 0x4c */ "ld c,h",
  /* 0x4d */ "ld c,l",
  /* 0x4e */ "ld c,(hl)",
  /* 0x4f */ "ld c,a",

  /* 0x50 */ "ld d,b",
  /* 0x51 */ "ld d,c",
  /* 0x52 */ "ld d,d",
  /* 0x53 */ "ld d,e",
  /* 0x54 */ "ld d,h",
  /* 0x55 */ "ld d,l",
  /* 0x56 */ "ld d,(hl)",
  /* 0x57 */ "ld d,a",
  /* 0x58 */ "ld e,b",
  /* 0x59 */ "ld e,c",
  /* 0x5a */ "ld e,d",
  /* 0x5b */ "ld e,e",
  /* 0x5c */ "ld e,h",
  /* 0x5d */ "ld e,l",
  /* 0x5e */ "ld e,(hl)",
  /* 0x5f */ "ld e,a",

  /* 0x60 */ "ld h,b",
  /* 0x61 */ "ld h,c",
  /* 0x62 */ "ld h,d",
  /* 0x63 */ "ld h,e",
  /* 0x64 */ "ld h,h",
  /* 0x65 */ "ld h,l",
  /* 0x66 */ "ld h,(hl)",
  /* 0x67 */ "ld h,a",
  /* 0x68 */ "ld l,b",
  /* 0x69 */ "ld l,c",
  /* 0x6a */ "ld l,d",
  /* 0x6b */ "ld l,e",
  /* 0x6c */ "ld l,h",
  /* 0x6d */ "ld l,l",
  /* 0x6e */ "ld l,(hl)",
  /* 0x6f */ "ld l,a",

  /* 0x70 */ "ld (hl),b",
  /* 0x71 */ "ld (hl),c",
  /* 0x72 */ "ld (hl),d",
  /* 0x73 */ "ld (hl),e",
  /* 0x74 */ "ld (hl),h",
  /* 0x75 */ "ld (hl),l",
  /* 0x76 */ "halt",
  /* 0x77 */ "ld (hl),a",
  /* 0x78 */ "ld a,b",
  /* 0x79 */ "ld a,c",
  /* 0x7a */ "ld a,d",
  /* 0x7b */ "ld a,e",
  /* 0x7c */ "ld a,h",
  /* 0x7d */ "ld a,l",
  /* 0x7e */ "ld a,(hl)",
  /* 0x7f */ "ld a,a",

  /* 0x80 */ "add a,b",
  /* 0x81 */ "add a,c",
  /* 0x82 */ "add a,d",
  /* 0x83 */ "add a,e",
  /* 0x84 */ "add a,h",
  /* 0x85 */ "add a,l",
  /* 0x86 */ "add a,(hl)",
  /* 0x87 */ "add a,a",
  /* 0x88 */ "adc a,b",
  /* 0x89 */ "adc a,c",
  /* 0x8a */ "adc a,d",
  /* 0x8b */ "adc a,e",
  /* 0x8c */ "adc a,h",
  /* 0x8d */ "adc a,l",
  /* 0x8e */ "adc a,(hl)",
  /* 0x8f */ "adc a,a",

  /* 0x90 */ "sub b",
  /* 0x91 */ "sub c",
  /* 0x92 */ "sub d",
  /* 0x93 */ "sub e",
  /* 0x94 */ "sub h",
  /* 0x95 */ "sub l",
  /* 0x96 */ "sub (hl)",
  /* 0x97 */ "sub a",
  /* 0x98 */ "sbc a,b",
  /* 0x99 */ "sbc a,c",
  /* 0x9a */ "sbc a,d",
  /* 0x9b */ "sbc a,e",
  /* 0x9c */ "sbc a,h",
  /* 0x9d */ "sbc a,l",
  /* 0x9e */ "sbc a,(hl)",
  /* 0x9f */ "sbc a,a",

  /* 0xa0 */ "and b",
  /* 0xa1 */ "and c",
  /* 0xa2 */ "and d",
  /* 0xa3 */ "and e",
  /* 0xa4 */ "and h",
  /* 0xa5 */ "and l",
  /* 0xa6 */ "and (hl)",
  /* 0xa7 */ "and a",
  /* 0xa8 */ "xor b",
  /* 0xa9 */ "xor c",
  /* 0xaa */ "xor d",
  /* 0xab */ "xor e",
  /* 0xac */ "xor h",
  /* 0xad */ "xor l",
  /* 0xae */ "xor (hl)",
  /* 0xaf */ "xor a",

  /* 0xb0 */ "or b",
  /* 0xb1 */ "or c",
  /* 0xb2 */ "or d",
  /* 0xb3 */ "or e",
  /* 0xb4 */ "or h",
  /* 0xb5 */ "or l",
  /* 0xb6 */ "or (hl)",
  /* 0xb7 */ "or a",
  /* 0xb8 */ "cp b",
  /* 0xb9 */ "cp c",
  /* 0xba */ "cp d",
  /* 0xbb */ "cp e",
  /* 0xbc */ "cp h",
  /* 0xbd */ "cp l",
  /* 0xbe */ "cp (hl)",
  /* 0xbf */ "cp a",

  /* 0xc0 */ "ret nz",
  /* 0xc1 */ "pop bc",
  /* 0xc2 */ "jp nz,^L",
  /* 0xc3 */ "jp ^L",
  /* 0xc4 */ "call nz,^L",
  /* 0xc5 */ "push bc",
  /* 0xc6 */ "add a,^B",
  /* 0xc7 */ "rst $00",
  /* 0xc8 */ "ret z",
  /* 0xc9 */ "ret",
  /* 0xca */ "jp z,^L",
  /* 0xcb */ "",
  /* 0xcc */ "call z,^L",
  /* 0xcd */ "call ^L",
  /* 0xce */ "adc a,^B",
  /* 0xcf */ "rst $08",

  /* 0xd0 */ "ret nc",
  /* 0xd1 */ "pop de",
  /* 0xd2 */ "jp nc,^L",
  /* 0xd3 */ "out (^B),a",
  /* 0xd4 */ "call nc,^L",
  /* 0xd5 */ "push de",
  /* 0xd6 */ "sub ^B",
  /* 0xd7 */ "rst $10",
  /* 0xd8 */ "ret c",
  /* 0xd9 */ "exx",
  /* 0xda */ "jp c,^L",
  /* 0xdb */ "in a,(^B)",
  /* 0xdc */ "call c,^L",
  /* 0xdd */ "",
  /* 0xde */ "sbc a,^B",
  /* 0xdf */ "rst $18",

  /* 0xe0 */ "ret po",
  /* 0xe1 */ "pop hl",
  /* 0xe2 */ "jp po,^L",
  /* 0xe3 */ "ex (sp),hl",
  /* 0xe4 */ "call po,^L",
  /* 0xe5 */ "push hl",
  /* 0xe6 */ "and ^B",
  /* 0xe7 */ "rst $20",
  /* 0xe8 */ "ret pe",
  /* 0xe9 */ "jp (hl)",
  /* 0xea */ "jp pe,^L",
  /* 0xeb */ "ex de,hl",
  /* 0xec */ "call pe,^L",
  /* 0xed */ "",
  /* 0xee */ "xor ^B",
  /* 0xef */ "rst $28",

  /* 0xf0 */ "ret p",
  /* 0xf1 */ "pop af",
  /* 0xf2 */ "jp p,^L",
  /* 0xf3 */ "di",
  /* 0xf4 */ "call p,^L",
  /* 0xf5 */ "push af",
  /* 0xf6 */ "or ^B",
  /* 0xf7 */ "rst $30",
  /* 0xf8 */ "ret m",
  /* 0xf9 */ "ld sp,hl",
  /* 0xfa */ "jp m,^L",
  /* 0xfb */ "ei",
  /* 0xfc */ "call m,^L",
  /* 0xfd */ "",
  /* 0xfe */ "cp ^B",
  /* 0xff */ "rst $38"
];

/**
 * Extended instructions available for ZX Spectrum Next only
 */
const z80NextSet: { [key: number]: boolean } = {
  0x23: true,
  0x24: true,
  0x27: true,
  0x28: true,
  0x29: true,
  0x2a: true,
  0x2b: true,
  0x2c: true,
  0x30: true,
  0x31: true,
  0x32: true,
  0x33: true,
  0x34: true,
  0x35: true,
  0x36: true,
  0x8a: true,
  0x90: true,
  0x91: true,
  0x92: true,
  0x93: true,
  0x94: true,
  0x95: true,
  0x98: true,
  0xa4: true,
  0xa5: true,
  0xac: true,
  0xb4: true,
  0xb7: true,
  0xbc: true
};

const extendedInstructions: { [key: number]: string } = {
  0x23: "swapnib",
  0x24: "mirror a",
  0x27: "test ^B",
  0x28: "bsla de,b",
  0x29: "bsra de,b",
  0x2a: "bsrl de,b",
  0x2b: "bsrf de,b",
  0x2c: "brlc de,b",
  0x30: "mul d,e",
  0x31: "add hl,a",
  0x32: "add de,a",
  0x33: "add bc,a",
  0x34: "add hl,^W",
  0x35: "add de,^W",
  0x36: "add bc,^W",
  0x40: "in b,(c)",
  0x41: "out (c),b",
  0x42: "sbc hl,bc",
  0x43: "ld (^W),bc",
  0x44: "neg",
  0x45: "retn",
  0x46: "im 0",
  0x47: "ld i,a",
  0x48: "in c,(c)",
  0x49: "out (c),c",
  0x4a: "adc hl,bc",
  0x4b: "ld bc,(^W)",
  0x4c: "neg",
  0x4d: "reti",
  0x4e: "im 0",
  0x4f: "ld r,a",
  0x50: "in d,(c)",
  0x51: "out (c),d",
  0x52: "sbc hl,de",
  0x53: "ld (^W),de",
  0x54: "neg",
  0x55: "retn",
  0x56: "im 1",
  0x57: "ld a,i",
  0x58: "in e,(c)",
  0x59: "out (c),e",
  0x5a: "adc hl,de",
  0x5b: "ld de,(^W)",
  0x5c: "neg",
  0x5d: "retn",
  0x5e: "im 2",
  0x5f: "ld a,r",
  0x60: "in h,(c)",
  0x61: "out (c),h",
  0x62: "sbc hl,hl",
  0x63: "ld (^W),hl",
  0x64: "neg",
  0x65: "retn",
  0x66: "im 0",
  0x67: "rrd",
  0x68: "in l,(c)",
  0x69: "out (c),l",
  0x6a: "adc hl,hl",
  0x6b: "ld hl,(^W)",
  0x6c: "neg",
  0x6d: "retn",
  0x6e: "im 0",
  0x6f: "rld",
  0x70: "in (c)",
  0x71: "out (c),0",
  0x72: "sbc hl,sp",
  0x73: "ld (^W),sp",
  0x74: "neg",
  0x75: "retn",
  0x76: "im 1",
  0x78: "in a,(c)",
  0x79: "out (c),a",
  0x7a: "adc hl,sp",
  0x7b: "ld sp,(^W)",
  0x7c: "neg",
  0x7d: "retn",
  0x7e: "im 2",
  0x8a: "push ^w", // BIG ENDIAN!
  0x90: "outinb",
  0x91: "nextreg ^B,^B",
  0x92: "nextreg ^B,a",
  0x93: "pixeldn",
  0x94: "pixelad",
  0x95: "setae",
  0x98: "jp (c)",
  0xa0: "ldi",
  0xa1: "cpi",
  0xa2: "ini",
  0xa3: "outi",
  0xa4: "ldix",
  0xa5: "ldws",
  0xa8: "ldd",
  0xa9: "cpd",
  0xaa: "ind",
  0xab: "outd",
  0xac: "lddx",
  0xb0: "ldir",
  0xb1: "cpir",
  0xb2: "inir",
  0xb3: "otir",
  0xb4: "ldirx",
  0xb7: "ldpirx",
  0xb8: "lddr",
  0xb9: "cpdr",
  0xba: "indr",
  0xbb: "otdr",
  0xbc: "lddrx"
};

const indexedInstructions: { [key: number]: string } = {
  0x09: "add ^X,bc",
  0x19: "add ^X,de",
  0x21: "ld ^X,^W",
  0x22: "ld (^W),^X",
  0x23: "inc ^X",
  0x24: "inc ^h",
  0x25: "dec ^h",
  0x26: "ld ^h,^B",
  0x29: "add ^X,^X",
  0x2a: "ld ^X,(^W)",
  0x2b: "dec ^X",
  0x2c: "inc ^l",
  0x2d: "dec ^l",
  0x2e: "ld ^l,^B",
  0x34: "inc (^X^D)",
  0x35: "dec (^X^D)",
  0x36: "ld (^X^D),^B",
  0x39: "add ^X,sp",
  0x44: "ld b,^h",
  0x45: "ld b,^l",
  0x46: "ld b,(^X^D)",
  0x4c: "ld c,^h",
  0x4d: "ld c,^l",
  0x4e: "ld c,(^X^D)",
  0x54: "ld d,^h",
  0x55: "ld d,^l",
  0x56: "ld d,(^X^D)",
  0x5c: "ld e,^h",
  0x5d: "ld e,^l",
  0x5e: "ld e,(^X^D)",
  0x60: "ld ^h,b",
  0x61: "ld ^h,c",
  0x62: "ld ^h,d",
  0x63: "ld ^h,e",
  0x64: "ld ^h,^h",
  0x65: "ld ^h,^l",
  0x66: "ld h,(^X^D)",
  0x67: "ld ^h,a",
  0x68: "ld ^l,b",
  0x69: "ld ^l,c",
  0x6a: "ld ^l,d",
  0x6b: "ld ^l,e",
  0x6c: "ld ^l,^h",
  0x6d: "ld ^l,^l",
  0x6e: "ld l,(^X^D)",
  0x6f: "ld ^l,a",
  0x70: "ld (^X^D),b",
  0x71: "ld (^X^D),c",
  0x72: "ld (^X^D),d",
  0x73: "ld (^X^D),e",
  0x74: "ld (^X^D),h",
  0x75: "ld (^X^D),l",
  0x77: "ld (^X^D),a",
  0x7c: "ld a,^h",
  0x7d: "ld a,^l",
  0x7e: "ld a,(^X^D)",
  0x84: "add a,^h",
  0x85: "add a,^l",
  0x86: "add a,(^X^D)",
  0x8c: "adc a,^h",
  0x8d: "adc a,^l",
  0x8e: "adc a,(^X^D)",
  0x94: "sub ^h",
  0x95: "sub ^l",
  0x96: "sub (^X^D)",
  0x9c: "sbc a,^h",
  0x9d: "sbc a,^l",
  0x9e: "sbc a,(^X^D)",
  0xa4: "and ^h",
  0xa5: "and ^l",
  0xa6: "and (^X^D)",
  0xac: "xor ^h",
  0xad: "xor ^l",
  0xae: "xor (^X^D)",
  0xb4: "or ^h",
  0xb5: "or ^l",
  0xb6: "or (^X^D)",
  0xbc: "cp ^h",
  0xbd: "cp ^l",
  0xbe: "cp (^X^D)",
  0xe1: "pop ^X",
  0xe3: "ex (sp),^X",
  0xe5: "push ^X",
  0xe9: "jp (^X)",
  0xf9: "ld sp,^X"
};
