import "mocha";
import * as expect from "expect";
import { Z80AsmKeywords } from './../../src/lang-providers/keywords/z80asm-keyword';


describe("Z80 ASM - 8bits load group", () => {

  it("LD r, r' => reg8 --> reg8", () => {
    expect(Z80AsmKeywords.findKeyword("ld a,a").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld a,b").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld a,c").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld a,d").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld a,e").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld a,h").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld a,l").keyword).toBe("LD r, r'");

    expect(Z80AsmKeywords.findKeyword("ld b,a").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld b,b").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld b,c").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld b,d").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld b,e").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld b,h").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld b,l").keyword).toBe("LD r, r'");

    expect(Z80AsmKeywords.findKeyword("ld c,a").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld c,b").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld c,c").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld c,d").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld c,e").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld c,h").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld c,l").keyword).toBe("LD r, r'");

    expect(Z80AsmKeywords.findKeyword("ld d,a").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld d,b").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld d,c").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld d,d").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld d,e").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld d,h").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld d,l").keyword).toBe("LD r, r'");

    expect(Z80AsmKeywords.findKeyword("ld e,a").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld e,b").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld e,c").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld e,d").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld e,e").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld e,h").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld e,l").keyword).toBe("LD r, r'");

    expect(Z80AsmKeywords.findKeyword("ld h,a").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld h,b").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld h,c").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld h,d").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld h,e").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld h,h").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld h,l").keyword).toBe("LD r, r'");

    expect(Z80AsmKeywords.findKeyword("ld l,a").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld l,b").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld l,c").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld l,d").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld l,e").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld l,h").keyword).toBe("LD r, r'");
    expect(Z80AsmKeywords.findKeyword("ld l,l").keyword).toBe("LD r, r'");

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


describe("Z80 ASM - 8-Bit Arithmetic Group", () => {

  it("ADD A, r", () => {
    expect(Z80AsmKeywords.findKeyword("add a,a").keyword).toBe("ADD A, r");
    expect(Z80AsmKeywords.findKeyword("add a,b").keyword).toBe("ADD A, r");
    expect(Z80AsmKeywords.findKeyword("add a,c").keyword).toBe("ADD A, r");
    expect(Z80AsmKeywords.findKeyword("add a,d").keyword).toBe("ADD A, r");
    expect(Z80AsmKeywords.findKeyword("add a,e").keyword).toBe("ADD A, r");
    expect(Z80AsmKeywords.findKeyword("add a,h").keyword).toBe("ADD A, r");
    expect(Z80AsmKeywords.findKeyword("add a,l").keyword).toBe("ADD A, r");
  });

  it("ADD A, n ", () => {
    expect(Z80AsmKeywords.findKeyword("add a,48+#0A").keyword).toBe("ADD A, n");
    expect(Z80AsmKeywords.findKeyword("add a,128").keyword).toBe("ADD A, n");
  });

  it("ADD A, (HL)", () => {
    expect(Z80AsmKeywords.findKeyword("add a,(hl)").keyword).toBe("ADD A, (HL)");
  });

  it("ADD A, (IX + d)", () => {
    expect(Z80AsmKeywords.findKeyword("add a,(ix)").keyword).toBe("ADD A, (IX + d)");
    expect(Z80AsmKeywords.findKeyword("add a,(ix+#0A)").keyword).toBe("ADD A, (IX + d)");
    expect(Z80AsmKeywords.findKeyword("add a,(ix-8)").keyword).toBe("ADD A, (IX + d)");
  });

  it("ADD A, (IY + d)", () => {
    expect(Z80AsmKeywords.findKeyword("add a,(iy)").keyword).toBe("ADD A, (IY + d)");
    expect(Z80AsmKeywords.findKeyword("add a,(iy+#0A)").keyword).toBe("ADD A, (IY + d)");
    expect(Z80AsmKeywords.findKeyword("add a,(iy-8)").keyword).toBe("ADD A, (IY + d)");
  });

  it("ADC A, s", () => {
    expect(Z80AsmKeywords.findKeyword("adc a,a").keyword).toBe("ADC A, s");
    expect(Z80AsmKeywords.findKeyword("adc a,b").keyword).toBe("ADC A, s");
    expect(Z80AsmKeywords.findKeyword("adc a,c").keyword).toBe("ADC A, s");
    expect(Z80AsmKeywords.findKeyword("adc a,d").keyword).toBe("ADC A, s");
    expect(Z80AsmKeywords.findKeyword("adc a,e").keyword).toBe("ADC A, s");
    expect(Z80AsmKeywords.findKeyword("adc a,h").keyword).toBe("ADC A, s");
    expect(Z80AsmKeywords.findKeyword("adc a,l").keyword).toBe("ADC A, s");

    expect(Z80AsmKeywords.findKeyword("adc a,48+#0A").keyword).toBe("ADC A, s");

    expect(Z80AsmKeywords.findKeyword("adc a,(ix)").keyword).toBe("ADC A, s");
    expect(Z80AsmKeywords.findKeyword("adc a,(ix+#0A)").keyword).toBe("ADC A, s");
    expect(Z80AsmKeywords.findKeyword("adc a,(ix-8)").keyword).toBe("ADC A, s");

    expect(Z80AsmKeywords.findKeyword("adc a,(iy)").keyword).toBe("ADC A, s");
    expect(Z80AsmKeywords.findKeyword("adc a,(iy+#0A)").keyword).toBe("ADC A, s");
    expect(Z80AsmKeywords.findKeyword("adc a,(iy-8)").keyword).toBe("ADC A, s");
  });

  it("SUB s", () => {
    expect(Z80AsmKeywords.findKeyword("sub a").keyword).toBe("SUB s");
    expect(Z80AsmKeywords.findKeyword("sub b").keyword).toBe("SUB s");
    expect(Z80AsmKeywords.findKeyword("sub c").keyword).toBe("SUB s");
    expect(Z80AsmKeywords.findKeyword("sub d").keyword).toBe("SUB s");
    expect(Z80AsmKeywords.findKeyword("sub e").keyword).toBe("SUB s");
    expect(Z80AsmKeywords.findKeyword("sub h").keyword).toBe("SUB s");
    expect(Z80AsmKeywords.findKeyword("sub l").keyword).toBe("SUB s");

    expect(Z80AsmKeywords.findKeyword("sub 48+#0A").keyword).toBe("SUB s");

    expect(Z80AsmKeywords.findKeyword("sub (ix)").keyword).toBe("SUB s");
    expect(Z80AsmKeywords.findKeyword("sub (ix+#0A)").keyword).toBe("SUB s");
    expect(Z80AsmKeywords.findKeyword("sub (ix-8)").keyword).toBe("SUB s");

    expect(Z80AsmKeywords.findKeyword("sub (iy)").keyword).toBe("SUB s");
    expect(Z80AsmKeywords.findKeyword("sub (iy+#0A)").keyword).toBe("SUB s");
    expect(Z80AsmKeywords.findKeyword("sub (iy-8)").keyword).toBe("SUB s");
  });

  it("SBC A, s", () => {
    expect(Z80AsmKeywords.findKeyword("sbc a,a").keyword).toBe("SBC A, s");
    expect(Z80AsmKeywords.findKeyword("sbc a,b").keyword).toBe("SBC A, s");
    expect(Z80AsmKeywords.findKeyword("sbc a,c").keyword).toBe("SBC A, s");
    expect(Z80AsmKeywords.findKeyword("sbc a,d").keyword).toBe("SBC A, s");
    expect(Z80AsmKeywords.findKeyword("sbc a,e").keyword).toBe("SBC A, s");
    expect(Z80AsmKeywords.findKeyword("sbc a,h").keyword).toBe("SBC A, s");
    expect(Z80AsmKeywords.findKeyword("sbc a,l").keyword).toBe("SBC A, s");

    expect(Z80AsmKeywords.findKeyword("sbc a,48+#0A").keyword).toBe("SBC A, s");

    expect(Z80AsmKeywords.findKeyword("sbc a,(ix)").keyword).toBe("SBC A, s");
    expect(Z80AsmKeywords.findKeyword("sbc a,(ix+#0A)").keyword).toBe("SBC A, s");
    expect(Z80AsmKeywords.findKeyword("sbc a,(ix-8)").keyword).toBe("SBC A, s");

    expect(Z80AsmKeywords.findKeyword("sbc a,(iy)").keyword).toBe("SBC A, s");
    expect(Z80AsmKeywords.findKeyword("sbc a,(iy+#0A)").keyword).toBe("SBC A, s");
    expect(Z80AsmKeywords.findKeyword("sbc a,(iy-8)").keyword).toBe("SBC A, s");
  });

  it("AND s", () => {
    expect(Z80AsmKeywords.findKeyword("and a").keyword).toBe("AND s");
    expect(Z80AsmKeywords.findKeyword("and b").keyword).toBe("AND s");
    expect(Z80AsmKeywords.findKeyword("and c").keyword).toBe("AND s");
    expect(Z80AsmKeywords.findKeyword("and d").keyword).toBe("AND s");
    expect(Z80AsmKeywords.findKeyword("and e").keyword).toBe("AND s");
    expect(Z80AsmKeywords.findKeyword("and h").keyword).toBe("AND s");
    expect(Z80AsmKeywords.findKeyword("and l").keyword).toBe("AND s");

    expect(Z80AsmKeywords.findKeyword("and 48+#0A").keyword).toBe("AND s");

    expect(Z80AsmKeywords.findKeyword("and (ix)").keyword).toBe("AND s");
    expect(Z80AsmKeywords.findKeyword("and (ix+#0A)").keyword).toBe("AND s");
    expect(Z80AsmKeywords.findKeyword("and (ix-8)").keyword).toBe("AND s");

    expect(Z80AsmKeywords.findKeyword("and (iy)").keyword).toBe("AND s");
    expect(Z80AsmKeywords.findKeyword("and (iy+#0A)").keyword).toBe("AND s");
    expect(Z80AsmKeywords.findKeyword("and (iy-8)").keyword).toBe("AND s");
  });

  it("OR s", () => {
    expect(Z80AsmKeywords.findKeyword("or a").keyword).toBe("OR s");
    expect(Z80AsmKeywords.findKeyword("or b").keyword).toBe("OR s");
    expect(Z80AsmKeywords.findKeyword("or c").keyword).toBe("OR s");
    expect(Z80AsmKeywords.findKeyword("or d").keyword).toBe("OR s");
    expect(Z80AsmKeywords.findKeyword("or e").keyword).toBe("OR s");
    expect(Z80AsmKeywords.findKeyword("or h").keyword).toBe("OR s");
    expect(Z80AsmKeywords.findKeyword("or l").keyword).toBe("OR s");

    expect(Z80AsmKeywords.findKeyword("or 48+#0A").keyword).toBe("OR s");

    expect(Z80AsmKeywords.findKeyword("or (ix)").keyword).toBe("OR s");
    expect(Z80AsmKeywords.findKeyword("or (ix+#0A)").keyword).toBe("OR s");
    expect(Z80AsmKeywords.findKeyword("or (ix-8)").keyword).toBe("OR s");

    expect(Z80AsmKeywords.findKeyword("or (iy)").keyword).toBe("OR s");
    expect(Z80AsmKeywords.findKeyword("or (iy+#0A)").keyword).toBe("OR s");
    expect(Z80AsmKeywords.findKeyword("or (iy-8)").keyword).toBe("OR s");
  });

  it("XOR s", () => {
    expect(Z80AsmKeywords.findKeyword("xor a").keyword).toBe("XOR s");
    expect(Z80AsmKeywords.findKeyword("xor b").keyword).toBe("XOR s");
    expect(Z80AsmKeywords.findKeyword("xor c").keyword).toBe("XOR s");
    expect(Z80AsmKeywords.findKeyword("xor d").keyword).toBe("XOR s");
    expect(Z80AsmKeywords.findKeyword("xor e").keyword).toBe("XOR s");
    expect(Z80AsmKeywords.findKeyword("xor h").keyword).toBe("XOR s");
    expect(Z80AsmKeywords.findKeyword("xor l").keyword).toBe("XOR s");

    expect(Z80AsmKeywords.findKeyword("xor 48+#0A").keyword).toBe("XOR s");

    expect(Z80AsmKeywords.findKeyword("xor (ix)").keyword).toBe("XOR s");
    expect(Z80AsmKeywords.findKeyword("xor (ix+#0A)").keyword).toBe("XOR s");
    expect(Z80AsmKeywords.findKeyword("xor (ix-8)").keyword).toBe("XOR s");

    expect(Z80AsmKeywords.findKeyword("xor (iy)").keyword).toBe("XOR s");
    expect(Z80AsmKeywords.findKeyword("xor (iy+#0A)").keyword).toBe("XOR s");
    expect(Z80AsmKeywords.findKeyword("xor (iy-8)").keyword).toBe("XOR s");
  });

  it("CP s", () => {
    expect(Z80AsmKeywords.findKeyword("cp a").keyword).toBe("CP s");
    expect(Z80AsmKeywords.findKeyword("cp b").keyword).toBe("CP s");
    expect(Z80AsmKeywords.findKeyword("cp c").keyword).toBe("CP s");
    expect(Z80AsmKeywords.findKeyword("cp d").keyword).toBe("CP s");
    expect(Z80AsmKeywords.findKeyword("cp e").keyword).toBe("CP s");
    expect(Z80AsmKeywords.findKeyword("cp h").keyword).toBe("CP s");
    expect(Z80AsmKeywords.findKeyword("cp l").keyword).toBe("CP s");

    expect(Z80AsmKeywords.findKeyword("cp 48+#0A").keyword).toBe("CP s");

    expect(Z80AsmKeywords.findKeyword("cp (ix)").keyword).toBe("CP s");
    expect(Z80AsmKeywords.findKeyword("cp (ix+#0A)").keyword).toBe("CP s");
    expect(Z80AsmKeywords.findKeyword("cp (ix-8)").keyword).toBe("CP s");

    expect(Z80AsmKeywords.findKeyword("cp (iy)").keyword).toBe("CP s");
    expect(Z80AsmKeywords.findKeyword("cp (iy+#0A)").keyword).toBe("CP s");
    expect(Z80AsmKeywords.findKeyword("cp (iy-8)").keyword).toBe("CP s");
  });


  it("INC r", () => {
    expect(Z80AsmKeywords.findKeyword("inc a").keyword).toBe("INC r");
    expect(Z80AsmKeywords.findKeyword("inc b").keyword).toBe("INC r");
    expect(Z80AsmKeywords.findKeyword("inc c").keyword).toBe("INC r");
    expect(Z80AsmKeywords.findKeyword("inc d").keyword).toBe("INC r");
    expect(Z80AsmKeywords.findKeyword("inc e").keyword).toBe("INC r");
    expect(Z80AsmKeywords.findKeyword("inc h").keyword).toBe("INC r");
    expect(Z80AsmKeywords.findKeyword("inc l").keyword).toBe("INC r");
  });

  it("INC (HL)", () => {
    expect(Z80AsmKeywords.findKeyword("inc (hl)").keyword).toBe("INC (HL)");
  });

  it("INC (IX+d)", () => {
    expect(Z80AsmKeywords.findKeyword("inc (ix)").keyword).toBe("INC (IX+d)");
    expect(Z80AsmKeywords.findKeyword("inc (ix+#0A)").keyword).toBe("INC (IX+d)");
    expect(Z80AsmKeywords.findKeyword("inc (ix-8)").keyword).toBe("INC (IX+d)");
  });

  it("INC (IY+d)", () => {
    expect(Z80AsmKeywords.findKeyword("inc (iy)").keyword).toBe("INC (IY+d)");
    expect(Z80AsmKeywords.findKeyword("inc (iy+#0A)").keyword).toBe("INC (IY+d)");
    expect(Z80AsmKeywords.findKeyword("inc (iy-8)").keyword).toBe("INC (IY+d)");
  });


  it("DEC m", () => {
    expect(Z80AsmKeywords.findKeyword("dec a").keyword).toBe("DEC m");
    expect(Z80AsmKeywords.findKeyword("dec b").keyword).toBe("DEC m");
    expect(Z80AsmKeywords.findKeyword("dec c").keyword).toBe("DEC m");
    expect(Z80AsmKeywords.findKeyword("dec d").keyword).toBe("DEC m");
    expect(Z80AsmKeywords.findKeyword("dec e").keyword).toBe("DEC m");
    expect(Z80AsmKeywords.findKeyword("dec h").keyword).toBe("DEC m");
    expect(Z80AsmKeywords.findKeyword("dec l").keyword).toBe("DEC m");

    expect(Z80AsmKeywords.findKeyword("dec (hl)").keyword).toBe("DEC m");

    expect(Z80AsmKeywords.findKeyword("dec (ix)").keyword).toBe("DEC m");
    expect(Z80AsmKeywords.findKeyword("dec (ix+#0A)").keyword).toBe("DEC m");
    expect(Z80AsmKeywords.findKeyword("dec (ix-8)").keyword).toBe("DEC m");

    expect(Z80AsmKeywords.findKeyword("dec (iy)").keyword).toBe("DEC m");
    expect(Z80AsmKeywords.findKeyword("dec (iy+#0A)").keyword).toBe("DEC m");
    expect(Z80AsmKeywords.findKeyword("dec (iy-8)").keyword).toBe("DEC m");
  });


});


describe("Z80 ASM - General-Purpose Arithmetic and CPU Control Groups", () => {

  it("DAA", () => {
    expect(Z80AsmKeywords.findKeyword("daa").keyword).toBe("DAA");
  });

  it("CPL", () => {
    expect(Z80AsmKeywords.findKeyword("cpl").keyword).toBe("CPL");
  });

  it("NEG", () => {
    expect(Z80AsmKeywords.findKeyword("neg").keyword).toBe("NEG");
  });

  it("CCF", () => {
    expect(Z80AsmKeywords.findKeyword("ccf").keyword).toBe("CCF");
  });

  it("SCF", () => {
    expect(Z80AsmKeywords.findKeyword("scf").keyword).toBe("SCF");
  });

  it("NOP", () => {
    expect(Z80AsmKeywords.findKeyword("nop").keyword).toBe("NOP");
  });

  it("HALT", () => {
    expect(Z80AsmKeywords.findKeyword("halt").keyword).toBe("HALT");
  });

  it("DI", () => {
    expect(Z80AsmKeywords.findKeyword("di").keyword).toBe("DI");
  });

  it("EI", () => {
    expect(Z80AsmKeywords.findKeyword("ei").keyword).toBe("EI");
  });

  it("IM 0", () => {
    expect(Z80AsmKeywords.findKeyword("im 0").keyword).toBe("IM 0");
  });

  it("IM 1", () => {
    expect(Z80AsmKeywords.findKeyword("im 1").keyword).toBe("IM 1");
  });

  it("IM 2", () => {
    expect(Z80AsmKeywords.findKeyword("im 2").keyword).toBe("IM 2");
  });

});

describe("Z80 ASM - 16-Bit Arithmetic Group", () => {

  it("ADD HL, ss", () => {
    expect(Z80AsmKeywords.findKeyword("add hl, bc").keyword).toBe("ADD HL, ss");
    expect(Z80AsmKeywords.findKeyword("add hl, de").keyword).toBe("ADD HL, ss");
    expect(Z80AsmKeywords.findKeyword("add hl, hl").keyword).toBe("ADD HL, ss");
    expect(Z80AsmKeywords.findKeyword("add hl, sp").keyword).toBe("ADD HL, ss");
  });

  it("ADC HL, ss", () => {
    expect(Z80AsmKeywords.findKeyword("adc hl, bc").keyword).toBe("ADC HL, ss");
    expect(Z80AsmKeywords.findKeyword("adc hl, de").keyword).toBe("ADC HL, ss");
    expect(Z80AsmKeywords.findKeyword("adc hl, hl").keyword).toBe("ADC HL, ss");
    expect(Z80AsmKeywords.findKeyword("adc hl, sp").keyword).toBe("ADC HL, ss");
  });

  it("SBC HL, ss", () => {
    expect(Z80AsmKeywords.findKeyword("sbc hl, bc").keyword).toBe("SBC HL, ss");
    expect(Z80AsmKeywords.findKeyword("sbc hl, de").keyword).toBe("SBC HL, ss");
    expect(Z80AsmKeywords.findKeyword("sbc hl, hl").keyword).toBe("SBC HL, ss");
    expect(Z80AsmKeywords.findKeyword("sbc hl, sp").keyword).toBe("SBC HL, ss");
  });


  it("ADD IX, pp", () => {
    expect(Z80AsmKeywords.findKeyword("add ix, bc").keyword).toBe("ADD IX, pp");
    expect(Z80AsmKeywords.findKeyword("add ix, de").keyword).toBe("ADD IX, pp");
    expect(Z80AsmKeywords.findKeyword("add ix, ix").keyword).toBe("ADD IX, pp");
    expect(Z80AsmKeywords.findKeyword("add ix, sp").keyword).toBe("ADD IX, pp");
  });

  it("ADD IY, rr", () => {
    expect(Z80AsmKeywords.findKeyword("add iy, bc").keyword).toBe("ADD IY, rr");
    expect(Z80AsmKeywords.findKeyword("add iy, de").keyword).toBe("ADD IY, rr");
    expect(Z80AsmKeywords.findKeyword("add iy, iy").keyword).toBe("ADD IY, rr");
    expect(Z80AsmKeywords.findKeyword("add iy, sp").keyword).toBe("ADD IY, rr");
  });

  it("INC ss", () => {
    expect(Z80AsmKeywords.findKeyword("inc bc").keyword).toBe("INC ss");
    expect(Z80AsmKeywords.findKeyword("inc de").keyword).toBe("INC ss");
    expect(Z80AsmKeywords.findKeyword("inc hl").keyword).toBe("INC ss");
    expect(Z80AsmKeywords.findKeyword("inc sp").keyword).toBe("INC ss");
  });

  it("INC IX", () => {
    expect(Z80AsmKeywords.findKeyword("inc ix").keyword).toBe("INC IX");
  });

  it("INC IY", () => {
    expect(Z80AsmKeywords.findKeyword("inc iy").keyword).toBe("INC IY");
  });

  it("DEC ss", () => {
    expect(Z80AsmKeywords.findKeyword("dec bc").keyword).toBe("DEC ss");
    expect(Z80AsmKeywords.findKeyword("dec de").keyword).toBe("DEC ss");
    expect(Z80AsmKeywords.findKeyword("dec hl").keyword).toBe("DEC ss");
    expect(Z80AsmKeywords.findKeyword("dec sp").keyword).toBe("DEC ss");
  });

  it("DEC IX", () => {
    expect(Z80AsmKeywords.findKeyword("dec ix").keyword).toBe("DEC IX");
  });

  it("DEC IY", () => {
    expect(Z80AsmKeywords.findKeyword("dec iy ").keyword).toBe("DEC IY");
  });

});

describe("Z80 ASM - Rotate and Shift Group", () => {

  it("RLCA", () => {
    expect(Z80AsmKeywords.findKeyword("rlca").keyword).toBe("RLCA");
  });

  it("RLA", () => {
    expect(Z80AsmKeywords.findKeyword("rla").keyword).toBe("RLA");
  });

  it("RRCA", () => {
    expect(Z80AsmKeywords.findKeyword("rrca").keyword).toBe("RRCA");
  });

  it("RRA", () => {
    expect(Z80AsmKeywords.findKeyword("rra").keyword).toBe("RRA");
  });

  it("RLC r", () => {
    expect(Z80AsmKeywords.findKeyword("rlc a").keyword).toBe("RLC r");
    expect(Z80AsmKeywords.findKeyword("rlc b").keyword).toBe("RLC r");
    expect(Z80AsmKeywords.findKeyword("rlc c").keyword).toBe("RLC r");
    expect(Z80AsmKeywords.findKeyword("rlc d").keyword).toBe("RLC r");
    expect(Z80AsmKeywords.findKeyword("rlc e").keyword).toBe("RLC r");
    expect(Z80AsmKeywords.findKeyword("rlc h").keyword).toBe("RLC r");
    expect(Z80AsmKeywords.findKeyword("rlc l").keyword).toBe("RLC r");
  });

  it("RLC (HL)", () => {
    expect(Z80AsmKeywords.findKeyword("rlc (hl)").keyword).toBe("RLC (HL)");
  });

  it("RLC (IX+d)", () => {
    expect(Z80AsmKeywords.findKeyword("rlc (ix)").keyword).toBe("RLC (IX+d)");
    expect(Z80AsmKeywords.findKeyword("rlc (ix+#0A)").keyword).toBe("RLC (IX+d)");
    expect(Z80AsmKeywords.findKeyword("rlc (ix-8)").keyword).toBe("RLC (IX+d)");
  });

  it("RLC (IY+d)", () => {
    expect(Z80AsmKeywords.findKeyword("rlc (iy)").keyword).toBe("RLC (IY+d)");
    expect(Z80AsmKeywords.findKeyword("rlc (iy+#0A)").keyword).toBe("RLC (IY+d)");
    expect(Z80AsmKeywords.findKeyword("rlc (iy-8)").keyword).toBe("RLC (IY+d)");
  });

  it("RL m", () => {
    expect(Z80AsmKeywords.findKeyword("rl a").keyword).toBe("RL m");
    expect(Z80AsmKeywords.findKeyword("rl b").keyword).toBe("RL m");
    expect(Z80AsmKeywords.findKeyword("rl c").keyword).toBe("RL m");
    expect(Z80AsmKeywords.findKeyword("rl d").keyword).toBe("RL m");
    expect(Z80AsmKeywords.findKeyword("rl e").keyword).toBe("RL m");
    expect(Z80AsmKeywords.findKeyword("rl h").keyword).toBe("RL m");
    expect(Z80AsmKeywords.findKeyword("rl l").keyword).toBe("RL m");

    expect(Z80AsmKeywords.findKeyword("rl (hl)").keyword).toBe("RL m");

    expect(Z80AsmKeywords.findKeyword("rl (ix)").keyword).toBe("RL m");
    expect(Z80AsmKeywords.findKeyword("rl (ix+#0A)").keyword).toBe("RL m");
    expect(Z80AsmKeywords.findKeyword("rl (ix-8)").keyword).toBe("RL m");

    expect(Z80AsmKeywords.findKeyword("rl (iy)").keyword).toBe("RL m");
    expect(Z80AsmKeywords.findKeyword("rl (iy+#0A)").keyword).toBe("RL m");
    expect(Z80AsmKeywords.findKeyword("rl (iy-8)").keyword).toBe("RL m");
  });

  it("RRC m", () => {
    expect(Z80AsmKeywords.findKeyword("rrc a").keyword).toBe("RRC m");
    expect(Z80AsmKeywords.findKeyword("rrc b").keyword).toBe("RRC m");
    expect(Z80AsmKeywords.findKeyword("rrc c").keyword).toBe("RRC m");
    expect(Z80AsmKeywords.findKeyword("rrc d").keyword).toBe("RRC m");
    expect(Z80AsmKeywords.findKeyword("rrc e").keyword).toBe("RRC m");
    expect(Z80AsmKeywords.findKeyword("rrc h").keyword).toBe("RRC m");
    expect(Z80AsmKeywords.findKeyword("rrc l").keyword).toBe("RRC m");

    expect(Z80AsmKeywords.findKeyword("rrc (hl)").keyword).toBe("RRC m");

    expect(Z80AsmKeywords.findKeyword("rrc (ix)").keyword).toBe("RRC m");
    expect(Z80AsmKeywords.findKeyword("rrc (ix+#0A)").keyword).toBe("RRC m");
    expect(Z80AsmKeywords.findKeyword("rrc (ix-8)").keyword).toBe("RRC m");

    expect(Z80AsmKeywords.findKeyword("rrc (iy)").keyword).toBe("RRC m");
    expect(Z80AsmKeywords.findKeyword("rrc (iy+#0A)").keyword).toBe("RRC m");
    expect(Z80AsmKeywords.findKeyword("rrc (iy-8)").keyword).toBe("RRC m");
  });

  it("RR m", () => {
    expect(Z80AsmKeywords.findKeyword("rr a").keyword).toBe("RR m");
    expect(Z80AsmKeywords.findKeyword("rr b").keyword).toBe("RR m");
    expect(Z80AsmKeywords.findKeyword("rr c").keyword).toBe("RR m");
    expect(Z80AsmKeywords.findKeyword("rr d").keyword).toBe("RR m");
    expect(Z80AsmKeywords.findKeyword("rr e").keyword).toBe("RR m");
    expect(Z80AsmKeywords.findKeyword("rr h").keyword).toBe("RR m");
    expect(Z80AsmKeywords.findKeyword("rr l").keyword).toBe("RR m");

    expect(Z80AsmKeywords.findKeyword("rr (hl)").keyword).toBe("RR m");

    expect(Z80AsmKeywords.findKeyword("rr (ix)").keyword).toBe("RR m");
    expect(Z80AsmKeywords.findKeyword("rr (ix+#0A)").keyword).toBe("RR m");
    expect(Z80AsmKeywords.findKeyword("rr (ix-8)").keyword).toBe("RR m");

    expect(Z80AsmKeywords.findKeyword("rr (iy)").keyword).toBe("RR m");
    expect(Z80AsmKeywords.findKeyword("rr (iy+#0A)").keyword).toBe("RR m");
    expect(Z80AsmKeywords.findKeyword("rr (iy-8)").keyword).toBe("RR m");
  });

  it("SLA m", () => {
    expect(Z80AsmKeywords.findKeyword("sla a").keyword).toBe("SLA m");
    expect(Z80AsmKeywords.findKeyword("sla b").keyword).toBe("SLA m");
    expect(Z80AsmKeywords.findKeyword("sla c").keyword).toBe("SLA m");
    expect(Z80AsmKeywords.findKeyword("sla d").keyword).toBe("SLA m");
    expect(Z80AsmKeywords.findKeyword("sla e").keyword).toBe("SLA m");
    expect(Z80AsmKeywords.findKeyword("sla h").keyword).toBe("SLA m");
    expect(Z80AsmKeywords.findKeyword("sla l").keyword).toBe("SLA m");

    expect(Z80AsmKeywords.findKeyword("sla (hl)").keyword).toBe("SLA m");

    expect(Z80AsmKeywords.findKeyword("sla (ix)").keyword).toBe("SLA m");
    expect(Z80AsmKeywords.findKeyword("sla (ix+#0A)").keyword).toBe("SLA m");
    expect(Z80AsmKeywords.findKeyword("sla (ix-8)").keyword).toBe("SLA m");

    expect(Z80AsmKeywords.findKeyword("sla (iy)").keyword).toBe("SLA m");
    expect(Z80AsmKeywords.findKeyword("sla (iy+#0A)").keyword).toBe("SLA m");
    expect(Z80AsmKeywords.findKeyword("sla (iy-8)").keyword).toBe("SLA m");
  });

  it("SRA m", () => {
    expect(Z80AsmKeywords.findKeyword("sra a").keyword).toBe("SRA m");
    expect(Z80AsmKeywords.findKeyword("sra b").keyword).toBe("SRA m");
    expect(Z80AsmKeywords.findKeyword("sra c").keyword).toBe("SRA m");
    expect(Z80AsmKeywords.findKeyword("sra d").keyword).toBe("SRA m");
    expect(Z80AsmKeywords.findKeyword("sra e").keyword).toBe("SRA m");
    expect(Z80AsmKeywords.findKeyword("sra h").keyword).toBe("SRA m");
    expect(Z80AsmKeywords.findKeyword("sra l").keyword).toBe("SRA m");

    expect(Z80AsmKeywords.findKeyword("sra (hl)").keyword).toBe("SRA m");

    expect(Z80AsmKeywords.findKeyword("sra (ix)").keyword).toBe("SRA m");
    expect(Z80AsmKeywords.findKeyword("sra (ix+#0A)").keyword).toBe("SRA m");
    expect(Z80AsmKeywords.findKeyword("sra (ix-8)").keyword).toBe("SRA m");

    expect(Z80AsmKeywords.findKeyword("sra (iy)").keyword).toBe("SRA m");
    expect(Z80AsmKeywords.findKeyword("sra (iy+#0A)").keyword).toBe("SRA m");
    expect(Z80AsmKeywords.findKeyword("sra (iy-8)").keyword).toBe("SRA m");
  });

  it("SRL m", () => {
    expect(Z80AsmKeywords.findKeyword("srl a").keyword).toBe("SRL m");
    expect(Z80AsmKeywords.findKeyword("srl b").keyword).toBe("SRL m");
    expect(Z80AsmKeywords.findKeyword("srl c").keyword).toBe("SRL m");
    expect(Z80AsmKeywords.findKeyword("srl d").keyword).toBe("SRL m");
    expect(Z80AsmKeywords.findKeyword("srl e").keyword).toBe("SRL m");
    expect(Z80AsmKeywords.findKeyword("srl h").keyword).toBe("SRL m");
    expect(Z80AsmKeywords.findKeyword("srl l").keyword).toBe("SRL m");

    expect(Z80AsmKeywords.findKeyword("srl (hl)").keyword).toBe("SRL m");

    expect(Z80AsmKeywords.findKeyword("srl (ix)").keyword).toBe("SRL m");
    expect(Z80AsmKeywords.findKeyword("srl (ix+#0A)").keyword).toBe("SRL m");
    expect(Z80AsmKeywords.findKeyword("srl (ix-8)").keyword).toBe("SRL m");

    expect(Z80AsmKeywords.findKeyword("srl (iy)").keyword).toBe("SRL m");
    expect(Z80AsmKeywords.findKeyword("srl (iy+#0A)").keyword).toBe("SRL m");
    expect(Z80AsmKeywords.findKeyword("srl (iy-8)").keyword).toBe("SRL m");
  });

  it("RLD", () => {
    expect(Z80AsmKeywords.findKeyword("rld").keyword).toBe("RLD");
  });

  it("RRD", () => {
    expect(Z80AsmKeywords.findKeyword("rrd").keyword).toBe("RRD");
  });

});

describe("Z80 ASM - Bit Set, Reset, and Test Group", () => {

  it("BIT b, r", () => {
    expect(Z80AsmKeywords.findKeyword("bit 0, d").keyword).toBe("BIT b, r");
    expect(Z80AsmKeywords.findKeyword("bit 1, d").keyword).toBe("BIT b, r");
    expect(Z80AsmKeywords.findKeyword("bit 2, d").keyword).toBe("BIT b, r");
    expect(Z80AsmKeywords.findKeyword("bit 3, d").keyword).toBe("BIT b, r");
    expect(Z80AsmKeywords.findKeyword("bit 4, d").keyword).toBe("BIT b, r");
    expect(Z80AsmKeywords.findKeyword("bit 5, d").keyword).toBe("BIT b, r");
    expect(Z80AsmKeywords.findKeyword("bit 6, d").keyword).toBe("BIT b, r");
  });

  it("BIT b, (HL)", () => {
    expect(Z80AsmKeywords.findKeyword("bit 7, (hl)").keyword).toBe("BIT b, (HL)");
  });

  it("BIT b, (IX+d)", () => {
    expect(Z80AsmKeywords.findKeyword("bit 1, (ix)").keyword).toBe("BIT b, (IX+d)");
    expect(Z80AsmKeywords.findKeyword("bit 2, (ix+#0A)").keyword).toBe("BIT b, (IX+d)");
    expect(Z80AsmKeywords.findKeyword("bit 3, (ix-8)").keyword).toBe("BIT b, (IX+d)");
  });

  it("BIT b, (IY+d)", () => {
    expect(Z80AsmKeywords.findKeyword("bit 4, (iy)").keyword).toBe("BIT b, (IY+d)");
    expect(Z80AsmKeywords.findKeyword("bit 5, (iy+#0A)").keyword).toBe("BIT b, (IY+d)");
    expect(Z80AsmKeywords.findKeyword("bit 6, (iy-8)").keyword).toBe("BIT b, (IY+d)");
  });

  it("SET b, r", () => {
    expect(Z80AsmKeywords.findKeyword("set 0, d").keyword).toBe("SET b, r");
    expect(Z80AsmKeywords.findKeyword("set 1, d").keyword).toBe("SET b, r");
    expect(Z80AsmKeywords.findKeyword("set 2, d").keyword).toBe("SET b, r");
    expect(Z80AsmKeywords.findKeyword("set 3, d").keyword).toBe("SET b, r");
    expect(Z80AsmKeywords.findKeyword("set 4, d").keyword).toBe("SET b, r");
    expect(Z80AsmKeywords.findKeyword("set 5, d").keyword).toBe("SET b, r");
    expect(Z80AsmKeywords.findKeyword("set 6, d").keyword).toBe("SET b, r");
  });

  it("SET b, (HL)", () => {
    expect(Z80AsmKeywords.findKeyword("set 7, (hl)").keyword).toBe("SET b, (HL)");
  });

  it("SET b, (IX+d)", () => {
    expect(Z80AsmKeywords.findKeyword("set 1, (ix)").keyword).toBe("SET b, (IX+d)");
    expect(Z80AsmKeywords.findKeyword("set 2, (ix+#0A)").keyword).toBe("SET b, (IX+d)");
    expect(Z80AsmKeywords.findKeyword("set 3, (ix-8)").keyword).toBe("SET b, (IX+d)");
  });

  it("SET b, (IY+d)", () => {
    expect(Z80AsmKeywords.findKeyword("set 4, (iy)").keyword).toBe("SET b, (IY+d)");
    expect(Z80AsmKeywords.findKeyword("set 5, (iy+#0A)").keyword).toBe("SET b, (IY+d)");
    expect(Z80AsmKeywords.findKeyword("set 6, (iy-8)").keyword).toBe("SET b, (IY+d)");
  });

  it("RES b, m", () => {
    expect(Z80AsmKeywords.findKeyword("res 0, a").keyword).toBe("RES b, m");
    expect(Z80AsmKeywords.findKeyword("res 1, b").keyword).toBe("RES b, m");
    expect(Z80AsmKeywords.findKeyword("res 2, c").keyword).toBe("RES b, m");
    expect(Z80AsmKeywords.findKeyword("res 3, d").keyword).toBe("RES b, m");
    expect(Z80AsmKeywords.findKeyword("res 4, e").keyword).toBe("RES b, m");
    expect(Z80AsmKeywords.findKeyword("res 5, h").keyword).toBe("RES b, m");
    expect(Z80AsmKeywords.findKeyword("res 6, l").keyword).toBe("RES b, m");

    expect(Z80AsmKeywords.findKeyword("res 7,(hl)").keyword).toBe("RES b, m");

    expect(Z80AsmKeywords.findKeyword("res 1,(ix)").keyword).toBe("RES b, m");
    expect(Z80AsmKeywords.findKeyword("res 2,(ix+#0A)").keyword).toBe("RES b, m");
    expect(Z80AsmKeywords.findKeyword("res 3,(ix-8)").keyword).toBe("RES b, m");

    expect(Z80AsmKeywords.findKeyword("res 4,(iy)").keyword).toBe("RES b, m");
    expect(Z80AsmKeywords.findKeyword("res 5,(iy+#0A)").keyword).toBe("RES b, m");
    expect(Z80AsmKeywords.findKeyword("res 6,(iy-8)").keyword).toBe("RES b, m");
  });

});


describe("Z80 ASM - Jump Group", () => {

  it("JP nn", () => {
    expect(Z80AsmKeywords.findKeyword("jp #1601").keyword).toBe("JP nn");
  });

  it("JP cc, nn", () => {
    expect(Z80AsmKeywords.findKeyword("jp nz, #1601").keyword).toBe("JP cc, nn");
    expect(Z80AsmKeywords.findKeyword("jp z,  #1601").keyword).toBe("JP cc, nn");
    expect(Z80AsmKeywords.findKeyword("jp nc, #1601").keyword).toBe("JP cc, nn");
    expect(Z80AsmKeywords.findKeyword("jp po, #1601").keyword).toBe("JP cc, nn");
    expect(Z80AsmKeywords.findKeyword("jp pe, #1601").keyword).toBe("JP cc, nn");
    expect(Z80AsmKeywords.findKeyword("jp p,  #1601").keyword).toBe("JP cc, nn");
    expect(Z80AsmKeywords.findKeyword("jp m,  #1601").keyword).toBe("JP cc, nn");
  });

  it("JR e", () => {
    expect(Z80AsmKeywords.findKeyword("jr $+5").keyword).toBe("JR e");
  });

  it("JR C, e", () => {
    expect(Z80AsmKeywords.findKeyword("jr c, #1601").keyword).toBe("JR C, e");
  });

  it("JR NC, e", () => {
    expect(Z80AsmKeywords.findKeyword("jr nc, #1601").keyword).toBe("JR NC, e");
  });

  it("JR Z, e", () => {
    expect(Z80AsmKeywords.findKeyword("jr z, #1601").keyword).toBe("JR Z, e");
  });

  it("JR NZ, e", () => {
    expect(Z80AsmKeywords.findKeyword("jr nz, #1601").keyword).toBe("JR NZ, e");
  });

  it("JP (HL)", () => {
    expect(Z80AsmKeywords.findKeyword("jp (hl)").keyword).toBe("JP (HL)");
  });

  it("JP (IX)", () => {
    expect(Z80AsmKeywords.findKeyword("jp (ix)").keyword).toBe("JP (IX)");
  });

  it("JP (IY)", () => {
    expect(Z80AsmKeywords.findKeyword("jp (iy)").keyword).toBe("JP (IY)");
  });

  it("DJNZ, e", () => {
    expect(Z80AsmKeywords.findKeyword("djnz $+10").keyword).toBe("DJNZ, e");
  });
});


describe("Z80 ASM - Call and Return Group", () => {


});

describe("Z80 ASM - Input and Output Group", () => {


});
