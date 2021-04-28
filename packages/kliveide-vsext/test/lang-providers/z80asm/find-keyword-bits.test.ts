import "mocha";
import * as expect from "expect";
import { Z80AsmKeywords } from '../../../src/lang-providers/keywords/z80asm-keyword';

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