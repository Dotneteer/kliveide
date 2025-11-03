import { getNextRegisters, NextRegInfo } from "../../../emu/machines/zxNext/NextRegDevice";
import { ICustomDisassembler } from "./custom-disassembly";
import {
  DisassemblyItem,
  DisassemblyOptions,
  DisassemblyOutput,
  FetchResult,
  MemorySection,
} from "../common-types";
import { intToX2, intToX4, toSbyte } from "../utils";
import { MemorySectionType } from "../../../common/abstractions/MemorySection";
import { toDecimal3, toDecimal5 } from "../../../common/utils/conversions";

/**
 * This class implements the Z80 disassembler
 */
export class Z80Disassembler {
  private _customDisassembler: ICustomDisassembler | null;
  private _output = new DisassemblyOutput();
  private _offset = 0;
  private _opOffset = 0;
  private _currentOpCodes: number[] = [];
  private _displacement: number | undefined;
  private _opCode = 0;
  private _indexMode = 0;
  private _decimalMode = false;
  private _overflow = false;
  private _addressOffset = 0;
  private _nextRegInfo: NextRegInfo[] = [];

  /**
   * Initializes a new instance of the disassembler
   * @param memorySections Memory map for disassembly
   * @param memoryContents The contents of the memory to disassemble
   *
   */
  constructor(
    public readonly memorySections: MemorySection[],
    public readonly memoryContents: Uint8Array,
    public readonly partitionLabels?: string[],
    public readonly options?: DisassemblyOptions
  ) {
    this.memorySections = memorySections;
    this.memoryContents = memoryContents;
    this._nextRegInfo = getNextRegisters();
    this._decimalMode = options?.decimalMode ?? false;
  }

  /**
   * Sets the address offset for the disassembly
   * @param addressOffset Address offset to use
   */
  setAddressOffset(addressOffset: number): void {
    this._addressOffset = addressOffset;
  }

  /**
   * Allows to set a custom disassembler
   * @param custom
   */
  setCustomDisassembler(custom: ICustomDisassembler): void {
    this._customDisassembler = custom;
    custom.setDisassemblyApi({
      decimalMode: this._decimalMode,
      getMemoryContents: () => this.memoryContents,
      getOffset: () => this._offset,
      fetch: () => this.apiFetch(),
      peek: (ahead?: number) => this.peek(ahead),
      addDisassemblyItem: (item: DisassemblyItem) => this._output.addItem(item),
      createLabel: (address: number) => this._output.createLabel(address),
      getRomPage: () => {
        if (this.options && this.options.getRomPage) {
          return this.options.getRomPage();
        }
        return -1;
      }
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
  async disassemble(startAddress = 0x0000, endAddress = 0xffff): Promise<DisassemblyOutput | null> {
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
          await this.disassembleSection(toDisassemble);
          break;

        case MemorySectionType.ByteArray:
          await this.generateByteArray(toDisassemble);
          break;

        case MemorySectionType.WordArray:
          await this.generateWordArray(toDisassemble);
          break;

        case MemorySectionType.Skip:
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
  private async disassembleSection(section: MemorySection): Promise<void> {
    this._customDisassembler?.startSectionDisassembly(section);
    this._offset = section.startAddress;
    this._overflow = false;
    const endOffset = section.endAddress;
    while (this._offset <= endOffset && !this._overflow) {
      // --- Disassemble the current item
      const customTakes = this._customDisassembler?.beforeInstruction(this.peek()) ?? false;
      if (!customTakes) {
        const item = this.disassembleOperation();
        if (item) {
          this._output.addItem(item);
        }
        this._customDisassembler?.afterInstruction(item);
      }
    }
    this.labelFixup();
  }

  /**
   * Generates byte array output for the specified section
   * @param section Section information
   */
  private async generateByteArray(section: MemorySection): Promise<void> {
    const length = section.endAddress - section.startAddress + 1;
    for (let i = 0; i < length; i += 8) {
      let bytes: string[] = [];
      for (let j = 0; j < 8; j++) {
        if (i + j >= length) {
          break;
        }
        const byte = this.memoryContents[section.startAddress + i + j];
        bytes.push(this._decimalMode ? toDecimal3(byte) : `$${intToX2(byte)}`);
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
  private async generateWordArray(section: MemorySection): Promise<void> {
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
        words.push(
          this._decimalMode ? (value & 0xffff).toString(10) : `$${intToX4(value & 0xffff)}`
        );
      }

      const startAddress = (section.startAddress + i) & 0xffff;
      this._output.addItem({
        partition: this.partitionLabels?.[startAddress >> 13] ?? undefined,
        address: startAddress,
        instruction: ".defw " + words.join(", ")
      });
    }
    if (length % 2 === 1) {
      this.generateByteArray(new MemorySection(section.endAddress, section.endAddress));
    }
  }

  /**
   * Generates skip output for the specified section
   * @param section Section information
   */
  private generateSkipOutput(section: MemorySection): void {
    this._output.addItem({
      partition: this.partitionLabels?.[section.startAddress >> 13] ?? undefined,
      address: section.startAddress,
      instruction:
        ".skip" + this._decimalMode
          ? (section.endAddress - section.startAddress + 1).toString(10)
          : `$${intToX4(section.endAddress - section.startAddress + 1)}`
    });
  }

  /**
   * Disassembles a single instruction
   */
  private disassembleOperation(): DisassemblyItem {
    this._opOffset = this._offset;
    this._currentOpCodes = [];
    this._displacement = undefined;
    this._indexMode = 0; // No index
    let decodeInfo: string | undefined;
    const address = this._offset & 0xffff;
    let defaultTstates = 4;

    // --- We should generate a normal instruction disassembly
    this._opCode = this.fetch();
    if (this._opCode === 0xed) {
      // --- Decode extended instruction set

      defaultTstates += 4;
      this._opCode = this.fetch();
      decodeInfo =
        !(this.options?.allowExtendedSet ?? false) && z80NextSet[this._opCode]
          ? "nop"
          : extendedInstructions[this._opCode] ?? "nop";
    } else if (this._opCode === 0xcb) {
      // --- Decode bit operations

      defaultTstates += 4;
      this._opCode = this.fetch();
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

      defaultTstates += 4;
      this._indexMode = 1; // IX
      this._opCode = this.fetch();
      if (this._opCode === 0xcb) {
        defaultTstates += 4;
      }
      decodeInfo = this.disassembleIndexedOperation();
    } else if (this._opCode === 0xfd) {
      // --- Decode IY-indexed operations

      defaultTstates += 4;
      this._indexMode = 2; // IY
      this._opCode = this.fetch();
      if (this._opCode === 0xcb) {
        defaultTstates += 4;
      }
      decodeInfo = this.disassembleIndexedOperation();
    } else {
      // --- Decode standard operations
      defaultTstates = 4;
      decodeInfo = standardInstructions[this._opCode];
    }
    return this.decodeInstruction(address, decodeInfo, defaultTstates);
  }

  /**
   * Gets the operation map for an indexed operation
   */
  private disassembleIndexedOperation(): string | undefined {
    if (this._opCode !== 0xcb) {
      let decodeInfo = indexedInstructions[this._opCode] ?? standardInstructions[this._opCode];
      if (decodeInfo && decodeInfo.indexOf("^D") >= 0) {
        // --- The instruction used displacement, get it
        this._displacement = this.fetch();
      }
      return decodeInfo;
    }
    this._displacement = this.fetch();
    this._opCode = this.fetch();

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
      return (this._opCode & 0x07) === 0x06 ? "res ^b,(^X^D)" : "res ^b,(^X^D),^s";
    }
    return (this._opCode & 0x07) === 0x06 ? "set ^b,(^X^D)" : "set ^b,(^X^D),^s";
  }

  /**
   * Fetches the next byte to disassemble
   */
  private fetch(): number {
    if (this._offset >= this.memoryContents.length) {
      this._offset = 0;
      this._overflow = true;
    }
    const value = this.memoryContents[this._offset++];
    this._currentOpCodes.push(value);
    return value;
  }

  /**
   * Fetches the next word to disassemble
   */
  private fetchWord(): number {
    const l = this.fetch();
    const h = this.fetch();
    return ((h << 8) | l) & 0xffff;
  }

  /**
   * Fetches the next byte to disassemble (for the custom API)
   */
  private apiFetch(): FetchResult {
    const opcode = this.fetch();
    return {
      offset: this._offset,
      overflow: this._overflow,
      opcode
    };
  }

  /**
   * Fetches the next byte from the stream to disassemble
   */
  private peek(ahead?: number): FetchResult {
    let overflow = false;
    ahead = ahead ?? 0;
    let offset = this._offset + ahead;
    if (offset >= this.memoryContents.length) {
      offset = offset % this.memoryContents.length;
      overflow = true;
    }
    const opcode = this.memoryContents[offset];
    const partitionLabel = this.partitionLabels?.[offset >> 13] ?? undefined;
    return {
      partitionLabel,
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
  private decodeInstruction(
    address: number,
    opInfo: string | undefined,
    defaultTstates: number
  ): DisassemblyItem {
    // --- By default, unknown codes are NOP operations
    const disassemblyItem: DisassemblyItem = {
      partition: this.partitionLabels?.[address >> 13] ?? undefined,
      address: (address + this._addressOffset) & 0xffff,
      opCodes: this._currentOpCodes,
      instruction: "nop",
      tstates: defaultTstates
    };

    const parts = (opInfo ?? "").split("|");
    const pattern = parts[0];
    let tstates = defaultTstates;
    let tstates2 = 0;
    if (parts.length > 1) {
      const nums = parts[1].split("/");
      tstates = parseInt(nums[0]);
      tstates2 = nums.length > 1 ? parseInt(nums[1]) : 0;
    }

    // --- We have a real operation, it's time to decode it
    let pragmaCount = 0;
    disassemblyItem.instruction = pattern;
    disassemblyItem.tstates = tstates;
    disassemblyItem.tstates2 = tstates2;
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
   * Processes pragma informations within an operation map
   * @param disassemblyItem Disassembly item to process
   * @param pragmaIndex Index of the pragma within the instruction string
   */
  private processPragma(disassemblyItem: DisassemblyItem, pragmaIndex: number): void {
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
        var distance = this.fetch();
        var labelAddr = (this._addressOffset + this._opOffset + 2 + toSbyte(distance)) & 0xffff;
        this._output.createLabel(labelAddr, this._opOffset);
        replacement = `${this.options?.noLabelPrefix ?? false ? "$" : "L"}${this._decimalMode ? toDecimal5(labelAddr) : intToX4(labelAddr)}`;
        symbolPresent = true;
        disassemblyItem.hasLabelSymbol = true;
        symbolValue = labelAddr;
        break;
      case "R":
        const rstAddr = this._opCode - 0xc7;
        replacement = this._decimalMode ? rstAddr.toString(10) : `$${intToX2(rstAddr)}`;
        break;
      case "L":
        // --- #L: absolute label (16 bit address)
        var target = this.fetchWord();
        this._output.createLabel(target, this._opOffset);
        replacement = `${this.options?.noLabelPrefix ?? false ? "$" : "L"}${this._decimalMode ? toDecimal5(target) : intToX4(target)}`;
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
        var value = this.fetch();
        replacement = this._decimalMode ? value.toString(10) : `$${intToX2(value)}`;
        symbolPresent = true;
        symbolValue = value;
        break;
      case "N":
        // --- #N: 8-bit Next Register index from the code
        var value = this.fetch();
        replacement = this._decimalMode ? value.toString(10) : `$${intToX2(value)}`;
        const regInfo = this._nextRegInfo.find((n) => n?.id === value);
        if (regInfo) {
          disassemblyItem.hardComment = regInfo.description;
        }
        break;
      case "W":
        // --- #W: 16-bit word from the code
        var word = this.fetchWord();
        replacement = this._decimalMode ? word.toString(10) : `$${intToX4(word)}`;
        symbolPresent = true;
        symbolValue = word;
        break;
      case "w":
        // --- #W: 16-bit word from the code, big endian
        var word = (this.fetch() << 8) | this.fetch();
        replacement = this._decimalMode ? word.toString(10) : `$${intToX4(word)}`;
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
              ? this._decimalMode
                ? `-${0x100 - this._displacement}`
                : `-$${intToX2(0x100 - this._displacement)}`
              : this._decimalMode
                ? `+${this._displacement}`
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
 * 8-bit register pairs for the ^s pragma
 */
const q8Regs: string[] = ["b", "c", "d", "e", "h", "l", "(hl)", "a"];

/**
 * Disassembly stumps for standard instructions
 */
const standardInstructions: string[] = [
  /* 0x00 */ "nop",
  /* 0x01 */ "ld bc,^W|10",
  /* 0x02 */ "ld (bc),a|7",
  /* 0x03 */ "inc bc|6",
  /* 0x04 */ "inc b",
  /* 0x05 */ "dec b",
  /* 0x06 */ "ld b,^B|7",
  /* 0x07 */ "rlca",
  /* 0x08 */ "ex af,af'",
  /* 0x09 */ "add hl,bc|11",
  /* 0x0a */ "ld a,(bc)|7",
  /* 0x0b */ "dec bc|6",
  /* 0x0c */ "inc c",
  /* 0x0d */ "dec c",
  /* 0x0e */ "ld c,^B|7",
  /* 0x0f */ "rrca",

  /* 0x10 */ "djnz ^r|13/8",
  /* 0x11 */ "ld de,^W|10",
  /* 0x12 */ "ld (de),a|7",
  /* 0x13 */ "inc de|6",
  /* 0x14 */ "inc d",
  /* 0x15 */ "dec d",
  /* 0x16 */ "ld d,^B|7",
  /* 0x17 */ "rla",
  /* 0x18 */ "jr ^r|12",
  /* 0x19 */ "add hl,de|11",
  /* 0x1a */ "ld a,(de)|7",
  /* 0x1b */ "dec de|6",
  /* 0x1c */ "inc e",
  /* 0x1d */ "dec e",
  /* 0x1e */ "ld e,^B|7",
  /* 0x1f */ "rra",

  /* 0x20 */ "jr nz,^r|12/7",
  /* 0x21 */ "ld hl,^W|10",
  /* 0x22 */ "ld (^W),hl|16",
  /* 0x23 */ "inc hl|6",
  /* 0x24 */ "inc h",
  /* 0x25 */ "dec h",
  /* 0x26 */ "ld h,^B|7",
  /* 0x27 */ "daa",
  /* 0x28 */ "jr z,^r|12/7",
  /* 0x29 */ "add hl,hl|11",
  /* 0x2a */ "ld hl,(^W)|16",
  /* 0x1b */ "dec hl|6",
  /* 0x1c */ "inc l",
  /* 0x1d */ "dec l",
  /* 0x2e */ "ld l,^B|7",
  /* 0x2f */ "cpl",

  /* 0x30 */ "jr nc,^r|12/7",
  /* 0x31 */ "ld sp,^W|10",
  /* 0x32 */ "ld (^W),a|13",
  /* 0x33 */ "inc sp|6",
  /* 0x34 */ "inc (hl)|11",
  /* 0x35 */ "dec (hl)|11",
  /* 0x36 */ "ld (hl),^B|10",
  /* 0x37 */ "scf",
  /* 0x38 */ "jr c,^r|12/7",
  /* 0x39 */ "add hl,sp|11",
  /* 0x3a */ "ld a,(^W)|13",
  /* 0x3b */ "dec sp|6",
  /* 0x3c */ "inc a",
  /* 0x3d */ "dec a",
  /* 0x3e */ "ld a,^B|7",
  /* 0x3f */ "ccf",

  /* 0x40 */ "ld b,b",
  /* 0x41 */ "ld b,c",
  /* 0x42 */ "ld b,d",
  /* 0x43 */ "ld b,e",
  /* 0x44 */ "ld b,h",
  /* 0x45 */ "ld b,l",
  /* 0x46 */ "ld b,(hl)|7",
  /* 0x47 */ "ld b,a",
  /* 0x48 */ "ld c,b",
  /* 0x49 */ "ld c,c",
  /* 0x4a */ "ld c,d",
  /* 0x4b */ "ld c,e",
  /* 0x4c */ "ld c,h",
  /* 0x4d */ "ld c,l",
  /* 0x4e */ "ld c,(hl)|7",
  /* 0x4f */ "ld c,a",

  /* 0x50 */ "ld d,b",
  /* 0x51 */ "ld d,c",
  /* 0x52 */ "ld d,d",
  /* 0x53 */ "ld d,e",
  /* 0x54 */ "ld d,h",
  /* 0x55 */ "ld d,l",
  /* 0x56 */ "ld d,(hl)|7",
  /* 0x57 */ "ld d,a",
  /* 0x58 */ "ld e,b",
  /* 0x59 */ "ld e,c",
  /* 0x5a */ "ld e,d",
  /* 0x5b */ "ld e,e",
  /* 0x5c */ "ld e,h",
  /* 0x5d */ "ld e,l",
  /* 0x5e */ "ld e,(hl)|7",
  /* 0x5f */ "ld e,a",

  /* 0x60 */ "ld h,b",
  /* 0x61 */ "ld h,c",
  /* 0x62 */ "ld h,d",
  /* 0x63 */ "ld h,e",
  /* 0x64 */ "ld h,h",
  /* 0x65 */ "ld h,l",
  /* 0x66 */ "ld h,(hl)|7",
  /* 0x67 */ "ld h,a",
  /* 0x68 */ "ld l,b",
  /* 0x69 */ "ld l,c",
  /* 0x6a */ "ld l,d",
  /* 0x6b */ "ld l,e",
  /* 0x6c */ "ld l,h",
  /* 0x6d */ "ld l,l",
  /* 0x6e */ "ld l,(hl)|7",
  /* 0x6f */ "ld l,a",

  /* 0x70 */ "ld (hl),b|7",
  /* 0x71 */ "ld (hl),c|7",
  /* 0x72 */ "ld (hl),d|7",
  /* 0x73 */ "ld (hl),e|7",
  /* 0x74 */ "ld (hl),h|7",
  /* 0x75 */ "ld (hl),l|7",
  /* 0x76 */ "halt",
  /* 0x77 */ "ld (hl),a|7",
  /* 0x78 */ "ld a,b",
  /* 0x79 */ "ld a,c",
  /* 0x7a */ "ld a,d",
  /* 0x7b */ "ld a,e",
  /* 0x7c */ "ld a,h",
  /* 0x7d */ "ld a,l",
  /* 0x7e */ "ld a,(hl)|7",
  /* 0x7f */ "ld a,a",

  /* 0x80 */ "add a,b",
  /* 0x81 */ "add a,c",
  /* 0x82 */ "add a,d",
  /* 0x83 */ "add a,e",
  /* 0x84 */ "add a,h",
  /* 0x85 */ "add a,l",
  /* 0x86 */ "add a,(hl)|7",
  /* 0x87 */ "add a,a",
  /* 0x88 */ "adc a,b",
  /* 0x89 */ "adc a,c",
  /* 0x8a */ "adc a,d",
  /* 0x8b */ "adc a,e",
  /* 0x8c */ "adc a,h",
  /* 0x8d */ "adc a,l",
  /* 0x8e */ "adc a,(hl)|7",
  /* 0x8f */ "adc a,a",

  /* 0x90 */ "sub b",
  /* 0x91 */ "sub c",
  /* 0x92 */ "sub d",
  /* 0x93 */ "sub e",
  /* 0x94 */ "sub h",
  /* 0x95 */ "sub l",
  /* 0x96 */ "sub (hl)|7",
  /* 0x97 */ "sub a",
  /* 0x98 */ "sbc a,b",
  /* 0x99 */ "sbc a,c",
  /* 0x9a */ "sbc a,d",
  /* 0x9b */ "sbc a,e",
  /* 0x9c */ "sbc a,h",
  /* 0x9d */ "sbc a,l",
  /* 0x9e */ "sbc a,(hl)|7",
  /* 0x9f */ "sbc a,a",

  /* 0xa0 */ "and b",
  /* 0xa1 */ "and c",
  /* 0xa2 */ "and d",
  /* 0xa3 */ "and e",
  /* 0xa4 */ "and h",
  /* 0xa5 */ "and l",
  /* 0xa6 */ "and (hl)|7",
  /* 0xa7 */ "and a",
  /* 0xa8 */ "xor b",
  /* 0xa9 */ "xor c",
  /* 0xaa */ "xor d",
  /* 0xab */ "xor e",
  /* 0xac */ "xor h",
  /* 0xad */ "xor l",
  /* 0xae */ "xor (hl)|7",
  /* 0xaf */ "xor a",

  /* 0xb0 */ "or b",
  /* 0xb1 */ "or c",
  /* 0xb2 */ "or d",
  /* 0xb3 */ "or e",
  /* 0xb4 */ "or h",
  /* 0xb5 */ "or l",
  /* 0xb6 */ "or (hl)|7",
  /* 0xb7 */ "or a",
  /* 0xb8 */ "cp b",
  /* 0xb9 */ "cp c",
  /* 0xba */ "cp d",
  /* 0xbb */ "cp e",
  /* 0xbc */ "cp h",
  /* 0xbd */ "cp l",
  /* 0xbe */ "cp (hl)|7",
  /* 0xbf */ "cp a",

  /* 0xc0 */ "ret nz|11/5",
  /* 0xc1 */ "pop bc|10",
  /* 0xc2 */ "jp nz,^L|10",
  /* 0xc3 */ "jp ^L|10",
  /* 0xc4 */ "call nz,^L|17/10",
  /* 0xc5 */ "push bc|11",
  /* 0xc6 */ "add a,^B|7",
  /* 0xc7 */ "rst ^R|11",
  /* 0xc8 */ "ret z|11/5",
  /* 0xc9 */ "ret|10",
  /* 0xca */ "jp z,^L|10",
  /* 0xcb */ "",
  /* 0xcc */ "call z,^L|17/10",
  /* 0xcd */ "call ^L|17",
  /* 0xce */ "adc a,^B|7",
  /* 0xcf */ "rst ^R|11",

  /* 0xd0 */ "ret nc|11/5",
  /* 0xd1 */ "pop de|10",
  /* 0xd2 */ "jp nc,^L|10",
  /* 0xd3 */ "out (^B),a|11",
  /* 0xd4 */ "call nc,^L|17/10",
  /* 0xd5 */ "push de|11",
  /* 0xd6 */ "sub ^B|7",
  /* 0xd7 */ "rst ^R|11",
  /* 0xd8 */ "ret c|11/5",
  /* 0xd9 */ "exx",
  /* 0xda */ "jp c,^L|10",
  /* 0xdb */ "in a,(^B)|11",
  /* 0xdc */ "call c,^L|17/10",
  /* 0xdd */ "",
  /* 0xde */ "sbc a,^B|7",
  /* 0xdf */ "rst ^R|11",

  /* 0xe0 */ "ret po|11/5",
  /* 0xe1 */ "pop hl|10",
  /* 0xe2 */ "jp po,^L|10",
  /* 0xe3 */ "ex (sp),hl|19",
  /* 0xe4 */ "call po,^L|17/10",
  /* 0xe5 */ "push hl|11",
  /* 0xe6 */ "and ^B|7",
  /* 0xe7 */ "rst ^R|11",
  /* 0xe8 */ "ret pe|11/5",
  /* 0xe9 */ "jp (hl)",
  /* 0xea */ "jp pe,^L|10",
  /* 0xeb */ "ex de,hl",
  /* 0xec */ "call pe,^L|17/10",
  /* 0xed */ "",
  /* 0xee */ "xor ^B|7",
  /* 0xef */ "rst ^R|11",

  /* 0xf0 */ "ret p|11/5",
  /* 0xf1 */ "pop af|10",
  /* 0xf2 */ "jp p,^L|10",
  /* 0xf3 */ "di",
  /* 0xf4 */ "call p,^L|17/10",
  /* 0xf5 */ "push af|11",
  /* 0xf6 */ "or ^B|7",
  /* 0xf7 */ "rst ^R|11",
  /* 0xf8 */ "ret m|11/5",
  /* 0xf9 */ "ld sp,hl|6",
  /* 0xfa */ "jp m,^L|10",
  /* 0xfb */ "ei",
  /* 0xfc */ "call m,^L|17/10",
  /* 0xfd */ "",
  /* 0xfe */ "cp ^B|7",
  /* 0xff */ "rst ^R|11"
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
  0x27: "test ^B|11",
  0x28: "bsla de,b",
  0x29: "bsra de,b",
  0x2a: "bsrl de,b",
  0x2b: "bsrf de,b",
  0x2c: "brlc de,b",
  0x30: "mul d,e",
  0x31: "add hl,a",
  0x32: "add de,a",
  0x33: "add bc,a",
  0x34: "add hl,^W|16",
  0x35: "add de,^W|16",
  0x36: "add bc,^W|16",
  0x40: "in b,(c)|12",
  0x41: "out (c),b|12",
  0x42: "sbc hl,bc|15",
  0x43: "ld (^W),bc|20",
  0x44: "neg",
  0x45: "retn|14",
  0x46: "im 0",
  0x47: "ld i,a|9",
  0x48: "in c,(c)|12",
  0x49: "out (c),c|12",
  0x4a: "adc hl,bc|15",
  0x4b: "ld bc,(^W)|20",
  0x4c: "neg",
  0x4d: "reti|14",
  0x4e: "im 0",
  0x4f: "ld r,a|9",
  0x50: "in d,(c)|12",
  0x51: "out (c),d|12",
  0x52: "sbc hl,de|15",
  0x53: "ld (^W),de|20",
  0x54: "neg",
  0x55: "retn|14",
  0x56: "im 1",
  0x57: "ld a,i|9",
  0x58: "in e,(c)|12",
  0x59: "out (c),e|12",
  0x5a: "adc hl,de|15",
  0x5b: "ld de,(^W)|20",
  0x5c: "neg",
  0x5d: "retn|14",
  0x5e: "im 2",
  0x5f: "ld a,r|9",
  0x60: "in h,(c)|12",
  0x61: "out (c),h|12",
  0x62: "sbc hl,hl|15",
  0x63: "ld (^W),hl|20",
  0x64: "neg",
  0x65: "retn|14",
  0x66: "im 0",
  0x67: "rrd|18",
  0x68: "in l,(c)|12",
  0x69: "out (c),l|12",
  0x6a: "adc hl,hl|15",
  0x6b: "ld hl,(^W)|20",
  0x6c: "neg",
  0x6d: "retn|14",
  0x6e: "im 0",
  0x6f: "rld|18",
  0x70: "in (c)|12",
  0x71: "out (c),0|12",
  0x72: "sbc hl,sp|15",
  0x73: "ld (^W),sp|20",
  0x74: "neg",
  0x75: "retn|14",
  0x76: "im 1",
  0x78: "in a,(c)|12",
  0x79: "out (c),a|12",
  0x7a: "adc hl,sp|15",
  0x7b: "ld sp,(^W)|20",
  0x7c: "neg",
  0x7d: "retn|14",
  0x7e: "im 2",
  0x8a: "push ^w|23", // BIG ENDIAN!
  0x90: "outinb|16",
  0x91: "nextreg ^N,^B|20",
  0x92: "nextreg ^N,a|17",
  0x93: "pixeldn",
  0x94: "pixelad",
  0x95: "setae",
  0x98: "jp (c)|13",
  0xa0: "ldi|16",
  0xa1: "cpi|16",
  0xa2: "ini|16",
  0xa3: "outi|16",
  0xa4: "ldix|16",
  0xa5: "ldws|14",
  0xa8: "ldd|16",
  0xa9: "cpd|16",
  0xaa: "ind|16",
  0xab: "outd|16",
  0xac: "lddx|16",
  0xb0: "ldir|21/16",
  0xb1: "cpir|21/16",
  0xb2: "inir|21/16",
  0xb3: "otir|21/16",
  0xb4: "ldirx|21/16",
  0xb7: "ldpirx|21/16",
  0xb8: "lddr|21/16",
  0xb9: "cpdr|21/16",
  0xba: "indr|21/16",
  0xbb: "otdr|21/16",
  0xbc: "lddrx|21/16"
};

const indexedInstructions: { [key: number]: string } = {
  0x09: "add ^X,bc|15",
  0x19: "add ^X,de|15",
  0x21: "ld ^X,^W|14",
  0x22: "ld (^W),^X|20",
  0x23: "inc ^X|10",
  0x24: "inc ^h",
  0x25: "dec ^h",
  0x26: "ld ^h,^B|11",
  0x29: "add ^X,^X|15",
  0x2a: "ld ^X,(^W)|20",
  0x2b: "dec ^X|10",
  0x2c: "inc ^l",
  0x2d: "dec ^l",
  0x2e: "ld ^l,^B|11",
  0x34: "inc (^X^D)|23",
  0x35: "dec (^X^D)|23",
  0x36: "ld (^X^D),^B|19",
  0x39: "add ^X,sp|15",
  0x44: "ld b,^h",
  0x45: "ld b,^l",
  0x46: "ld b,(^X^D)|19",
  0x4c: "ld c,^h",
  0x4d: "ld c,^l",
  0x4e: "ld c,(^X^D)|19",
  0x54: "ld d,^h",
  0x55: "ld d,^l",
  0x56: "ld d,(^X^D)|19",
  0x5c: "ld e,^h",
  0x5d: "ld e,^l",
  0x5e: "ld e,(^X^D)|19",
  0x60: "ld ^h,b",
  0x61: "ld ^h,c",
  0x62: "ld ^h,d",
  0x63: "ld ^h,e",
  0x64: "ld ^h,^h",
  0x65: "ld ^h,^l",
  0x66: "ld h,(^X^D)|19",
  0x67: "ld ^h,a",
  0x68: "ld ^l,b",
  0x69: "ld ^l,c",
  0x6a: "ld ^l,d",
  0x6b: "ld ^l,e",
  0x6c: "ld ^l,^h",
  0x6d: "ld ^l,^l",
  0x6e: "ld l,(^X^D)|19",
  0x6f: "ld ^l,a",
  0x70: "ld (^X^D),b|19",
  0x71: "ld (^X^D),c|19",
  0x72: "ld (^X^D),d|19",
  0x73: "ld (^X^D),e|19",
  0x74: "ld (^X^D),h|19",
  0x75: "ld (^X^D),l|19",
  0x77: "ld (^X^D),a|19",
  0x7c: "ld a,^h",
  0x7d: "ld a,^l",
  0x7e: "ld a,(^X^D)|19",
  0x84: "add a,^h",
  0x85: "add a,^l",
  0x86: "add a,(^X^D)|19",
  0x8c: "adc a,^h",
  0x8d: "adc a,^l",
  0x8e: "adc a,(^X^D)|19",
  0x94: "sub ^h",
  0x95: "sub ^l",
  0x96: "sub (^X^D)|19",
  0x9c: "sbc a,^h",
  0x9d: "sbc a,^l",
  0x9e: "sbc a,(^X^D)|19",
  0xa4: "and ^h",
  0xa5: "and ^l",
  0xa6: "and (^X^D)|19",
  0xac: "xor ^h",
  0xad: "xor ^l",
  0xae: "xor (^X^D)|19",
  0xb4: "or ^h",
  0xb5: "or ^l",
  0xb6: "or (^X^D)|19",
  0xbc: "cp ^h",
  0xbd: "cp ^l",
  0xbe: "cp (^X^D)|19",
  0xe1: "pop ^X|14",
  0xe3: "ex (sp),^X|23",
  0xe5: "push ^X|15",
  0xe9: "jp (^X)",
  0xf9: "ld sp,^X|10"
};
