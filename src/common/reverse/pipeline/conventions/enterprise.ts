import { romKindHasBasicCalls, romKindIsEnterprise } from "@common/roms/romIdentity";
import type { DecodedRow } from "../preprocess/decode";
import { REGS, type Reg } from "../preprocess/registers";
import type { CallContract, ConventionContext, DecodedTextTable, RomConvention } from "./convention";

/*
 * The Enterprise's conventions (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §4.5, P5). Sources (D4):
 *
 * - The EXOS call (`RST 30h` and a function byte): the EXOS technical description's §4.1
 *   (`_input/enterprise128/docs/Exos.htm`, "EXOS rendszerhívások - általános információk"):
 *   parameters in A, BC and DE and the results there too; A is the status, 0 for success; AF, BC and
 *   DE are not kept; HL, IX, IY and the whole alternate set (AF' too) are, apart from the functions its
 *   chapter 11 names. An interface fact from the manual.
 * - IS-BASIC's restarts (`RST 08h/10h/18h/20h` on the pages that hold IS-BASIC): what Klive's own
 *   sidecars found reading the code, as `.ai/rom-annotations/ep-authoring-guide.md` records it.
 * - The packed texts: the formats Klive's EXOS 2.1 and 2.0 sidecars describe (TEXT_UNPACK,
 *   ERR_MESSAGES, TEXT_CHARS, WP_UNPACK, WP_PHRASES), written from the ROMs' code. The tables are found
 *   through those labels, so a page nobody has labelled yet gets none.
 */

const MAIN: Reg[] = ["A", "F", "B", "C", "D", "E"];

const EXOS_CALL: CallContract = {
  name: "EXOS call",
  inputs: ["A", "B", "C", "D", "E"],
  changes: MAIN,
  keeps: REGS.filter((r) => !MAIN.includes(r)),
  source: "manual: EXOS technical description §4.1 (functions in its chapter 11 may differ)"
};

/** What IS-BASIC's restarts do, by vector. */
const BASIC_RESTARTS: Record<number, string> = {
  0x08: "IS-BASIC: calls HL in segment A",
  0x10: "IS-BASIC: runs the call list that follows (bytes ended by $00)",
  0x18: "IS-BASIC: raises error 9000 + A when NZ",
  0x20: "IS-BASIC: raises error HL"
};

export const enterpriseConvention: RomConvention = {
  id: "enterprise",
  description: "EXOS calls, IS-BASIC's restarts and the packed texts of the Enterprise's ROMs",
  source: "EXOS technical description §4.1; Klive's own Enterprise sidecars and ep-authoring-guide.md",
  appliesTo: (kind) => romKindIsEnterprise(kind),

  callContract(row: DecodedRow) {
    return isRestart(row, 0x30) ? EXOS_CALL : undefined;
  },

  explain(row: DecodedRow, kind) {
    if (isRestart(row, 0x30)) return "EXOS call: A, BC, DE in; A = status (0 = ok); keeps HL, IX, IY and the alternate set (manual §4.1)";
    if (romKindHasBasicCalls(kind) && row.branch?.kind === "rst") return BASIC_RESTARTS[row.branch.address ?? -1];
    return undefined;
  },

  texts(context: ConventionContext) {
    const tables: DecodedTextTable[] = [];
    const at = (name: string) => context.labels.get(name);
    // --- A table has no count of its own: it ends with its data region (else at the next label)
    const starts = [...context.labels.values()].sort((a, b) => a - b);
    const endOf = (start: number) => {
      const region = context.regions?.find((r) => r.type !== "disassemble" && start >= r.start && start <= r.end);
      if (region) {
        // --- Neighbouring data regions of one table (rows of another width) count as one
        let end = region.end;
        for (;;) {
          const next = context.regions?.find((r) => r.start === end + 1 && r.type !== "disassemble" && !starts.includes(r.start));
          if (!next) break;
          end = next.end;
        }
        return end;
      }
      return (starts.find((o) => o > start) ?? context.bytes.length) - 1;
    };
    const chars = at("TEXT_CHARS");
    const words = at("TEXT_WORDS");
    if (chars !== undefined && words !== undefined) {
      const packed = new NibbleTexts(context.bytes, chars, words);
      for (const name of ["ERR_MESSAGES", "TEXT_WORDS", "ERR_TEXT_PACKED"]) {
        const start = at(name);
        if (start !== undefined) tables.push(packed.table(name, start, endOf(start)));
      }
      // --- The keys: ERR_NUMBERS' words (ascending, ended by $0000) for ERR_MESSAGES; the EXOS texts
      // --- answer status codes $FF downwards
      const numbers = at("ERR_NUMBERS");
      const messages = tables.find((t) => t.name === "ERR_MESSAGES");
      if (numbers !== undefined && messages) {
        const keys: string[] = [];
        for (let o = numbers; o + 1 < context.bytes.length && keys.length < messages.texts.length; o += 2) {
          const value = context.bytes[o] | (context.bytes[o + 1] << 8);
          if (value === 0) break;
          keys.push(String(value));
        }
        if (keys.length === messages.texts.length) messages.keys = keys;
      }
      const exos = tables.find((t) => t.name === "ERR_TEXT_PACKED");
      if (exos) exos.keys = exos.texts.map((_, i) => `$${(0xff - i).toString(16).toUpperCase()}`);
    }
    const phrases = at("WP_PHRASES");
    if (phrases !== undefined) {
      tables.push(
        at("WP_UNPACK_00") !== undefined ? wpBitPhrases(context.bytes, phrases, endOf(phrases)) : wpBytePhrases(context.bytes, phrases, endOf(phrases))
      );
    }
    return tables;
  }
};

function isRestart(row: DecodedRow, vector: number): boolean {
  return row.branch?.kind === "rst" && row.branch.address === vector;
}

// ------------------------------------------------------------------------------------------------
// The 4-bit texts (TEXT_UNPACK's form)

/** Reads a bit stream from bit 7 of each byte. */
class BitReader {
  private bit = 0;
  constructor(
    private readonly bytes: Uint8Array,
    private offset: number
  ) {}
  read(count: number): number {
    let value = 0;
    for (let i = 0; i < count; i++) {
      if (this.offset >= this.bytes.length) throw new Error("ran past the page");
      const b = (this.bytes[this.offset] >> (7 - this.bit)) & 1;
      value = (value << 1) | b;
      if (++this.bit === 8) {
        this.bit = 0;
        this.offset++;
      }
    }
    return value;
  }
  /** The byte the next bit comes from. */
  get offsetNow(): number {
    return this.offset;
  }
}

/**
 * Codes of 4 bits: 0 ends a text; 1-13 index TEXT_CHARS (E O N R T A I S C L D U and space); 14 and 4
 * bits index the 16 rarer characters after them; 15 and 5 bits n is word n - 1 of TEXT_WORDS, or with
 * n = 0 makes the letters up to the next space capitals. Letters come out in lower case.
 */
class NibbleTexts {
  constructor(
    private readonly bytes: Uint8Array,
    private readonly chars: number,
    private readonly words: number
  ) {}

  /** Every text that starts before `end`, up to the first that does not decode cleanly. */
  table(name: string, start: number, end: number): DecodedTextTable {
    const reader = new BitReader(this.bytes, start);
    const texts: string[] = [];
    let problem: string | undefined;
    while (texts.length < 256 && reader.offsetNow <= end) {
      try {
        const text = this.text(reader, 0);
        // --- The bits after the last text of the table are not a text (an empty text is: EXOS 2.1 has
        // --- one for each code its spec gives no text)
        if (!/^[\x20-\x7e]*$/.test(text) || reader.offsetNow > end + 1) break;
        texts.push(text);
      } catch (error) {
        problem = (error as Error).message;
        break;
      }
    }
    // --- Zero bits padding the table's last byte read as empty texts
    while (texts.length && texts[texts.length - 1] === "") texts.pop();
    return { name, start, packing: "4-bit codes (TEXT_UNPACK)", texts, ...(problem ? { problem } : {}) };
  }

  private text(reader: BitReader, depth: number): string {
    if (depth > 3) throw new Error("words nested too deep");
    let out = "";
    let capitals = false;
    const put = (c: string) => {
      if (c === " ") capitals = false;
      out += /[A-Za-z]/.test(c) ? (capitals ? c.toUpperCase() : c.toLowerCase()) : c;
    };
    for (;;) {
      const code = reader.read(4);
      if (code === 0) return out;
      if (code <= 13) put(String.fromCharCode(this.bytes[this.chars + code - 1]));
      else if (code === 14) put(String.fromCharCode(this.bytes[this.chars + 13 + reader.read(4)]));
      else {
        const n = reader.read(5);
        if (n === 0) capitals = true;
        else {
          // --- A word keeps its own capitals ("EXOS"); the caller's capital mode still applies
          for (const c of this.word(n - 1, depth + 1)) {
            out += capitals && /[a-z]/.test(c) ? c.toUpperCase() : c;
            if (c === " ") capitals = false;
          }
        }
      }
    }
  }

  private word(index: number, depth: number): string {
    const reader = new BitReader(this.bytes, this.words);
    for (let i = 0; i < index; i++) skipText(reader);
    return this.text(reader, depth);
  }
}

/** Steps over one text code by code, as TEXT_UNPACK does to reach text n (no words are decoded). */
function skipText(reader: BitReader): void {
  for (;;) {
    const code = reader.read(4);
    if (code === 0) return;
    if (code === 14) reader.read(4);
    if (code === 15) reader.read(5);
  }
}

// ------------------------------------------------------------------------------------------------
// The WP's texts

/**
 * EXOS 2.1's WP phrases: each a length byte that counts itself, then the phrase in WP_UNPACK's bit
 * stream (1 + 5 bits: the letter $61 + n; 01 + 8 bits: that byte; 00 + 5 bits: 0 ends, else phrase n).
 */
function wpBitPhrases(bytes: Uint8Array, start: number, end: number): DecodedTextTable {
  const texts: string[] = [];
  let problem: string | undefined;
  let offset = start;
  const phraseStarts: number[] = [];
  while (phraseStarts.length < 64 && offset <= end && bytes[offset] > 1) {
    phraseStarts.push(offset);
    offset += bytes[offset];
  }
  const decode = (index: number, depth: number): string => {
    if (depth > 3 || index >= phraseStarts.length) throw new Error(`phrase ${index + 1} is not in the table`);
    const reader = new BitReader(bytes, phraseStarts[index] + 1);
    let out = "";
    for (;;) {
      if (reader.read(1)) out += String.fromCharCode(0x61 + reader.read(5));
      else if (reader.read(1)) out += printableOrEscape(reader.read(8));
      else {
        const n = reader.read(5);
        if (n === 0) return out;
        out += decode(n - 1, depth + 1);
      }
    }
  };
  for (let i = 0; i < phraseStarts.length; i++) {
    try {
      texts.push(decode(i, 0));
    } catch (error) {
      problem = (error as Error).message;
      break;
    }
  }
  return { name: "WP_PHRASES", start, packing: "WP bit stream (WP_UNPACK, EXOS 2.1)", texts, ...(problem ? { problem } : {}) };
}

/** EXOS 2.0's WP phrases: a length byte that does not count itself, then the bytes as they are. */
function wpBytePhrases(bytes: Uint8Array, start: number, end: number): DecodedTextTable {
  const texts: string[] = [];
  let offset = start;
  while (texts.length < 64 && offset <= end && bytes[offset] > 0) {
    const length = bytes[offset];
    texts.push(Array.from(bytes.subarray(offset + 1, offset + 1 + length), printableOrEscape).join(""));
    offset += length + 1;
  }
  return { name: "WP_PHRASES", start, packing: "bytes and phrase numbers (EXOS 2.0)", texts };
}

/** A byte as text: printable as it is, anything else as `<$xx>`. */
function printableOrEscape(b: number): string {
  return b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : `<$${b.toString(16).padStart(2, "0").toUpperCase()}>`;
}
