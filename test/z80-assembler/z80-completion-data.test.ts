import { describe, it, expect } from "vitest";
import {
  Z80_COMPLETION_ITEMS,
  Z80_INSTRUCTION_ITEMS,
  Z80_REGISTER_ITEMS,
  Z80_PRAGMA_ITEMS,
  Z80_KEYWORD_ITEMS,
  Z80_DIRECTIVE_ITEMS,
  type StaticCompletionItem
} from "@renderer/appIde/services/z80-completion-data";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function labels(items: readonly StaticCompletionItem[]): string[] {
  return items.map((i) => i.label);
}

function duplicates(items: readonly StaticCompletionItem[]): string[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const item of items) {
    if (seen.has(item.label)) dupes.push(item.label);
    seen.add(item.label);
  }
  return dupes;
}

// ---------------------------------------------------------------------------
// Tests — instructions
// ---------------------------------------------------------------------------

describe("Z80_INSTRUCTION_ITEMS", () => {
  it("contains the core Z80 mnemonics", () => {
    const ls = labels(Z80_INSTRUCTION_ITEMS);
    for (const mnemonic of ["nop", "ld", "add", "sub", "jp", "jr", "call", "ret", "push", "pop",
                             "halt", "inc", "dec", "and", "or", "xor", "cp", "bit", "set", "res",
                             "rl", "rr", "rlc", "rrc", "sla", "sra", "srl", "rla", "rra", "rlca",
                             "rrca", "rld", "rrd", "ldi", "ldd", "ldir", "lddr", "cpi", "cpd",
                             "cpir", "cpdr", "ini", "ind", "inir", "indr", "outi", "outd", "otir",
                             "otdr", "daa", "cpl", "ccf", "scf", "ei", "di", "exx", "ex",
                             "in", "out", "im", "djnz", "adc", "sbc", "neg", "retn", "reti",
                             "rst", "sll"]) {
      expect(ls, `missing mnemonic: ${mnemonic}`).toContain(mnemonic);
    }
  });

  it("contains ZX Spectrum Next extension opcodes", () => {
    const ls = labels(Z80_INSTRUCTION_ITEMS);
    for (const mnemonic of ["nextreg", "mirror", "mul", "test", "swapnib", "brlc", "bsla",
                             "bsra", "bsrf", "bsrl", "pixelad", "pixeldn", "setae", "outinb",
                             "ldix", "ldws", "ldirx", "lddrx", "lddx", "ldpirx"]) {
      expect(ls, `missing Next mnemonic: ${mnemonic}`).toContain(mnemonic);
    }
  });

  it("all Next items are flagged with next: true", () => {
    for (const item of Z80_INSTRUCTION_ITEMS.filter((i) => i.next)) {
      expect(item.next).toBe(true);
    }
  });

  it("has no duplicate labels", () => {
    expect(duplicates(Z80_INSTRUCTION_ITEMS)).toEqual([]);
  });

  it("every item has a non-empty label, kind='instruction', and detail", () => {
    for (const item of Z80_INSTRUCTION_ITEMS) {
      expect(item.label.length, `empty label`).toBeGreaterThan(0);
      expect(item.kind).toBe("instruction");
      expect(item.detail.length, `empty detail for ${item.label}`).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests — registers
// ---------------------------------------------------------------------------

describe("Z80_REGISTER_ITEMS", () => {
  it("contains 8-bit registers", () => {
    const ls = labels(Z80_REGISTER_ITEMS);
    for (const r of ["a", "b", "c", "d", "e", "h", "l", "i", "r"]) {
      expect(ls, `missing register: ${r}`).toContain(r);
    }
  });

  it("contains 16-bit registers", () => {
    const ls = labels(Z80_REGISTER_ITEMS);
    for (const r of ["hl", "bc", "de", "sp", "ix", "iy", "af"]) {
      expect(ls, `missing register: ${r}`).toContain(r);
    }
  });

  it("contains undocumented index byte registers", () => {
    const ls = labels(Z80_REGISTER_ITEMS);
    for (const r of ["xh", "xl", "yh", "yl"]) {
      expect(ls, `missing IX/IY byte register: ${r}`).toContain(r);
    }
  });

  it("has no duplicate labels", () => {
    expect(duplicates(Z80_REGISTER_ITEMS)).toEqual([]);
  });

  it("every item has kind='register'", () => {
    for (const item of Z80_REGISTER_ITEMS) {
      expect(item.kind).toBe("register");
    }
  });
});

// ---------------------------------------------------------------------------
// Tests — pragmas
// ---------------------------------------------------------------------------

describe("Z80_PRAGMA_ITEMS", () => {
  it("contains common pragmas", () => {
    const ls = labels(Z80_PRAGMA_ITEMS);
    for (const p of [".org", ".equ", ".var", ".db", ".dw", ".dm", ".ds",
                      ".defb", ".defw", ".defm", ".defn", ".defh", ".defg",
                      ".skip", ".extern", ".align", ".error", ".includebin"]) {
      expect(ls, `missing pragma: ${p}`).toContain(p);
    }
  });

  it("has no duplicate labels", () => {
    expect(duplicates(Z80_PRAGMA_ITEMS)).toEqual([]);
  });

  it("every item has kind='pragma'", () => {
    for (const item of Z80_PRAGMA_ITEMS) {
      expect(item.kind).toBe("pragma");
    }
  });
});

// ---------------------------------------------------------------------------
// Tests — structural keywords
// ---------------------------------------------------------------------------

describe("Z80_KEYWORD_ITEMS", () => {
  it("contains structural keywords", () => {
    const ls = labels(Z80_KEYWORD_ITEMS);
    for (const kw of [".macro", ".endm", ".proc", ".endp", ".if", ".else", ".endif",
                       ".while", ".endw", ".loop", ".endl", ".repeat", ".until",
                       ".for", ".next", ".module", ".endmodule", ".struct", ".ends"]) {
      expect(ls, `missing keyword: ${kw}`).toContain(kw);
    }
  });

  it("has no duplicate labels", () => {
    expect(duplicates(Z80_KEYWORD_ITEMS)).toEqual([]);
  });

  it("every item has kind='keyword'", () => {
    for (const item of Z80_KEYWORD_ITEMS) {
      expect(item.kind).toBe("keyword");
    }
  });
});

// ---------------------------------------------------------------------------
// Tests — preprocessor directives
// ---------------------------------------------------------------------------

describe("Z80_DIRECTIVE_ITEMS", () => {
  it("contains preprocessor directives", () => {
    const ls = labels(Z80_DIRECTIVE_ITEMS);
    for (const d of ["#ifdef", "#ifndef", "#if", "#else", "#endif",
                      "#define", "#undef", "#include", "#line"]) {
      expect(ls, `missing directive: ${d}`).toContain(d);
    }
  });

  it("has no duplicate labels", () => {
    expect(duplicates(Z80_DIRECTIVE_ITEMS)).toEqual([]);
  });

  it("every item has kind='directive'", () => {
    for (const item of Z80_DIRECTIVE_ITEMS) {
      expect(item.kind).toBe("directive");
    }
  });
});

// ---------------------------------------------------------------------------
// Tests — combined list
// ---------------------------------------------------------------------------

describe("Z80_COMPLETION_ITEMS (combined)", () => {
  it("is the union of all sub-lists", () => {
    const expectedCount =
      Z80_INSTRUCTION_ITEMS.length +
      Z80_REGISTER_ITEMS.length +
      Z80_PRAGMA_ITEMS.length +
      Z80_KEYWORD_ITEMS.length +
      Z80_DIRECTIVE_ITEMS.length;
    expect(Z80_COMPLETION_ITEMS.length).toBe(expectedCount);
  });

  it("has no duplicate labels within the combined list", () => {
    expect(duplicates(Z80_COMPLETION_ITEMS)).toEqual([]);
  });

  it("every item has a non-empty label and detail", () => {
    for (const item of Z80_COMPLETION_ITEMS) {
      expect(item.label.length, `empty label`).toBeGreaterThan(0);
      expect(item.detail.length, `empty detail for '${item.label}'`).toBeGreaterThan(0);
    }
  });
});
