import "mocha";
import * as expect from "expect";
import { Z80AsmKeywords } from '../../../src/lang-providers/keywords/z80asm-keyword';

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