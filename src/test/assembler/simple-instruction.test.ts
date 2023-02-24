import "mocha";
import { testCodeEmit } from "./test-helpers";

describe("Assembler - simple instructions", () => {
  const instructions = [
    { source: "nop", emit: 0x00 },
    { source: "rlca", emit: 0x07 },
    { source: "rrca", emit: 0x0f },
    { source: "rla", emit: 0x17 },
    { source: "rra", emit: 0x1f },
    { source: "daa", emit: 0x27 },
    { source: "cpl", emit: 0x2f },
    { source: "scf", emit: 0x37 },
    { source: "ccf", emit: 0x3f },
    { source: "halt", emit: 0x76 },
    { source: "exx", emit: 0xd9 },
    { source: "di", emit: 0xf3 },
    { source: "ei", emit: 0xfb },

    { source: "neg", emit: 0xed44 },
    { source: "retn", emit: 0xed45 },
    { source: "reti", emit: 0xed4d },
    { source: "rrd", emit: 0xed67 },
    { source: "rld", emit: 0xed6f },
    { source: "ldi", emit: 0xeda0 },
    { source: "cpi", emit: 0xeda1 },
    { source: "ini", emit: 0xeda2 },
    { source: "outi", emit: 0xeda3 },
    { source: "ldd", emit: 0xeda8 },
    { source: "cpd", emit: 0xeda9 },
    { source: "ind", emit: 0xedaa },
    { source: "outd", emit: 0xedab },
    { source: "ldir", emit: 0xedb0 },
    { source: "cpir", emit: 0xedb1 },
    { source: "inir", emit: 0xedb2 },
    { source: "otir", emit: 0xedb3 },
    { source: "lddr", emit: 0xedb8 },
    { source: "cpdr", emit: 0xedb9 },
    { source: "indr", emit: 0xedba },
    { source: "otdr", emit: 0xedbb },
  ];
  instructions.forEach((inst) => {
    it(inst.source, async () => {
      const high = inst.emit >> 8;
      const low = inst.emit & 0xff;
      const bytes = high ? [high, low] : [low];
      await await testCodeEmit(inst.source, ...bytes);
    });
  });

  const nextInstructions = [
    { source: "ldix", emit: 0xeda4 },
    { source: "ldws", emit: 0xeda5 },
    { source: "ldirx", emit: 0xedb4 },
    { source: "lddx", emit: 0xedac },
    { source: "lddrx", emit: 0xedbc },
    { source: "ldpirx", emit: 0xedb7 },
    { source: "outinb", emit: 0xed90 },
    { source: "swapnib", emit: 0xed23 },
    { source: "pixeldn", emit: 0xed93 },
    { source: "pixelad", emit: 0xed94 },
    { source: "setae", emit: 0xed95 },
  ];
  nextInstructions.forEach((inst) => {
    it(inst.source, async () => {
      const high = inst.emit >> 8;
      const low = inst.emit & 0xff;
      const bytes = high ? [high, low] : [low];
      await testCodeEmit(
        `
        .model next
        ${inst.source}
        `,
        ...bytes);
    });
  });
});
