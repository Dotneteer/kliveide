import { describe, it, expect } from "vitest";
import { computeNumericHover } from "@renderer/appIde/services/z80-providers";
import type { HoverResult } from "@renderer/appIde/services/z80-providers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Call computeNumericHover with `column` pointing to the first non-space char. */
function hoverAt(line: string, col: number): HoverResult | null {
  return computeNumericHover(line, col);
}

/** Returns hover result when column is inside the first numeric token found. */
function hoverOnFirstNum(line: string): HoverResult | null {
  // Scan for the start of a numeric literal without matching hex letters in identifiers.
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const prev = i > 0 ? line[i - 1] : "\0";
    const next = i + 1 < line.length ? line[i + 1] : "\0";

    if ((ch === "$" || ch === "#") && /[0-9A-Fa-f]/.test(next)) {
      return computeNumericHover(line, i + 1); // 1-based column at '$'/'#'
    }
    if (ch === "%" && /[01]/.test(next)) {
      return computeNumericHover(line, i + 1);
    }
    if (ch === "0" && (next === "x" || next === "X") && !/[A-Za-z_$@]/.test(prev)) {
      return computeNumericHover(line, i + 1);
    }
    if (/[0-9]/.test(ch) && !/[A-Za-z_$@0-9]/.test(prev)) {
      return computeNumericHover(line, i + 1);
    }
  }
  return null;
}

function label(h: HoverResult | null): string {
  return h?.contents[0] ?? "";
}

// ---------------------------------------------------------------------------
// Null cases (no hover)
// ---------------------------------------------------------------------------

describe("computeNumericHover — null cases", () => {
  it("returns null for an empty line", () => {
    expect(computeNumericHover("", 1)).toBeNull();
  });

  it("returns null when column is on a non-numeric token", () => {
    expect(computeNumericHover("  ld a, $FF", 3)).toBeNull(); // column on 'l' of 'ld'
  });

  it("returns null only for value === 0", () => {
    // 0 is 0 in every base — nothing useful to show
    expect(computeNumericHover("  ld a, 0", 9)).toBeNull();
    expect(computeNumericHover("  ld a, $0", 9)).toBeNull();
  });

  it("returns non-null for small non-zero values like $3 and 9", () => {
    // $3 is hex — showing "3 decimal" is genuinely useful
    expect(computeNumericHover("  ld a, $3", 9)).not.toBeNull();
    // 9 decimal — showing "$9 hex · binary" is useful too
    expect(computeNumericHover("  ld a, 9", 9)).not.toBeNull();
  });

  it("returns null for numbers inside a comment", () => {
    expect(computeNumericHover("  nop  ; $FF = 255", 10)).toBeNull();
    expect(computeNumericHover("; #4000", 3)).toBeNull();
  });

  it("returns null when column is past end of line", () => {
    expect(computeNumericHover("  nop", 100)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Dollar-prefix hex  $NNNN
// ---------------------------------------------------------------------------

describe("computeNumericHover — $hex", () => {
  it("$FF → decimal and binary", () => {
    const h = hoverOnFirstNum("  ld a, $FF");
    expect(h).not.toBeNull();
    const l = label(h);
    expect(l).toContain("255 decimal");
    expect(l).toContain("%11111111 binary");
  });

  it("$4000 → decimal (no binary for 16-bit)", () => {
    const h = hoverOnFirstNum("  ld hl, $4000");
    const l = label(h);
    expect(l).toContain("16384 decimal");
    expect(l).not.toContain("binary");
  });

  it("$FFFF → 65535", () => {
    const h = hoverOnFirstNum("  ld hl, $FFFF");
    expect(label(h)).toContain("65535 decimal");
  });

  it("label contains the token wrapped in backticks", () => {
    const h = hoverOnFirstNum("  ld a, $FF");
    expect(label(h)).toContain("`$FF`");
  });

  it("case-insensitive: $ff shows same as $FF", () => {
    const h = hoverOnFirstNum("  ld a, $ff");
    expect(label(h)).toContain("255 decimal");
  });
});

// ---------------------------------------------------------------------------
// Hash-prefix hex  #NNNN
// ---------------------------------------------------------------------------

describe("computeNumericHover — #hex", () => {
  it("#FF → decimal and binary", () => {
    const h = hoverOnFirstNum("  ld a, #FF");
    expect(label(h)).toContain("255 decimal");
    expect(label(h)).toContain("%11111111 binary");
  });

  it("#4000 → decimal", () => {
    const h = hoverOnFirstNum("  ld hl, #4000");
    expect(label(h)).toContain("16384 decimal");
  });

  it("label contains `#FF`", () => {
    const h = hoverOnFirstNum("  ld a, #FF");
    expect(label(h)).toContain("`#FF`");
  });
});

// ---------------------------------------------------------------------------
// 0x C-style hex
// ---------------------------------------------------------------------------

describe("computeNumericHover — 0x hex", () => {
  it("0xFF → decimal and binary", () => {
    const h = hoverOnFirstNum("  ld a, 0xFF");
    expect(label(h)).toContain("255 decimal");
    expect(label(h)).toContain("%11111111 binary");
  });

  it("0x4000 → decimal", () => {
    const h = hoverOnFirstNum("  ld hl, 0x4000");
    expect(label(h)).toContain("16384 decimal");
  });
});

// ---------------------------------------------------------------------------
// Hex-suffix  NNNh
// ---------------------------------------------------------------------------

describe("computeNumericHover — hex suffix", () => {
  it("0FFh → decimal and binary", () => {
    const h = hoverOnFirstNum("  ld a, 0FFh");
    expect(label(h)).toContain("255 decimal");
    expect(label(h)).toContain("%11111111 binary");
  });

  it("4000H → decimal", () => {
    const h = hoverOnFirstNum("  ld hl, 4000H");
    expect(label(h)).toContain("16384 decimal");
  });
});

// ---------------------------------------------------------------------------
// Binary  %NNN
// ---------------------------------------------------------------------------

describe("computeNumericHover — binary literals", () => {
  it("%10000000 → hex + decimal", () => {
    const h = hoverOnFirstNum("  ld a, %10000000");
    expect(h).not.toBeNull();
    const l = label(h);
    expect(l).toContain("$80 hex");
    expect(l).toContain("128 decimal");
  });

  it("%01010101 → $55 hex + 85 decimal", () => {
    const h = hoverOnFirstNum("  ld a, %01010101");
    expect(label(h)).toContain("$55 hex");
    expect(label(h)).toContain("85 decimal");
  });

  it("%1111_0000 with underscores → $F0 hex + 240 decimal", () => {
    const h = hoverOnFirstNum("  ld a, %1111_0000");
    expect(label(h)).toContain("$F0 hex");
    expect(label(h)).toContain("240 decimal");
  });

  it("label contains the raw token", () => {
    const h = hoverOnFirstNum("  ld a, %11111111");
    expect(label(h)).toContain("`%11111111`");
  });

  it("hex format does NOT appear in binary sources section", () => {
    // Binary input should show hex, not re-show binary in the output
    const h = hoverOnFirstNum("  ld a, %10000000");
    const l = label(h);
    // Should contain hex and decimal but not a second binary representation
    expect(l).toContain("$80 hex");
    expect(l).not.toContain("binary"); // binary is the SOURCE format, not repeated
  });

  it("%1111000011110000 (16-bit) shows grouped form", () => {
    const l = label(hoverOnFirstNum("  ld hl, %1111000011110000"));
    expect(l).toContain("$F0F0 hex");
    expect(l).toContain("(grouped)");
  });
});

// ---------------------------------------------------------------------------
// Octal  NNNo / NNNq
// ---------------------------------------------------------------------------

describe("computeNumericHover — octal", () => {
  it("377o → hex + decimal", () => {
    const h = hoverOnFirstNum("  ld a, 377o");
    expect(label(h)).toContain("$FF hex");
    expect(label(h)).toContain("255 decimal");
  });

  it("100o → $40 hex + 64 decimal", () => {
    const h = hoverOnFirstNum("  ld a, 100o");
    expect(label(h)).toContain("$40 hex");
    expect(label(h)).toContain("64 decimal");
  });

  it("377Q uppercase suffix", () => {
    const h = hoverOnFirstNum("  ld a, 377Q");
    expect(label(h)).toContain("255 decimal");
  });
});

// ---------------------------------------------------------------------------
// Decimal  NNNN
// ---------------------------------------------------------------------------

describe("computeNumericHover — decimal literals", () => {
  it("255 → hex and binary", () => {
    const h = hoverOnFirstNum("  ld a, 255");
    expect(label(h)).toContain("$FF hex");
    expect(label(h)).toContain("%11111111 binary");
  });

  it("65535 → hex (no binary for 16-bit)", () => {
    const h = hoverOnFirstNum("  ld hl, 65535");
    expect(label(h)).toContain("$FFFF hex");
    expect(label(h)).not.toContain("binary");
  });

  it("16384 → $4000 hex", () => {
    const h = hoverOnFirstNum("  ld hl, 16384");
    expect(label(h)).toContain("$4000 hex");
  });

  it("10 → $A hex and %00001010 binary", () => {
    const h = hoverOnFirstNum("  ld a, 10");
    expect(label(h)).toContain("$A hex");
    expect(label(h)).toContain("%00001010 binary");
  });

  it("label contains the raw decimal token", () => {
    const h = hoverOnFirstNum("  ld a, 255");
    expect(label(h)).toContain("`255`");
  });
});

// ---------------------------------------------------------------------------
// Column boundary: cursor must be WITHIN the token
// ---------------------------------------------------------------------------

describe("computeNumericHover — column boundaries", () => {
  it("returns non-null when column is at the start of the token", () => {
    // "  ld a, $FF" — '$' is at index 8 → column 9
    const col = "  ld a, ".length + 1; // 9
    expect(computeNumericHover("  ld a, $FF", col)).not.toBeNull();
  });

  it("returns non-null when column is at the last char of the token", () => {
    // "  ld a, $FF" — last 'F' is at index 10 → column 11
    const col = "  ld a, $FF".length; // 11
    expect(computeNumericHover("  ld a, $FF", col)).not.toBeNull();
  });

  it("returns null when column is just before the token", () => {
    const col = "  ld a, ".length; // column 8 = ' ' before $
    expect(computeNumericHover("  ld a, $FF", col)).toBeNull();
  });

  it("returns null when column is just after the token", () => {
    const col = "  ld a, $FF".length + 1; // column 12 = after last F
    expect(computeNumericHover("  ld a, $FF", col)).toBeNull();
  });
});
