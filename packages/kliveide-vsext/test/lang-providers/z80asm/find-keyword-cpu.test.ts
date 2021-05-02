import "mocha";
import * as expect from "expect";
import { Z80AsmKeywords } from '../../../src/lang-providers/keywords/z80asm-keyword';

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