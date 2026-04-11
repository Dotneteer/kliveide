import { describe, it, expect } from "vitest";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";

// ---------------------------------------------------------------------------
// Helpers

function nextOptions(): AssemblerOptions {
  const opts = new AssemblerOptions();
  opts.currentModel = SpectrumModelType.Next;
  return opts;
}

async function compileDma(
  source: string,
  ...expectedBytes: number[]
): Promise<void> {
  const compiler = new Z80Assembler();
  const result = await compiler.compile(source, nextOptions());
  expect(result.errorCount).toBe(0);
  expect(result.segments.length).toBe(1);
  expect(result.segments[0].emittedCode.length).toBe(expectedBytes.length);
  for (let i = 0; i < expectedBytes.length; i++) {
    expect(result.segments[0].emittedCode[i]).toBe(expectedBytes[i]);
  }
}

async function compileDmaErrors(
  source: string,
  ...errorCodes: string[]
): Promise<void> {
  const compiler = new Z80Assembler();
  const result = await compiler.compile(source, nextOptions());
  expect(result.errorCount).toBe(errorCodes.length);
  for (let i = 0; i < errorCodes.length; i++) {
    expect(result.errors[i].errorCode).toBe(errorCodes[i]);
  }
}

async function compileDmaWithModelError(source: string, model: number): Promise<void> {
  const compiler = new Z80Assembler();
  const opts = new AssemblerOptions();
  opts.currentModel = model;
  const result = await compiler.compile(source, opts);
  expect(result.errorCount).toBeGreaterThan(0);
  expect(result.errors.some((e) => e.errorCode === "Z0368")).toBe(true);
}

// ---------------------------------------------------------------------------
// Model guard

describe("Z80 Assembler - .dma pragma: model guard", () => {
  it("rejects .dma on Spectrum 48 model", async () => {
    await compileDmaWithModelError(".dma reset", SpectrumModelType.Spectrum48);
  });

  it("rejects .dma on Spectrum 128 model", async () => {
    await compileDmaWithModelError(".dma reset", SpectrumModelType.Spectrum128);
  });

  it("rejects .dma on Spectrum+3 model", async () => {
    await compileDmaWithModelError(".dma reset", SpectrumModelType.SpectrumP3);
  });

  it("accepts .dma on ZX Spectrum Next model", async () => {
    await compileDma(".dma reset", 0xc3);
  });

  it("accepts .model next before .dma", async () => {
    const compiler = new Z80Assembler();
    const result = await compiler.compile(".model next\n.dma reset");
    expect(result.errorCount).toBe(0);
    expect(result.segments[0].emittedCode[0]).toBe(0xc3);
  });
});

// ---------------------------------------------------------------------------
// WR6 simple commands

describe("Z80 Assembler - .dma simple commands (WR6)", () => {
  it(".dma reset emits 0xC3", async () => {
    await compileDma(".dma reset", 0xc3);
  });

  it(".dma load emits 0xCF", async () => {
    await compileDma(".dma load", 0xcf);
  });

  it(".dma enable emits 0x87", async () => {
    await compileDma(".dma enable", 0x87);
  });

  it(".dma disable emits 0x83", async () => {
    await compileDma(".dma disable", 0x83);
  });

  it(".dma continue emits 0xD3", async () => {
    await compileDma(".dma continue", 0xd3);
  });

  it(".dma cmd 0xCF emits 0xCF", async () => {
    await compileDma(".dma cmd 0xCF", 0xcf);
  });

  it(".dma cmd 0x87 emits 0x87", async () => {
    await compileDma(".dma cmd 0x87", 0x87);
  });
});

// ---------------------------------------------------------------------------
// readmask

describe("Z80 Assembler - .dma readmask", () => {
  it(".dma readmask 0x7E emits 0xBB, 0x7E", async () => {
    await compileDma(".dma readmask 0x7E", 0xbb, 0x7e);
  });

  it(".dma readmask 0x00 emits 0xBB, 0x00", async () => {
    await compileDma(".dma readmask 0x00", 0xbb, 0x00);
  });
});

// ---------------------------------------------------------------------------
// WR0

describe("Z80 Assembler - .dma wr0", () => {
  it("wr0 a_to_b, transfer (base only) emits 0x7D", async () => {
    // 0x78 | 0x04 (a_to_b) | 0x01 (transfer) = 0x7D
    await compileDma(".dma wr0 a_to_b, transfer", 0x7d);
  });

  it("wr0 b_to_a, transfer (base only) emits 0x79", async () => {
    // 0x78 | 0x00 (b_to_a) | 0x01 (transfer) = 0x79
    await compileDma(".dma wr0 b_to_a, transfer", 0x79);
  });

  it("wr0 a_to_b, search emits 0x7E", async () => {
    // 0x78 | 0x04 | 0x02 = 0x7E
    await compileDma(".dma wr0 a_to_b, search", 0x7e);
  });

  it("wr0 a_to_b, search_transfer emits 0x7F", async () => {
    // 0x78 | 0x04 | 0x03 = 0x7F
    await compileDma(".dma wr0 a_to_b, search_transfer", 0x7f);
  });

  it("wr0 a_to_b, transfer, 0x8000 emits base + addr LE", async () => {
    await compileDma(".dma wr0 a_to_b, transfer, 0x8000", 0x7d, 0x00, 0x80);
  });

  it("wr0 a_to_b, transfer, 0x8000, 1024 emits base + addr + len LE", async () => {
    // len 1024 = 0x0400
    await compileDma(".dma wr0 a_to_b, transfer, 0x8000, 1024", 0x7d, 0x00, 0x80, 0x00, 0x04);
  });

  it("wr0 b_to_a, search, 0x4000, 256 emits correct bytes", async () => {
    // base: 0x78 | 0x00 (b_to_a) | 0x02 (search) = 0x7A
    // addr 0x4000: 0x00, 0x40
    // len 256 = 0x0100: 0x00, 0x01
    await compileDma(".dma wr0 b_to_a, search, 0x4000, 256", 0x7a, 0x00, 0x40, 0x00, 0x01);
  });

  it("wr0 with unknown direction raises Z0361", async () => {
    await compileDmaErrors(".dma wr0 invalid, transfer", "Z0361");
  });

  it("wr0 with unknown transfer type raises Z0362", async () => {
    await compileDmaErrors(".dma wr0 a_to_b, invalid_type", "Z0362");
  });
});

// ---------------------------------------------------------------------------
// WR1

describe("Z80 Assembler - .dma wr1", () => {
  it("wr1 memory, increment emits 0x14", async () => {
    // 0x04 | 0x10 (increment) = 0x14; no timing frame
    await compileDma(".dma wr1 memory, increment", 0x14);
  });

  it("wr1 memory, decrement emits 0x04", async () => {
    await compileDma(".dma wr1 memory, decrement", 0x04);
  });

  it("wr1 memory, fixed emits 0x24", async () => {
    // 0x04 | 0x20 (fixed) = 0x24
    await compileDma(".dma wr1 memory, fixed", 0x24);
  });

  it("wr1 io, fixed emits 0x2C", async () => {
    // 0x04 | 0x08 (io) | 0x20 (fixed) = 0x2C
    await compileDma(".dma wr1 io, fixed", 0x2c);
  });

  it("wr1 io, fixed, 2t emits 0x6C, 0x02", async () => {
    // base: 0x04 | 0x08 | 0x20 | 0x40 (timing) = 0x6C; timing: 2t=0x02
    await compileDma(".dma wr1 io, fixed, 2t", 0x6c, 0x02);
  });

  it("wr1 io, fixed, 3t emits 0x6C, 0x01", async () => {
    await compileDma(".dma wr1 io, fixed, 3t", 0x6c, 0x01);
  });

  it("wr1 io, fixed, 4t emits 0x6C, 0x00", async () => {
    await compileDma(".dma wr1 io, fixed, 4t", 0x6c, 0x00);
  });

  it("wr1 memory, increment, 2t emits base 0x54, timing 0x02", async () => {
    // 0x04 | 0x10 | 0x40 = 0x54; 2t=0x02
    await compileDma(".dma wr1 memory, increment, 2t", 0x54, 0x02);
  });

  it("wr1 with bad port type raises Z0363", async () => {
    await compileDmaErrors(".dma wr1 ram, increment", "Z0363");
  });

  it("wr1 with bad address mode raises Z0364", async () => {
    await compileDmaErrors(".dma wr1 memory, forward", "Z0364");
  });

  it("wr1 with bad cycle length raises Z0365", async () => {
    await compileDmaErrors(".dma wr1 memory, increment, 5t", "Z0365");
  });
});

// ---------------------------------------------------------------------------
// WR2

describe("Z80 Assembler - .dma wr2", () => {
  it("wr2 io, fixed emits 0x28", async () => {
    // 0x00 | 0x08 (io) | 0x20 (fixed) = 0x28
    await compileDma(".dma wr2 io, fixed", 0x28);
  });

  it("wr2 memory, increment emits 0x10", async () => {
    // 0x00 | 0x10 (increment) = 0x10
    await compileDma(".dma wr2 memory, increment", 0x10);
  });

  it("wr2 io, fixed, 3t emits 0x68, 0x01", async () => {
    // base: 0x08 | 0x20 | 0x40 = 0x68; timing: 3t=0x01
    await compileDma(".dma wr2 io, fixed, 3t", 0x68, 0x01);
  });

  it("wr2 io, fixed, 2t emits 0x68, 0x02", async () => {
    await compileDma(".dma wr2 io, fixed, 2t", 0x68, 0x02);
  });

  it("wr2 io, fixed, 3t, 50 emits base, timing with prescaler flag, prescaler", async () => {
    // base: 0x68; timing: 0x01 | 0x20 = 0x21; prescaler: 50=0x32
    await compileDma(".dma wr2 io, fixed, 3t, 50", 0x68, 0x21, 0x32);
  });

  it("wr2 memory, increment, 2t, 100 emits base, timing, prescaler", async () => {
    // base: 0x00 | 0x10 | 0x40 = 0x50; timing: 0x02 | 0x20 = 0x22; prescaler: 100=0x64
    await compileDma(".dma wr2 memory, increment, 2t, 100", 0x50, 0x22, 0x64);
  });
});

// ---------------------------------------------------------------------------
// WR3

describe("Z80 Assembler - .dma wr3", () => {
  it("wr3 (no flags) emits 0x80", async () => {
    // base: 0x80
    await compileDma(".dma wr3", 0x80);
  });

  it("wr3 dma_enable emits 0xC0", async () => {
    // 0x80 | 0x40 = 0xC0
    await compileDma(".dma wr3 dma_enable", 0xc0);
  });

  it("wr3 int_enable emits 0xA0", async () => {
    // 0x80 | 0x20 = 0xA0
    await compileDma(".dma wr3 int_enable", 0xa0);
  });

  it("wr3 stop_on_match emits 0x84", async () => {
    // 0x80 | 0x04 = 0x84
    await compileDma(".dma wr3 stop_on_match", 0x84);
  });

  it("wr3 dma_enable, stop_on_match emits 0xC4", async () => {
    // 0x80 | 0x40 | 0x04 = 0xC4
    await compileDma(".dma wr3 dma_enable, stop_on_match", 0xc4);
  });

  it("wr3 stop_on_match, 0xFF, 0x00 emits 0x9C, 0xFF, 0x00", async () => {
    // 0x80 | 0x04 (stop) | 0x08 (mask) | 0x10 (match) = 0x9C
    await compileDma(".dma wr3 stop_on_match, 0xFF, 0x00", 0x9c, 0xff, 0x00);
  });
});

// ---------------------------------------------------------------------------
// WR4

describe("Z80 Assembler - .dma wr4", () => {
  it("wr4 byte, 0x5B emits 0x8D, 0x5B, 0x00", async () => {
    // base: 0x81 | 0x0C (addr bits) = 0x8D; byte mode: no MM bits
    await compileDma(".dma wr4 byte, 0x5B", 0x8d, 0x5b, 0x00);
  });

  it("wr4 continuous, 0x005B emits 0xAD, 0x5B, 0x00", async () => {
    // base: 0x81 | 0x20 (continuous) | 0x0C = 0xAD
    await compileDma(".dma wr4 continuous, 0x005B", 0xad, 0x5b, 0x00);
  });

  it("wr4 burst, 0x005B emits 0xCD, 0x5B, 0x00", async () => {
    // base: 0x81 | 0x40 (burst) | 0x0C = 0xCD
    await compileDma(".dma wr4 burst, 0x005B", 0xcd, 0x5b, 0x00);
  });

  it("wr4 continuous (no address) emits 0xAD only", async () => {
    await compileDma(".dma wr4 continuous", 0xad);
  });

  it("wr4 with bad mode raises Z0366", async () => {
    await compileDmaErrors(".dma wr4 stream, 0x005B", "Z0366");
  });
});

// ---------------------------------------------------------------------------
// WR5

describe("Z80 Assembler - .dma wr5", () => {
  it("wr5 (no flags) emits 0x82", async () => {
    await compileDma(".dma wr5", 0x82);
  });

  it("wr5 auto_restart emits 0xA2", async () => {
    // 0x82 | 0x20 = 0xA2
    await compileDma(".dma wr5 auto_restart", 0xa2);
  });
});

// ---------------------------------------------------------------------------
// Error cases

describe("Z80 Assembler - .dma error cases", () => {
  it(".dma without sub-command raises Z0360", async () => {
    // Passing '+ 1' which is not an identifier
    const compiler = new Z80Assembler();
    const result = await compiler.compile(".dma + 1", nextOptions());
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.errors[0].errorCode).toBe("Z0360");
  });

  it(".dma unknown subcommand raises Z0360", async () => {
    await compileDmaErrors(".dma foobar", "Z0360");
  });
});

// ---------------------------------------------------------------------------
// Full sprite DMA program (regression)

describe("Z80 Assembler - .dma full program", () => {
  it("compiles sprite DMA program with compile-time constants", async () => {
    const source = `
      .dma reset
      .dma wr0 a_to_b, transfer, 0, 0
      .dma wr1 memory, increment
      .dma wr2 io, fixed
      .dma wr4 continuous, 0x005B
      .dma wr5
      .dma load
      .dma enable
    `;
    const compiler = new Z80Assembler();
    const result = await compiler.compile(source, nextOptions());
    expect(result.errorCount).toBe(0);
    const code = result.segments[0].emittedCode;
    // reset: 0xC3
    expect(code[0]).toBe(0xc3);
    // wr0: 0x7D, 0x00, 0x00, 0x00, 0x00
    expect(code[1]).toBe(0x7d);
    expect(code[2]).toBe(0x00);
    expect(code[3]).toBe(0x00);
    expect(code[4]).toBe(0x00);
    expect(code[5]).toBe(0x00);
    // wr1: 0x14
    expect(code[6]).toBe(0x14);
    // wr2: 0x28
    expect(code[7]).toBe(0x28);
    // wr4: 0xAD, 0x5B, 0x00
    expect(code[8]).toBe(0xad);
    expect(code[9]).toBe(0x5b);
    expect(code[10]).toBe(0x00);
    // wr5: 0x82
    expect(code[11]).toBe(0x82);
    // load: 0xCF
    expect(code[12]).toBe(0xcf);
    // enable: 0x87
    expect(code[13]).toBe(0x87);
    expect(code.length).toBe(14);
  });

  it("runtime-patched form produces same byte stream as inline form", async () => {
    // The inline form:
    const inlineSource = `
      .dma wr0 a_to_b, transfer, 0, 0
      .dma wr4 continuous, 0x005B
    `;
    // The runtime-patched form:
    const patchedSource = `
      .dma wr0 a_to_b, transfer
PORT_A: .dw 0
BLOCK_LEN: .dw 0
      .dma wr4 continuous
PORT_B: .dw 0x005B
    `;

    const compiler = new Z80Assembler();
    const r1 = await compiler.compile(inlineSource, nextOptions());
    const r2 = await compiler.compile(patchedSource, nextOptions());

    expect(r1.errorCount).toBe(0);
    expect(r2.errorCount).toBe(0);

    const code1 = r1.segments[0].emittedCode;
    const code2 = r2.segments[0].emittedCode;

    expect(code1.length).toBe(code2.length);
    for (let i = 0; i < code1.length; i++) {
      expect(code2[i]).toBe(code1[i]);
    }
  });
});
