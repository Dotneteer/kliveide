import { describe, it } from "vitest";
import { M6510Tester } from "./m6510-tester";

describe("M6510 Disassembler - basic instructions", function () {
  it("Implied instructions work as expected", async () => {
    // --- Act
    await M6510Tester.TestWithCycles("brk", 7, 0x00);
    await M6510Tester.TestWithCycles("php", 3, 0x08);
    await M6510Tester.TestWithCycles("clc", 2, 0x18);
    await M6510Tester.TestWithCycles("plp", 4, 0x28);
    await M6510Tester.TestWithCycles("sec", 2, 0x38);
    await M6510Tester.TestWithCycles("rti", 6, 0x40);
    await M6510Tester.TestWithCycles("pha", 3, 0x48);
    await M6510Tester.TestWithCycles("cli", 2, 0x58);
    await M6510Tester.TestWithCycles("rts", 6, 0x60);
    await M6510Tester.TestWithCycles("pla", 4, 0x68);
    await M6510Tester.TestWithCycles("sei", 2, 0x78);
    await M6510Tester.TestWithCycles("dey", 2, 0x88);
    await M6510Tester.TestWithCycles("txa", 2, 0x8A);
    await M6510Tester.TestWithCycles("tya", 2, 0x98);
    await M6510Tester.TestWithCycles("txs", 2, 0x9A);
    await M6510Tester.TestWithCycles("tay", 2, 0xA8);
    await M6510Tester.TestWithCycles("tax", 2, 0xAA);
    await M6510Tester.TestWithCycles("clv", 2, 0xB8);
    await M6510Tester.TestWithCycles("tsx", 2, 0xBA);
    await M6510Tester.TestWithCycles("iny", 2, 0xC8);
    await M6510Tester.TestWithCycles("dex", 2, 0xCA);
    await M6510Tester.TestWithCycles("cld", 2, 0xD8);
    await M6510Tester.TestWithCycles("inx", 2, 0xE8);
    await M6510Tester.TestWithCycles("nop", 2, 0xEA);
    await M6510Tester.TestWithCycles("sed", 2, 0xF8);
  });

  it("Immediate instructions work as expected", async () => {
    // --- Act
    await M6510Tester.Test("ora #$23", 0x09, 0x23);
    await M6510Tester.Test("and #$23", 0x29, 0x23);
    await M6510Tester.Test("eor #$23", 0x49, 0x23);
    await M6510Tester.Test("adc #$23", 0x69, 0x23);
    await M6510Tester.Test("ldy #$23", 0xA0, 0x23);
    await M6510Tester.Test("ldx #$23", 0xA2, 0x23);
    await M6510Tester.Test("lda #$23", 0xA9, 0x23);
    await M6510Tester.Test("cpy #$23", 0xC0, 0x23);
    await M6510Tester.Test("cmp #$23", 0xC9, 0x23);
    await M6510Tester.Test("cpx #$23", 0xE0, 0x23);
    await M6510Tester.Test("sbc #$23", 0xE9, 0x23);
  });

  it("Zero page instructions work as expected", async () => {
    // --- Act
    await M6510Tester.Test("ora $23", 0x05, 0x23);
    await M6510Tester.Test("asl $23", 0x06, 0x23);
    await M6510Tester.Test("bit $23", 0x24, 0x23);
    await M6510Tester.Test("and $23", 0x25, 0x23);
    await M6510Tester.Test("rol $23", 0x26, 0x23);
    await M6510Tester.Test("eor $23", 0x45, 0x23);
    await M6510Tester.Test("lsr $23", 0x46, 0x23);
    await M6510Tester.Test("adc $23", 0x65, 0x23);
    await M6510Tester.Test("ror $23", 0x66, 0x23);
    await M6510Tester.Test("sty $23", 0x84, 0x23);
    await M6510Tester.Test("sta $23", 0x85, 0x23);
    await M6510Tester.Test("stx $23", 0x86, 0x23);
    await M6510Tester.Test("ldy $23", 0xA4, 0x23);
    await M6510Tester.Test("lda $23", 0xA5, 0x23);
    await M6510Tester.Test("ldx $23", 0xA6, 0x23);
    await M6510Tester.Test("cpy $23", 0xC4, 0x23);
    await M6510Tester.Test("cmp $23", 0xC5, 0x23);
    await M6510Tester.Test("dec $23", 0xC6, 0x23);
    await M6510Tester.Test("cpx $23", 0xE4, 0x23);
    await M6510Tester.Test("sbc $23", 0xE5, 0x23);
    await M6510Tester.Test("inc $23", 0xE6, 0x23);
  });

  it("Absolute instructions work as expected", async () => {
    // --- Act
    await M6510Tester.Test("ora $3456", 0x0D, 0x56, 0x34);
    await M6510Tester.Test("asl $3456", 0x0E, 0x56, 0x34);
    await M6510Tester.Test("jsr L3456", 0x20, 0x56, 0x34);
    await M6510Tester.Test("bit $3456", 0x2C, 0x56, 0x34);
    await M6510Tester.Test("and $3456", 0x2D, 0x56, 0x34);
    await M6510Tester.Test("rol $3456", 0x2E, 0x56, 0x34);
    await M6510Tester.Test("eor $3456", 0x4D, 0x56, 0x34);
    await M6510Tester.Test("lsr $3456", 0x4E, 0x56, 0x34);
    await M6510Tester.Test("jmp L3456", 0x4C, 0x56, 0x34);
    await M6510Tester.Test("adc $3456", 0x6D, 0x56, 0x34);
    await M6510Tester.Test("ror $3456", 0x6E, 0x56, 0x34);
    await M6510Tester.Test("sty $3456", 0x8C, 0x56, 0x34);
    await M6510Tester.Test("sta $3456", 0x8D, 0x56, 0x34);
    await M6510Tester.Test("stx $3456", 0x8E, 0x56, 0x34);
    await M6510Tester.Test("ldy $3456", 0xAC, 0x56, 0x34);
    await M6510Tester.Test("lda $3456", 0xAD, 0x56, 0x34);
    await M6510Tester.Test("ldx $3456", 0xAE, 0x56, 0x34);
    await M6510Tester.Test("cpy $3456", 0xCC, 0x56, 0x34);
    await M6510Tester.Test("cmp $3456", 0xCD, 0x56, 0x34);
    await M6510Tester.Test("dec $3456", 0xCE, 0x56, 0x34);
    await M6510Tester.Test("cpx $3456", 0xEC, 0x56, 0x34);
    await M6510Tester.Test("sbc $3456", 0xED, 0x56, 0x34);
    await M6510Tester.Test("inc $3456", 0xEE, 0x56, 0x34);
  });

  it("Relative addressing works as expected", async () => {
    // --- Act
    await M6510Tester.Test("bpl L0002", 0x10, 0x00);
    await M6510Tester.Test("bpl L0022", 0x10, 0x20);
    await M6510Tester.Test("bpl LFFF2", 0x10, 0xF0);
    await M6510Tester.Test("bmi L0002", 0x30, 0x00);
    await M6510Tester.Test("bvc L0002", 0x50, 0x00);
    await M6510Tester.Test("bvs L0002", 0x70, 0x00);
    await M6510Tester.Test("bcc L0002", 0x90, 0x00);
    await M6510Tester.Test("bcs L0002", 0xB0, 0x00);
    await M6510Tester.Test("bne L0002", 0xD0, 0x00);
    await M6510Tester.Test("beq L0002", 0xF0, 0x00);
  });

  it("Indexed addressing works as expected", async () => {
    // --- Act
    await M6510Tester.Test("ora $23,x", 0x15, 0x23);
    await M6510Tester.Test("asl $23,x", 0x16, 0x23);
    await M6510Tester.Test("ora $3456,y", 0x19, 0x56, 0x34);
    await M6510Tester.Test("ora $3456,x", 0x1D, 0x56, 0x34);
    await M6510Tester.Test("asl $3456,x", 0x1E, 0x56, 0x34);
    await M6510Tester.Test("and $23,x", 0x35, 0x23);
    await M6510Tester.Test("rol $23,x", 0x36, 0x23);
    await M6510Tester.Test("and $3456,y", 0x39, 0x56, 0x34);
    await M6510Tester.Test("and $3456,x", 0x3D, 0x56, 0x34);
    await M6510Tester.Test("rol $3456,x", 0x3E, 0x56, 0x34);
    await M6510Tester.Test("eor $23,x", 0x55, 0x23);
    await M6510Tester.Test("lsr $23,x", 0x56, 0x23);
    await M6510Tester.Test("eor $3456,y", 0x59, 0x56, 0x34);
    await M6510Tester.Test("eor $3456,x", 0x5D, 0x56, 0x34);
    await M6510Tester.Test("lsr $3456,x", 0x5E, 0x56, 0x34);
    await M6510Tester.Test("adc $23,x", 0x75, 0x23);
    await M6510Tester.Test("ror $23,x", 0x76, 0x23);
    await M6510Tester.Test("adc $3456,y", 0x79, 0x56, 0x34);
    await M6510Tester.Test("adc $3456,x", 0x7D, 0x56, 0x34);
    await M6510Tester.Test("ror $3456,x", 0x7E, 0x56, 0x34);
    await M6510Tester.Test("sty $23,x", 0x94, 0x23);
    await M6510Tester.Test("sta $23,x", 0x95, 0x23);
    await M6510Tester.Test("stx $23,y", 0x96, 0x23);
    await M6510Tester.Test("sta $3456,y", 0x99, 0x56, 0x34);
    await M6510Tester.Test("sta $3456,x", 0x9D, 0x56, 0x34);
    await M6510Tester.Test("ldy $23,x", 0xB4, 0x23);
    await M6510Tester.Test("lda $23,x", 0xB5, 0x23);
    await M6510Tester.Test("ldx $23,y", 0xB6, 0x23);
    await M6510Tester.Test("lda $3456,y", 0xB9, 0x56, 0x34);
    await M6510Tester.Test("ldy $3456,x", 0xBC, 0x56, 0x34);
    await M6510Tester.Test("lda $3456,x", 0xBD, 0x56, 0x34);
    await M6510Tester.Test("ldx $3456,y", 0xBE, 0x56, 0x34);
    await M6510Tester.Test("cmp $23,x", 0xD5, 0x23);
    await M6510Tester.Test("dec $23,x", 0xD6, 0x23);
    await M6510Tester.Test("cmp $3456,y", 0xD9, 0x56, 0x34);
    await M6510Tester.Test("cmp $3456,x", 0xDD, 0x56, 0x34);
    await M6510Tester.Test("dec $3456,x", 0xDE, 0x56, 0x34);
    await M6510Tester.Test("sbc $23,x", 0xF5, 0x23);
    await M6510Tester.Test("inc $23,x", 0xF6, 0x23);
    await M6510Tester.Test("sbc $3456,y", 0xF9, 0x56, 0x34);
    await M6510Tester.Test("sbc $3456,x", 0xFD, 0x56, 0x34);
    await M6510Tester.Test("inc $3456,x", 0xFE, 0x56, 0x34);
  });

  it("Indirect addressing works as expected", async () => {
    // --- Act
    await M6510Tester.Test("ora ($23,x)", 0x01, 0x23);
    await M6510Tester.Test("and ($23,x)", 0x21, 0x23);
    await M6510Tester.Test("eor ($23,x)", 0x41, 0x23);
    await M6510Tester.Test("adc ($23,x)", 0x61, 0x23);
    await M6510Tester.Test("sta ($23,x)", 0x81, 0x23);
    await M6510Tester.Test("lda ($23,x)", 0xA1, 0x23);
    await M6510Tester.Test("cmp ($23,x)", 0xC1, 0x23);
    await M6510Tester.Test("sbc ($23,x)", 0xE1, 0x23);
    
    await M6510Tester.Test("ora ($23),y", 0x11, 0x23);
    await M6510Tester.Test("and ($23),y", 0x31, 0x23);
    await M6510Tester.Test("eor ($23),y", 0x51, 0x23);
    await M6510Tester.Test("adc ($23),y", 0x71, 0x23);
    await M6510Tester.Test("sta ($23),y", 0x91, 0x23);
    await M6510Tester.Test("lda ($23),y", 0xB1, 0x23);
    await M6510Tester.Test("cmp ($23),y", 0xD1, 0x23);
    await M6510Tester.Test("sbc ($23),y", 0xF1, 0x23);
    
    await M6510Tester.Test("jmp ($3456)", 0x6C, 0x56, 0x34);
  });

  it("Accumulator addressing works as expected", async () => {
    // --- Act
    await M6510Tester.Test("asl", 0x0A);
    await M6510Tester.Test("rol", 0x2A);
    await M6510Tester.Test("lsr", 0x4A);
    await M6510Tester.Test("ror", 0x6A);
  });

  it("Undocumented instructions work as expected", async () => {
    // --- Act
    await M6510Tester.Test("jam", 0x02);
    await M6510Tester.Test("slo ($23,x)", 0x03, 0x23);
    await M6510Tester.Test("nop $23", 0x04, 0x23);
    await M6510Tester.Test("slo $23", 0x07, 0x23);
    await M6510Tester.Test("aac #$23", 0x0B, 0x23);
    await M6510Tester.Test("nop $3456", 0x0C, 0x56, 0x34);
    await M6510Tester.Test("slo $3456", 0x0F, 0x56, 0x34);
    await M6510Tester.Test("slo ($23),y", 0x13, 0x23);
    await M6510Tester.Test("nop $23,x", 0x14, 0x23);
    await M6510Tester.Test("slo $23,x", 0x17, 0x23);
    await M6510Tester.Test("nop", 0x1A);
    await M6510Tester.Test("slo $3456,y", 0x1B, 0x56, 0x34);
    await M6510Tester.Test("nop $3456,x", 0x1C, 0x56, 0x34);
    await M6510Tester.Test("slo $3456,x", 0x1F, 0x56, 0x34);
    
    // RLA instructions
    await M6510Tester.Test("rla ($23,x)", 0x23, 0x23);
    await M6510Tester.Test("rla $23", 0x27, 0x23);
    await M6510Tester.Test("rla $3456", 0x2F, 0x56, 0x34);
    await M6510Tester.Test("rla ($23),y", 0x33, 0x23);
    await M6510Tester.Test("rla $23,x", 0x37, 0x23);
    await M6510Tester.Test("rla $3456,y", 0x3B, 0x56, 0x34);
    await M6510Tester.Test("rla $3456,x", 0x3F, 0x56, 0x34);
    
    // SRE instructions
    await M6510Tester.Test("sre ($23,x)", 0x43, 0x23);
    await M6510Tester.Test("sre $23", 0x47, 0x23);
    await M6510Tester.Test("asr #$23", 0x4B, 0x23);
    await M6510Tester.Test("sre $3456", 0x4F, 0x56, 0x34);
    await M6510Tester.Test("sre ($23),y", 0x53, 0x23);
    await M6510Tester.Test("sre $23,x", 0x57, 0x23);
    await M6510Tester.Test("sre $3456,y", 0x5B, 0x56, 0x34);
    await M6510Tester.Test("sre $3456,x", 0x5F, 0x56, 0x34);
    
    // RRA instructions
    await M6510Tester.Test("rra ($23,x)", 0x63, 0x23);
    await M6510Tester.Test("rra $23", 0x67, 0x23);
    await M6510Tester.Test("arr #$23", 0x6B, 0x23);
    await M6510Tester.Test("rra $3456", 0x6F, 0x56, 0x34);
    await M6510Tester.Test("rra ($23),y", 0x73, 0x23);
    await M6510Tester.Test("rra $23,x", 0x77, 0x23);
    await M6510Tester.Test("rra $3456,y", 0x7B, 0x56, 0x34);
    await M6510Tester.Test("rra $3456,x", 0x7F, 0x56, 0x34);
    
    // SAX instructions
    await M6510Tester.Test("sax ($23,x)", 0x83, 0x23);
    await M6510Tester.Test("sax $23", 0x87, 0x23);
    await M6510Tester.Test("xaa #$23", 0x8B, 0x23);
    await M6510Tester.Test("sax $3456", 0x8F, 0x56, 0x34);
    await M6510Tester.Test("axa ($23),y", 0x93, 0x23);
    await M6510Tester.Test("sax $23,y", 0x97, 0x23);
    await M6510Tester.Test("xas $3456,y", 0x9B, 0x56, 0x34);
    await M6510Tester.Test("sya $3456,x", 0x9C, 0x56, 0x34);
    await M6510Tester.Test("sxa $3456,y", 0x9E, 0x56, 0x34);
    await M6510Tester.Test("axa $3456,y", 0x9F, 0x56, 0x34);
    
    // LAX instructions
    await M6510Tester.Test("lax ($23,x)", 0xA3, 0x23);
    await M6510Tester.Test("lax $23", 0xA7, 0x23);
    await M6510Tester.Test("atx #$23", 0xAB, 0x23);
    await M6510Tester.Test("lax $3456", 0xAF, 0x56, 0x34);
    await M6510Tester.Test("lax ($23),y", 0xB3, 0x23);
    await M6510Tester.Test("lax $23,y", 0xB7, 0x23);
    await M6510Tester.Test("lar $3456,y", 0xBB, 0x56, 0x34);
    await M6510Tester.Test("lax $3456,y", 0xBF, 0x56, 0x34);
    
    // DCP instructions
    await M6510Tester.Test("dcp ($23,x)", 0xC3, 0x23);
    await M6510Tester.Test("dcp $23", 0xC7, 0x23);
    await M6510Tester.Test("axs #$23", 0xCB, 0x23);
    await M6510Tester.Test("dcp $3456", 0xCF, 0x56, 0x34);
    await M6510Tester.Test("dcp ($23),y", 0xD3, 0x23);
    await M6510Tester.Test("dcp $23,x", 0xD7, 0x23);
    await M6510Tester.Test("dcp $3456,y", 0xDB, 0x56, 0x34);
    await M6510Tester.Test("dcp $3456,x", 0xDF, 0x56, 0x34);
    
    // ISC instructions
    await M6510Tester.Test("isc ($23,x)", 0xE3, 0x23);
    await M6510Tester.Test("isc $23", 0xE7, 0x23);
    await M6510Tester.Test("sbc #$23", 0xEB, 0x23); // SBC duplicate
    await M6510Tester.Test("isc $3456", 0xEF, 0x56, 0x34);
    await M6510Tester.Test("isc ($23),y", 0xF3, 0x23);
    await M6510Tester.Test("isc $23,x", 0xF7, 0x23);
    await M6510Tester.Test("isc $3456,y", 0xFB, 0x56, 0x34);
    await M6510Tester.Test("isc $3456,x", 0xFF, 0x56, 0x34);
  });

  it("Decimal mode works as expected", async () => {
    // --- Act
    await M6510Tester.TestWithDecimal("lda #35", 0xA9, 0x23);
    await M6510Tester.TestWithDecimal("lda 35", 0xA5, 0x23);
    await M6510Tester.TestWithDecimal("lda 13398", 0xAD, 0x56, 0x34);
    await M6510Tester.TestWithDecimal("lda 13398,x", 0xBD, 0x56, 0x34);
    await M6510Tester.TestWithDecimal("lda (35,x)", 0xA1, 0x23);
    await M6510Tester.TestWithDecimal("lda (35),y", 0xB1, 0x23);
    await M6510Tester.TestWithDecimal("jmp (13398)", 0x6C, 0x56, 0x34);
  });
});
