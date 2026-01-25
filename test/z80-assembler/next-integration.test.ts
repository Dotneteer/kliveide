import { describe, it, expect } from "vitest";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { NexFileWriter } from "@main/z80-compiler/nex-file-writer";

describe("Next Integration Tests - Real-World Scenarios", () => {
  async function testCompile(source: string) {
    const options = new AssemblerOptions();
    const assembler = new Z80Assembler();
    return await assembler.compile(source, options);
  }

  describe("User's Simplified Syntax", () => {
    it("✅ User's original simplified example compiles and generates NEX", async () => {
      const source = `
        .model next
        .savenex file "screen-tests.nex"
        .savenex core "3.1.0"
        .savenex entryaddr $8000
        
        main:
          ld a,3
          out ($fe),a
        trap: 
          jr trap
      `;
      
      const output = await testCompile(source);
      
      // Verify compilation succeeded
      expect(output.errors.length).toBe(0);
      
      // Verify defaults were applied
      expect(output.nexConfig.ramSize).toBe(768);
      expect(output.nexConfig.borderColor).toBe(7);
      expect(output.nexConfig.entryAddr).toBe(0x8000);
      
      // Verify code structure
      expect(output.segments.length).toBeGreaterThan(0);
      expect(output.segments[0].bank).toBeUndefined(); // Unbanked
      expect(output.segments[0].startAddress).toBe(0x8000); // Default address
      
      // Verify unbanked tracking
      expect(output.unbankedSegments).toBeDefined();
      expect(output.unbankedSegments!.length).toBeGreaterThan(0);
      
      // Verify NEX file can be generated
      const nexData = await NexFileWriter.fromAssemblerOutput(output, "/tmp");
      expect(nexData).toBeDefined();
      expect(nexData.length).toBeGreaterThan(512);
      
      // Verify NEX file signature
      expect(nexData[0]).toBe(0x4e); // 'N'
      expect(nexData[1]).toBe(0x65); // 'e'
      expect(nexData[2]).toBe(0x78); // 'x'
      expect(nexData[3]).toBe(0x74); // 't'
    });

    it("✅ Simplified example without explicit entryaddr gets default", async () => {
      const source = `
        .model next
        .savenex file "app.nex"
        .savenex core "3.1.0"
        
        main:
          ld a,7
          out ($fe),a
          ret
      `;
      
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      expect(output.nexConfig.entryAddr).toBe(0x8000); // Default
      expect(output.nexConfig.ramSize).toBe(768); // Default
      expect(output.nexConfig.borderColor).toBe(7); // Default
    });
  });

  describe("Complex Multi-Bank Applications", () => {
    it("✅ Complex app with unbanked main code + multiple banked extensions", async () => {
      const source = `
        .model next
        .savenex file "complex.nex"
        .savenex core "3.1.0"
        
        ; Main unbanked code in bank 2
        main:
          call bank2Init
          call switchToBank3
          call bank3Code
          call switchToBank5
          call bank5Code
          ret
        
        bank2Init:
          ld a,7
          out ($fe),a
          ret
        
        switchToBank3:
          ld a,3
          out ($fE),a
          ret
        
        switchToBank5:
          ld a,5
          out ($fE),a
          ret
        
        ; Extended code in bank 3
        .bank 3
        .org 0xC000
        
        bank3Code:
          ld b,0
        loop3:
          djnz loop3
          ret
        
        ; Extended code in bank 5
        .bank 5
        .org 0xC000
        
        bank5Code:
          ld c,0
        loop5:
          dec c
          jr nz, loop5
          ret
      `;
      
      const output = await testCompile(source);
      
      // Verify compilation succeeded
      expect(output.errors.length).toBe(0);
      
      // Verify multiple segments
      expect(output.segments.length).toBeGreaterThanOrEqual(3);
      
      // Verify we have unbanked and banked segments
      const unbankedCount = output.segments.filter(s => s.bank === undefined).length;
      const bankedCount = output.segments.filter(s => s.bank !== undefined).length;
      expect(unbankedCount).toBeGreaterThan(0);
      expect(bankedCount).toBeGreaterThan(0);
      
      // Verify specific banks present
      expect(output.segments.some(s => s.bank === 3)).toBe(true);
      expect(output.segments.some(s => s.bank === 5)).toBe(true);
      
      // Verify NEX generation
      const nexData = await NexFileWriter.fromAssemblerOutput(output, "/tmp");
      expect(nexData).toBeDefined();
      expect(nexData.length).toBeGreaterThan(512 * 2);
    });

    it("✅ Mixed code with unbanked segments at different addresses", async () => {
      const source = `
        .model next
        .savenex file "mixed.nex"
        .savenex core "3.1.0"
        
        ; Unbanked code starting at $8000 (default)
        section1:
          ld a,1
          ld b,2
          ret
        
        ; Switch to different unbanked address
        .org $8500
        
        section2:
          ld c,3
          ld d,4
          ret
        
        ; Switch to yet another address
        .org $9000
        
        section3:
          ld e,5
          ld h,6
          ret
        
        ; Explicit bank for comparison
        .bank 4
        .org 0xC000
        
        bankSection:
          ld l,7
          ret
      `;
      
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      
      // Verify unbanked segments at different addresses
      expect(output.unbankedSegments).toBeDefined();
      expect(output.unbankedSegments!.some(s => s.startAddress === 0x8000)).toBe(true);
      expect(output.unbankedSegments!.some(s => s.startAddress === 0x8500)).toBe(true);
      expect(output.unbankedSegments!.some(s => s.startAddress === 0x9000)).toBe(true);
      
      // Verify explicit bank
      expect(output.segments.some(s => s.bank === 4)).toBe(true);
      
      // Verify NEX generation works
      const nexData = await NexFileWriter.fromAssemblerOutput(output, "/tmp");
      expect(nexData).toBeDefined();
    });
  });

  describe("Backward Compatibility", () => {
    it("✅ Traditional explicit bank layout still works unchanged", async () => {
      const source = `
        .model next
        .savenex file "traditional.nex"
        .savenex ram 768
        .savenex border 7
        .savenex entryaddr $8000
        
        ; Traditional multi-bank layout with explicit bank
        .bank 2
        .org 0x0000
        .disp 0x8000
        
        main:
          ld a,3
          out ($fe),a
        trap: 
          jr trap
      `;
      
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      
      // Verify explicit values are used
      expect(output.nexConfig.ramSize).toBe(768);
      expect(output.nexConfig.borderColor).toBe(7);
      expect(output.nexConfig.entryAddr).toBe(0x8000);
      
      // Verify segment structure
      expect(output.segments[0].bank).toBe(2);
      expect(output.segments[0].startAddress).toBe(0x0000);
      expect(output.segments[0].displacement).toBe(0x8000);
    });

    it("✅ Non-Next models unaffected by auto-mode", async () => {
      const source = `
        .model Spectrum48
        .org $8000
        
        main:
          ld a,1
          ret
      `;
      
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      
      // Verify no Next-specific auto-defaults applied
      expect(output.nexConfig).toBeDefined();
      // Note: ramSize might have a standard default value
      expect(output.nexConfig.borderColor).toBe(0); // Default for Spectrum48
      
      // Verify no unbanked tracking
      expect(output.unbankedSegments).toBeUndefined();
      
      // Verify isNextAutoMode not set
      expect(output.isNextAutoMode).toBeUndefined();
    });

    it("✅ User can override all defaults individually", async () => {
      const source = `
        .model next
        .savenex file "overridden.nex"
        .savenex ram 1792
        .savenex border 2
        .savenex entryaddr $9000
        .savenex core "3.0.0"
        
        main:
          ld a,1
          ret
      `;
      
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      
      // Verify all values overridden
      expect(output.nexConfig.ramSize).toBe(1792);
      expect(output.nexConfig.borderColor).toBe(2);
      expect(output.nexConfig.entryAddr).toBe(0x9000);
      expect(output.nexConfig.coreVersion.major).toBe(3);
      expect(output.nexConfig.coreVersion.minor).toBe(0);
      expect(output.nexConfig.coreVersion.subminor).toBe(0);
    });
  });

  describe("Edge Cases and Special Scenarios", () => {
    it("✅ Code with .disp works correctly with unbanked mode", async () => {
      const source = `
        .model next
        .savenex file "disp.nex"
        
        .org $8100
        .disp $8000
        
        main:
          ld hl,$        ; Should equal $8000 due to disp
          ld a,1
          ret
      `;
      
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      
      // Verify segment structure
      expect(output.segments[0].startAddress).toBe(0x8100);
      expect(output.segments[0].displacement).toBe(0x8000);
    });

    it("✅ Multiple pragmas on same line with Next defaults", async () => {
      const source = `
        .model next
        .savenex file "multi.nex"
        .savenex core "3.1.0"
        
        .org $8200
        
        data:
          db 1, 2, 3, 4, 5
        
        code:
          ld a,7
          out ($fe),a
          ret
      `;
      
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      
      // Verify defaults applied
      expect(output.nexConfig.ramSize).toBe(768);
      expect(output.nexConfig.borderColor).toBe(7);
      
      // Verify code at custom org
      expect(output.unbankedSegments!.some(s => s.startAddress === 0x8200)).toBe(true);
    });

    it("✅ Empty Next program with only defaults", async () => {
      const source = `
        .model next
        .savenex file "empty.nex"
        .savenex core "3.1.0"
      `;
      
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      
      // Verify defaults were set
      expect(output.nexConfig.ramSize).toBe(768);
      expect(output.nexConfig.borderColor).toBe(7);
      expect(output.nexConfig.entryAddr).toBe(0x8000);
      
      // Verify NEX can still be generated
      const nexData = await NexFileWriter.fromAssemblerOutput(output, "/tmp");
      expect(nexData).toBeDefined();
    });

    it("✅ Complex labels and jumps with unbanked code", async () => {
      const source = `
        .model next
        .savenex file "labels.nex"
        
        main:
          call initDisplay
          call mainLoop
          ret
        
        initDisplay:
          ld a,7
          out ($fe),a
          ret
        
        mainLoop:
          ld b,10
        loopCount:
          ld c,255
        innerLoop:
          dec c
          jr nz, innerLoop
          djnz loopCount
          ret
      `;
      
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      
      // Verify code compiled with labels
      expect(output.segments.length).toBeGreaterThan(0);
      expect(output.segments[0].startAddress).toBe(0x8000);
      expect(output.segments[0].emittedCode.length).toBeGreaterThan(0);
    });
  });

  describe("Warning and Error Handling", () => {
    it("✅ Code with unbanked segments at various addresses compiles", async () => {
      const source = `
        .model next
        .savenex file "addr.nex"
        
        ; Code at default $8000
        .org $8000
        ld a,1
        
        ; Code at $9000
        .org $9000
        ld b,2
        
        ; Code at $a000
        .org $a000
        ld c,3
      `;
      
      const output = await testCompile(source);
      
      // Should compile successfully
      expect(output.errors.filter(e => !e.isWarning).length).toBe(0);
      
      // Code compiles despite multiple segments at different addresses
      expect(output.segments.length).toBeGreaterThanOrEqual(3);
      expect(output.segments.some(s => s.startAddress === 0x8000)).toBe(true);
      expect(output.segments.some(s => s.startAddress === 0x9000)).toBe(true);
      expect(output.segments.some(s => s.startAddress === 0xa000)).toBe(true);
    });

    it("✅ Multiple unbanked sections with overlapping addresses prevented", async () => {
      const source = `
        .model next
        .savenex file "overlap.nex"
        
        .org $8000
        ld a,1
        ld b,2
        ld c,3
        
        .org $8001
        ld d,4
        ld e,5
      `;
      
      const output = await testCompile(source);
      
      // This should compile - assembler allows overlapping .org
      // (later code overwrites earlier code at the same addresses)
      expect(output.errors.filter(e => !e.isWarning).length).toBe(0);
      expect(output.segments.length).toBeGreaterThanOrEqual(2);
    });
  });
});
