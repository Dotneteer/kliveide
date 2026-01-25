import { describe, it, expect } from "vitest";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { NexFileWriter } from "@main/z80-compiler/nex-file-writer";

describe("NEX Integration Tests", () => {
  it("compiles and generates NEX file from source", async () => {
    const source = `
      ; NEX integration test
      .model Next
      
      ; Configure NEX file
      .savenex file "test.nex"
      .savenex ram 768
      .savenex border 5
      .savenex core 3, 1, 10
      .savenex stackaddr 0xFF00
      .savenex entrybank 5
      
      ; Code in bank 5
      .bank 5
      .org 0xC000
      .ent $
      
    Start:
      ld a, 5
      out (0xFE), a
      halt
      jr Start
    `;

    const options = new AssemblerOptions();
    options.currentModel = 4; // Next
    
    const assembler = new Z80Assembler();
    const output = await assembler.compile(source, options);
    
    expect(output.errors.length).toBe(0);
    expect(output.nexConfig).toBeDefined();
    expect(output.nexConfig.filename).toBe("test.nex");
    expect(output.modelType).toBe(4); // SpectrumModelType.Next
    
    // Generate NEX file
    const nexData = await NexFileWriter.fromAssemblerOutput(output, process.cwd());
    
    expect(nexData).toBeDefined();
    expect(nexData.length).toBeGreaterThan(512); // At least header + 1 bank
    
    // Verify header
    expect(nexData[0]).toBe(0x4E); // 'N'
    expect(nexData[1]).toBe(0x65); // 'e'
    expect(nexData[2]).toBe(0x78); // 'x'
    expect(nexData[3]).toBe(0x74); // 't'
    
    // Verify configuration
    expect(nexData[8]).toBe(0); // 768K RAM
    expect(nexData[11]).toBe(5); // Border color
    expect(nexData[135]).toBe(3); // Core major
    expect(nexData[136]).toBe(1); // Core minor
    expect(nexData[137]).toBe(10); // Core subminor
    expect(nexData[139]).toBe(5); // Entry bank
    
    // Verify at least one bank is present
    expect(nexData[18 + 5]).toBe(1); // Bank 5 present
  });

  it("handles multi-bank programs correctly", async () => {
    const source = `
      .model Next
      
      .savenex file "multibank.nex"
      .savenex ram 768
      .savenex entrybank 5
      
      ; Main code in bank 5
      .bank 5
      .org 0xC000
      .ent $
    Main:
      ld a, 1
      ret
      
      ; Data in bank 2
      .bank 2
      .org 0xC000
    Data:
      .defb 1,2,3,4,5
      
      ; Graphics in bank 10
      .bank 10
      .org 0xC000
    Graphics:
      .defb 0xFF,0xFF,0xFF,0xFF
    `;

    const options = new AssemblerOptions();
    options.currentModel = 4;
    
    const assembler = new Z80Assembler();
    const output = await assembler.compile(source, options);
    
    expect(output.errors.length).toBe(0);
    expect(output.segments.filter(s => s.bank === 5).length).toBeGreaterThan(0);
    expect(output.segments.filter(s => s.bank === 2).length).toBeGreaterThan(0);
    expect(output.segments.filter(s => s.bank === 10).length).toBeGreaterThan(0);
    
    const nexData = await NexFileWriter.fromAssemblerOutput(output, process.cwd());
    
    // Verify banks are present in header
    expect(nexData[18 + 5]).toBe(1); // Bank 5
    expect(nexData[18 + 2]).toBe(1); // Bank 2
    expect(nexData[18 + 10]).toBe(1); // Bank 10
    
    // Verify bank count
    expect(nexData[9]).toBe(3); // 3 banks total
  });

  it("handles configuration defaults correctly", async () => {
    const source = `
      .model Next
      
      .savenex file "defaults.nex"
      
      .org 0x8000
      .ent $
      ld a, 1
      ret
    `;

    const options = new AssemblerOptions();
    options.currentModel = 4;
    
    const assembler = new Z80Assembler();
    const output = await assembler.compile(source, options);
    
    expect(output.errors.length).toBe(0);
    expect(output.nexConfig.ramSize).toBe(768); // Default
    expect(output.nexConfig.borderColor).toBe(7); // Auto-default for Next model
    expect(output.nexConfig.entryBank).toBe(0); // Default
    
    const nexData = await NexFileWriter.fromAssemblerOutput(output, process.cwd());
    expect(nexData[8]).toBe(0); // 768K RAM
    expect(nexData[11]).toBe(7); // White border (auto-default for Next)
  });

  it("validates model type requirement", async () => {
    const source = `
      .model Spectrum128
      
      .savenex file "invalid.nex"
      
      .org 0x8000
      ld a, 1
      ret
    `;

    const options = new AssemblerOptions();
    options.currentModel = 1; // Spectrum 128
    
    const assembler = new Z80Assembler();
    const output = await assembler.compile(source, options);
    
    // Should have error about .savenex only working with Next
    expect(output.errors.length).toBeGreaterThan(0);
    expect(output.errors[0].errorCode).toBe("Z0340");
  });

  it("supports all savenex configuration options", async () => {
    const source = `
      .model Next
      
      .savenex file "full-config.nex"
      .savenex ram 1792
      .savenex border 7
      .savenex core 3, 1, 10
      .savenex stackaddr 0x5FFF
      .savenex entryaddr 0xC000
      .savenex entrybank 5
      .savenex filehandle "close"
      .savenex preserve "on"
      .savenex bar "on", 128, 50, 100
      
      .bank 5
      .org 0xC000
      .ent $
      ld a, 7
      ret
    `;

    const options = new AssemblerOptions();
    options.currentModel = 4;
    
    const assembler = new Z80Assembler();
    const output = await assembler.compile(source, options);
    
    expect(output.errors.length).toBe(0);
    expect(output.nexConfig.ramSize).toBe(1792);
    expect(output.nexConfig.borderColor).toBe(7);
    expect(output.nexConfig.stackAddr).toBe(0x5FFF);
    expect(output.nexConfig.entryAddr).toBe(0xC000);
    expect(output.nexConfig.entryBank).toBe(5);
    expect(output.nexConfig.preserveRegs).toBe(true);
    expect(output.nexConfig.loadingBar.enabled).toBe(true);
    expect(output.nexConfig.loadingBar.color).toBe(128);
    
    const nexData = await NexFileWriter.fromAssemblerOutput(output, process.cwd());
    
    expect(nexData[8]).toBe(1); // 1792K RAM
    expect(nexData[11]).toBe(7); // White border
    expect(nexData[12]).toBe(0xFF); // Stack LSB
    expect(nexData[13]).toBe(0x5F); // Stack MSB
    expect(nexData[14]).toBe(0x00); // PC LSB
    expect(nexData[15]).toBe(0xC0); // PC MSB
    expect(nexData[130]).toBe(1); // Loading bar enabled
    expect(nexData[131]).toBe(128); // Loading bar color
    expect(nexData[134]).toBe(1); // Preserve regs
  });

  it("handles expression evaluation in savenex pragmas", async () => {
    const source = `
      .model Next
      
      STACK_TOP equ 0xFF00
      ENTRY_POINT equ 0xC000
      
      .savenex file "expressions.nex"
      .savenex stackaddr STACK_TOP
      .savenex entryaddr ENTRY_POINT
      
      .bank 5
      .org ENTRY_POINT
      .ent $
      ld a, 1
      ret
    `;

    const options = new AssemblerOptions();
    options.currentModel = 4;
    
    const assembler = new Z80Assembler();
    const output = await assembler.compile(source, options);
    
    expect(output.errors.length).toBe(0);
    expect(output.nexConfig.stackAddr).toBe(0xFF00);
    expect(output.nexConfig.entryAddr).toBe(0xC000);
    
    const nexData = await NexFileWriter.fromAssemblerOutput(output, process.cwd());
    expect(nexData[12]).toBe(0x00); // Stack LSB
    expect(nexData[13]).toBe(0xFF); // Stack MSB
    expect(nexData[14]).toBe(0x00); // PC LSB
    expect(nexData[15]).toBe(0xC0); // PC MSB
  });
});
