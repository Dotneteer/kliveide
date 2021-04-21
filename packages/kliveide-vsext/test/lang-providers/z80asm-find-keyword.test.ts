import "mocha";
import * as expect from "expect";
import { Z80AsmKeywords } from './../../src/lang-providers/keywords/z80asm-keyword';


describe("Z80 ASM - 8bits load group", () => {

  it("LD r, r' => reg8 --> reg8", () => {
    expect(Z80AsmKeywords.findKeyword("ld a,b").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld a,c").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld a,d").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld a,e").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld a,h").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld a,l").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld a,a").keyword).toBe("LD r, r'");

    expect(Z80AsmKeywords.findKeyword("ld b,b").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld b,c").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld b,d").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld b,e").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld b,h").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld b,l").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld b,a").keyword).toBe("LD r, r'");

    expect(Z80AsmKeywords.findKeyword("ld c,b").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld c,c").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld c,d").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld c,e").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld c,h").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld c,l").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld c,a").keyword).toBe("LD r, r'");

    expect(Z80AsmKeywords.findKeyword("ld d,b").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld d,c").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld d,d").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld d,e").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld d,h").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld d,l").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld d,a").keyword).toBe("LD r, r'");

    expect(Z80AsmKeywords.findKeyword("ld e,b").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld e,c").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld e,d").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld e,e").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld e,h").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld e,l").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld e,a").keyword).toBe("LD r, r'");

    expect(Z80AsmKeywords.findKeyword("ld h,b").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld h,c").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld h,d").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld h,e").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld h,h").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld h,l").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld h,a").keyword).toBe("LD r, r'");

    expect(Z80AsmKeywords.findKeyword("ld l,b").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld l,c").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld l,d").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld l,e").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld l,h").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld l,l").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld l,a").keyword).toBe("LD r, r'");
  });

  it("LD r,n => NN --> reg8", () => {
    expect(Z80AsmKeywords.findKeyword("ld a,48+#0A").keyword).toBe("LD r,n");
    expect(Z80AsmKeywords.findKeyword("ld b,48+#0A").keyword).toBe("LD r,n");
    expect(Z80AsmKeywords.findKeyword("ld c,48+#0A").keyword).toBe("LD r,n");
    expect(Z80AsmKeywords.findKeyword("ld d,48+#0A").keyword).toBe("LD r,n");
    expect(Z80AsmKeywords.findKeyword("ld e,48+#0A").keyword).toBe("LD r,n");
    expect(Z80AsmKeywords.findKeyword("ld h,48+#0A").keyword).toBe("LD r,n");
    expect(Z80AsmKeywords.findKeyword("ld l,48+#0A").keyword).toBe("LD r,n");
  });

  it("LD r, (HL) => (reg16) --> reg8", () => {
    expect(Z80AsmKeywords.findKeyword("ld a,(hl)").keyword).toBe("LD r, (HL)");
    expect(Z80AsmKeywords.findKeyword("ld b,(hl)").keyword).toBe("LD r, (HL)");
    expect(Z80AsmKeywords.findKeyword("ld c,(hl)").keyword).toBe("LD r, (HL)");
    expect(Z80AsmKeywords.findKeyword("ld d,(hl)").keyword).toBe("LD r, (HL)");
    expect(Z80AsmKeywords.findKeyword("ld e,(hl)").keyword).toBe("LD r, (HL)");
    expect(Z80AsmKeywords.findKeyword("ld h,(hl)").keyword).toBe("LD r, (HL)");
    expect(Z80AsmKeywords.findKeyword("ld l,(hl)").keyword).toBe("LD r, (HL)");
  });

  it("LD r, (IX+d) => (indexed) --> reg8", () => {
    expect(Z80AsmKeywords.findKeyword("ld a,(ix)").keyword).toBe("LD r, (IX+d)");
    expect(Z80AsmKeywords.findKeyword("ld a,(ix+8)").keyword).toBe("LD r, (IX+d)");
    expect(Z80AsmKeywords.findKeyword("ld a,(ix-6)").keyword).toBe("LD r, (IX+d)");

    expect(Z80AsmKeywords.findKeyword("ld b,(ix)").keyword).toBe("LD r, (IX+d)");
    expect(Z80AsmKeywords.findKeyword("ld b,(ix+8)").keyword).toBe("LD r, (IX+d)");
    expect(Z80AsmKeywords.findKeyword("ld b,(ix-6)").keyword).toBe("LD r, (IX+d)");

    expect(Z80AsmKeywords.findKeyword("ld c,(ix)").keyword).toBe("LD r, (IX+d)");
    expect(Z80AsmKeywords.findKeyword("ld c,(ix+8)").keyword).toBe("LD r, (IX+d)");
    expect(Z80AsmKeywords.findKeyword("ld c,(ix-6)").keyword).toBe("LD r, (IX+d)");

    expect(Z80AsmKeywords.findKeyword("ld d,(ix)").keyword).toBe("LD r, (IX+d)");
    expect(Z80AsmKeywords.findKeyword("ld d,(ix+8)").keyword).toBe("LD r, (IX+d)");
    expect(Z80AsmKeywords.findKeyword("ld d,(ix-6)").keyword).toBe("LD r, (IX+d)");

    expect(Z80AsmKeywords.findKeyword("ld e,(ix)").keyword).toBe("LD r, (IX+d)");
    expect(Z80AsmKeywords.findKeyword("ld e,(ix+8)").keyword).toBe("LD r, (IX+d)");
    expect(Z80AsmKeywords.findKeyword("ld e,(ix-6)").keyword).toBe("LD r, (IX+d)");

    expect(Z80AsmKeywords.findKeyword("ld h,(ix)").keyword).toBe("LD r, (IX+d)");
    expect(Z80AsmKeywords.findKeyword("ld h,(ix+8)").keyword).toBe("LD r, (IX+d)");
    expect(Z80AsmKeywords.findKeyword("ld h,(ix-6)").keyword).toBe("LD r, (IX+d)");

    expect(Z80AsmKeywords.findKeyword("ld l,(ix)").keyword).toBe("LD r, (IX+d)");
    expect(Z80AsmKeywords.findKeyword("ld l,(ix+8)").keyword).toBe("LD r, (IX+d)");
    expect(Z80AsmKeywords.findKeyword("ld l,(ix-6)").keyword).toBe("LD r, (IX+d)");
  });

  it("LD r, (IY+d) => (indexed) --> reg8", () => {
    expect(Z80AsmKeywords.findKeyword("ld b,(iy)").keyword).toBe("LD r, (IY+d)");
    expect(Z80AsmKeywords.findKeyword("ld b,(iy+8)").keyword).toBe("LD r, (IY+d)");
    expect(Z80AsmKeywords.findKeyword("ld b,(iy-6)").keyword).toBe("LD r, (IY+d)");

    expect(Z80AsmKeywords.findKeyword("ld c,(iy)").keyword).toBe("LD r, (IY+d)");
    expect(Z80AsmKeywords.findKeyword("ld c,(iy+8)").keyword).toBe("LD r, (IY+d)");
    expect(Z80AsmKeywords.findKeyword("ld c,(iy-6)").keyword).toBe("LD r, (IY+d)");

    expect(Z80AsmKeywords.findKeyword("ld d,(iy)").keyword).toBe("LD r, (IY+d)");
    expect(Z80AsmKeywords.findKeyword("ld d,(iy+8)").keyword).toBe("LD r, (IY+d)");
    expect(Z80AsmKeywords.findKeyword("ld d,(iy-6)").keyword).toBe("LD r, (IY+d)");

    expect(Z80AsmKeywords.findKeyword("ld e,(iy)").keyword).toBe("LD r, (IY+d)");
    expect(Z80AsmKeywords.findKeyword("ld e,(iy+8)").keyword).toBe("LD r, (IY+d)");
    expect(Z80AsmKeywords.findKeyword("ld e,(iy-6)").keyword).toBe("LD r, (IY+d)");

    expect(Z80AsmKeywords.findKeyword("ld h,(iy)").keyword).toBe("LD r, (IY+d)");
    expect(Z80AsmKeywords.findKeyword("ld h,(iy+8)").keyword).toBe("LD r, (IY+d)");
    expect(Z80AsmKeywords.findKeyword("ld h,(iy-6)").keyword).toBe("LD r, (IY+d)");

    expect(Z80AsmKeywords.findKeyword("ld l,(iy)").keyword).toBe("LD r, (IY+d)");
    expect(Z80AsmKeywords.findKeyword("ld l,(iy+8)").keyword).toBe("LD r, (IY+d)");
    expect(Z80AsmKeywords.findKeyword("ld l,(iy-6)").keyword).toBe("LD r, (IY+d)");

    expect(Z80AsmKeywords.findKeyword("ld a,(iy)").keyword).toBe("LD r, (IY+d)");
    expect(Z80AsmKeywords.findKeyword("ld a,(iy+8)").keyword).toBe("LD r, (IY+d)");
    expect(Z80AsmKeywords.findKeyword("ld a,(iy-6)").keyword).toBe("LD r, (IY+d)");
  });

  it("LD (HL), r => reg8 --> (reg16)", () => {
    expect(Z80AsmKeywords.findKeyword("ld (hl),a").keyword).toBe("LD (HL), r");
    expect(Z80AsmKeywords.findKeyword("ld (hl),b").keyword).toBe("LD (HL), r");
    expect(Z80AsmKeywords.findKeyword("ld (hl),c").keyword).toBe("LD (HL), r");
    expect(Z80AsmKeywords.findKeyword("ld (hl),d").keyword).toBe("LD (HL), r");
    expect(Z80AsmKeywords.findKeyword("ld (hl),e").keyword).toBe("LD (HL), r");
    expect(Z80AsmKeywords.findKeyword("ld (hl),h").keyword).toBe("LD (HL), r");
    expect(Z80AsmKeywords.findKeyword("ld (hl),l").keyword).toBe("LD (HL), r");
  });

  it("LD (IX+d), r => reg8 --> (indexed)", () => {
    expect(Z80AsmKeywords.findKeyword("ld (ix),a,").keyword).toBe("LD (IX+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (ix+8),a").keyword).toBe("LD (IX+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (ix-6),a").keyword).toBe("LD (IX+d), r");

    expect(Z80AsmKeywords.findKeyword("ld (ix),b,").keyword).toBe("LD (IX+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (ix+8),b").keyword).toBe("LD (IX+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (ix-6),b").keyword).toBe("LD (IX+d), r");

    expect(Z80AsmKeywords.findKeyword("ld (ix),c,").keyword).toBe("LD (IX+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (ix+8),c").keyword).toBe("LD (IX+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (ix-6),c").keyword).toBe("LD (IX+d), r");

    expect(Z80AsmKeywords.findKeyword("ld (ix),d,").keyword).toBe("LD (IX+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (ix+8),d").keyword).toBe("LD (IX+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (ix-6),d").keyword).toBe("LD (IX+d), r");

    expect(Z80AsmKeywords.findKeyword("ld (ix),e,").keyword).toBe("LD (IX+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (ix+8),e").keyword).toBe("LD (IX+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (ix-6),e").keyword).toBe("LD (IX+d), r");

    expect(Z80AsmKeywords.findKeyword("ld (ix),h,").keyword).toBe("LD (IX+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (ix+8),h").keyword).toBe("LD (IX+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (ix-6),h").keyword).toBe("LD (IX+d), r");

    expect(Z80AsmKeywords.findKeyword("ld (ix),l,").keyword).toBe("LD (IX+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (ix+8),l").keyword).toBe("LD (IX+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (ix-6),l").keyword).toBe("LD (IX+d), r");
  });

  it("LD (IY+d), r => reg8 --> (indexed)", () => {
    expect(Z80AsmKeywords.findKeyword("ld (iy),a").keyword).toBe("LD (IY+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (iy+8),a").keyword).toBe("LD (IY+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (iy-6),a").keyword).toBe("LD (IY+d), r");

    expect(Z80AsmKeywords.findKeyword("ld (iy),b,").keyword).toBe("LD (IY+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (iy+8),b").keyword).toBe("LD (IY+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (iy-6),b").keyword).toBe("LD (IY+d), r");

    expect(Z80AsmKeywords.findKeyword("ld (iy),c").keyword).toBe("LD (IY+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (iy+8),c").keyword).toBe("LD (IY+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (iy-6),c").keyword).toBe("LD (IY+d), r");

    expect(Z80AsmKeywords.findKeyword("ld (iy),d").keyword).toBe("LD (IY+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (iy+8),d").keyword).toBe("LD (IY+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (iy-6),d").keyword).toBe("LD (IY+d), r");

    expect(Z80AsmKeywords.findKeyword("ld (iy),e").keyword).toBe("LD (IY+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (iy+8),e").keyword).toBe("LD (IY+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (iy-6),e").keyword).toBe("LD (IY+d), r");

    expect(Z80AsmKeywords.findKeyword("ld (iy),h").keyword).toBe("LD (IY+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (iy+8),h").keyword).toBe("LD (IY+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (iy-6),h").keyword).toBe("LD (IY+d), r");

    expect(Z80AsmKeywords.findKeyword("ld (iy),l").keyword).toBe("LD (IY+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (iy+8),l").keyword).toBe("LD (IY+d), r");
    expect(Z80AsmKeywords.findKeyword("ld (iy-6),l").keyword).toBe("LD (IY+d), r");
  });

  it("LD (HL), n => NN --> (hl)", () => {
    expect(Z80AsmKeywords.findKeyword("ld (hl),48+#0A").keyword).toBe("LD (HL), n");
    expect(Z80AsmKeywords.findKeyword("ld (hl),5").keyword).toBe("LD (HL), n");
  });

  it("LD (IX+d), n => NN --> (indexed)", () => {
    expect(Z80AsmKeywords.findKeyword("ld (ix),#23").keyword).toBe("LD (IX+d), n");
    expect(Z80AsmKeywords.findKeyword("ld (ix+8),#23").keyword).toBe("LD (IX+d), n");
    expect(Z80AsmKeywords.findKeyword("ld (ix-6),#23").keyword).toBe("LD (IX+d), n");
  });

  it("LD (IY+d), n => NN --> (indexed)", () => {
    expect(Z80AsmKeywords.findKeyword("ld (iy),#23").keyword).toBe("LD (IY+d), n");
    expect(Z80AsmKeywords.findKeyword("ld (iy+8),#23").keyword).toBe("LD (IY+d), n");
    expect(Z80AsmKeywords.findKeyword("ld (iy-6),#23").keyword).toBe("LD (IY+d), n");
  });

  it("LD A, (BC) => (reg16) --> reg8", () => {
    expect(Z80AsmKeywords.findKeyword("ld a,(bc)").keyword).toBe("LD A, (BC)");
  });

  it("LD A, (DE) => (reg16) --> reg8", () => {
    expect(Z80AsmKeywords.findKeyword("ld a,(de)").keyword).toBe("LD A, (DE)");
  });

  it("LD A, (nn) =>  (NNNN) --> reg8", () => {
    expect(Z80AsmKeywords.findKeyword("ld a,(#4000)").keyword).toBe("LD A, (nn)");
  });

  it("LD (BC), A => reg8 --> (reg16)", () => {
    expect(Z80AsmKeywords.findKeyword("ld (bc),a").keyword).toBe("LD (BC), A");
  });

  it("LD (DE), A => reg8 --> (reg16)", () => {
    expect(Z80AsmKeywords.findKeyword("ld (de),a").keyword).toBe("LD (DE), A");
  });

  it("LD (nn), A  => reg8 --> (NNNN)", () => {
    expect(Z80AsmKeywords.findKeyword("ld (#4000),a").keyword).toBe("LD (nn), A");
  });

  it("LD A, I  => spec/reg8", () => {
    expect(Z80AsmKeywords.findKeyword("ld a,i").keyword).toBe("LD A, I");
  });

  it("LD A, R  => spec/reg8", () => {
    expect(Z80AsmKeywords.findKeyword("ld a,r").keyword).toBe("LD A, R");
  });

  it("LD I, A  => spec/reg8", () => {
    expect(Z80AsmKeywords.findKeyword("ld i,a").keyword).toBe("LD I,A");
  });

  it("LD R, A  => spec/reg8", () => {
    expect(Z80AsmKeywords.findKeyword("ld r,a").keyword).toBe("LD R, A");
  });

});


describe("Z80 ASM - 16bits load group", () => {

  it("LD dd, nn => NN --> reg16", () => {
    expect(Z80AsmKeywords.findKeyword("ld bc,#1000*2+#34").keyword).toBe("LD dd, nn");
    expect(Z80AsmKeywords.findKeyword("ld de,#1000*2+#34").keyword).toBe("LD dd, nn");
    expect(Z80AsmKeywords.findKeyword("ld sp,#1000*2+#34").keyword).toBe("LD dd, nn");
  });

  it("LD IX, nn => NN --> reg16", () => {
    expect(Z80AsmKeywords.findKeyword("ld ix,#1000*2+#34").keyword).toBe("LD IX, nn");
    expect(Z80AsmKeywords.findKeyword("ld ix,5").keyword).toBe("LD IX, nn");
  });

  it("LD IY, nn => NN --> reg16", () => {
    expect(Z80AsmKeywords.findKeyword("ld iy,#1000*2+#34").keyword).toBe("LD IY, nn");
    expect(Z80AsmKeywords.findKeyword("ld iy,5").keyword).toBe("LD IY, nn");
  });

  it("LD HL, (nn) => (NNNN) --> reg16", () => {
    expect(Z80AsmKeywords.findKeyword("ld HL,(#4000+32)").keyword).toBe("LD HL, (nn)");
    expect(Z80AsmKeywords.findKeyword("ld HL,#1000*2+#34").keyword).toBe("LD HL, (nn)");
  });

  it("LD dd, (nn) => (NNNN) --> reg16", () => {
    expect(Z80AsmKeywords.findKeyword("ld bc,(#4000+32)").keyword).toBe("LD dd, (nn)");
    expect(Z80AsmKeywords.findKeyword("ld de,(#4000+32)").keyword).toBe("LD dd, (nn)");
    expect(Z80AsmKeywords.findKeyword("ld sp,(#4000+32)").keyword).toBe("LD dd, (nn)");
  });

  it("LD IX, (nn) => (NNNN) --> reg16", () => {
    expect(Z80AsmKeywords.findKeyword("ld ix,(#4000+32)").keyword).toBe("LD IX, (nn)");
  });

  it("LD IY, (nn) => (NNNN) --> reg16", () => {
    expect(Z80AsmKeywords.findKeyword("ld iy,(#4000+32)").keyword).toBe("LD IY, (nn)");
  });

  it("LD (nn), HL => (NNNN) --> reg16", () => {
    expect(Z80AsmKeywords.findKeyword("ld (#4000+32), hl").keyword).toBe("LD (nn), HL");
    expect(Z80AsmKeywords.findKeyword("ld #1000*2+#34, hl").keyword).toBe("LD (nn), HL");
  });

  it("LD (nn), dd => NN --> reg16", () => {
    expect(Z80AsmKeywords.findKeyword("ld #1000*2+#34, bc").keyword).toBe("LD (nn), dd");
    expect(Z80AsmKeywords.findKeyword("ld #1000*2+#34, de").keyword).toBe("LD (nn), dd");
    expect(Z80AsmKeywords.findKeyword("ld #1000*2+#34, sp").keyword).toBe("LD (nn), dd");
  });

  it("LD (nn), IX => (NNNN) --> reg16", () => {
    expect(Z80AsmKeywords.findKeyword("ld (#4000+32), ix").keyword).toBe("LD (nn), IX");
  });

  it("LD (nn), IY => (NNNN) --> reg16", () => {
    expect(Z80AsmKeywords.findKeyword("ld (#4000+32),iy").keyword).toBe("LD (nn), IY");
  });

  it("LD SP, HL => (NNNN) --> reg16", () => {
    expect(Z80AsmKeywords.findKeyword("ld sp, hl").keyword).toBe("LD SP, HL");
  });

  it("LD SP, IX => (NNNN) --> reg16", () => {
    expect(Z80AsmKeywords.findKeyword("ld sp, ix").keyword).toBe("LD SP, IX");
  });

  it("LD SP, IY => (NNNN) --> reg16", () => {
    expect(Z80AsmKeywords.findKeyword("ld sp, iy").keyword).toBe("LD SP, IY");
  });

  it("PUSH qq => (NNNN) --> reg16", () => {
    expect(Z80AsmKeywords.findKeyword("push bc").keyword).toBe("PUSH qq");
    expect(Z80AsmKeywords.findKeyword("push de").keyword).toBe("PUSH qq");
    expect(Z80AsmKeywords.findKeyword("push hl").keyword).toBe("PUSH qq");
    expect(Z80AsmKeywords.findKeyword("push af").keyword).toBe("PUSH qq");
  });

  it("PUSH IX => (NNNN) --> reg16", () => {
    expect(Z80AsmKeywords.findKeyword("push ix ").keyword).toBe("PUSH IX");
  });

  it("PUSH IY => (NNNN) --> reg16", () => {
    expect(Z80AsmKeywords.findKeyword("push iy").keyword).toBe("PUSH IY");
  });

  it("POP qq => (NNNN) --> reg16", () => {
    expect(Z80AsmKeywords.findKeyword("pop bc").keyword).toBe("POP qq");
    expect(Z80AsmKeywords.findKeyword("pop de").keyword).toBe("POP qq");
    expect(Z80AsmKeywords.findKeyword("pop hl").keyword).toBe("POP qq");
    expect(Z80AsmKeywords.findKeyword("pop af").keyword).toBe("POP qq");
  });

  it("POP IX => (NNNN) --> reg16", () => {
    expect(Z80AsmKeywords.findKeyword("pop ix ").keyword).toBe("POP IX");
  });

  it("POP IY => (NNNN) --> reg16", () => {
    expect(Z80AsmKeywords.findKeyword("pop iy").keyword).toBe("POP IY");
  });

});


describe("Z80 ASM - Exchange, Block Transfer, and Search Group", () => {

  it("EX DE, HL  => spec/reg8", () => {
    expect(Z80AsmKeywords.findKeyword("ex de, hl").keyword).toBe("EX DE, HL");
  });

  it("EX AF, AF'  => spec/reg8", () => {
    expect(Z80AsmKeywords.findKeyword("ex af,af'").keyword).toBe("EX AF, AF'");
  });

  it("EXX  => spec/reg8", () => {
    expect(Z80AsmKeywords.findKeyword("exx").keyword).toBe("EXX");
  });

  it("EX (SP), HL  => spec/reg8", () => {
    expect(Z80AsmKeywords.findKeyword("ex (sp), hl").keyword).toBe("EX (SP), HL");
  });

  it("EX (SP), IX  => spec/reg8", () => {
    expect(Z80AsmKeywords.findKeyword("ex (sp), ix").keyword).toBe("EX (SP), IX");
  });

  it("EX (SP), IY  => spec/reg8", () => {
    expect(Z80AsmKeywords.findKeyword("ex (sp), iy").keyword).toBe("EX (SP), IY");
  });

  it("LDI  => spec/reg8", () => {
    expect(Z80AsmKeywords.findKeyword("ldi").keyword).toBe("LDI");
  });

  it("LDIR  => spec/reg8", () => {
    expect(Z80AsmKeywords.findKeyword("ldir").keyword).toBe("LDIR");
  });

  it("LDD  => spec/reg8", () => {
    expect(Z80AsmKeywords.findKeyword("ldd").keyword).toBe("LDD");
  });

  it("LDDR  => spec/reg8", () => {
    expect(Z80AsmKeywords.findKeyword("lddr").keyword).toBe("LDDR");
  });

  it("CPI  => spec/reg8", () => {
    expect(Z80AsmKeywords.findKeyword("cpi").keyword).toBe("CPI");
  });

  it("CPIR  => spec/reg8", () => {
    expect(Z80AsmKeywords.findKeyword("cpir").keyword).toBe("CPIR");
  });

  it("CPD  => spec/reg8", () => {
    expect(Z80AsmKeywords.findKeyword("cpd").keyword).toBe("CPD");
  });

  it("CPDR  => spec/reg8", () => {
    expect(Z80AsmKeywords.findKeyword("cpdr").keyword).toBe("CPDR");
  });

});
