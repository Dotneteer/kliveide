import { DisassemblyItem, FetchResult, MemorySection } from "../common-types";
import { intToX2 } from "../utils";
import { CUSTOM_Z80_DISASSEMBLY_TOOL, ICustomDisassembler, IDisassemblyApi } from "./custom-disassembly";

/**
 * Custom disassembler for the ZX80's 4K ROM. Its one custom construct: the `RST $08` handler pops its
 * return address and reads the byte there (`POP HL` / `LD L,(HL)` at $0008), so the byte after every
 * `RST $08` is an error code, not an instruction. The report the ROM shows is the code + 1 (RUN_STOP,
 * $0492-$04A8: ERR_NR + 1; a run showed code 1 as report 2, code 5 as report 6).
 *
 * Unlike the ZX81's, there is no `RST $28` decoding: the ZX80 has no calculator, and its `RST $28`
 * evaluates an expression with ordinary code after it. A ZX80 fitted with the 8K ROM runs the ZX81's
 * ROM and takes `Zx81CustomDisassembler` instead (`machine-registry.ts`).
 */
export class Zx80CustomDisassembler implements ICustomDisassembler {
  private _api: IDisassemblyApi;
  private _inRst08Mode = false;

  readonly toolId = CUSTOM_Z80_DISASSEMBLY_TOOL;

  setDisassemblyApi(api: IDisassemblyApi): void {
    this._api = api;
  }

  startSectionDisassembly(_section: MemorySection): void {
    this._inRst08Mode = false;
  }

  beforeInstruction(fetchResult: FetchResult): boolean {
    if (!this._inRst08Mode) return false;
    this._inRst08Mode = false;
    const address = fetchResult.offset;
    const errorCode = this._api.fetch().opcode;
    this._api.addDisassemblyItem({
      address,
      instruction: `.defb ${this._api.decimalMode ? errorCode.toString(10) : `$${intToX2(errorCode)}`}`,
      hardComment: `(report ${errorCode + 1})`
    });
    return true;
  }

  afterInstruction(item: DisassemblyItem): void {
    if (item.opCodes?.[0] === 0xcf) {
      this._inRst08Mode = true;
      item.hardComment = "(Report error)";
    }
  }
}
