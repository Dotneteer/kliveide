import { describe, it, expect } from "vitest";
import { M6510Tester } from "./m6510-tester";
import { MemoryMap, MemorySection } from "@renderer/appIde/disassemblers/common-types";
import { M6510Disassembler } from "@renderer/appIde/disassemblers/6510-disassembler/m6510-disassembler";
import { MemorySectionType } from "@abstractions/MemorySection";

describe("M6510 Disassembler - labels and advanced features", function () {
  it("Labels are created for jumps and branches", async () => {
    // --- Arrange
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, 0x0010));

    // JMP $1005, BEQ +2, NOP, NOP, LDA #$00
    const code = [0x4C, 0x05, 0x10, 0xF0, 0x02, 0xEA, 0xEA, 0xA9, 0x00];
    const disassembler = new M6510Disassembler(map.sections, new Uint8Array(code));

    // --- Act
    const output = await disassembler.disassemble(0x0000, 0x0008);
    
    // --- Assert
    expect(output).not.toBeNull();
    if (output === null) return;
    
    expect(output.outputItems.length).toBe(5);
    expect(output.outputItems[0].instruction).toBe("jmp L1005");
    expect(output.outputItems[1].instruction).toBe("beq L0007");
    expect(output.outputItems[2].instruction).toBe("nop");
    expect(output.outputItems[3].instruction).toBe("nop");
    expect(output.outputItems[4].instruction).toBe("lda #$00");
    
    // Check that labels were created
    expect(output.labels.size).toBe(2);
    expect(output.labels.has(0x1005)).toBe(true);
    expect(output.labels.has(0x0007)).toBe(true);
  });

  it("Memory sections work correctly", async () => {
    // --- Arrange
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, 0x0002, MemorySectionType.Disassemble));
    map.add(new MemorySection(0x0003, 0x0006, MemorySectionType.ByteArray));
    map.add(new MemorySection(0x0007, 0x0008, MemorySectionType.WordArray));

    // LDA #$00, NOP, $01, $02, $03, $04, $05, $06, $07, $08
    const code = [0xA9, 0x00, 0xEA, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06];
    const disassembler = new M6510Disassembler(map.sections, new Uint8Array(code));

    // --- Act
    const output = await disassembler.disassemble(0x0000, 0x0008);

    // --- Assert
    expect(output).not.toBeNull();
    if (output === null) return;
    
    expect(output.outputItems.length).toBe(4);
    expect(output.outputItems[0].instruction).toBe("lda #$00");
    expect(output.outputItems[1].instruction).toBe("nop");
    expect(output.outputItems[2].instruction).toBe(".byte $01, $02, $03, $04");
    expect(output.outputItems[3].instruction).toBe(".word $0605");
  });

  it("Decimal mode affects output formatting", async () => {
    // --- Arrange
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, 0x0002));

    // LDA #$FF, STA $ABCD
    const code = [0xA9, 0xFF, 0x8D, 0xCD, 0xAB];
    const disassembler = new M6510Disassembler(map.sections, new Uint8Array(code), {
      decimalMode: true
    });

    // --- Act
    const output = await disassembler.disassemble(0x0000, 0x0004);

    // --- Assert
    expect(output).not.toBeNull();
    if (output === null) return;
    
    expect(output.outputItems.length).toBe(2);
    expect(output.outputItems[0].instruction).toBe("lda #255");
    expect(output.outputItems[1].instruction).toBe("sta 43981");
  });

  it("Relative addressing calculates correct addresses", async () => {
    // Test forward and backward branches
    await M6510Tester.Test("bpl L0002", 0x10, 0x00); // forward 0 bytes (+2 for instruction length)
    await M6510Tester.Test("bpl L0024", 0x10, 0x22); // forward 34 bytes  
    await M6510Tester.Test("bpl LFFF4", 0x10, 0xF2); // backward 14 bytes (-14 + 256 = 242 = 0xF2)
  });

  it("Symbol tracking works for operands", async () => {
    // --- Arrange
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, 0x0002));

    // LDA #$42, STA $1234
    const code = [0xA9, 0x42, 0x8D, 0x34, 0x12];
    const disassembler = new M6510Disassembler(map.sections, new Uint8Array(code));

    // --- Act
    const output = await disassembler.disassemble(0x0000, 0x0004);

    // --- Assert
    expect(output).not.toBeNull();
    if (output === null) return;
    
    expect(output.outputItems.length).toBe(2);
    
    // Check symbol information for immediate value
    const item1 = output.outputItems[0];
    expect(item1.hasSymbol).toBe(true);
    expect(item1.symbolValue).toBe(0x42);
    expect(item1.tokenPosition).toBeGreaterThanOrEqual(0);
    expect(item1.tokenLength).toBeGreaterThan(0);
    
    // Check symbol information for absolute address
    const item2 = output.outputItems[1];
    expect(item2.hasSymbol).toBe(true);
    expect(item2.symbolValue).toBe(0x1234);
    expect(item2.tokenPosition).toBeGreaterThanOrEqual(0);
    expect(item2.tokenLength).toBeGreaterThan(0);
  });
});
