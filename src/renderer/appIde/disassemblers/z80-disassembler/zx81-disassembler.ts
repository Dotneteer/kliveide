import { DisassemblyItem, FetchResult, MemorySection } from "../common-types";
import { intToX2, intToX4, toSbyte } from "../utils";
import { CUSTOM_Z80_DISASSEMBLY_TOOL, ICustomDisassembler, IDisassemblyApi } from "./custom-disassembly";
import { FloatNumber } from "./zx-spectrum-48-disassembler";

/**
 * The ZX81 ROM's calculator literals (the ROM's 'table of addresses' at $1923). The numbering differs
 * from the Spectrum's: the ZX81 has no `in`, `read-in`, `val$`, `usr-$` or `re-stack`.
 */
const zx81CalcOps: Record<number, string> = {
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
  0x0a: "no-gr-eql",
  0x0b: "nos-neql",
  0x0c: "no-grtr",
  0x0d: "no-less",
  0x0e: "nos-eql",
  0x0f: "addition",
  0x10: "str-&-no",
  0x11: "str-l-eql",
  0x12: "str-gr-eql",
  0x13: "strs-neql",
  0x14: "str-grtr",
  0x15: "str-less",
  0x16: "strs-eql",
  0x17: "strs-add",
  0x18: "neg",
  0x19: "code",
  0x1a: "val",
  0x1b: "len",
  0x1c: "sin",
  0x1d: "cos",
  0x1e: "tan",
  0x1f: "asn",
  0x20: "acs",
  0x21: "atn",
  0x22: "ln",
  0x23: "exp",
  0x24: "int",
  0x25: "sqr",
  0x26: "sgn",
  0x27: "abs",
  0x28: "peek",
  0x29: "usr-no",
  0x2a: "str$",
  0x2b: "chrs",
  0x2c: "not",
  0x2d: "duplicate",
  0x2e: "n-mod-m",
  0x2f: "jump",
  0x30: "stk-data",
  0x31: "dec-jr-nz",
  0x32: "less-0",
  0x33: "greater-0",
  0x34: "end-calc",
  0x35: "get-argt",
  0x36: "truncate",
  0x37: "fp-calc-2",
  0x38: "e-to-fp"
};

const STK_CONSTS = ["stk-zero", "stk-one", "stk-half", "stk-pi/2", "stk-ten"];

/** The ZX81 ROM's error codes after RST $08 (the report is the code + 1, shown as a letter/digit) */
const ZX81_REPORT_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Custom disassembler for the ZX81 (`.plans/ZX8081_WASM_PLAN.md` §11): `RST $08` is followed by an
 * error-code byte, and `RST $28` enters the calculator, whose literals run until `end-calc` ($34).
 */
export class Zx81CustomDisassembler implements ICustomDisassembler {
  private _api: IDisassemblyApi;
  private _inRst08Mode = false;
  private _inRst28Mode = false;
  private _seriesCount = 0;

  readonly toolId = CUSTOM_Z80_DISASSEMBLY_TOOL;

  setDisassemblyApi(api: IDisassemblyApi): void {
    this._api = api;
  }

  startSectionDisassembly(_section: MemorySection): void {
    this._inRst08Mode = false;
    this._inRst28Mode = false;
    this._seriesCount = 0;
  }

  private hex2(value: number): string {
    return this._api.decimalMode ? value.toString(10) : `$${intToX2(value)}`;
  }

  beforeInstruction(fetchResult: FetchResult): boolean {
    if (this._inRst08Mode) {
      const address = fetchResult.offset;
      const errorCode = this._api.fetch().opcode;
      this._inRst08Mode = false;
      const report = ZX81_REPORT_CHARS[(errorCode + 1) & 0xff] ?? "?";
      this._api.addDisassemblyItem({
        address,
        instruction: `.defb ${this.hex2(errorCode)}`,
        hardComment: `(report ${report})`
      });
      return true;
    }
    if (this._inRst28Mode) {
      const address = fetchResult.offset;
      const calcCode = this._api.fetch().opcode;
      this.disassembleCalculatorEntry(address, calcCode);
      return true;
    }
    return false;
  }

  afterInstruction(item: DisassemblyItem): void {
    if (item.opCodes?.[0] === 0xcf) {
      this._inRst08Mode = true;
      item.hardComment = "(Report error)";
      return;
    }
    if (item.opCodes?.[0] === 0xef) {
      this._inRst28Mode = true;
      this._seriesCount = 0;
      item.hardComment = "(Invoke Calculator)";
    }
  }

  private disassembleCalculatorEntry(address: number, calcCode: number): void {
    const item: DisassemblyItem = { address, instruction: `.defb ${this.hex2(calcCode)}` };
    const opCodes: number[] = [calcCode];

    // --- A number in the compact form (stk-data, and the constants of a series)
    if (this._seriesCount > 0) {
      let length = (calcCode >> 6) + 1;
      if ((calcCode & 0x3f) === 0) length++;
      for (let i = 0; i < length; i++) opCodes.push(this._api.fetch().opcode);
      item.instruction = ".defb " + opCodes.map((b) => this.hex2(b)).join(", ");
      item.hardComment = `(${FloatNumber.FromCompactBytes(opCodes).toFixed(6)})`;
      this._seriesCount--;
      this._api.addDisassemblyItem(item);
      return;
    }

    switch (calcCode) {
      case 0x00:
      case 0x2f:
      case 0x31: {
        const fetchValue = this._api.fetch();
        const jump = fetchValue.opcode;
        opCodes.push(jump);
        // --- Relative to the offset byte itself (`fetch` leaves `offset` past it), as on the Spectrum
        const jumpAddr = (fetchValue.offset - 1 + toSbyte(jump)) & 0xffff;
        this._api.createLabel(jumpAddr);
        item.instruction = `.defb ${this.hex2(calcCode)}, ${this.hex2(jump)}`;
        item.hardComment = `(${zx81CalcOps[calcCode]}: L${this._api.decimalMode ? jumpAddr : intToX4(jumpAddr)})`;
        break;
      }
      case 0x30:
        this._seriesCount = 1;
        item.hardComment = "(stk-data)";
        break;
      case 0x34:
        item.hardComment = "(end-calc)";
        this._inRst28Mode = false;
        break;
      default:
        if (calcCode >= 0x80 && calcCode <= 0x9f) {
          this._seriesCount = calcCode - 0x80;
          item.hardComment = `(series-${intToX2(calcCode - 0x80)})`;
        } else if (calcCode >= 0xa0 && calcCode <= 0xbf) {
          item.hardComment = `(${STK_CONSTS[calcCode - 0xa0] ?? `stk-const-${intToX2(calcCode - 0xa0)}`})`;
        } else if (calcCode >= 0xc0 && calcCode <= 0xdf) {
          item.hardComment = `(st-mem-${calcCode - 0xc0})`;
        } else if (calcCode >= 0xe0) {
          item.hardComment = `(get-mem-${calcCode - 0xe0})`;
        } else {
          item.hardComment = `(${zx81CalcOps[calcCode] ?? `calc code: ${this.hex2(calcCode)}`})`;
        }
        break;
    }
    this._api.addDisassemblyItem(item);
  }
}
