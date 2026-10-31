import { DisassemblyItem, FetchResult, MemorySection } from "../common-types";
import { intToX2 } from "../utils";
import { CUSTOM_Z80_DISASSEMBLY_TOOL, ICustomDisassembler, IDisassemblyApi } from "./custom-disassembly";

/*
 * The Enterprise 64/128's custom disassembler (`.plans/ENTERPRISE_PLAN.md` §11). `RST 30h` is the
 * EXOS call: the byte after it is the function code, and execution goes on after that byte (the
 * machine's `getCallInstructionLength` gives 2 for it, so Step Over agrees). Every program calls EXOS
 * this way, not only the ROM, so the decoding is not gated on an address.
 *
 * The function codes are the EXOS 2.1 kernel specification's list (`_input/enterprise128/docs/Exos.htm`,
 * part II, §2 "EXOS function codes"); the names are Klive's own words for them. Codes 12-15 and
 * anything above 34 are not functions: EXOS answers them with the .IFUNC error.
 */

const RST_30 = 0xf7;

/** The EXOS functions, by the code that follows `RST 30h` */
export const EXOS_FUNCTIONS: ReadonlyMap<number, string> = new Map<number, string>([
  [0, "Reset system"],
  [1, "Open channel"],
  [2, "Create channel"],
  [3, "Close channel"],
  [4, "Destroy channel"],
  [5, "Read character"],
  [6, "Read block"],
  [7, "Write character"],
  [8, "Write block"],
  [9, "Read channel status"],
  [10, "Set and read channel status"],
  [11, "Special function"],
  [16, "Read, write or toggle EXOS variable"],
  [17, "Capture channel"],
  [18, "Redirect channel"],
  [19, "Set default device"],
  [20, "Read system status"],
  [21, "Link device"],
  [22, "Read EXOS boundary"],
  [23, "Set user boundary"],
  [24, "Allocate segment"],
  [25, "Free segment"],
  [26, "Scan ROM extensions"],
  [27, "Allocate channel buffer"],
  [28, "Explain error code"],
  [29, "Load module"],
  [30, "Load relocatable module"],
  [31, "Set time"],
  [32, "Read time"],
  [33, "Set date"],
  [34, "Read date"]
]);

/** The comment on the byte after `RST 30h` */
export function exosFunctionComment(code: number): string {
  const name = EXOS_FUNCTIONS.get(code);
  return name ? `(EXOS ${code}: ${name})` : `(EXOS ${code}: not a function)`;
}

export class EpCustomDisassembler implements ICustomDisassembler {
  private _api: IDisassemblyApi;
  private _inExosCall = false;

  readonly toolId = CUSTOM_Z80_DISASSEMBLY_TOOL;

  setDisassemblyApi(api: IDisassemblyApi): void {
    this._api = api;
  }

  startSectionDisassembly(_section: MemorySection): void {
    this._inExosCall = false;
  }

  beforeInstruction(fetchResult: FetchResult): boolean {
    if (!this._inExosCall) return false;
    this._inExosCall = false;
    const code = this._api.fetch().opcode;
    this._api.addDisassemblyItem({
      address: fetchResult.offset,
      instruction: `.defb ${this._api.decimalMode ? code.toString(10) : `$${intToX2(code)}`}`,
      hardComment: exosFunctionComment(code)
    });
    return true;
  }

  afterInstruction(item: DisassemblyItem): void {
    if (item.opCodes?.length === 1 && item.opCodes[0] === RST_30) {
      this._inExosCall = true;
      item.hardComment = "(EXOS call)";
    }
  }
}
