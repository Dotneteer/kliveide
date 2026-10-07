import { describe, expect, it } from "vitest";

import {
  decodeDmaCommand,
  decodeDmaStream,
  describeDmaCommand,
  dmaGroupOf,
  formatDmaBase,
  formatDmaCommand
} from "@common/zxnext/dma/dmaDecoder";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";

// ---------------------------------------------------------------------------------------------
// Helpers

async function assemble(source: string): Promise<number[]> {
  const opts = new AssemblerOptions();
  opts.currentModel = SpectrumModelType.Next;
  const result = await new Z80Assembler().compile(source, opts);
  if (result.errorCount > 0) {
    throw new Error(
      `Assembly failed: ${result.errors.map((e) => `${e.errorCode} ${e.message}`).join("; ")}\n${source}`
    );
  }
  return result.segments.flatMap((s) => [...s.emittedCode]);
}

const listing = (bytes: number[], decimal = false) =>
  decodeDmaStream(bytes)
    .map((cmd) => "  " + formatDmaCommand(cmd, { decimal }).text)
    .join("\n");

const one = (bytes: number[]) => {
  const cmd = decodeDmaCommand(bytes, 0, bytes.length);
  return { cmd, ...formatDmaCommand(cmd), meaning: describeDmaCommand(cmd) };
};

// --- A deterministic PRNG, so a failing property case can be reproduced
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s >>> 24;
  };
}

// ---------------------------------------------------------------------------------------------
// Group decoding

describe("DMA decoder: register groups", () => {
  it("classifies base bytes as the hardware does", () => {
    expect(dmaGroupOf(0x7d)).toBe("wr0");
    expect(dmaGroupOf(0x01)).toBe("wr0");
    expect(dmaGroupOf(0x14)).toBe("wr1");
    expect(dmaGroupOf(0x00)).toBe("wr2");
    expect(dmaGroupOf(0x28)).toBe("wr2");
    expect(dmaGroupOf(0x80)).toBe("wr3");
    expect(dmaGroupOf(0xad)).toBe("wr4");
    expect(dmaGroupOf(0x82)).toBe("wr5");
    expect(dmaGroupOf(0xa2)).toBe("wr5");
    expect(dmaGroupOf(0x8a)).toBe("wr5");
    expect(dmaGroupOf(0x86)).toBe("invalid");
    expect(dmaGroupOf(0xc2)).toBe("invalid");
    expect(dmaGroupOf(0xc3)).toBe("wr6");
  });
});

describe("DMA decoder: §4 representability table", () => {
  it("WR0 with all four follow bits is a pragma", () => {
    const r = one([0x7d, 0x00, 0x80, 0x00, 0x01]);
    expect(r.text).toBe(".dma wr0 a_to_b, transfer, $8000, $0100");
    expect(r.representable).toBe(true);
    expect(r.meaning).toBe("WR0: A→B transfer, port A $8000, length $0100 (256)");
  });

  it("WR0 B→A search", () => {
    expect(one([0x7a, 0x34, 0x12, 0x10, 0x00]).text).toBe(".dma wr0 b_to_a, search, $1234, $0010");
    expect(one([0x7b, 0, 0, 0, 0]).text).toBe(".dma wr0 b_to_a, search_transfer, $0000, $0000");
  });

  it("WR0 with only some follow bits falls back to .defb", () => {
    const r = one([0x1d, 0x00, 0x80]); // D3, D4: port A only
    expect(r.cmd.bytes).toHaveLength(3);
    expect(r.text).toBe(".defb $1D, $00, $80");
    expect(r.representable).toBe(false);
    expect(r.meaning).toBe("WR0: A→B transfer, port A $8000");
    // --- D3 and D5: port A low and length low, unpaired
    const p = one([0x2d, 0x11, 0x22]);
    expect(p.meaning).toBe("WR0: A→B transfer, port A low $11, length low $22");
    // --- No follow bits at all: one byte
    expect(one([0x05]).text).toBe(".dma cmd $05");
  });

  it("WR1 forms", () => {
    expect(one([0x14]).text).toBe(".dma wr1 memory, increment");
    expect(one([0x04]).text).toBe(".dma wr1 memory, decrement");
    expect(one([0x6c, 0x02]).text).toBe(".dma wr1 io, fixed, 2t");
    expect(one([0x54, 0x00]).text).toBe(".dma wr1 memory, increment, 4t");
    expect(one([0x54, 0x01]).meaning).toBe("WR1: port A memory, increment, 3T cycle");
    // --- addr mode 11
    expect(one([0x34]).representable).toBe(false);
    // --- timing 3
    expect(one([0x54, 0x03]).text).toBe(".defb $54, $03");
    // --- timing D5: the swallowed byte
    const s = one([0x54, 0x21, 0x99]);
    expect(s.cmd.bytes).toEqual([0x54, 0x21, 0x99]);
    expect(s.representable).toBe(false);
    expect(s.meaning).toContain("$99 ignored (port A has no prescaler)");
  });

  it("WR2 forms", () => {
    expect(one([0x10]).text).toBe(".dma wr2 memory, increment");
    expect(one([0x28]).text).toBe(".dma wr2 io, fixed");
    expect(one([0x68, 0x01]).text).toBe(".dma wr2 io, fixed, 3t");
    expect(one([0x68, 0x21, 0x32]).text).toBe(".dma wr2 io, fixed, 3t, $32");
    expect(one([0x68, 0x21, 0x32]).meaning).toBe("WR2: port B I/O, fixed, 3T cycle, prescaler 50");
    expect(one([0x68, 0x20, 0x32]).text).toBe(".dma wr2 io, fixed, 4t, $32");
    expect(one([0x68, 0x04]).representable).toBe(false);
    expect(one([0x68, 0x03]).representable).toBe(false);
    expect(one([0x30]).representable).toBe(false);
    expect(one([0x00]).text).toBe(".dma wr2 memory, decrement");
  });

  it("WR3 forms", () => {
    expect(one([0xc0]).text).toBe(".dma wr3 dma_enable");
    expect(one([0xe0]).text).toBe(".dma wr3 dma_enable, int_enable");
    expect(one([0x9c, 0xff, 0x00]).text).toBe(".dma wr3 stop_on_match, $FF, $00");
    expect(one([0x98, 0xff, 0x00]).text).toBe(".dma wr3 $FF, $00");
    expect(one([0x80]).text).toBe(".dma wr3");
    // --- mask without match
    const m = one([0x88, 0x0f]);
    expect(m.text).toBe(".defb $88, $0F");
    expect(m.representable).toBe(false);
    expect(one([0x90, 0x0f]).representable).toBe(false);
  });

  it("WR4 forms", () => {
    expect(one([0xad, 0x00, 0x48]).text).toBe(".dma wr4 continuous, $4800");
    expect(one([0xcd, 0x00, 0xc0]).text).toBe(".dma wr4 burst, $C000");
    expect(one([0x8d, 0x5b, 0x00]).text).toBe(".dma wr4 byte, $005B");
    // --- mode 11
    expect(one([0xed, 0, 0]).representable).toBe(false);
    // --- only D2: one follow byte
    const lo = one([0xa5, 0x12]);
    expect(lo.cmd.bytes).toEqual([0xa5, 0x12]);
    expect(lo.text).toBe(".defb $A5, $12");
    // --- D4 with D2/D3: D4 is ignored, still not representable
    expect(one([0xbd, 0, 0]).cmd.bytes).toHaveLength(3);
    expect(one([0xbd, 0, 0]).representable).toBe(false);
    // --- D4 alone: the DMA goes deaf
    const deaf = one([0xb1]);
    expect(deaf.cmd.kind === "wr4" && deaf.cmd.deaf).toBe(true);
    expect(deaf.cmd.bytes).toEqual([0xb1]);
    expect(deaf.meaning).toContain("ignores every later write");
  });

  it("WR5 forms", () => {
    expect(one([0x82]).text).toBe(".dma wr5");
    expect(one([0xa2]).text).toBe(".dma wr5 auto_restart");
    expect(one([0x8a]).text).toBe(".dma cmd $8A");
    expect(one([0x8a]).meaning).toBe("WR5: no auto restart");
  });

  it("WR6 commands", () => {
    expect(one([0xc3]).text).toBe(".dma reset");
    expect(one([0xcf]).text).toBe(".dma load");
    expect(one([0x87]).text).toBe(".dma enable");
    expect(one([0x83]).text).toBe(".dma disable");
    expect(one([0xd3]).text).toBe(".dma continue");
    expect(one([0xbb, 0x7e]).text).toBe(".dma readmask $7E");
    expect(one([0xbb, 0xfe]).text).toBe(".defb $BB, $FE");
    expect(one([0x8b]).text).toBe(".dma cmd $8B");
    expect(one([0x8b]).meaning).toBe("WR6: reinitialize status byte");
    expect(one([0xa7]).meaning).toBe("WR6: start read sequence");
    expect(one([0xbf]).meaning).toBe("WR6: read status byte");
    expect(one([0xc7]).meaning).toBe("WR6: reset port A timing");
    expect(one([0xcb]).meaning).toBe("WR6: reset port B timing");
    expect(one([0xaf]).meaning).toBe("WR6: command $AF: no effect on the Next");
  });

  it("an ignored byte", () => {
    expect(one([0x86]).text).toBe(".dma cmd $86");
    expect(one([0x86]).meaning).toBe("$86: not a DMA register write, ignored");
  });

  it("decimal numbers", () => {
    const cmd = decodeDmaCommand([0x7d, 0x00, 0x80, 0x00, 0x01], 0, 5);
    expect(formatDmaCommand(cmd, { decimal: true }).text).toBe(
      ".dma wr0 a_to_b, transfer, 32768, 256"
    );
  });
});

describe("DMA decoder: ranges", () => {
  it("never reads at or past end, and reports what is missing", () => {
    const bytes = new Proxy([0x7d, 0x00, 0x80, 0x00, 0x01], {
      get(target, prop) {
        if (typeof prop === "string" && /^\d+$/.test(prop) && Number(prop) >= 3) {
          throw new Error(`read past end at ${prop}`);
        }
        return Reflect.get(target, prop);
      }
    });
    const cmds = decodeDmaStream(bytes, 0, 3);
    expect(cmds).toHaveLength(1);
    expect(cmds[0].bytes).toEqual([0x7d, 0x00, 0x80]);
    expect(cmds[0].missing).toBe(2);
    expect(formatDmaCommand(cmds[0]).text).toBe(".defb $7D, $00, $80");
    expect(describeDmaCommand(cmds[0])).toBe("truncated: WR0 expects 2 more bytes");
  });

  it("a truncated WR2 timing byte counts one byte missing", () => {
    const cmds = decodeDmaStream([0x68], 0, 1);
    expect(cmds[0].missing).toBe(1);
    expect(describeDmaCommand(cmds[0])).toBe("truncated: WR2 expects 1 more byte");
  });

  it("decodes from an offset inside a larger array", () => {
    const cmds = decodeDmaStream([0xff, 0xff, 0xc3, 0xcf, 0x87, 0xff], 2, 5);
    expect(cmds.map((c) => [c.offset, formatDmaCommand(c).text])).toEqual([
      [2, ".dma reset"],
      [3, ".dma load"],
      [4, ".dma enable"]
    ]);
  });

  it("exposes field boundaries for label splits", () => {
    const cmd = decodeDmaCommand([0x7d, 0x00, 0x80, 0x00, 0x01], 0, 5);
    expect(cmd.fields).toEqual([
      { offset: 1, size: 2, value: 0x8000, role: "portA" },
      { offset: 3, size: 2, value: 0x0100, role: "length" }
    ]);
    expect(formatDmaBase(cmd).text).toBe(".dma wr0 a_to_b, transfer");
    expect(formatDmaBase(decodeDmaCommand([0xad, 0, 0x48], 0, 3)).text).toBe(".dma wr4 continuous");
    expect(formatDmaBase(decodeDmaCommand([0x68, 0x21, 0x32], 0, 3)).text).toBe(".dma cmd $68");
  });
});

// ---------------------------------------------------------------------------------------------
// D2: the runtime-patching program reads as the hardware reads it

describe("DMA decoder: documented programs", () => {
  it("the runtime-patching program", async () => {
    const bytes = await assemble(`
      .dma reset
      .dma wr0 a_to_b, transfer
      .dw 0
      .dw 0
      .dma wr1 memory, increment
      .dma wr2 memory, increment
      .dma wr4 continuous
      .dw $4800
      .dma wr5
      .dma load
      .dma enable
    `);
    expect(listing(bytes).split("\n").map((l) => l.trim())).toEqual([
      ".dma reset",
      ".dma wr0 a_to_b, transfer, $0000, $0000",
      ".dma wr1 memory, increment",
      ".dma wr2 memory, increment",
      ".dma wr4 continuous, $4800",
      ".dma wr5",
      ".dma load",
      ".dma enable"
    ]);
  });

  it("the sprite program in raw bytes", () => {
    const bytes = [0x7d, 0, 0, 0, 0, 0x14, 0x28, 0xad, 0x5b, 0x00, 0x82, 0xcf, 0x87];
    expect(listing(bytes).split("\n").map((l) => l.trim())).toEqual([
      ".dma wr0 a_to_b, transfer, $0000, $0000",
      ".dma wr1 memory, increment",
      ".dma wr2 io, fixed",
      ".dma wr4 continuous, $005B",
      ".dma wr5",
      ".dma load",
      ".dma enable"
    ]);
  });

  it("a half-supplied WR0 takes the next base byte as length high (D2)", async () => {
    const bytes = await assemble(`
      .dma wr0 a_to_b, transfer, $8000
      .dma wr1 memory, increment
      .dma load
    `);
    const cmds = decodeDmaStream(bytes);
    expect(cmds[0].kind).toBe("wr0");
    expect(cmds[0].bytes).toEqual([0x7d, 0x00, 0x80, 0x14, 0xcf]);
    expect(cmds).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------------------------
// D1: everything reassembles

const CORPUS = [
  `
    .dma reset
    .dma wr0 a_to_b, transfer, $4000, 32
    .dma wr1 memory, increment
    .dma wr2 memory, increment
    .dma wr4 continuous, $4800
    .dma wr5
    .dma load
    .dma enable
  `,
  `
    .dma readmask $7E
    .dma cmd $CF
    .dma wr0 b_to_a, search_transfer, $1234, $FFFF
    .dma wr1 memory, increment, 4t
    .dma wr1 io, fixed, 2t
    .dma wr2 io, fixed, 3t
    .dma wr2 io, fixed, 3t, 50
    .dma wr2 memory, decrement, 2t, 0
    .dma wr3 dma_enable
    .dma wr3 stop_on_match, $FF, $00
    .dma wr3 dma_enable, int_enable
    .dma wr4 burst, $C000
    .dma wr4 byte, 0
    .dma wr5 auto_restart
    .dma disable
    .dma continue
  `,
  `
    .dma wr0 a_to_b, transfer
    .dw $8000
    .dw $0100
    .dma wr4 continuous
    .dw $4800
    .dma cmd $8B
    .dma cmd $A7
    .dma cmd $BF
  `
];

describe("DMA decoder: round trip with the real assembler (D1)", () => {
  CORPUS.forEach((source, index) => {
    it(`corpus program #${index + 1}`, async () => {
      const bytes = await assemble(source);
      for (const decimal of [false, true]) {
        const text = listing(bytes, decimal);
        expect(await assemble(text)).toEqual(bytes);
      }
    });
  });

  it("random byte streams reassemble to themselves", async () => {
    const next = rng(0x6b);
    for (let round = 0; round < 60; round++) {
      const length = 1 + (next() % 40);
      const bytes = Array.from({ length }, () => next());
      for (const decimal of [false, true]) {
        const text = listing(bytes, decimal);
        expect(await assemble(text), text).toEqual(bytes);
      }
    }
  });

  it("every single base byte reassembles, alone and followed by data", async () => {
    const lines: string[] = [];
    const expected: number[] = [];
    for (let base = 0; base < 256; base++) {
      const bytes = [base, 0x21, 0x7f, 0x34, 0x12, 0x56];
      const cmds = decodeDmaStream(bytes);
      for (const cmd of cmds) lines.push("  " + formatDmaCommand(cmd).text);
      expected.push(...bytes);
      const alone = decodeDmaStream([base]);
      lines.push("  " + formatDmaCommand(alone[0]).text);
      expected.push(base);
    }
    expect(await assemble(lines.join("\n"))).toEqual(expected);
  });

  it("the base-only form plus data reassembles", async () => {
    for (let base = 0; base < 256; base++) {
      const bytes = [base, 0x21, 0x7f, 0x34, 0x12, 0x56];
      const cmd = decodeDmaCommand(bytes, 0, bytes.length);
      const rest = cmd.bytes.slice(1).map((b) => `$${b.toString(16)}`);
      const text = "  " + formatDmaBase(cmd).text + (rest.length ? `\n  .defb ${rest.join(", ")}` : "");
      expect((await assemble(text)).slice(0, cmd.bytes.length), text).toEqual(cmd.bytes);
    }
  });
});
