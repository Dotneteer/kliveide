import { ht1080zTokenName } from "@common/ht1080z/basicTokens";

import { DisassemblyItem, FetchResult, MemorySection } from "../common-types";
import { intToX2, intToX4 } from "../utils";
import { CUSTOM_Z80_DISASSEMBLY_TOOL, ICustomDisassembler, IDisassemblyApi } from "./custom-disassembly";

/*
 * The HT-1080Z's custom disassembler (`.plans/HT1080Z_PLAN.md` §11). Level II BASIC's `RST 08h` is
 * its syntax check: the byte after it is the character (or token) the text must hold next. The ROM's
 * tables between 1608h and 18F6h are data, listed as such. Every model's BASIC ROM has them at the
 * same addresses (`test/ht1080z/disassembler.test.ts` checks the three ROMs).
 *
 * The ROM cannot be paged out on any model, so the decoding is gated on the address alone: the 12K
 * BASIC ROM at 0000h-2FFFh. The extension ROM above it is a different program.
 */

/** The end of the BASIC ROM (exclusive). */
const BASIC_ROM_END = 0x3000;

/** The kind of data a table holds. */
type TableKind = "functions" | "keywords" | "statements" | "precedence" | "arithmetic" | "errors";

type DataTable = { start: number; end: number; kind: TableKind };

/** The ROM's tables, start and end inclusive. */
const TABLES: DataTable[] = [
  // --- Function dispatch, tokens D7h-FAh
  { start: 0x1608, end: 0x164f, kind: "functions" },
  // --- The reserved words, tokens 80h-FBh, closed by an 80h byte
  { start: 0x1650, end: 0x1821, kind: "keywords" },
  // --- Statement dispatch, tokens 80h-BBh
  { start: 0x1822, end: 0x1899, kind: "statements" },
  // --- Operator precedences: + - * / ↑ AND OR
  { start: 0x189a, end: 0x18a0, kind: "precedence" },
  // --- Conversion and arithmetic routines, by number type
  { start: 0x18a1, end: 0x18c8, kind: "arithmetic" },
  // --- The two-letter error codes, 23 of them from NF (ERR 0)
  { start: 0x18c9, end: 0x18f6, kind: "errors" }
];

const FIRST_FUNCTION_TOKEN = 0xd7;
const PRECEDENCE_OPERATORS = ["+", "-", "*", "/", "↑", "AND", "OR"];

/** A byte as it appears in a listing comment: printable ASCII in quotes, otherwise hex. */
function charOf(code: number): string {
  const token = ht1080zTokenName(code);
  if (token) return `token ${token}`;
  return code >= 0x20 && code < 0x7f ? `"${String.fromCharCode(code)}"` : `$${intToX2(code)}`;
}

export class Ht1080zCustomDisassembler implements ICustomDisassembler {
  private _api: IDisassemblyApi;
  private _inSyntaxCheck = false;

  readonly toolId = CUSTOM_Z80_DISASSEMBLY_TOOL;

  setDisassemblyApi(api: IDisassemblyApi): void {
    this._api = api;
  }

  startSectionDisassembly(_section: MemorySection): void {
    this._inSyntaxCheck = false;
  }

  private hex2(value: number): string {
    return this._api.decimalMode ? value.toString(10) : `$${intToX2(value)}`;
  }

  private hex4(value: number): string {
    return this._api.decimalMode ? value.toString(10) : `$${intToX4(value)}`;
  }

  beforeInstruction(fetchResult: FetchResult): boolean {
    const address = fetchResult.offset;
    if (this._inSyntaxCheck) {
      this._inSyntaxCheck = false;
      const expected = this._api.fetch().opcode;
      this._api.addDisassemblyItem({
        address,
        instruction: `.defb ${this.hex2(expected)}`,
        hardComment: `(expects ${charOf(expected)})`
      });
      return true;
    }
    if (address >= BASIC_ROM_END) return false;
    const table = TABLES.find((t) => address >= t.start && address <= t.end);
    if (!table) return false;
    this.disassembleTableEntry(address, table);
    return true;
  }

  afterInstruction(item: DisassemblyItem): void {
    if (item.address < BASIC_ROM_END && item.opCodes?.[0] === 0xcf) {
      this._inSyntaxCheck = true;
      item.hardComment = "(Syntax check)";
    }
  }

  /** One entry of a ROM table: a word, a byte, a keyword or an error code. */
  private disassembleTableEntry(address: number, table: DataTable): void {
    const word = (): number => {
      const lo = this._api.fetch().opcode;
      const hi = address + 1 <= table.end ? this._api.fetch().opcode : 0;
      return lo | (hi << 8);
    };
    switch (table.kind) {
      case "functions":
      case "statements": {
        const target = word();
        const index = (address - table.start) >> 1;
        const token = (table.kind === "functions" ? FIRST_FUNCTION_TOKEN : 0x80) + index;
        this._api.createLabel(target);
        this._api.addDisassemblyItem({
          address,
          instruction: `.defw ${this.hex4(target)}`,
          hardComment: `(${ht1080zTokenName(token) ?? this.hex2(token)})`
        });
        return;
      }
      case "arithmetic": {
        const target = word();
        if (target) this._api.createLabel(target);
        this._api.addDisassemblyItem({ address, instruction: `.defw ${this.hex4(target)}` });
        return;
      }
      case "precedence": {
        const value = this._api.fetch().opcode;
        this._api.addDisassemblyItem({
          address,
          instruction: `.defb ${this.hex2(value)}`,
          hardComment: `(precedence of ${PRECEDENCE_OPERATORS[address - table.start]})`
        });
        return;
      }
      case "errors": {
        const first = this._api.fetch().opcode;
        const second = address + 1 <= table.end ? this._api.fetch().opcode : 0x20;
        const code = String.fromCharCode(first, second);
        this._api.addDisassemblyItem({
          address,
          instruction: `.defb "${code}"`,
          hardComment: `(error ${((address - table.start) >> 1) + 1})`
        });
        return;
      }
      case "keywords": {
        const bytes = [this._api.fetch().opcode];
        // --- The terminator: a lone 80h byte
        if (bytes[0] === 0x80 && address === table.end) {
          this._api.addDisassemblyItem({
            address,
            instruction: `.defb ${this.hex2(0x80)}`,
            hardComment: "(end of reserved words)"
          });
          return;
        }
        // --- The keyword's other characters, up to the next one's first (bit 7 set)
        while (address + bytes.length < table.end && (this._api.peek().opcode & 0x80) === 0) {
          bytes.push(this._api.fetch().opcode);
        }
        const keyword = bytes.map((b) => String.fromCharCode(b & 0x7f)).join("");
        this._api.addDisassemblyItem({
          address,
          instruction: `.defb ${bytes.map((b) => this.hex2(b)).join(", ")}`,
          hardComment: `("${keyword}")`
        });
        return;
      }
    }
  }
}
