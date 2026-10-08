import { describe, expect, it } from "vitest";
import {
  flagLetters,
  layoutFingerprint,
  parseKcov,
  parseLcov,
  toCoverageCsv,
  toKcov,
  toLcov
} from "@common/profile/coverageExport";
import { findSmcRuns } from "@common/profile/smcReport";
import { profileLayoutOf } from "@common/profile/layouts";
import { PF_CODE, PF_EXECUTED, PF_SELF_MODIFIED, PF_WRITTEN } from "@common/profile/profileTypes";

/* The coverage exports and the SMC report (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D9, D16, Phase 6) */

const sp48 = profileLayoutOf("sp48")!;
const sp128 = profileLayoutOf("sp128")!;

describe("LCOV", () => {
  it("writes records genhtml reads back: SF, DA per line, LF/LH, end_of_record", () => {
    const text = toLcov([
      { path: "b.asm", lines: [{ line: 3, hits: 0 }, { line: 1, hits: 12 }] },
      { path: "a.asm", lines: [{ line: 7, hits: 1 }] },
      { path: "empty.asm", lines: [] }
    ]);
    expect(text).toBe(
      "TN:\nSF:b.asm\nDA:1,12\nDA:3,0\nLF:2\nLH:1\nend_of_record\nTN:\nSF:a.asm\nDA:7,1\nLF:1\nLH:1\nend_of_record\n"
    );
    const records = parseLcov(text);
    expect(records.map((r) => [r.path, r.found, r.hit])).toEqual([
      ["b.asm", 2, 1],
      ["a.asm", 1, 1]
    ]);
  });

  it("rejects a record whose totals disagree with its lines", () => {
    expect(() => parseLcov("SF:a\nDA:1,1\nLF:2\nLH:1\nend_of_record\n")).toThrow(/LF/);
    expect(() => parseLcov("SF:a\nDA:1,0\nLF:1\nLH:1\nend_of_record\n")).toThrow(/LH/);
    expect(() => parseLcov("SF:a\nDA:1,0\n")).toThrow(/end_of_record/);
  });
});

describe("CSV", () => {
  it("names the partition and the address in it, and can leave the ROM out", () => {
    const bytes = [
      { offset: 0x40000, flags: PF_EXECUTED | PF_CODE, exec: 5, read: 0, write: 0, time: 20 },
      { offset: 0x0c010, flags: PF_WRITTEN }
    ];
    const csv = toCoverageCsv(bytes, sp128, { [-1]: "R0", 3: "B3" });
    expect(csv).toBe("offset,partition,address,flags,exec,read,write,time\n040000,R0,0000,EC----,5,0,0,20\n00C010,B3,0010,---W--,,,,\n");
    expect(toCoverageCsv(bytes, sp128, {}, true).split("\n")).toHaveLength(3);
    expect(flagLetters(0x3f)).toBe("ECRWSX");
  });
});

describe(".kcov", () => {
  it("round-trips a run on the same layout", () => {
    const bytes = [
      { offset: 0x8000, flags: PF_EXECUTED | PF_CODE, exec: 3, read: 0, write: 0, time: 12 },
      { offset: 0x9000, flags: PF_WRITTEN }
    ];
    const text = toKcov("sp48", sp48, { timeUnit: "T-states", instructions: 3, timeTotal: 12 }, bytes);
    const run = parseKcov(text, sp48);
    expect(run).toEqual({ bytes, instructions: 3, timeTotal: 12, machineId: "sp48" });
  });

  it("refuses a run recorded on another layout, and a file that is not one", () => {
    const text = toKcov("sp48", sp48, { timeUnit: "T-states", instructions: 0, timeTotal: 0 }, []);
    expect(parseKcov(text, sp128)).toMatch(/another machine/);
    expect(parseKcov("nope", sp48)).toMatch(/not JSON/);
    expect(parseKcov("{}", sp48)).toMatch(/not a Klive coverage file/);
    expect(layoutFingerprint(sp48)).not.toBe(layoutFingerprint(sp128));
  });
});

describe("the SMC report", () => {
  it("joins adjacent self-modified bytes into runs, with counts and the nearest label", () => {
    const smc = PF_SELF_MODIFIED | PF_WRITTEN | PF_CODE;
    const runs = findSmcRuns(
      [
        { offset: 0x8001, flags: smc, write: 1, exec: 2 },
        { offset: 0x8002, flags: smc, write: 3, exec: 0 },
        { offset: 0x8003, flags: PF_EXECUTED },
        { offset: 0x9000, flags: smc }
      ],
      sp48,
      (address) => (address >= 0x8000 && address < 0x9000 ? { name: "Patch", address: 0x8000 } : undefined)
    );
    expect(runs).toEqual([
      { from: 0x8001, to: 0x8002, partition: undefined, address: 0x8001, label: "Patch", labelOffset: 1, writes: 4, executions: 2 },
      { from: 0x9000, to: 0x9000, partition: undefined, address: 0x9000 }
    ]);
  });
});
