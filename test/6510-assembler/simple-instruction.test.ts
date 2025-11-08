import { describe, it } from "vitest";
import { testCodeEmit } from "./test-helpers";

describe("Assembler - simple instructions", () => {
  const instructions = [
    { source: "brk", emit: 0x00 },
    { source: "clc", emit: 0x18 },
    { source: "cld", emit: 0xd8 },
    { source: "cli", emit: 0x58 },
    { source: "clv", emit: 0xb8 },
    { source: "dex", emit: 0xca },
    { source: "dey", emit: 0x88 },
    { source: "hlt", emit: 0x02 },
    { source: "inx", emit: 0xe8 },
    { source: "iny", emit: 0xc8 },
    { source: "jam", emit: 0x02 },
    { source: "kil", emit: 0x02 },
    { source: "nop", emit: 0xea },
    { source: "pha", emit: 0x48 },
    { source: "php", emit: 0x08 },
    { source: "pla", emit: 0x68 },
    { source: "plp", emit: 0x28 },
    { source: "rti", emit: 0x40 },
    { source: "rts", emit: 0x60 },
    { source: "sec", emit: 0x38 },
    { source: "sed", emit: 0xf8 },
    { source: "sei", emit: 0x78 },
    { source: "tax", emit: 0xaa },
    { source: "tay", emit: 0xa8 },
    { source: "tsx", emit: 0xba },
    { source: "txa", emit: 0x8a },
    { source: "txs", emit: 0x9a },
    { source: "tya", emit: 0x98 },
  ];
  instructions.forEach((inst) => {
    it(inst.source, async () => {
      const high = inst.emit >> 8;
      const low = inst.emit & 0xff;
      const bytes = high ? [high, low] : [low];
      await testCodeEmit(inst.source, ...bytes);
    });
  });
});
