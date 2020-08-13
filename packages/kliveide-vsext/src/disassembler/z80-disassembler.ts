import {
  SpectrumSpecificMode,
  OperationMap,
  extendedInstructions,
  bitInstructions,
  standardInstructions,
  indexedInstructions,
  indexedBitInstructions,
  q8Regs,
  q16Regs,
  r16Regs,
  calcOps,
} from "./instruction-tables";
import {
  DisassemblyItem,
  DisassemblyOutput,
  MemorySection,
  MemorySectionType,
  SpectrumSpecificDisassemblyFlags,
  processMessages,
  intToX2,
  intToX4,
  toSbyte,
  FloatNumber,
} from "./disassembly-helper";
import { CancellationToken } from "../utils/cancellation";

/**
 * Number of disassembler items to process in a batch before
 * allowing the event loop
 */
const DISASSEMBLER_BATCH = 100;

/**
 * Spectrum disassembly item
 */
interface ISpectrumDisassemblyItem {
  item?: DisassemblyItem;
  carryOn: boolean;
}

/**
 * This class implements the Z80 disassembler
 */
export class Z80Disassembler {
  private _output = new DisassemblyOutput();
  private _offset = 0;
  private _opOffset = 0;
  private _currentOpCodes = "";
  private _displacement: number | undefined;
  private _opCode = 0;
  private _indexMode = 0;
  private _overflow = false;
  private _spectMode = SpectrumSpecificMode.None;
  private _seriesCount = 0;
  private _lineCount = 0;

  private _cancellationToken: CancellationToken | null = null;

  /**
   * Gets the contents of the memory
   */
  readonly memoryContents: Uint8Array;

  /**
   * Memory sections used by the disassembler
   */
  readonly memorySections: MemorySection[];

  /**
   * The ZX Spectrum specific disassembly flags for each bank
   */
  readonly disassemblyFlags: Map<number, SpectrumSpecificDisassemblyFlags>;

  /**
   * Indicates if ZX Spectrum Next extended instruction disassembly is allowed
   */
  readonly extendedInstructionsAllowed: boolean;

  /**
   * Initializes a new instance of the disassembler
   * @param memorySections Memory map for disassembly
   * @param memoryContents The contents of the memory to disassemble
   * @param disasmFlags Optional flags to be used with the disassembly
   * @param extendedSet True, if NEXT operation disassembly is allowed; otherwise, false
   */
  constructor(
    memorySections: MemorySection[],
    memoryContents: Uint8Array,
    disasmFlags?: Map<number, SpectrumSpecificDisassemblyFlags>,
    extendedSet = false
  ) {
    this.memorySections = memorySections;
    this.memoryContents = memoryContents;
    this.disassemblyFlags = disasmFlags
      ? disasmFlags
      : new Map<number, SpectrumSpecificDisassemblyFlags>();
    this.extendedInstructionsAllowed = extendedSet;
  }

  /**
   * Disassembles the memory from the specified start address with the given endAddress
   * @param startAddress The start address of the disassembly
   * @param endAddress The end address of the disassembly
   * @returns The disassembly output, if finished; or null, if cancelled
   */
  async disassemble(
    startAddress = 0x0000,
    endAddress = 0xffff,
    cancellationToken?: CancellationToken
  ): Promise<DisassemblyOutput | null> {
    this._cancellationToken = cancellationToken ?? null;

    this._output = new DisassemblyOutput();
    if (endAddress > this.memoryContents.length) {
      endAddress = this.memoryContents.length - 1;
    }
    const refSection = new MemorySection(startAddress, endAddress);
    this._lineCount = 0;

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

        case MemorySectionType.Rst28Calculator:
          await this._generateRst28ByteCodeOutput(toDisassemble);
          break;
      }
      if (this._cancellationToken?.cancelled) {
        return null;
      }
    }
    return this._output;



  }

  /**
   * Allows the event loop to execute when a batch has ended
   */
  private async allowEventLoop(): Promise<void> {
    if (this._lineCount++ % DISASSEMBLER_BATCH === 0) {
      await processMessages();
    }
  }

  /**
   * Creates disassembler output for the specified section
   * @param section Section information
   */
  private async _disassembleSection(section: MemorySection): Promise<void> {
    this._offset = section.startAddress;
    this._overflow = false;
    const endOffset = section.endAddress;
    let isSpectrumSpecific = false;
    while (this._offset <= endOffset && !this._overflow) {
      
      await this.allowEventLoop();
      if (this._cancellationToken?.cancelled) {
        return;
      }
      
      if (isSpectrumSpecific) {
        const spectItem = this._disassembleSpectrumSpecificOperation();
        isSpectrumSpecific = spectItem.carryOn;
        if (spectItem && spectItem.item) {
          this._output.addItem(spectItem.item);
        }
      } else {
        // --- Disassemble the current item
        const item = this._disassembleOperation();
        if (item) {
          this._output.addItem(item);
          isSpectrumSpecific = this._shouldEnterSpectrumSpecificMode(item);
        }
      }
    }
    this._labelFixup();
  }

  /**
   * Generates byte array output for the specified section
   * @param section Section information
   */
  private async _generateByteArray(section: MemorySection): Promise<void> {
    const length = section.endAddress - section.startAddress + 1;
    for (let i = 0; i < length; i += 8) {
      let sb = ".defb ";
      for (let j = 0; j < 8; j++) {
        if (i + j >= length) {
          break;
        }
        if (j > 0) {
          sb += ", ";
        }
        sb += `#${intToX2(this.memoryContents[section.startAddress + i + j])}`;
      }

      await this.allowEventLoop();
      if (this._cancellationToken?.cancelled) {
        return;
      }

      const item = new DisassemblyItem((section.startAddress + i) & 0xffff);
      item.instruction = sb;
      this._output.addItem(item);
    }
  }

  /**
   * Generates word array output for the specified section
   * @param section Section information
   */
  private async _generateWordArray(section: MemorySection): Promise<void> {
    const length = section.endAddress - section.startAddress + 1;
    for (let i = 0; i < length; i += 8) {
      if (i + 1 >= length) {
        break;
      }
      let sb = ".defw ";
      for (let j = 0; j < 8; j += 2) {
        if (i + j + 1 >= length) {
          break;
        }
        if (j > 0) {
          sb += ", ";
        }
        const value =
          this.memoryContents[section.startAddress + i + j * 2] +
          (this.memoryContents[section.startAddress + i + j * 2 + 1] << 8);
        sb += `#${intToX4(value & 0xffff)}`;
      }
      
      await this.allowEventLoop();
      if (this._cancellationToken?.cancelled) {
        return;
      }
      
      const item = new DisassemblyItem((section.startAddress + i) & 0xffff);
      item.instruction = sb;
      this._output.addItem(item);
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
  private _generateSkipOutput(section: MemorySection): void {
    const item = new DisassemblyItem(section.startAddress);
    item.instruction = `.skip ${intToX4(
      section.endAddress - section.startAddress + 1
    )}H`;
    this._output.addItem(item);
  }

  /**
   * Disassembles a single instruction
   */
  private _disassembleOperation(): DisassemblyItem {
    this._opOffset = this._offset;
    this._currentOpCodes = "";
    this._displacement = undefined;
    this._indexMode = 0; // No index
    let decodeInfo: OperationMap | undefined;
    const address = this._offset & 0xffff;

    // --- We should generate a normal instruction disassembly
    this._opCode = this._fetch();
    if (this._opCode === 0xed) {
      this._opCode = this._fetch();
      decodeInfo = extendedInstructions.getInstruction(this._opCode);
      if (
        decodeInfo &&
        decodeInfo.extendedSet &&
        !this.extendedInstructionsAllowed
      ) {
        decodeInfo = undefined;
      }
    } else if (this._opCode === 0xcb) {
      this._opCode = this._fetch();
      decodeInfo = bitInstructions.getInstruction(this._opCode);
    } else if (this._opCode === 0xdd) {
      this._indexMode = 1; // IX
      this._opCode = this._fetch();
      decodeInfo = this._disassembleIndexedOperation();
    } else if (this._opCode === 0xfd) {
      this._indexMode = 2; // IY
      this._opCode = this._fetch();
      decodeInfo = this._disassembleIndexedOperation();
    } else {
      decodeInfo = standardInstructions.getInstruction(this._opCode);
    }
    return this._decodeInstruction(address, decodeInfo);
  }

  /**
   * Gets the operation map for an indexed operation
   */
  private _disassembleIndexedOperation(): OperationMap | undefined {
    if (this._opCode !== 0xcb) {
      let decodeInfo = indexedInstructions.getInstruction(this._opCode);
      if (!decodeInfo) {
        return standardInstructions.getInstruction(this._opCode);
      }
      if (
        decodeInfo.instructionPattern &&
        decodeInfo.instructionPattern.indexOf("^D") >= 0
      ) {
        // --- The instruction used displacement, get it
        this._displacement = this._fetch();
      }
      return decodeInfo;
    }
    this._displacement = this._fetch();
    this._opCode = this._fetch();
    return indexedBitInstructions.getInstruction(this._opCode);
  }

  /**
   * Fetches the next byte to disassemble
   */
  private _fetch(): number {
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
  private _fetchWord(): number {
    const l = this._fetch();
    const h = this._fetch();
    return ((h << 8) | l) & 0xffff;
  }

  /**
   * Decodes the specified instruction
   * @param address Instruction address
   * @param opInfo Operation inforamtion
   */
  private _decodeInstruction(
    address: number,
    opInfo: OperationMap | undefined
  ): DisassemblyItem {
    // --- By default, unknown codes are NOP operations
    var disassemblyItem = new DisassemblyItem(address);
    disassemblyItem.opCodes = this._currentOpCodes;
    disassemblyItem.instruction = "nop";
    disassemblyItem.lastAddress = (this._offset - 1) & 0xffff;
    if (!opInfo || !opInfo.instructionPattern) {
      return disassemblyItem;
    }

    // --- We have a real operation, it's time to decode it
    let pragmaCount = 0;
    disassemblyItem.instruction = opInfo.instructionPattern;
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
    disassemblyItem.lastAddress = (this._offset - 1) & 0xffff;
    return disassemblyItem;
  }

  /**
   * Processes pragma informations within an operation map
   * @param disassemblyItem Disassembly item to process
   * @param pragmaIndex Index of the pragma within the instruction string
   */
  private _processPragma(
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
      case "8":
        // --- #8: 8-bit value defined on bit 3, 4 and 5 ($00, $10, ..., $38)
        const val = this._opCode & 0x38;
        replacement = this._byteToString(val);
        break;
      case "b":
        // --- #b: bit index defined on bit 3, 4 and 5 in bit operations
        var bit = (this._opCode & 0x38) >> 3;
        replacement = bit.toString();
        break;
      case "r":
        // --- #r: relative label (8 bit offset)
        var distance = this._fetch();
        var labelAddr = (this._opOffset + 2 + toSbyte(distance)) & 0xffff;
        this._output.createLabel(labelAddr, this._opOffset);
        replacement = this._getLabelName(labelAddr);
        symbolPresent = true;
        disassemblyItem.hasLabelSymbol = true;
        symbolValue = labelAddr;
        break;
      case "L":
        // --- #L: absolute label (16 bit address)
        var target = this._fetchWord();
        disassemblyItem.targetAddress = target;
        this._output.createLabel(target, this._opOffset);
        replacement = this._getLabelName(target);
        symbolPresent = true;
        disassemblyItem.hasLabelSymbol = true;
        symbolValue = target;
        break;
      case "q":
        // --- #q: 8-bit registers named on bit 3, 4 and 5 (B, C, ..., (HL), A)
        var regqIndex = (this._opCode & 0x38) >> 3;
        replacement = q8Regs[regqIndex];
        break;
      case "s":
        // --- #q: 8-bit registers named on bit 0, 1 and 2 (B, C, ..., (HL), A)
        var regsIndex = this._opCode & 0x07;
        replacement = q8Regs[regsIndex];
        break;
      case "Q":
        // --- #Q: 16-bit register pair named on bit 4 and 5 (BC, DE, HL, SP)
        var regQIndex = (this._opCode & 0x30) >> 4;
        replacement = q16Regs[regQIndex];
        break;
      case "R":
        // --- #Q: 16-bit register pair named on bit 4 and 5 (BC, DE, HL, AF)
        var regRIndex = (this._opCode & 0x30) >> 4;
        replacement = r16Regs[regRIndex];
        break;
      case "B":
        // --- #B: 8-bit value from the code
        var value = this._fetch();
        replacement = this._byteToString(value);
        symbolPresent = true;
        symbolValue = value;
        break;
      case "W":
        // --- #W: 16-bit word from the code
        var word = this._fetchWord();
        replacement = this._wordToString(word);
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
              ? `-${this._byteToString(0x100 - this._displacement)}`
              : `+${this._byteToString(this._displacement)}`;
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
  private _labelFixup(): void {
    for (const label of this._output.labels) {
      const outputItem = this._output.get(label[0]);
      if (outputItem) {
        outputItem.hasLabel = true;
      }
    }
  }

  /**
   * Converts a byte value to a hexadecimal string
   * @param value Value to convert
   */
  private _byteToString(value: number): string {
    return `#${intToX2(value)}`;
  }

  /**
   * Converts a 16-bit value to a hexadecimal string
   * @param value Value to convert
   */
  private _wordToString(value: number): string {
    return `#${intToX4(value)}`;
  }

  /**
   * Gets a label by its address
   * @param addr Label address
   */
  private _getLabelName(addr: number): string {
    return `L${intToX4(addr)}`;
  }

  /**
   * Generates bytecode output for the specified memory section
   * @param section Section information
   */
  private async _generateRst28ByteCodeOutput(
    section: MemorySection
  ): Promise<void> {
    this._spectMode = SpectrumSpecificMode.Spectrum48Rst28;
    this._seriesCount = 0;
    let addr = (this._offset = section.startAddress);
    while (addr <= section.endAddress) {
      
      await this.allowEventLoop();
      if (this._cancellationToken?.cancelled) {
        return;
      }

      this._currentOpCodes = "";
      const opCode = this._fetch();
      const entry = this._disassembleCalculatorEntry(addr, opCode);
      if (entry.item) {
        this._output.addItem(entry.item);
      }
      addr = this._offset;
    }
  }

  /**
   * Disassemble a calculator entry
   * @param address Address of calculator entry
   * @param calcCode Calculator entry code
   */
  private _disassembleCalculatorEntry(
    address: number,
    calcCode: number
  ): ISpectrumDisassemblyItem {
    // --- Create the default disassembly item
    const result = {
      item: new DisassemblyItem(address),
      carryOn: false,
    };
    result.item.lastAddress = (this._offset - 1) & 0xffff;
    result.item.instruction = `.defb #${intToX2(calcCode)}`;
    const opCodes: number[] = [calcCode];
    result.carryOn = true;

    // --- If we're in series mode, obtain the subsequent series value
    if (this._seriesCount > 0) {
      let lenght = (calcCode >> 6) + 1;
      if ((calcCode & 0x3f) === 0) {
        lenght++;
      }
      for (let i = 0; i < lenght; i++) {
        const nextByte = this._fetch();
        opCodes.push(nextByte);
      }
      let instruction = ".defb ";
      for (let i = 0; i < opCodes.length; i++) {
        if (i > 0) {
          instruction += ", ";
        }
        instruction += `#${intToX2(opCodes[i])}`;
      }
      result.item.instruction = instruction;
      result.item.hardComment = `(${FloatNumber.FromCompactBytes(
        opCodes
      ).toFixed(6)})`;
      this._seriesCount--;
      return result;
    }

    // --- Generate the output according the calculation op code
    switch (calcCode) {
      case 0x00:
      case 0x33:
      case 0x35:
        const jump = this._fetch();
        opCodes.push(jump);
        const jumpAddr = (this._offset - 1 + toSbyte(jump)) & 0xffff;
        this._output.createLabel(jumpAddr);
        result.item.instruction = `.defb #${intToX2(calcCode)}, #${intToX2(
          jump
        )}`;
        result.item.hardComment = `(${calcOps.get(
          calcCode
        )}: ${this._getLabelName(jumpAddr)})`;
        result.carryOn = calcCode !== 0x33;
        break;

      case 0x34:
        this._seriesCount = 1;
        result.item.hardComment = "(stk-data)";
        break;

      case 0x38:
        result.item.hardComment = "(end-calc)";
        result.carryOn = false;
        break;

      case 0x86:
      case 0x88:
      case 0x8c:
        this._seriesCount = calcCode - 0x80;
        result.item.hardComment = `(series-0${(calcCode - 0x80).toString(16)})`;
        break;

      case 0xa0:
      case 0xa1:
      case 0xa2:
      case 0xa3:
      case 0xa4:
        const constNo = calcCode - 0xa0;
        result.item.hardComment = this._getIndexedCalcOp(0x3f, constNo);
        break;

      case 0xc0:
      case 0xc1:
      case 0xc2:
      case 0xc3:
      case 0xc4:
      case 0xc5:
        const stNo = calcCode - 0xc0;
        result.item.hardComment = this._getIndexedCalcOp(0x40, stNo);
        break;

      case 0xe0:
      case 0xe1:
      case 0xe2:
      case 0xe3:
      case 0xe4:
      case 0xe5:
        const getNo = calcCode - 0xe0;
        result.item.hardComment = this._getIndexedCalcOp(0x41, getNo);
        break;

      default:
        const comment = calcOps.has(calcCode)
          ? calcOps.get(calcCode)
          : `calc code: #${intToX2(calcCode)}`;
        result.item.hardComment = `(${comment})`;
        break;
    }
    return result;
  }

  /**
   * Gets the indexed operation
   * @param opCode operation code
   * @param index operation index
   */
  private _getIndexedCalcOp(opCode: number, index: number): string {
    if (calcOps.has(opCode)) {
      var ops = calcOps.get(opCode);
      if (ops) {
        const values = ops.split("|");
        if (index >= 0 && values.length > index) {
          return `(${values[index]})`;
        }
      }
    }
    return `calc code: ${opCode}/${index}`;
  }

  /**
   * Checks if the disassembler should enter into Spectrum-specific mode after
   * the specified disassembly item.
   * @param item Item used to check the Spectrum-specific mode
   * @returns True, to move to the Spectrum-specific mode; otherwise, false
   */
  private _shouldEnterSpectrumSpecificMode(item: DisassemblyItem): boolean {
    // --- Check if we find flags for the bank of the disassembly item
    const bank = item.address >> 14;
    const flags = this.disassemblyFlags.get(bank);
    if (!flags || flags === SpectrumSpecificDisassemblyFlags.None) {
      return false;
    }

    // --- Check for Spectrum 48K RST #08
    if (
      (flags & SpectrumSpecificDisassemblyFlags.Spectrum48Rst08) !== 0 &&
      item.opCodes.trim() === "CF"
    ) {
      this._spectMode = SpectrumSpecificMode.Spectrum48Rst08;
      item.hardComment = "(Report error)";
      return true;
    }

    // --- Check for Spectrum 48K RST #28
    if (
      (flags & SpectrumSpecificDisassemblyFlags.Spectrum48Rst28) !== 0 &&
      (item.opCodes.trim() === "EF" || // --- RST #28
      item.opCodes.trim() === "CD 5E 33" || // --- CALL 335E
        item.opCodes.trim() === "CD 62 33")
    ) {
      // --- CALL 3362
      this._spectMode = SpectrumSpecificMode.Spectrum48Rst28;
      this._seriesCount = 0;
      item.hardComment = "(Invoke Calculator)";
      return true;
    }

    // --- Check for Spectrum 128K RST #28
    if (
      (flags & SpectrumSpecificDisassemblyFlags.Spectrum128Rst28) !== 0 &&
      item.opCodes.trim() === "EF"
    ) {
      this._spectMode = SpectrumSpecificMode.Spectrum128Rst8;
      item.hardComment = "(Call Spectrum 48 ROM)";
      return true;
    }

    return false;
  }

  /**
   * Disassembles the subsequent operation as Spectrum-specific operation
   */
  private _disassembleSpectrumSpecificOperation(): ISpectrumDisassemblyItem {
    if (this._spectMode === SpectrumSpecificMode.None) {
      return {
        item: undefined,
        carryOn: false,
      };
    }

    const result: ISpectrumDisassemblyItem = {
      carryOn: false,
    };

    // --- Handle Spectrum 48 RST #08
    if (this._spectMode === SpectrumSpecificMode.Spectrum48Rst08) {
      // --- The next byte is the operation code
      const address = this._offset;
      const errorCode = this._fetch();
      this._spectMode = SpectrumSpecificMode.None;
      result.item = new DisassemblyItem(address);
      result.item.instruction = `.defb #${intToX2(errorCode)}`;
      (result.item.hardComment = `(error code: #${intToX2(errorCode)})`),
        (result.item.lastAddress = (this._offset - 1) & 0xffff);
    }

    // --- Handle Spectrum 48 RST #28
    if (this._spectMode === SpectrumSpecificMode.Spectrum48Rst28) {
      const address = this._offset & 0xffff;
      const calcCode = this._fetch();
      const entry = this._disassembleCalculatorEntry(address, calcCode);
      result.item = entry.item;
    }

    // --- Handle Spectrum 128 RST #08
    if (this._spectMode === SpectrumSpecificMode.Spectrum128Rst8) {
      // --- The next byte is the operation code
      const address = this._offset & 0xffff;
      const callAddress = this._fetchWord();
      this._spectMode = SpectrumSpecificMode.None;
      result.item = new DisassemblyItem(address);
      (result.item.instruction = `.defw #${intToX4(callAddress)}`),
        (result.item.lastAddress = (this._offset - 1) & 0xffff);
    }

    if (!result.carryOn) {
      this._spectMode = SpectrumSpecificMode.None;
    }
    return result;
  }
}
