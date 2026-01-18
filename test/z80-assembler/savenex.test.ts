import { describe, it, expect } from "vitest";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";

describe("Z80 Assembler - SaveNex Pragma", async () => {
  it("rejects SaveNex with non-Next model", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 1; // Spectrum 48
    const compiler = new Z80Assembler();
    const source = `
      .savenex file "test.nex"
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(1);
    expect(result.errors[0].errorCode).toBe("Z0340");
  });

  it("parses .savenex file with string literal", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4; // Spectrum Next
    const compiler = new Z80Assembler();
    const source = `
      .savenex file "myprogram.nex"
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.filename).toBe("myprogram.nex");
  });

  it("rejects .savenex file with non-string expression", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex file 12345
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(1);
    expect(result.errors[0].errorCode).toBe("Z0341");
  });

  it("parses .savenex ram 768", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex ram 768
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.ramSize).toBe(768);
  });

  it("parses .savenex ram 1792", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex ram 1792
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.ramSize).toBe(1792);
  });

  it("rejects .savenex ram with invalid value", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex ram 1024
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(1);
    expect(result.errors[0].errorCode).toBe("Z0342");
  });

  it("parses .savenex border with valid color", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex border 5
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.borderColor).toBe(5);
  });

  it("rejects .savenex border with out-of-range color", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex border 8
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(1);
    expect(result.errors[0].errorCode).toBe("Z0343");
  });

  it("parses .savenex core with valid version numbers", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex core 3, 1, 10
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.coreVersion.major).toBe(3);
    expect(result.nexConfig.coreVersion.minor).toBe(1);
    expect(result.nexConfig.coreVersion.subminor).toBe(10);
  });

  it("parses .savenex core with string version format", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex core "3.1.10"
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.coreVersion.major).toBe(3);
    expect(result.nexConfig.coreVersion.minor).toBe(1);
    expect(result.nexConfig.coreVersion.subminor).toBe(10);
  });

  it("rejects .savenex core with invalid string version format", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex core "3.1"
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(1);
    expect(result.errors[0].errorCode).toBe("Z0344");
  });

  it("rejects .savenex core with non-numeric string parts", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex core "3.a.10"
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(1);
    expect(result.errors[0].errorCode).toBe("Z0344");
  });

  it("rejects .savenex core with out-of-range version", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex core 256, 0, 0
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(1);
    expect(result.errors[0].errorCode).toBe("Z0344");
  });

  it("rejects .savenex core with out-of-range version in string format", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex core "256.0.0"
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(1);
    expect(result.errors[0].errorCode).toBe("Z0344");
  });

  it("parses .savenex stackaddr with valid address", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex stackaddr 0xFF00
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.stackAddr).toBe(0xFF00);
  });

  it("rejects .savenex stackaddr with out-of-range address", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex stackaddr 0x10000
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(1);
    expect(result.errors[0].errorCode).toBe("Z0351");
  });

  it("parses .savenex entryaddr with valid address", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex entryaddr 0x8000
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.entryAddr).toBe(0x8000);
  });

  it("rejects .savenex entryaddr with out-of-range address", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex entryaddr 0x10000
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(1);
    expect(result.errors[0].errorCode).toBe("Z0352");
  });

  it("parses .savenex entrybank with valid bank", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex entrybank 5
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.entryBank).toBe(5);
  });

  it("rejects .savenex entrybank with out-of-range bank", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex entrybank 112
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(1);
    expect(result.errors[0].errorCode).toBe("Z0345");
  });

  it("parses .savenex filehandle close", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex filehandle "close"
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.fileHandle).toBe("close");
  });

  it("parses .savenex filehandle open", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex filehandle "open"
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.fileHandle).toBe("open");
  });

  it("rejects .savenex filehandle with invalid mode", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex filehandle "invalid"
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(1);
    expect(result.errors[0].errorCode).toBe("Z0349");
  });

  it("parses .savenex preserve on", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex preserve "on"
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.preserveRegs).toBe(true);
  });

  it("parses .savenex preserve off", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex preserve "off"
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.preserveRegs).toBe(false);
  });

  it("parses .savenex preserve with integer", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex preserve 1
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.preserveRegs).toBe(true);
  });

  it("parses .savenex screen layer2", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex screen "layer2"
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.screen?.type).toBe("layer2");
    expect(result.nexConfig.screen?.filename).toBeUndefined();
  });

  it("parses .savenex screen with filename", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex screen "ula", "screen.scr"
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.screen?.type).toBe("ula");
    expect(result.nexConfig.screen?.filename).toBe("screen.scr");
  });

  it("parses .savenex screen with filename and palette offset", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex screen "lores", "screen.scr", 256
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.screen?.type).toBe("lores");
    expect(result.nexConfig.screen?.filename).toBe("screen.scr");
    expect(result.nexConfig.screen?.paletteOffset).toBe(256);
  });

  it("rejects .savenex screen with invalid type", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex screen "invalid"
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(1);
    expect(result.errors[0].errorCode).toBe("Z0347");
  });

  it("parses .savenex palette", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex palette "palette.pal"
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.paletteFile).toBe("palette.pal");
  });

  it("parses .savenex copper", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex copper "copper.cop"
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.copperFile).toBe("copper.cop");
  });

  it("parses .savenex bar on", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex bar "on"
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.loadingBar.enabled).toBe(true);
  });

  it("parses .savenex bar with color", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex bar "on", 128
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.loadingBar.enabled).toBe(true);
    expect(result.nexConfig.loadingBar.color).toBe(128);
  });

  it("parses .savenex bar with all parameters", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex bar "on", 128, 50, 100
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.loadingBar.enabled).toBe(true);
    expect(result.nexConfig.loadingBar.color).toBe(128);
    expect(result.nexConfig.loadingBar.delay).toBe(50);
    expect(result.nexConfig.loadingBar.startDelay).toBe(100);
  });

  it("accumulates multiple .savenex pragmas", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex file "test.nex"
      .savenex ram 1792
      .savenex border 2
      .savenex core 3, 1, 10
      .savenex stackaddr 0xFFF0
      .savenex entryaddr 0x8000
      .savenex entrybank 5
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.filename).toBe("test.nex");
    expect(result.nexConfig.ramSize).toBe(1792);
    expect(result.nexConfig.borderColor).toBe(2);
    expect(result.nexConfig.coreVersion.major).toBe(3);
    expect(result.nexConfig.coreVersion.minor).toBe(1);
    expect(result.nexConfig.coreVersion.subminor).toBe(10);
    expect(result.nexConfig.stackAddr).toBe(0xFFF0);
    expect(result.nexConfig.entryAddr).toBe(0x8000);
    expect(result.nexConfig.entryBank).toBe(5);
  });

  it("preserves default values when not specified", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex file "test.nex"
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.ramSize).toBe(768); // default
    expect(result.nexConfig.borderColor).toBe(0); // default
    expect(result.nexConfig.entryBank).toBe(0); // default
    expect(result.nexConfig.fileHandle).toBe("close"); // default
    expect(result.nexConfig.preserveRegs).toBe(false); // default
    expect(result.nexConfig.loadingBar.enabled).toBe(false); // default
  });

  it("supports expressions in .savenex pragmas", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      ENTRY_ADDR equ 0x8000
      STACK_TOP equ 0xFF00
      
      .savenex entryaddr ENTRY_ADDR
      .savenex stackaddr STACK_TOP
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.entryAddr).toBe(0x8000);
    expect(result.nexConfig.stackAddr).toBe(0xFF00);
  });

  it("case insensitive subcommands", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .SAVENEX FILE "test.nex"
      .savenex RAM 768
      .SaveNex Border 3
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(0);
    expect(result.nexConfig.filename).toBe("test.nex");
    expect(result.nexConfig.ramSize).toBe(768);
    expect(result.nexConfig.borderColor).toBe(3);
  });

  it("rejects unknown subcommand", async () => {
    const options = new AssemblerOptions();
    options.currentModel = 4;
    const compiler = new Z80Assembler();
    const source = `
      .savenex unknown "value"
    `;
    const result = await compiler.compile(source, options);

    expect(result.errors.length).toBe(1);
    expect(result.errors[0].errorCode).toBe("Z0346");
  });
});
