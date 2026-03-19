import { describe, it, expect } from "vitest";
import { lookupTstates } from "@renderer/appIde/services/z80-tstates-data";

describe("lookupTstates", () => {
  // --- Basic standard instructions ---

  it("nop → 4 T-states", () => {
    expect(lookupTstates("  nop")).toEqual({ t: 4 });
  });

  it("halt → 4 T-states", () => {
    expect(lookupTstates("halt")).toEqual({ t: 4 });
  });

  it("ld a,b → 4 T-states", () => {
    expect(lookupTstates("  ld a, b")).toEqual({ t: 4 });
  });

  it("ld a,(hl) → 7 T-states", () => {
    expect(lookupTstates("  ld a, (hl)")).toEqual({ t: 7 });
  });

  it("ld bc,1234h → 10 T-states (immediate)", () => {
    expect(lookupTstates("  ld bc, $1234")).toEqual({ t: 10 });
  });

  // --- Conditional instructions with two T-state values ---

  it("djnz label → 13/8 T-states", () => {
    const ts = lookupTstates("  djnz myLoop");
    expect(ts).toEqual({ t: 13, t2: 8 });
  });

  it("jr nz,label → 12/7 T-states", () => {
    const ts = lookupTstates("  jr nz, skip");
    expect(ts).toEqual({ t: 12, t2: 7 });
  });

  it("jr z,label → 12/7 T-states", () => {
    const ts = lookupTstates("  jr z, label");
    expect(ts).toEqual({ t: 12, t2: 7 });
  });

  it("jr nc,label → 12/7 T-states", () => {
    expect(lookupTstates("  jr nc, back")).toEqual({ t: 12, t2: 7 });
  });

  it("jr c,label → 12/7 T-states", () => {
    expect(lookupTstates("  jr c, fwd")).toEqual({ t: 12, t2: 7 });
  });

  it("call nz,addr → 17/10 T-states", () => {
    expect(lookupTstates("  call nz, $1234")).toEqual({ t: 17, t2: 10 });
  });

  it("ret nz → 11/5 T-states", () => {
    expect(lookupTstates("  ret nz")).toEqual({ t: 11, t2: 5 });
  });

  it("ret → 10 T-states (unconditional)", () => {
    expect(lookupTstates("  ret")).toEqual({ t: 10 });
  });

  // --- Unconditional jumps/calls ---

  it("jr label → 12 T-states (unconditional)", () => {
    expect(lookupTstates("  jr loop")).toEqual({ t: 12 });
  });

  it("jp addr → 10 T-states", () => {
    expect(lookupTstates("  jp $0000")).toEqual({ t: 10 });
  });

  it("call addr → 17 T-states", () => {
    expect(lookupTstates("  call myFunc")).toEqual({ t: 17 });
  });

  // --- Comments and labels are handled ---

  it("strips trailing comment", () => {
    expect(lookupTstates("  ld a, b  ; load B into A")).toEqual({ t: 4 });
  });

  it("strips leading label with colon", () => {
    expect(lookupTstates("loop: djnz loop")).toEqual({ t: 13, t2: 8 });
  });

  it("strips leading label without colon", () => {
    expect(lookupTstates("entry nop")).toEqual({ t: 4 });
  });

  // --- CB prefix (bit operations) ---

  it("rlc b → 8 T-states", () => {
    expect(lookupTstates("  rlc b")).toEqual({ t: 8 });
  });

  it("rl (hl) → 15 T-states", () => {
    expect(lookupTstates("  rl (hl)")).toEqual({ t: 15 });
  });

  it("bit 3,a → 8 T-states", () => {
    expect(lookupTstates("  bit 3, a")).toEqual({ t: 8 });
  });

  it("bit 0,(hl) → 12 T-states", () => {
    expect(lookupTstates("  bit 0, (hl)")).toEqual({ t: 12 });
  });

  it("set 7,b → 8 T-states", () => {
    expect(lookupTstates("  set 7, b")).toEqual({ t: 8 });
  });

  it("res 4,(hl) → 15 T-states", () => {
    expect(lookupTstates("  res 4, (hl)")).toEqual({ t: 15 });
  });

  // --- ED prefix (extended) ---

  it("neg → 8 T-states", () => {
    expect(lookupTstates("  neg")).toEqual({ t: 8 });
  });

  it("ldir → 21/16 T-states", () => {
    expect(lookupTstates("  ldir")).toEqual({ t: 21, t2: 16 });
  });

  it("reti → 14 T-states", () => {
    expect(lookupTstates("  reti")).toEqual({ t: 14 });
  });

  it("in a,(c) → 12 T-states", () => {
    expect(lookupTstates("  in a, (c)")).toEqual({ t: 12 });
  });

  it("sbc hl,de → 15 T-states", () => {
    expect(lookupTstates("  sbc hl, de")).toEqual({ t: 15 });
  });

  it("ld a,i → 9 T-states", () => {
    expect(lookupTstates("  ld a, i")).toEqual({ t: 9 });
  });

  // --- IX/IY indexed ---

  it("ld ix,1234h → 14 T-states", () => {
    expect(lookupTstates("  ld ix, $1234")).toEqual({ t: 14 });
  });

  it("ld a,(ix+5) → 19 T-states", () => {
    expect(lookupTstates("  ld a, (ix+5)")).toEqual({ t: 19 });
  });

  it("ld (iy-3),b → 19 T-states", () => {
    expect(lookupTstates("  ld (iy-3), b")).toEqual({ t: 19 });
  });

  it("add ix,bc → 15 T-states", () => {
    expect(lookupTstates("  add ix, bc")).toEqual({ t: 15 });
  });

  it("pop iy → 14 T-states", () => {
    expect(lookupTstates("  pop iy")).toEqual({ t: 14 });
  });

  it("push ix → 15 T-states", () => {
    expect(lookupTstates("  push ix")).toEqual({ t: 15 });
  });

  it("inc (ix+0) → 23 T-states", () => {
    expect(lookupTstates("  inc (ix+0)")).toEqual({ t: 23 });
  });

  it("add a,(iy+10) → 19 T-states", () => {
    expect(lookupTstates("  add a, (iy+10)")).toEqual({ t: 19 });
  });

  // --- IX/IY undocumented half-registers ---

  it("ld a,xh → 8 T-states", () => {
    expect(lookupTstates("  ld a, xh")).toEqual({ t: 8 });
  });

  it("add a,yl → 8 T-states", () => {
    expect(lookupTstates("  add a, yl")).toEqual({ t: 8 });
  });

  // --- DDCB/FDCB indexed bit operations ---

  it("rlc (ix+3) → 23 T-states", () => {
    expect(lookupTstates("  rlc (ix+3)")).toEqual({ t: 23 });
  });

  it("bit 5,(iy+0) → 20 T-states", () => {
    expect(lookupTstates("  bit 5, (iy+0)")).toEqual({ t: 20 });
  });

  it("set 2,(ix+1) → 23 T-states", () => {
    expect(lookupTstates("  set 2, (ix+1)")).toEqual({ t: 23 });
  });

  // --- ZX Spectrum Next ---

  it("swapnib → 8 T-states", () => {
    expect(lookupTstates("  swapnib")).toEqual({ t: 8 });
  });

  it("mul d,e → 8 T-states", () => {
    expect(lookupTstates("  mul d, e")).toEqual({ t: 8 });
  });

  it("nextreg $12,$34 → 20 T-states", () => {
    expect(lookupTstates("  nextreg $12, $34")).toEqual({ t: 20 });
  });

  it("nextreg $12,a → 17 T-states", () => {
    expect(lookupTstates("  nextreg $12, a")).toEqual({ t: 17 });
  });

  it("ldirx → 21/16 T-states", () => {
    expect(lookupTstates("  ldirx")).toEqual({ t: 21, t2: 16 });
  });

  it("test $aa → 11 T-states", () => {
    expect(lookupTstates("  test $aa")).toEqual({ t: 11 });
  });

  // --- Edge cases ---

  it("returns null for empty line", () => {
    expect(lookupTstates("")).toBeNull();
  });

  it("returns null for comment-only line", () => {
    expect(lookupTstates("  ; just a comment")).toBeNull();
  });

  it("returns null for a directive", () => {
    expect(lookupTstates("  .org $8000")).toBeNull();
  });

  it("handles uppercase mnemonics", () => {
    expect(lookupTstates("  LD A, B")).toEqual({ t: 4 });
  });

  it("handles mixed case", () => {
    expect(lookupTstates("  Ld A, (Hl)")).toEqual({ t: 7 });
  });

  // --- ALU with immediates ---

  it("add a,$42 → 7 T-states", () => {
    expect(lookupTstates("  add a, $42")).toEqual({ t: 7 });
  });

  it("and $ff → 7 T-states", () => {
    expect(lookupTstates("  and $ff")).toEqual({ t: 7 });
  });

  it("cp 0 → 7 T-states", () => {
    expect(lookupTstates("  cp 0")).toEqual({ t: 7 });
  });

  // --- RST ---

  it("rst $08 → 11 T-states", () => {
    expect(lookupTstates("  rst $08")).toEqual({ t: 11 });
  });

  // --- Stack ops ---

  it("push bc → 11 T-states", () => {
    expect(lookupTstates("  push bc")).toEqual({ t: 11 });
  });

  it("pop hl → 10 T-states", () => {
    expect(lookupTstates("  pop hl")).toEqual({ t: 10 });
  });

  // --- Exchange ---

  it("ex de,hl → 4 T-states", () => {
    expect(lookupTstates("  ex de, hl")).toEqual({ t: 4 });
  });

  it("ex (sp),hl → 19 T-states", () => {
    expect(lookupTstates("  ex (sp), hl")).toEqual({ t: 19 });
  });

  it("exx → 4 T-states", () => {
    expect(lookupTstates("  exx")).toEqual({ t: 4 });
  });

  // --- Interrupt mode ---

  it("im 1 → 8 T-states", () => {
    expect(lookupTstates("  im 1")).toEqual({ t: 8 });
  });
});

describe("lookupTstates — integration with computeHover", () => {
  it("T-states info is added to instruction hover when line is provided", async () => {
    // Import computeHover dynamically to avoid full provider registration
    const { computeHover } = await import("@renderer/appIde/services/z80-providers");
    const { LanguageIntelService } = await import("@renderer/appIde/services/LanguageIntelService");
    const svc = new LanguageIntelService();

    const result = computeHover("ld", svc, undefined, undefined, "  ld a, (hl)");
    expect(result).not.toBeNull();
    const text = result!.contents.join("\n");
    expect(text).toContain("T-states");
    expect(text).toContain("7");
  });

  it("conditional T-states shows both values", async () => {
    const { computeHover } = await import("@renderer/appIde/services/z80-providers");
    const { LanguageIntelService } = await import("@renderer/appIde/services/LanguageIntelService");
    const svc = new LanguageIntelService();

    const result = computeHover("jr", svc, undefined, undefined, "  jr nz, label");
    expect(result).not.toBeNull();
    const text = result!.contents.join("\n");
    expect(text).toContain("T-states");
    expect(text).toContain("12");
    expect(text).toContain("7");
    expect(text).toMatch(/met.*not met/);
  });

  it("no T-states line when lineContent is omitted (backward compat)", async () => {
    const { computeHover } = await import("@renderer/appIde/services/z80-providers");
    const { LanguageIntelService } = await import("@renderer/appIde/services/LanguageIntelService");
    const svc = new LanguageIntelService();

    const result = computeHover("ld", svc);
    expect(result).not.toBeNull();
    const text = result!.contents.join("\n");
    expect(text).not.toContain("T-states");
  });
});
