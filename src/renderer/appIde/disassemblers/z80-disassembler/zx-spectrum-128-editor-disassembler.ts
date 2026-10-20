import type { DisassemblyItem, FetchResult, MemorySection } from "../common-types";
import { intToX2, intToX4 } from "../utils";
import {
  CUSTOM_Z80_DISASSEMBLY_TOOL,
  type ICustomDisassembler,
  type IDisassemblyApi
} from "./custom-disassembly";

/**
 * Custom disassembler for the ZX Spectrum 128K's editor ROM (ROM 0).
 *
 * In that ROM `RST $28` is not the calculator: its routine takes the word after the instruction as
 * an address in the other ROM (ROM 1, the 48K BASIC), calls it there through the paging routine in
 * RAM, and returns past the word. So the two bytes after each `RST $28` are listed as one `.defw`,
 * not as instructions. Its errors are raised by `CALL $05AC`, whose routine takes the byte after the
 * call as the report code and never returns; that byte is listed as `.defb`. Both found from the
 * ROM's own routines (`sp128-0.rom.dis`: CALL_ROM1, ERROR_128).
 *
 * The +2A/+3's editor ROM (ROM 0) has the same `RST $28` (a call into ROM 3, the word after it the
 * address), but its \$05AC is a stack switch whose calls are followed by code: it is decoded with
 * `decodeErrorCalls: false`.
 */
export class ZxSpectrum128EditorCustomDisassembler implements ICustomDisassembler {
  private _api: IDisassemblyApi;
  private _inRst28Mode = false;
  private _inErrorMode = false;
  private readonly _decodeErrorCalls: boolean;
  private readonly _otherRom: string;

  readonly toolId = CUSTOM_Z80_DISASSEMBLY_TOOL;

  /**
   * @param options `decodeErrorCalls` (default true): list the byte after `CALL $05AC` as the
   * report code, as the 128K's editor ROM needs; `otherRom` (default "ROM 1"): the ROM `RST $28`
   * calls, named in the listing's comments
   */
  constructor(options?: { decodeErrorCalls?: boolean; otherRom?: string }) {
    this._decodeErrorCalls = options?.decodeErrorCalls ?? true;
    this._otherRom = options?.otherRom ?? "ROM 1";
  }

  setDisassemblyApi(api: IDisassemblyApi): void {
    this._api = api;
  }

  startSectionDisassembly(_section: MemorySection): void {
    this._inRst28Mode = false;
    this._inErrorMode = false;
  }

  beforeInstruction(fetchResult: FetchResult): boolean {
    if (this._inErrorMode) {
      this._inErrorMode = false;
      const code = this._api.fetch().opcode;
      const value = this._api.decimalMode ? code.toString(10) : `$${intToX2(code)}`;
      this._api.addDisassemblyItem({
        address: fetchResult.offset,
        opCodes: [code],
        instruction: `.defb ${value}`,
        hardComment: `(error code: ${value})`
      });
      return true;
    }
    if (!this._inRst28Mode) return false;
    this._inRst28Mode = false;
    const address = fetchResult.offset;
    const low = this._api.fetch().opcode;
    const high = this._api.fetch().opcode;
    const target = (high << 8) | low;
    const value = this._api.decimalMode ? target.toString(10) : `$${intToX4(target)}`;
    this._api.addDisassemblyItem({
      address,
      opCodes: [low, high],
      instruction: `.defw ${value}`,
      hardComment: `(${this._otherRom} address)`
    });
    return true;
  }

  afterInstruction(item: DisassemblyItem): void {
    if (item.opCodes && item.opCodes[0] === 0xef) {
      this._inRst28Mode = true;
      item.hardComment = `(Call ${this._otherRom})`;
    } else if (
      this._decodeErrorCalls &&
      item.opCodes?.[0] === 0xcd &&
      item.opCodes[1] === 0xac &&
      item.opCodes[2] === 0x05
    ) {
      this._inErrorMode = true;
      item.hardComment = "(Report error)";
    }
  }
}
