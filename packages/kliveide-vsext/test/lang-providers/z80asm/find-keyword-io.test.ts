import "mocha";
import * as expect from "expect";
import { Z80AsmKeywords } from '../../../src/lang-providers/keywords/z80asm-keyword';

describe("Z80 ASM - Input and Output Group", () => {

    it("IN A, (n)", () => {
      expect(Z80AsmKeywords.findKeyword("in a, (#FE)").keyword).toBe("IN A, (n)");
    });
  
    it("IN r (C)", () => {
      expect(Z80AsmKeywords.findKeyword("in a,(c)").keyword).toBe("IN r (C)");
      expect(Z80AsmKeywords.findKeyword("in b,(c)").keyword).toBe("IN r (C)");
      expect(Z80AsmKeywords.findKeyword("in c,(c)").keyword).toBe("IN r (C)");
      expect(Z80AsmKeywords.findKeyword("in d,(c)").keyword).toBe("IN r (C)");
      expect(Z80AsmKeywords.findKeyword("in e,(c)").keyword).toBe("IN r (C)");
      expect(Z80AsmKeywords.findKeyword("in h,(c)").keyword).toBe("IN r (C)");
      expect(Z80AsmKeywords.findKeyword("in l,(c)").keyword).toBe("IN r (C)");
    });
    
    it("INI", () => {
      expect(Z80AsmKeywords.findKeyword("ini").keyword).toBe("INI");
    });
  
    it("INIR", () => {
      expect(Z80AsmKeywords.findKeyword("inir").keyword).toBe("INIR");
    });
    
    it("IND", () => {
      expect(Z80AsmKeywords.findKeyword("ind").keyword).toBe("IND");
    });
    
    it("INDR", () => {
      expect(Z80AsmKeywords.findKeyword("indr").keyword).toBe("INDR");
    });
  
    it("OUT (n), A", () => {
      expect(Z80AsmKeywords.findKeyword("out (#FE), a").keyword).toBe("OUT (n), A");
    });
  
    it("OUT (C), r", () => {
      expect(Z80AsmKeywords.findKeyword("out (c), a").keyword).toBe("OUT (C), r");
      expect(Z80AsmKeywords.findKeyword("out (c), b").keyword).toBe("OUT (C), r");
      expect(Z80AsmKeywords.findKeyword("out (c), c").keyword).toBe("OUT (C), r");
      expect(Z80AsmKeywords.findKeyword("out (c), d").keyword).toBe("OUT (C), r");
      expect(Z80AsmKeywords.findKeyword("out (c), e").keyword).toBe("OUT (C), r");
      expect(Z80AsmKeywords.findKeyword("out (c), h").keyword).toBe("OUT (C), r");
      expect(Z80AsmKeywords.findKeyword("out (c), l").keyword).toBe("OUT (C), r");
    });
  
    it("OUTI", () => {
      expect(Z80AsmKeywords.findKeyword("outi").keyword).toBe("OUTI");
    });
  
    it("OTIR", () => {
      expect(Z80AsmKeywords.findKeyword("otir").keyword).toBe("OTIR");
    });
    
    it("OUTD", () => {
      expect(Z80AsmKeywords.findKeyword("outd").keyword).toBe("OUTD");
    });
    
    it("OTDR", () => {
      expect(Z80AsmKeywords.findKeyword("otdr").keyword).toBe("OTDR");
    });  
  
  });