import { DisassemblyItem, FetchResult, MemorySection } from "../common-types";
import { intToX2 } from "../utils";
import { CUSTOM_Z80_DISASSEMBLY_TOOL, ICustomDisassembler, IDisassemblyApi } from "./custom-disassembly";

/*
 * The Videoton TVC's custom disassembler (`.plans/VIDEOTON_TVC_PLAN.md` §11). `RST 30h` is the
 * operating system's call: both BASIC ROMs vector it through RAM (0030h: JP 0B23h) to a handler that
 * starts `EX (SP),HL / LD A,(HL) / INC HL / EX (SP),HL`, so the byte after the RST is the function
 * code and execution goes on after it. That holds for every program, not only the ROM, so the decoding
 * is not gated on an address.
 */

const RST_30 = 0xf7;

export class TvcCustomDisassembler implements ICustomDisassembler {
  private _api: IDisassemblyApi;
  private _inSystemCall = false;

  readonly toolId = CUSTOM_Z80_DISASSEMBLY_TOOL;

  setDisassemblyApi(api: IDisassemblyApi): void {
    this._api = api;
  }

  startSectionDisassembly(_section: MemorySection): void {
    this._inSystemCall = false;
  }

  beforeInstruction(fetchResult: FetchResult): boolean {
    if (!this._inSystemCall) return false;
    this._inSystemCall = false;
    const code = this._api.fetch().opcode;
    this._api.addDisassemblyItem({
      address: fetchResult.offset,
      instruction: `.defb ${this._api.decimalMode ? code.toString(10) : `$${intToX2(code)}`}`,
      hardComment: "(system call function)"
    });
    return true;
  }

  afterInstruction(item: DisassemblyItem): void {
    if (item.opCodes?.length === 1 && item.opCodes[0] === RST_30) {
      this._inSystemCall = true;
      item.hardComment = "(System call)";
    }
  }
}
