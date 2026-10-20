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
 */
export class ZxSpectrum128EditorCustomDisassembler implements ICustomDisassembler {
  private _api: IDisassemblyApi;
  private _inRst28Mode = false;
  private _inErrorMode = false;

  readonly toolId = CUSTOM_Z80_DISASSEMBLY_TOOL;

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
      hardComment: "(ROM 1 address)"
    });
    return true;
  }

  afterInstruction(item: DisassemblyItem): void {
    if (item.opCodes && item.opCodes[0] === 0xef) {
      this._inRst28Mode = true;
      item.hardComment = "(Call ROM 1)";
    } else if (item.opCodes?.[0] === 0xcd && item.opCodes[1] === 0xac && item.opCodes[2] === 0x05) {
      this._inErrorMode = true;
      item.hardComment = "(Report error)";
    }
  }
}
