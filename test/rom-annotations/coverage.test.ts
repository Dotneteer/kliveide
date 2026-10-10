import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { PF_CODE, PF_EXECUTED, PF_READ } from "@common/profile/profileTypes";
import { createSp48Session, type Sp48TestSession } from "../harness/sp48";

/*
 * The ROM annotation tools' `coverage` (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §6): runs
 * the real 48K ROM through BASIC with the access profile on, and tells the ROM's code from its data
 * by what the CPU did to each byte — fetched as an opcode, or only read. It is *observation*, the
 * provenance the ROM sidecars may cite, and it is how an author finds a table without consulting a
 * disassembly.
 *
 * `npm run rom:annotations -- coverage` runs this with `ROM_COVERAGE_OUT` set, which writes the
 * byte map for `skeleton` and the author to read. Without it, the test only checks the map is sane.
 */

type Scenario = { name: string; keys: string[][] };

/** BASIC statements typed at the K cursor, each ending in ENTER (K mode: a letter is a keyword). */
const SCENARIOS: Scenario[] = [
  // PRINT 2+2
  { name: "print-sum", keys: [["P"], ["N2"], ["SShift", "K"], ["N2"], ["Enter"]] },
  // PRINT 7/3 (the calculator's division)
  { name: "print-division", keys: [["P"], ["N7"], ["SShift", "V"], ["N3"], ["Enter"]] },
  // CLS
  { name: "cls", keys: [["V"], ["Enter"]] },
  // BORDER 1
  { name: "border", keys: [["B"], ["N1"], ["Enter"]] },
  // BEEP .1,1 (the beeper)
  { name: "beep", keys: [["CShift", "SShift"], ["SShift", "Z"], ["SShift", "M"], ["N1"], ["SShift", "N"], ["N1"], ["Enter"]] }
];

type RomCoverage = {
  rom: "sp48.rom";
  scenarios: string[];
  /** Offsets fetched as an opcode at least once */
  code: number[];
  /** Offsets read as data and never fetched */
  dataOnly: number[];
};

function measure(session: Sp48TestSession): RomCoverage {
  const machine = session.machine;
  machine.setProfiling(true, false);
  machine.resetProfile();
  for (const scenario of SCENARIOS) {
    session.typeKeys(scenario.keys);
    session.runFrames(30);
  }
  const flags = machine.readProfileFlags(0, 0x4000)!;
  const code: number[] = [];
  const dataOnly: number[] = [];
  for (let offset = 0; offset < 0x4000; offset++) {
    const f = flags[offset];
    if (f & (PF_EXECUTED | PF_CODE)) code.push(offset);
    else if (f & PF_READ) dataOnly.push(offset);
  }
  return { rom: "sp48.rom", scenarios: SCENARIOS.map((s) => s.name), code, dataOnly };
}

describe("ROM coverage (the 48K)", () => {
  it("tells the ROM's code from its data by what the CPU did to each byte", async () => {
    const session = await createSp48Session();
    session.bootToBasic();
    const coverage = measure(session);

    // --- The main loop ran, and the character set was read (printing) without being run
    expect(coverage.code).toContain(0x12ac);
    expect(coverage.dataOnly.some((offset) => offset >= 0x3d00 && offset <= 0x3fff)).toBe(true);
    expect(coverage.code.some((offset) => offset >= 0x3d00)).toBe(false);

    const out = process.env.ROM_COVERAGE_OUT;
    if (out) {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, `${JSON.stringify(coverage)}\n`);
    }
  });
});
