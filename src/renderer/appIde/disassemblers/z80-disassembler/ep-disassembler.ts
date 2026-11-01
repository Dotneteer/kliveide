import { DisassemblyItem, FetchResult, MemorySection } from "../common-types";
import { intToX2, intToX4 } from "../utils";
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
const RST_10 = 0xd7;

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

/*
 * IS-BASIC's call list. The BASIC cartridge puts a gate in the null segment's RAM ($0010 -> $009A): `RST 10h`
 * is followed by a list of routine bytes ended by $00, and execution goes on after the $00. The gate calls the
 * routines one after the other; a byte with bit 7 set picks entry n & $7F of EXOS segment 1's word table (at
 * $C000 + 2n of segment 1, which carries much of IS-BASIC 2.1), a byte below $80 entry n of the BASIC ROM's own
 * table ($C0E8 + 2n of its segment), and $00 (that table's entry 0) leaves the list. A routine may take inline
 * operands, reading them through the gate's pointer: $92 a byte, $93 and $96 a word (EXOS 2.1's segment 1,
 * read from their code and observed in the running gate; `.ai/rom-annotations/ep-authoring-guide.md`).
 * The restart means this only in IS-BASIC's own code, so the decoding is gated on the ROM pages that hold it
 * (kind "ep-exos-basic").
 */

/** The inline operand bytes the routines of IS-BASIC 2.1's call list take, by routine byte */
export const BASIC_CALL_OPERANDS: ReadonlyMap<number, 1 | 2> = new Map<number, 1 | 2>([
  [0x92, 1],
  [0x93, 2],
  [0x96, 2]
]);

/** A list longer than this is not one: the decoder stops and goes back to code */
const MAX_BASIC_CALLS = 64;

/** The comment on a byte of the list after IS-BASIC's `RST 10h` */
export function basicCallComment(code: number): string {
  if (code === 0) return "(IS-BASIC call list: end)";
  return code & 0x80
    ? `(IS-BASIC call: segment 1, entry ${code & 0x7f})`
    : `(IS-BASIC call: the BASIC ROM, entry ${code})`;
}

export class EpBasicCustomDisassembler implements ICustomDisassembler {
  private _api: IDisassemblyApi;
  private _inList = false;
  private _calls = 0;
  private _operand: 0 | 1 | 2 = 0;

  readonly toolId = CUSTOM_Z80_DISASSEMBLY_TOOL;

  setDisassemblyApi(api: IDisassemblyApi): void {
    this._api = api;
  }

  startSectionDisassembly(_section: MemorySection): void {
    this._inList = false;
    this._operand = 0;
  }

  beforeInstruction(fetchResult: FetchResult): boolean {
    if (!this._inList) return false;
    const decimal = this._api.decimalMode;
    if (this._operand) {
      const size = this._operand;
      this._operand = 0;
      const low = this._api.fetch().opcode;
      if (size === 1) {
        this._api.addDisassemblyItem({
          address: fetchResult.offset,
          opCodes: [low],
          instruction: `.defb ${decimal ? low.toString(10) : `$${intToX2(low)}`}`,
          hardComment: "(operand)"
        });
      } else {
        const high = this._api.fetch().opcode;
        const value = (high << 8) | low;
        this._api.addDisassemblyItem({
          address: fetchResult.offset,
          opCodes: [low, high],
          instruction: `.defw ${decimal ? value.toString(10) : `$${intToX4(value)}`}`,
          hardComment: "(operand)"
        });
      }
      return true;
    }
    const code = this._api.fetch().opcode;
    this._api.addDisassemblyItem({
      address: fetchResult.offset,
      opCodes: [code],
      instruction: `.defb ${decimal ? code.toString(10) : `$${intToX2(code)}`}`,
      hardComment: basicCallComment(code)
    });
    this._calls++;
    if (code === 0 || this._calls >= MAX_BASIC_CALLS) this._inList = false;
    else this._operand = BASIC_CALL_OPERANDS.get(code) ?? 0;
    return true;
  }

  afterInstruction(item: DisassemblyItem): void {
    if (item.opCodes?.length === 1 && item.opCodes[0] === RST_10) {
      this._inList = true;
      this._calls = 0;
      this._operand = 0;
      item.hardComment = "(IS-BASIC call list)";
    }
  }
}
