import "mocha";
import * as expect from "expect";
import { Z80AsmKeywords } from '../../../src/lang-providers/keywords/z80asm-keyword';

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