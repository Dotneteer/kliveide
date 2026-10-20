import type { DisassemblyItem, FetchResult, MemorySection } from "../common-types";
import { intToX4 } from "../utils";
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
 * not as instructions. Found from the ROM's own `RST $28` routine (`sp128-0.rom.dis`).
 */
export class ZxSpectrum128EditorCustomDisassembler implements ICustomDisassembler {
  private _api: IDisassemblyApi;
  private _inRst28Mode = false;

  readonly toolId = CUSTOM_Z80_DISASSEMBLY_TOOL;

  setDisassemblyApi(api: IDisassemblyApi): void {
    this._api = api;
  }

  startSectionDisassembly(_section: MemorySection): void {
    this._inRst28Mode = false;
  }

  beforeInstruction(fetchResult: FetchResult): boolean {
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
    }
  }
}
