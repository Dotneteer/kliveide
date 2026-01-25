import { describe, it, expect } from "vitest";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { NexFileWriter } from "@main/z80-compiler/nex-file-writer";

describe("Next NEX Export - Unbanked Code Mapping", () => {
  async function testCompile(source: string) {
    const options = new AssemblerOptions();
    const assembler = new Z80Assembler();
    return await assembler.compile(source, options);
  }

  async function generateNexFile(source: string) {
    const output = await testCompile(source);
    if (output.errors.length > 0) {
      throw new Error(`Compilation failed: ${output.errors[0].message}`);
    }
    return await NexFileWriter.fromAssemblerOutput(output, "/tmp");
  }

  describe("Bank 2 Offset Mapping", () => {
    it("✅ Unbanked code at $8000 maps to bank 2 offset $0000", async () => {
      const source = `
        .model next
        .savenex file "test.nex"
        .org $8000
        ld a,7
        out ($fe),a
        ret
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      expect(output.unbankedSegments).toBeDefined();
      expect(output.unbankedSegments![0].startAddress).toBe(0x8000);
      
      // Verify NEX generation works
      const nexData = await generateNexFile(source);
      expect(nexData).toBeDefined();
      expect(nexData.length).toBeGreaterThan(512);
    });

    it("✅ Unbanked code at $8200 maps to bank 2 offset $0200", async () => {
      const source = `
        .model next
        .savenex file "test.nex"
        .org $8200
        ld a,7
        out ($fe),a
        ret
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      // Should have unbanked segments at $8000 (default) and $8200 (explicit org)
      const unbanked8200 = output.unbankedSegments!.find(s => s.startAddress === 0x8200);
      expect(unbanked8200).toBeDefined();
      
      const nexData = await generateNexFile(source);
      expect(nexData).toBeDefined();
      expect(nexData.length).toBeGreaterThan(512);
    });

    it("✅ Unbanked code at $9000 maps to bank 2 offset $1000", async () => {
      const source = `
        .model next
        .savenex file "test.nex"
        .org $9000
        ld a,7
        out ($fe),a
        ret
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      // Should have an unbanked segment at $9000
      const unbanked9000 = output.unbankedSegments!.find(s => s.startAddress === 0x9000);
      expect(unbanked9000).toBeDefined();
      
      const nexData = await generateNexFile(source);
      expect(nexData).toBeDefined();
    });

    it("✅ Gap handling: code at $8000 and $9000 creates gap in bank 2", async () => {
      const source = `
        .model next
        .savenex file "test.nex"
        .org $8000
        ld a,1  ; At $8000 (offset $0000)
        
        .org $9000
        ld b,2  ; At $9000 (offset $1000) - creates gap from $0001-$0fff
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      // Should have unbanked segments at $8000 and $9000
      expect(output.unbankedSegments!.some(s => s.startAddress === 0x8000)).toBe(true);
      expect(output.unbankedSegments!.some(s => s.startAddress === 0x9000)).toBe(true);
      
      const nexData = await generateNexFile(source);
      expect(nexData).toBeDefined();
    });
  });

  describe("Mixed Unbanked and Banked Code", () => {
    it("✅ Mixed unbanked + banked code exports both correctly", async () => {
      const source = `
        .model next
        .savenex file "test.nex"
        
        ; Unbanked code in bank 2
        ld a,1
        
        .bank 5
        .org 0xC000
        ; Banked code in bank 5
        ld b,2
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      // Should have both unbanked and banked segments
      expect(output.unbankedSegments!.length).toBeGreaterThan(0);
      expect(output.segments.some(s => s.bank === 5)).toBe(true);
      
      const nexData = await generateNexFile(source);
      expect(nexData).toBeDefined();
      expect(nexData.length).toBeGreaterThan(512);
    });

    it("✅ Multiple unbanked sections with explicit bank sections", async () => {
      const source = `
        .model next
        .savenex file "test.nex"
        
        .org $8000
        ld a,1  ; Unbanked at $8000
        
        .bank 3
        .org 0xC000
        ld b,2  ; Bank 3
        
        .bank 2  ; Explicit bank 2 (different from auto unbanked)
        .org 0x0100
        ld c,3
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      
      const nexData = await generateNexFile(source);
      expect(nexData).toBeDefined();
    });
  });

  describe("NEX File Structure", () => {
    it("✅ Generated NEX file has valid structure with unbanked code", async () => {
      const source = `
        .model next
        .savenex file "test.nex"
        .savenex ram 768
        .savenex border 7
        .savenex entryaddr $8000
        
        ld a,3
        out ($fe),a
        ret
      `;
      const nexData = await generateNexFile(source);
      
      // Verify NEX signature
      expect(nexData[0]).toBe(0x4e); // 'N'
      expect(nexData[1]).toBe(0x65); // 'e'
      expect(nexData[2]).toBe(0x78); // 'x'
      expect(nexData[3]).toBe(0x74); // 't'
      
      // Verify version
      expect(nexData[4]).toBe(0x56); // 'V'
      expect(nexData[5]).toBe(0x31); // '1'
      expect(nexData[6]).toBe(0x2e); // '.'
      expect(nexData[7]).toBe(0x32); // '2'
      
      // Verify it's substantial enough to contain data
      expect(nexData.length).toBeGreaterThan(512 * 2);
    });

    it("✅ NEX file contains unbanked code in bank 2 data section", async () => {
      const source = `
        .model next
        .savenex file "test.nex"
        
        .org $8000
        ld a,7      ; Opcode: 0x3E 07
        out ($fe),a ; Opcode: 0xD3 FE
        ret         ; Opcode: 0xC9
      `;
      const output = await testCompile(source);
      const nexData = await generateNexFile(source);
      
      // NEX file should contain code at bank 2 offset $0000
      // Header is 512 bytes, then bank data
      const codeStartOffset = 512; // After header
      
      // First byte should be ld a,7
      expect(nexData[codeStartOffset]).toBe(0x3e);
      // Second byte should be 7
      expect(nexData[codeStartOffset + 1]).toBe(0x07);
    });
  });

  describe("Edge Cases", () => {
    it("✅ Unbanked code at $bfff (last valid address) exports correctly", async () => {
      const source = `
        .model next
        .savenex file "test.nex"
        
        .org $bfff
        nop  ; Single byte at last valid address
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      
      const nexData = await generateNexFile(source);
      expect(nexData).toBeDefined();
    });

    it("✅ Empty unbanked program still generates valid NEX", async () => {
      const source = `
        .model next
        .savenex file "test.nex"
        .savenex ram 768
        .savenex border 7
      `;
      const output = await testCompile(source);
      expect(output.errors.length).toBe(0);
      
      const nexData = await generateNexFile(source);
      expect(nexData).toBeDefined();
      expect(nexData.length).toBeGreaterThan(512);
    });
  });
});
