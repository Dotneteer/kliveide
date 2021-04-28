import "mocha";
import * as expect from "expect";
import { Z80AsmKeywords } from '../../../src/lang-providers/keywords/z80asm-keyword';

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