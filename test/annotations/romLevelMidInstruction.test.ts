import { describe, expect, it } from "vitest";
import { measureRomLevel, type RomDecoder } from "@common/roms/romAnnotationTools";

/*
 * A jump into the middle of an instruction of the page (a JP made after another ROM is paged in, as
 * the +3's ROM 0 does at the end of its start-up) cannot get a label there; it is reported apart and
 * does not hold the page below level 1.
 */

// --- A fake page: $0000 JP $0010 (3 bytes), $0003 LD BC,nn (3 bytes, so $0004 is mid-instruction),
// --- $0006 JP $0004, $0009 JR $0010, $0010 NOP ... decoded by a tiny table decoder
const decode: RomDecoder = async (_bytes, start, end) => {
  const all = [
    { offset: 0x0000, length: 3, target: 0x0010 },
    { offset: 0x0003, length: 3 },
    { offset: 0x0006, length: 3, target: 0x0004 },
    { offset: 0x0009, length: 7 },
    { offset: 0x0010, length: 1 }
  ];
  return all.filter((i) => i.offset >= start && i.offset <= end);
};
const bank = (labels: { name: string; value: number }[]) => ({
  regions: [{ start: 0, end: 0x10, type: "disassemble" }],
  localLabels: labels,
  lineAnnotations: Object.fromEntries(labels.map((l) => [String(l.value), { synopsis: "x" }]))
});

describe("measureRomLevel and targets inside an instruction", () => {
  it("lists a mid-instruction target apart and still reaches level 2", async () => {
    const report = await measureRomLevel(bank([{ name: "T", value: 0x10 }]), new Uint8Array(0x11), decode);
    expect(report.unlabelledTargets).toEqual([]);
    expect(report.midInstructionTargets).toEqual([0x0004]);
    expect(report.level).toBe(2);
  });

  it("still requires a label on a target that is an instruction start", async () => {
    const report = await measureRomLevel(bank([]), new Uint8Array(0x11), decode);
    expect(report.unlabelledTargets).toEqual([0x0010]);
    expect(report.level).toBe(0);
  });
});
