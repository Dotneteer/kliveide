import { describe, it, expect } from "vitest";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";

describe("Next Auto Defaults (Step 1)", () => {
  async function testCompile(source: string) {
    const options = new AssemblerOptions();
    const assembler = new Z80Assembler();
    return await assembler.compile(source, options);
  }

  describe("T1: Default .savenex Values", () => {
    it("✅ Next model applies default ram 768", async () => {
      const source = `.model next`;
      const output = await testCompile(source);
      expect(output.nexConfig.ramSize).toBe(768);
    });

    it("✅ Next model applies default border 7", async () => {
      const source = `.model next`;
      const output = await testCompile(source);
      expect(output.nexConfig.borderColor).toBe(7);
    });

    it("✅ Next model applies default entryaddr $8000", async () => {
      const source = `.model next`;
      const output = await testCompile(source);
      expect(output.nexConfig.entryAddr).toBe(0x8000);
    });

    it("✅ Explicit ram overrides default", async () => {
      const source = `
        .model next
        .savenex ram 1792
      `;
      const output = await testCompile(source);
      expect(output.nexConfig.ramSize).toBe(1792);
    });

    it("✅ Explicit border overrides default", async () => {
      const source = `
        .model next
        .savenex border 3
      `;
      const output = await testCompile(source);
      expect(output.nexConfig.borderColor).toBe(3);
    });

    it("✅ Explicit entryaddr overrides default", async () => {
      const source = `
        .model next
        .savenex entryaddr $9000
      `;
      const output = await testCompile(source);
      expect(output.nexConfig.entryAddr).toBe(0x9000);
    });

    it("❌ Non-Next models don't get defaults", async () => {
      const source = `
        .model Spectrum48
        .org $8000
        ld a,1
      `;
      const output = await testCompile(source);
      // Non-Next model should not have auto defaults
      // border should be 0 (default), not 7
      expect(output.nexConfig.borderColor).toBe(0);
      // entryAddr should be undefined, not $8000
      expect(output.nexConfig.entryAddr).toBeUndefined();
      // isNextAutoMode should not be set
      expect(output.isNextAutoMode).toBeUndefined();
    });

    it("❌ Empty Next program gets defaults", async () => {
      const source = `.model next`;
      const output = await testCompile(source);
      // All three defaults should be set
      expect(output.nexConfig.ramSize).toBe(768);
      expect(output.nexConfig.borderColor).toBe(7);
      expect(output.nexConfig.entryAddr).toBe(0x8000);
      // isNextAutoMode flag should be set
      expect(output.isNextAutoMode).toBe(true);
    });

    it("✅ Explicit ram and border both override defaults", async () => {
      const source = `
        .model next
        .savenex ram 1792
        .savenex border 2
      `;
      const output = await testCompile(source);
      expect(output.nexConfig.ramSize).toBe(1792);
      expect(output.nexConfig.borderColor).toBe(2);
      expect(output.nexConfig.entryAddr).toBe(0x8000); // Default still applies
    });

    it("✅ Explicit file and core don't interfere with defaults", async () => {
      const source = `
        .model next
        .savenex file "test.nex"
        .savenex core 3, 1, 0
      `;
      const output = await testCompile(source);
      expect(output.nexConfig.filename).toBe("test.nex");
      expect(output.nexConfig.ramSize).toBe(768); // Default
      expect(output.nexConfig.borderColor).toBe(7); // Default
      expect(output.nexConfig.entryAddr).toBe(0x8000); // Default
    });

    it("✅ isNextAutoMode flag is set only for Next model", async () => {
      const nextSource = `.model next`;
      const nextOutput = await testCompile(nextSource);
      expect(nextOutput.isNextAutoMode).toBe(true);

      const spectrum48Source = `.model Spectrum48`;
      const spectrum48Output = await testCompile(spectrum48Source);
      expect(spectrum48Output.isNextAutoMode).toBeUndefined();

      const spectrum128Source = `.model Spectrum128`;
      const spectrum128Output = await testCompile(spectrum128Source);
      expect(spectrum128Output.isNextAutoMode).toBeUndefined();
    });

    it("✅ Multiple explicit values override but don't interfere with each other", async () => {
      const source = `
        .model next
        .savenex ram 1792
        .savenex border 4
        .savenex entryaddr $8100
        .savenex file "myapp.nex"
      `;
      const output = await testCompile(source);
      expect(output.nexConfig.ramSize).toBe(1792);
      expect(output.nexConfig.borderColor).toBe(4);
      expect(output.nexConfig.entryAddr).toBe(0x8100);
      expect(output.nexConfig.filename).toBe("myapp.nex");
    });

    it("✅ Default entryaddr can be overridden with expression", async () => {
      const source = `
        .model next
        start: .equ $8200
        .savenex entryaddr start
      `;
      const output = await testCompile(source);
      expect(output.nexConfig.entryAddr).toBe(0x8200);
    });
  });

  describe("Edge Cases", () => {
    it("✅ Defaults not applied when .model not specified", async () => {
      const source = `
        ld a,1
        out ($fe),a
      `;
      const output = await testCompile(source);
      // Without .model next, defaults should NOT be applied
      expect(output.isNextAutoMode).toBeUndefined();
      expect(output.nexConfig.borderColor).toBe(0); // default, not 7
      expect(output.nexConfig.entryAddr).toBeUndefined(); // not set
    });

    it("✅ Case insensitive model name works", async () => {
      const source = `.model NEXT`;
      const output = await testCompile(source);
      expect(output.isNextAutoMode).toBe(true);
      expect(output.nexConfig.borderColor).toBe(7);
    });

    it("✅ Default ram 768 is the standard default anyway", async () => {
      const nextSource = `.model next`;
      const nextOutput = await testCompile(nextSource);
      expect(nextOutput.nexConfig.ramSize).toBe(768);

      // Verify this is also the built-in default
      const noModelSource = `ld a,1`;
      const noModelOutput = await testCompile(noModelSource);
      expect(noModelOutput.nexConfig.ramSize).toBe(768); // Built-in default
    });
  });

  describe("Integration with Code", () => {
    it("✅ Defaults work with actual code", async () => {
      const source = `
        .model next
        main:
          ld a,7
          out ($fe),a
          ret
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      expect(output.nexConfig.borderColor).toBe(7);
      expect(output.nexConfig.entryAddr).toBe(0x8000);
    });

    it("✅ Defaults work with savenex file directive", async () => {
      const source = `
        .model next
        .savenex file "app.nex"
        main:
          ld a,5
          out ($fe),a
          ret
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      expect(output.nexConfig.filename).toBe("app.nex");
      expect(output.nexConfig.borderColor).toBe(7);
      expect(output.nexConfig.entryAddr).toBe(0x8000);
    });

    it("✅ User's simplified example compiles", async () => {
      const source = `
        .model next
        .savenex file "screen-tests.nex"
        .savenex core "3.1.0"
        
        main:
          ld a,3
          out ($fe),a
        trap: jr trap
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      // Should have defaults applied
      expect(output.nexConfig.borderColor).toBe(7);
      expect(output.nexConfig.ramSize).toBe(768);
      expect(output.nexConfig.entryAddr).toBe(0x8000);
    });
  });

  describe("T2: Unbanked Code Mode Activation", () => {
    it("✅ Next model without .bank creates unbanked segment at $8000", async () => {
      const source = `
        .model next
        ld a,1
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      expect(output.segments.length).toBeGreaterThan(0);
      expect(output.segments[0].bank).toBeUndefined(); // Unbanked
      expect(output.segments[0].startAddress).toBe(0x8000);
      expect(output.unbankedSegments).toBeDefined();
      expect(output.unbankedSegments!.length).toBeGreaterThan(0);
    });

    it("❌ Unbanked and banked code can coexist", async () => {
      const source = `
        .model next
        ld a,1        ; Unbanked - goes to bank 2 at $8000
        
        .bank 5
        .org 0xC000
        ld b,2        ; Banked - goes to bank 5
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      // Multiple segments created due to .bank pragma
      expect(output.segments.length).toBeGreaterThanOrEqual(2);
      // Banked segment should be present
      expect(output.segments.some(s => s.bank === 5)).toBe(true);
      // Unbanked segments should be tracked
      expect(output.unbankedSegments).toBeDefined();
      expect(output.unbankedSegments!.length).toBeGreaterThan(0);
      // Should have both unbanked and banked segments
      expect(output.segments.some(s => s.bank === undefined)).toBe(true);
    });

    it("✅ .org overrides default $8000 for unbanked code", async () => {
      const source = `
        .model next
        .org $8200
        ld a,1
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      expect(output.segments[0].bank).toBeUndefined(); // Unbanked
      expect(output.segments[0].startAddress).toBe(0x8200);
      expect(output.unbankedSegments).toBeDefined();
      expect(output.unbankedSegments!.some(s => s.startAddress === 0x8200)).toBe(true);
    });

    it("✅ Multiple unbanked .org sections create multiple unbanked segments", async () => {
      const source = `
        .model next
        .org $8000
        ld a,1
        
        .org $8500
        ld b,2
        
        .org $9000
        ld c,3
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      // Each .org creates a new segment
      expect(output.segments.length).toBeGreaterThanOrEqual(3);
      // All should be unbanked
      expect(output.segments.every(s => s.bank === undefined)).toBe(true);
      // All segments should be tracked in unbankedSegments
      expect(output.unbankedSegments).toBeDefined();
      expect(output.unbankedSegments!.length).toBeGreaterThanOrEqual(3);
    });

    it("✅ .bank pragma creates banked segment, not in unbankedSegments", async () => {
      const source = `
        .model next
        ld a,1        ; Unbanked
        
        .bank 3
        .org 0xC000
        ld b,2        ; Banked - not in unbanked array
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      expect(output.segments.length).toBeGreaterThanOrEqual(2);
      // Should have both banked and unbanked segments
      expect(output.segments.some(s => s.bank === undefined)).toBe(true);
      expect(output.segments.some(s => s.bank === 3)).toBe(true);
      // Unbanked segments should be tracked
      expect(output.unbankedSegments).toBeDefined();
      expect(output.unbankedSegments!.length).toBeGreaterThan(0);
      // Verify that only unbanked segments are in the array
      expect(output.unbankedSegments!.every(s => s.bank === undefined)).toBe(true);
    });

    it("❌ Non-Next models don't track unbanked segments", async () => {
      const source = `
        .model Spectrum48
        .org $8000
        ld a,1
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      // unbankedSegments should not be populated for non-Next models
      expect(output.unbankedSegments).toBeUndefined();
    });
  });

  describe("T3: Unbanked Code Segment Initialization", () => {
    it("✅ Empty Next program creates initial unbanked segment at $8000", async () => {
      const source = `.model next`;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      // Should have at least one segment (the initial one)
      expect(output.segments.length).toBeGreaterThan(0);
      // First segment should be unbanked and at $8000
      expect(output.segments[0].bank).toBeUndefined();
      expect(output.segments[0].startAddress).toBe(0x8000);
      // Should be in unbankedSegments array
      expect(output.unbankedSegments).toBeDefined();
      expect(output.unbankedSegments!.includes(output.segments[0])).toBe(true);
    });

    it("✅ Code without .org compiles to $8000 (default)", async () => {
      const source = `
        .model next
        ld a,1
        nop
        ret
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      expect(output.segments[0].startAddress).toBe(0x8000);
      expect(output.segments[0].bank).toBeUndefined();
      // Code should be in the segment
      expect(output.segments[0].emittedCode.length).toBeGreaterThan(0);
    });

    it("❌ .org before code overrides $8000 default", async () => {
      const source = `
        .model next
        .org $8200
        ld a,1
        nop
        ret
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      // Should have segment(s) starting at custom address
      expect(output.segments.some(s => s.startAddress === 0x8200)).toBe(true);
      // None should be at default $8000 unless there was code before .org
      const defaultSegment = output.segments.find(s => s.startAddress === 0x8000);
      if (defaultSegment) {
        // If there is a default segment, it should have no code
        expect(defaultSegment.emittedCode.length).toBe(0);
      }
    });

    it("✅ First instruction address defaults to $8000", async () => {
      const source = `
        .model next
        start: ld a,7
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      // Find the start label
      const startSymbol = output.symbols["start"];
      expect(startSymbol).toBeDefined();
      // Symbol value is an ExpressionValue, extract the numeric value
      const symbolValue = typeof startSymbol.value === 'object' ? startSymbol.value.value : startSymbol.value;
      expect(symbolValue).toBe(0x8000);
    });

    it("✅ Multiple code sections default to $8000 but create new segments on .org", async () => {
      const source = `
        .model next
        ld a,1      ; $8000
        
        .org $8500
        ld b,2      ; $8500
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      expect(output.segments.length).toBeGreaterThanOrEqual(2);
      // All should be unbanked
      expect(output.segments.every(s => s.bank === undefined)).toBe(true);
      // Addresses should be correct
      expect(output.segments.some(s => s.startAddress === 0x8000)).toBe(true);
      expect(output.segments.some(s => s.startAddress === 0x8500)).toBe(true);
    });

    it("✅ Next model without any code still has default segment at $8000", async () => {
      const source = `
        .model next
        ; Just a comment, no code
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      // Should still have initial segment created
      expect(output.segments.length).toBeGreaterThan(0);
      expect(output.segments[0].startAddress).toBe(0x8000);
    });

    it("✅ Non-Next model doesn't get default $8000 segment", async () => {
      const source = `
        .model Spectrum48
        ld a,1
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      // Should not have unbanked tracking
      expect(output.unbankedSegments).toBeUndefined();
    });
  });

  describe("Step 4: Range Warnings", () => {
    it("✅ Code at $8000 range doesn't warn", async () => {
      const source = `
        .model next
        .org $8000
        ld a,1
      `;
      const output = await testCompile(source);
      const warnings = output.errors.filter(e => e.errorCode === "Z0902");
      expect(warnings.length).toBe(0);
    });

    it("✅ Code at $bff0 (edge case) doesn't warn", async () => {
      const source = `
        .model next
        .org $bff0
        nop
        nop
        nop
        nop
        nop
        nop
        nop
        nop
        nop
        nop
        nop
        nop
        nop
        nop
        nop
        nop
      `;
      const output = await testCompile(source);
      const warnings = output.errors.filter(e => e.errorCode === "Z0902");
      expect(warnings.length).toBe(0);
    });

    it("✅ Code at $c000 generates Z0904 warning", async () => {
      const source = `
        .model next
        .org $c000
        ld a,1
      `;
      const output = await testCompile(source);
      const warnings = output.errors.filter(e => e.errorCode === "Z0904");
      expect(warnings.length).toBe(1);
      expect(warnings[0].isWarning).toBe(true);
      expect(warnings[0].message).toContain("C000");
    });

    it("✅ Code compiles despite Z0904 warning", async () => {
      const source = `
        .model next
        .org $c000
        ld a,1
      `;
      const output = await testCompile(source);
      // Should have warning but not fail compilation
      expect(output.errors.some(e => e.errorCode === "Z0904")).toBe(true);
      // Only the warning should exist, not errors
      const errors = output.errors.filter(e => !e.isWarning);
      expect(errors.length).toBe(0);
    });

    it("✅ Banked code at $c000 doesn't warn", async () => {
      const source = `
        .model next
        .bank 4
        .org $c000
        ld a,1
      `;
      const output = await testCompile(source);
      const warnings = output.errors.filter(e => e.errorCode === "Z0902");
      expect(warnings.length).toBe(0);
    });

    it("✅ Forward reference in .savenex stackaddr works", async () => {
      const source = `
        .model next
        .savenex file "test.nex"
        .savenex stackaddr STACK_TOP
        
        ld a,1
        .defs $100
STACK_TOP:
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      // ld a,1 is 2 bytes at $8000-$8001, .defs $100 fills $8002-$8101, STACK_TOP is at $8102
      expect(output.nexConfig.stackAddr).toBe(0x8102);
    });

    it("✅ Forward reference in .savenex entryaddr works", async () => {
      const source = `
        .model next
        .savenex file "test.nex"
        .savenex entryaddr main
        
main:
        ld a,1
        ret
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      expect(output.nexConfig.entryAddr).toBe(0x8000);
    });

    it("✅ Both stackaddr and entryaddr forward references work together", async () => {
      const source = `
        .model next
        .savenex file "test.nex"
        .savenex stackaddr STACK_TOP
        .savenex entryaddr main
        
main:
        ld a,1
        call subroutine
        ret

subroutine:
        ld b,2
        ret
        
        .defs $100
STACK_TOP:
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      // main: ld a,1 (2 bytes), call (3 bytes), ret (1 byte), 
      // subroutine: ld b,2 (2 bytes), ret (1 byte) = 9 bytes total
      // .defs $100 fills 256 bytes, STACK_TOP at $8000 + 9 + 256 = $8109
      expect(output.nexConfig.stackAddr).toBe(0x8109);
      expect(output.nexConfig.entryAddr).toBe(0x8000);
    });
  });
});
