import {
  CUSTOM_Z80_DISASSEMBLY_TOOL,
  ICustomDisassembler,
  IDisassemblyApi
} from "./custom-disassembly";
import {
  DisassemblyItem,
  FetchResult,
  intToX2,
  intToX4,
  MemorySection,
  toSbyte
} from "./disassembly-helper";

/**
 * Custom disassembler for the ZX Spectrum 48 model
 */
export class ZxSpectrum48CustomDisassembler implements ICustomDisassembler {
  private _api: IDisassemblyApi;
  private _inRst08Mode = false;
  private _inRst28Mode = false;
  private _seriesCount = 0;

  readonly toolId = CUSTOM_Z80_DISASSEMBLY_TOOL;

  /**
   * Klive passes the disassembly API to the custom disassembler
   * @param api API to use for disassembly
   * @param machine The virtual machine instance
   */
  setDisassemblyApi (api: IDisassemblyApi): void {
    this._api = api;
  }

  /**
   * The disassembler starts disassembling a memory section
   * @param section
   */
  startSectionDisassembly (section: MemorySection): void {
    // --- No ZX Spectrum 48 specific code to disassemle
    this._inRst08Mode = false;
    this._inRst28Mode = false;
    this._seriesCount = 0;
  }

  /**
   * The disassembler is about to disassemble the subsequent instruction. The custom disassembler
   * can sign up to take the job.
   * @param peekResult The result of a peek(0) operation
   * @returns True, if the custom disassembler wants to disassemble the next instruction(s);
   * otherwise, false
   */
  beforeInstruction (fecthResult: FetchResult): boolean {
    // --- Handle RST #08 byte code
    if (this._inRst08Mode) {
      const address = fecthResult.offset;
      const errorCode = this._api.fetch().opcode;
      this._inRst08Mode = false;
      this._api.addDisassemblyItem({
        address,
        instruction: `.defb $${intToX2(errorCode)}`,
        hardComment: `(error code: $${intToX2(errorCode)})`
      });
      return true;
    }

    // --- Handle RST #28 byte codes
    if (this._inRst28Mode) {
      const address = fecthResult.offset;
      const calcCode = this._api.fetch().opcode;
      this.disassembleCalculatorEntry(address, calcCode);
      return true;
    }

    // --- No custom disassembly
    return false;
  }

  /**
   * The disassembler decoded the subsequent instruction. The custom disassembler can change the
   * details of the disassembled item, or update its internal state accordingly
   * @param item Disassembled item
   */
  afterInstruction (item: DisassemblyItem): void {
    // --- Check for Spectrum 48K RST #08
    if (item.opCodes && item.opCodes.trim() === "CF") {
      this._inRst08Mode = true;
      item.hardComment = "(Report error)";
      return;
    }

    // --- Check for Spectrum 48K RST #28
    if (
      item.opCodes &&
      (item.opCodes.trim() === "EF" || // --- RST #28
        item.opCodes.trim() === "CD 5E 33" || // --- CALL 335E
        item.opCodes.trim() === "CD 62 33")
    ) {
      // --- CALL 3362
      this._inRst28Mode = true;
      this._seriesCount = 0;
      item.hardComment = "(Invoke Calculator)";
    }
  }

  /**
   * Disassemble a calculator entry
   * @param address Address of calculator entry
   * @param calcCode Calculator entry code
   */
  private disassembleCalculatorEntry (address: number, calcCode: number): void {
    // --- Create the default disassembly item
    const item: DisassemblyItem = {
      address,
      instruction: `.defb $${intToX2(calcCode)}`
    };
    const opCodes: number[] = [calcCode];

    // --- If we're in series mode, obtain the subsequent series value
    if (this._seriesCount > 0) {
      let lenght = (calcCode >> 6) + 1;
      if ((calcCode & 0x3f) === 0) {
        lenght++;
      }
      for (let i = 0; i < lenght; i++) {
        const nextByte = this._api.fetch().opcode;
        opCodes.push(nextByte);
      }
      let instruction = ".defb ";
      for (let i = 0; i < opCodes.length; i++) {
        if (i > 0) {
          instruction += ", ";
        }
        instruction += `$${intToX2(opCodes[i])}`;
      }
      item.instruction = instruction;
      item.hardComment = `(${FloatNumber.FromCompactBytes(opCodes).toFixed(
        6
      )})`;
      this._seriesCount--;
      this._api.addDisassemblyItem(item);
      return;
    }

    // --- Generate the output according the calculation op code
    switch (calcCode) {
      case 0x00:
      case 0x33:
      case 0x35:
        const fetchValue = this._api.fetch();
        const jump = fetchValue.opcode;
        opCodes.push(jump);
        const jumpAddr = (fetchValue.offset - 1 + toSbyte(jump)) & 0xffff;
        this._api.createLabel(jumpAddr);
        item.instruction = `.defb $${intToX2(calcCode)}, $${intToX2(jump)}`;
        item.hardComment = `(${calcOps[calcCode]}: L${intToX4(jumpAddr)})`;
        this._inRst28Mode = calcCode !== 0x33;
        break;

      case 0x34:
        this._seriesCount = 1;
        item.hardComment = "(stk-data)";
        break;

      case 0x38:
        item.hardComment = "(end-calc)";
        this._inRst28Mode = false;
        break;

      case 0x86:
      case 0x88:
      case 0x8c:
        this._seriesCount = calcCode - 0x80;
        item.hardComment = `(series-0${(calcCode - 0x80).toString(16)})`;
        break;

      case 0xa0:
      case 0xa1:
      case 0xa2:
      case 0xa3:
      case 0xa4:
        const constNo = calcCode - 0xa0;
        item.hardComment = this.getIndexedCalcOp(0x3f, constNo);
        break;

      case 0xc0:
      case 0xc1:
      case 0xc2:
      case 0xc3:
      case 0xc4:
      case 0xc5:
        const stNo = calcCode - 0xc0;
        item.hardComment = this.getIndexedCalcOp(0x40, stNo);
        break;

      case 0xe0:
      case 0xe1:
      case 0xe2:
      case 0xe3:
      case 0xe4:
      case 0xe5:
        const getNo = calcCode - 0xe0;
        item.hardComment = this.getIndexedCalcOp(0x41, getNo);
        break;

      default:
        const comment = calcOps[calcCode] ?? `calc code: $${intToX2(calcCode)}`;
        item.hardComment = `(${comment})`;
        break;
    }
    this._api.addDisassemblyItem(item);
  }

  /**
   * Gets the indexed operation
   * @param opCode operation code
   * @param index operation index
   */
  private getIndexedCalcOp (opCode: number, index: number): string {
    const ops = calcOps[opCode];
    if (ops) {
      const values = ops.split("|");
      if (index >= 0 && values.length > index) {
        return `(${values[index]})`;
      }
    }
    return `calc code: ${opCode}/${index}`;
  }
}

/**
 * RST 28 calculations
 */
const calcOps: { [key: number]: string } = {
  0x00: "jump-true",
  0x01: "exchange",
  0x02: "delete",
  0x03: "subtract",
  0x04: "multiply",
  0x05: "division",
  0x06: "to-power",
  0x07: "or",
  0x08: "no-&-no",
  0x09: "no-l-eql",
  0x0a: "no-gr-eq",
  0x0b: "nos-neql",
  0x0c: "no-grtr",
  0x0d: "no-less",
  0x0e: "nos-eql",
  0x0f: "addition",
  0x10: "str-&-no",
  0x11: "str-l-eql",
  0x12: "str-gr-eq",
  0x13: "strs-neql",
  0x14: "str-grtr",
  0x15: "str-less",
  0x16: "strs-eql",
  0x17: "strs-add",
  0x18: "val$",
  0x19: "usr-$",
  0x1a: "read-in",
  0x1b: "negate",
  0x1c: "code",
  0x1d: "val",
  0x1e: "len",
  0x1f: "sin",
  0x20: "cos",
  0x21: "tan",
  0x22: "asn",
  0x23: "acs",
  0x24: "atn",
  0x25: "ln",
  0x26: "exp",
  0x27: "int",
  0x28: "sqr",
  0x29: "sgn",
  0x2a: "abs",
  0x2b: "peek",
  0x2c: "in",
  0x2d: "usr-no",
  0x2e: "str$",
  0x2f: "chr$",
  0x30: "not",
  0x31: "duplicate",
  0x32: "n-mod-m",
  0x33: "jump",
  0x34: "stk-data",
  0x35: "dec-jr-nz",
  0x36: "less-0",
  0x37: "greater-0",
  0x38: "end-calc",
  0x39: "get-argt",
  0x3a: "truncate",
  0x3b: "fp-calc-2",
  0x3c: "e-to-fp",
  0x3d: "re-stack",
  0x3e: "series-06|series-08|series-0C",
  0x3f: "stk-zero|stk-one|stk-half|stk-pi-half|stk-ten",
  0x40: "st-mem-0|st-mem-1|st-mem-2|st-mem-3|st-mem-4|st-mem-5",
  0x41: "get-mem-0|get-mem-1|get-mem-2|get-mem-3|get-mem-4|get-mem-5"
};

/**
 * This class contains helpers that manage ZX Spectrum float numbers
 */
export class FloatNumber {
  /**
   * Convert bytes into a ZX Spectrum floating point number
   * @param bytes Bytes of the float number
   */
  static FromBytes (bytes: number[]): number {
    if (bytes.length !== 5) {
      throw new Error("A float number must be exactly 5 bytes");
    }

    if (bytes[0] === 0) {
      // --- Simple integer form
      const neg = bytes[1] === 0xff;
      return (bytes[2] + bytes[3] * 0x100) * (neg ? -1 : 1);
    }

    const sign = (bytes[1] & 0x80) === 0 ? 1 : -1;
    const mantUpper = (((bytes[1] & 0x7f) | 0x80) << 23) * 2;
    const mant = mantUpper + (bytes[2] << 16) + (bytes[3] << 8) + bytes[4];
    const exp = bytes[0] - 128 - 32;
    return sign * mant * Math.pow(2.0, exp);
  }

  /**
   * Convert compact bytes into a ZX Spectrum floating point number
   * @param bytes Bytes of the float number
   */
  static FromCompactBytes (bytes: number[]): number {
    let copyFrom = 1;
    let exp = bytes[0] & 0x3f;
    if (exp === 0) {
      exp = bytes[1];
      copyFrom = 2;
    }
    exp += 0x50;
    const newBytes = [0x00, 0x00, 0x00, 0x00, 0x00];
    newBytes[0] = exp;
    let idx = 1;
    for (let i = copyFrom; i < bytes.length; i++) {
      newBytes[idx++] = bytes[i];
    }
    return FloatNumber.FromBytes(newBytes);
  }
}
