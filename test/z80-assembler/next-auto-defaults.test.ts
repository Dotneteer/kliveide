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
});
