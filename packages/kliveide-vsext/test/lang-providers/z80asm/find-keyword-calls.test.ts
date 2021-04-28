import "mocha";
import * as expect from "expect";
import { Z80AsmKeywords } from '../../../src/lang-providers/keywords/z80asm-keyword';

describe("Z80 ASM - Call and Return Group", () => {

    it("CALL nn", () => {
      expect(Z80AsmKeywords.findKeyword("call #FF55").keyword).toBe("CALL nn");
    });
  
    it("CALL cc, nn", () => {
      expect(Z80AsmKeywords.findKeyword("call nz, #AABB").keyword).toBe("CALL cc, nn");
      expect(Z80AsmKeywords.findKeyword("call z,  #AABB").keyword).toBe("CALL cc, nn");
      expect(Z80AsmKeywords.findKeyword("call nc, #AABB").keyword).toBe("CALL cc, nn");
      // BUG ??
      // expect(Z80AsmKeywords.findKeyword("call c,  #AABB").keyword).toBe("CALL cc, nn");
      expect(Z80AsmKeywords.findKeyword("call po, #AABB").keyword).toBe("CALL cc, nn");
      expect(Z80AsmKeywords.findKeyword("call pe, #AABB").keyword).toBe("CALL cc, nn");
      expect(Z80AsmKeywords.findKeyword("call p,  #AABB").keyword).toBe("CALL cc, nn");
      expect(Z80AsmKeywords.findKeyword("call m,  #AABB").keyword).toBe("CALL cc, nn");
    });
  
    it("RET", () => {
      expect(Z80AsmKeywords.findKeyword("ret").keyword).toBe("RET");
    });
    
    it("RET cc", () => {
      expect(Z80AsmKeywords.findKeyword("ret nz").keyword).toBe("RET cc");
      expect(Z80AsmKeywords.findKeyword("ret z").keyword).toBe("RET cc");
      expect(Z80AsmKeywords.findKeyword("ret nc").keyword).toBe("RET cc");
      expect(Z80AsmKeywords.findKeyword("ret c").keyword).toBe("RET cc");
      expect(Z80AsmKeywords.findKeyword("ret po").keyword).toBe("RET cc");
      expect(Z80AsmKeywords.findKeyword("ret pe").keyword).toBe("RET cc");
      expect(Z80AsmKeywords.findKeyword("ret p").keyword).toBe("RET cc");
      expect(Z80AsmKeywords.findKeyword("ret m").keyword).toBe("RET cc");
    });
    
    it("RETI", () => {
      expect(Z80AsmKeywords.findKeyword("reti").keyword).toBe("RETI");
    });
  
    it("RETN", () => {
      expect(Z80AsmKeywords.findKeyword("retn").keyword).toBe("RETN");
    });
  
    it("RST p", () => {
      expect(Z80AsmKeywords.findKeyword("rst #10").keyword).toBe("RST p");
    });
    
  });
  