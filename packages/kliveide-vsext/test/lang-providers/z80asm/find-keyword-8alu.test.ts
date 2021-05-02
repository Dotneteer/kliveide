import "mocha";
import * as expect from "expect";
import { Z80AsmKeywords } from '../../../src/lang-providers/keywords/z80asm-keyword';

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