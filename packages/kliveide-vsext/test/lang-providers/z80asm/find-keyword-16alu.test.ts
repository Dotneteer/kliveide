import "mocha";
import * as expect from "expect";
import { Z80AsmKeywords } from '../../../src/lang-providers/keywords/z80asm-keyword';

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