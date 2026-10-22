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
 * `decodeErrorCalls: false`. The +3's syntax ROM (ROM 1) also calls other ROMs through routines that
 * take the address from the word after the CALL (\$3F00 into ROM 2, \$3E80 into ROM 0): `inlineCalls`.
 */
export class ZxSpectrum128EditorCustomDisassembler implements ICustomDisassembler {
  private _api: IDisassemblyApi;
  private _inRst28Mode = false;
  private _inErrorMode = false;
  /** The ROM named for the inline word that follows, while one is due. */
  private _wordRom: string | undefined;
  private readonly _decodeErrorCalls: boolean;
  private readonly _otherRom: string;
  private readonly _inlineCalls: { address: number; rom: string }[];

  readonly toolId = CUSTOM_Z80_DISASSEMBLY_TOOL;

  /**
   * @param options `decodeErrorCalls` (default true): list the byte after `CALL $05AC` as the
   * report code, as the 128K's editor ROM needs; `otherRom` (default "ROM 1"): the ROM `RST $28`
   * calls, named in the listing's comments; `inlineCalls`: routines whose CALL is followed by the
   * address to call in another ROM (listed as `.defw`)
   */
  constructor(options?: {
    decodeErrorCalls?: boolean;
    otherRom?: string;
    inlineCalls?: { address: number; rom: string }[];
  }) {
    this._decodeErrorCalls = options?.decodeErrorCalls ?? true;
    this._otherRom = options?.otherRom ?? "ROM 1";
    this._inlineCalls = options?.inlineCalls ?? [];
  }

  setDisassemblyApi(api: IDisassemblyApi): void {
    this._api = api;
  }

  startSectionDisassembly(_section: MemorySection): void {
    this._inRst28Mode = false;
    this._inErrorMode = false;
    this._wordRom = undefined;
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
    if (!this._inRst28Mode && this._wordRom === undefined) return false;
    const rom = this._inRst28Mode ? this._otherRom : this._wordRom!;
    this._inRst28Mode = false;
    this._wordRom = undefined;
    const address = fetchResult.offset;
    const low = this._api.fetch().opcode;
    const high = this._api.fetch().opcode;
    const target = (high << 8) | low;
    const value = this._api.decimalMode ? target.toString(10) : `$${intToX4(target)}`;
    this._api.addDisassemblyItem({
      address,
      opCodes: [low, high],
      instruction: `.defw ${value}`,
      hardComment: `(${rom} address)`
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
    } else if (item.opCodes?.[0] === 0xcd && item.opCodes.length >= 3) {
      const target = item.opCodes[1] | (item.opCodes[2] << 8);
      const call = this._inlineCalls.find((c) => c.address === target);
      if (call) {
        this._wordRom = call.rom;
        item.hardComment = `(Call ${call.rom})`;
      }
    }
  }
}

/**
 * The +3's syntax ROM (ROM 1): `RST $28` + word into ROM 3, `CALL $3F00` + word into ROM 2 (+3DOS),
 * `CALL $3E80` + word into ROM 0. Its error routines' CALLs (each followed by an error code byte) are
 * at a different address in each version, so the sidecars mark those bytes with one-byte regions.
 */
export function plus3SyntaxDecoder(): ZxSpectrum128EditorCustomDisassembler {
  return new ZxSpectrum128EditorCustomDisassembler({
    decodeErrorCalls: false,
    otherRom: "ROM 3",
    inlineCalls: [
      { address: 0x3f00, rom: "ROM 2" },
      { address: 0x3e80, rom: "ROM 0" }
    ]
  });
}
