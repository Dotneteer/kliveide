import "mocha";
import * as expect from "expect";
import { Z80AsmKeywords } from '../../../src/lang-providers/keywords/z80asm-keyword';


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