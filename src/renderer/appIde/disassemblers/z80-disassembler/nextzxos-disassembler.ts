import type { DisassemblyItem, FetchResult, MemorySection } from "../common-types";
import { intToX2, intToX4 } from "../utils";
import {
  CUSTOM_Z80_DISASSEMBLY_TOOL,
  type ICustomDisassembler,
  type IDisassemblyApi
} from "./custom-disassembly";

/** What follows an instruction that takes inline data. */
export type NextOsInline =
  /** A word: the address to call in another ROM */
  | { kind: "call"; rom: string }
  /** A byte: an error code */
  | { kind: "error" }
  /** A byte: a function code, followed by a word when its bit 7 is set */
  | { kind: "function" }
  /** A byte and a word: a call into the DivMMC's memory */
  | { kind: "divmmcCall" };

/** The inline data of one NextZXOS ROM page, by restart and by CALL target. */
export type NextOsPageSpec = {
  restarts: Partial<Record<number, NextOsInline>>;
  calls: Partial<Record<number, NextOsInline>>;
};

/**
 * NextZXOS's ROM pages 0-2 (`enNextZX.rom`), found from their own restart and call routines; each page
 * uses its restarts differently, so each has its own table.
 *
 * - The ROM-to-ROM call stubs take the word after the CALL as the address to call, write NextReg $8E
 *   (the 128K mapping: bits 1-0 the ROM) and return through the same stub in the other ROM, which
 *   switches back: page 0's \$3E00 calls ROM 2 and \$3E80 ROM 1; page 1's \$3E80 calls ROM 0 and \$3F00
 *   ROM 2; page 2's \$3E00 calls ROM 0 and \$3F00 ROM 1.
 * - `CALL $0068` (pages 0 and 1) writes NextReg $8C = $80 (the alternate ROM enabled) and calls the word's
 *   address there; the alternate ROM's own \$007B switches it off again. Page 1's `CALL $0080` reaches
 *   the alternate ROM the same way through ROM 0.
 * - `RST $28` (pages 0 and 1) calls the word's address in ROM 3 through the RAM routine at \$5B48
 *   (NextReg $8E = 3), returning through \$5B4D (page 0) or \$5B3E (page 1).
 * - Page 0's `RST $18` and `RST $20` jump to its \$3E80 and \$3E00 stubs: a word for ROM 1 and ROM 2.
 * - Page 1's `CALL $26CB` and `CALL $26E5` write port $E3 ($87 or $8A: the DivMMC's memory paged in)
 *   and call the word's address there; the way back (\$26F7) writes the port again.
 * - Page 1's `RST $00` jumps to its \$3F00 stub: a word for ROM 2.
 * - Page 1's `RST $08` takes an error code byte, and so does its `CALL $08EF` (which never returns; $FF
 *   there means the +3DOS error in A); its `RST $10` a function byte, and a word after it when
 *   the byte's bit 7 is set.
 * - Page 2's `CALL $3E18` and `CALL $3E32` call the word's address in the alternate ROM, through ROM 0's
 *   (or ROM 1's) \$007B, coming back through \$3E13 (\$3F13).
 * - Page 2's `RST $08` (\$3F18) takes a byte (into A) and a word (into HL), pages the DivMMC's memory out
 *   (port $E3 = 0), selects ROM 3 at \$3CFC and runs on into \$3D00, where the fetch maps the DivMMC in
 *   again (its automap on \$3Dxx, NextReg $BB bit 7): a call of the DivMMC's code, the word its address.
 */
export const NEXTZXOS_PAGES: Readonly<Record<0 | 1 | 2, NextOsPageSpec>> = {
  0: {
    restarts: {
      0x18: { kind: "call", rom: "ROM 1" },
      0x20: { kind: "call", rom: "ROM 2" },
      0x28: { kind: "call", rom: "ROM 3" }
    },
    calls: {
      0x0068: { kind: "call", rom: "alternate ROM" },
      0x3e00: { kind: "call", rom: "ROM 2" },
      0x3e80: { kind: "call", rom: "ROM 1" }
    }
  },
  1: {
    restarts: {
      0x00: { kind: "call", rom: "ROM 2" },
      0x08: { kind: "error" },
      0x10: { kind: "function" },
      0x28: { kind: "call", rom: "ROM 3" }
    },
    calls: {
      0x0068: { kind: "call", rom: "alternate ROM" },
      0x0080: { kind: "call", rom: "alternate ROM" },
      0x08ef: { kind: "error" },
      0x26cb: { kind: "call", rom: "DivMMC" },
      0x26e5: { kind: "call", rom: "DivMMC" },
      0x3e80: { kind: "call", rom: "ROM 0" },
      0x3f00: { kind: "call", rom: "ROM 2" }
    }
  },
  2: {
    restarts: {
      0x08: { kind: "divmmcCall" }
    },
    calls: {
      0x3e00: { kind: "call", rom: "ROM 0" },
      0x3e18: { kind: "call", rom: "alternate ROM" },
      0x3e32: { kind: "call", rom: "alternate ROM" },
      0x3f00: { kind: "call", rom: "ROM 1" }
    }
  }
};

type Pending = { size: 1 | 2; comment: string; thenWordIfBit7?: string };

/**
 * Lists the inline bytes and words after a NextZXOS page's restarts and stub calls as `.defb`/`.defw`,
 * not as instructions (`NEXTZXOS_PAGES` says which).
 */
export class NextZxOsCustomDisassembler implements ICustomDisassembler {
  private _api: IDisassemblyApi;
  private _pending: Pending[] = [];

  readonly toolId = CUSTOM_Z80_DISASSEMBLY_TOOL;

  constructor(private readonly _spec: NextOsPageSpec) {}

  setDisassemblyApi(api: IDisassemblyApi): void {
    this._api = api;
  }

  startSectionDisassembly(_section: MemorySection): void {
    this._pending = [];
  }

  beforeInstruction(fetchResult: FetchResult): boolean {
    const next = this._pending.shift();
    if (!next) return false;
    const address = fetchResult.offset;
    if (next.size === 1) {
      const code = this._api.fetch().opcode;
      const value = this._api.decimalMode ? code.toString(10) : `$${intToX2(code)}`;
      this._api.addDisassemblyItem({
        address,
        opCodes: [code],
        instruction: `.defb ${value}`,
        hardComment: `(${next.comment})`
      });
      if (next.thenWordIfBit7 && code & 0x80) {
        this._pending.unshift({ size: 2, comment: next.thenWordIfBit7 });
      }
      return true;
    }
    const low = this._api.fetch().opcode;
    const high = this._api.fetch().opcode;
    const word = (high << 8) | low;
    const value = this._api.decimalMode ? word.toString(10) : `$${intToX4(word)}`;
    this._api.addDisassemblyItem({
      address,
      opCodes: [low, high],
      instruction: `.defw ${value}`,
      hardComment: `(${next.comment})`
    });
    return true;
  }

  afterInstruction(item: DisassemblyItem): void {
    const op = item.opCodes?.[0];
    if (op === undefined) return;
    let inline: NextOsInline | undefined;
    if (item.opCodes!.length === 1 && (op & 0xc7) === 0xc7) {
      inline = this._spec.restarts[op & 0x38];
    } else if (op === 0xcd && item.opCodes!.length >= 3) {
      inline = this._spec.calls[item.opCodes![1] | (item.opCodes![2] << 8)];
    }
    if (!inline) return;
    switch (inline.kind) {
      case "call":
        item.hardComment = `(Call ${inline.rom})`;
        this._pending.push({ size: 2, comment: `${inline.rom} address` });
        break;
      case "error":
        item.hardComment = "(Report error)";
        this._pending.push({ size: 1, comment: "error code" });
        break;
      case "function":
        this._pending.push({ size: 1, comment: "function code", thenWordIfBit7: "word" });
        break;
      case "divmmcCall":
        item.hardComment = "(Call DivMMC)";
        this._pending.push({ size: 1, comment: "DivMMC call byte" }, { size: 2, comment: "DivMMC address" });
        break;
    }
  }
}

/** The decoder for a NextZXOS page kind (`next-os0`..`next-os2`); undefined for any other kind. */
export function nextZxOsDecoderFor(kind: string | undefined): NextZxOsCustomDisassembler | undefined {
  const page = kind === "next-os0" ? 0 : kind === "next-os1" ? 1 : kind === "next-os2" ? 2 : undefined;
  return page === undefined ? undefined : new NextZxOsCustomDisassembler(NEXTZXOS_PAGES[page]);
}
