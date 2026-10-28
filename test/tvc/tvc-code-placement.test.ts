import { describe, expect, it } from "vitest";

import {
  isTvcPlacementProblem,
  placeTvcCode,
  tvcLauncherLine,
  tvcProgramPayload,
  tvcRunCommands,
  type TvcPlacement
} from "@common/tvc/codePlacement";

/*
 * Where TVC code goes (`common/tvc/codePlacement.ts`): one set of rules for Run, Inject and Export.
 */

const seg = (startAddress: number, length: number) => ({ startAddress, emittedCode: new Array(length).fill(0xc9) });

describe("TVC code placement", () => {
  it("takes code between 1A30h and BBFFh, entry first or the lowest segment", () => {
    const p = placeTvcCode([seg(0x8000, 4), seg(0x1a30, 2)], undefined) as TvcPlacement;
    expect(p).toMatchObject({ entry: 0x1a30, start: 0x1a30, end: 0x8004 });
    expect(p.segments.map((s) => s.startAddress)).toEqual([0x1a30, 0x8000]);
    expect((placeTvcCode([seg(0x1a30, 2)], 0x1a31) as TvcPlacement).entry).toBe(0x1a31);
    expect((placeTvcCode([seg(0xbbfe, 2)], undefined) as TvcPlacement).end).toBe(0xbc00);
  });

  it("refuses an empty build, the system area, and code too high", () => {
    expect(placeTvcCode([seg(0x8000, 0)], undefined)).toEqual({ code: "empty" });
    expect(placeTvcCode([seg(0x1a2f, 2)], undefined)).toEqual({ code: "tooLow", address: 0x1a2f });
    expect(placeTvcCode([seg(0xbbff, 2)], undefined)).toEqual({ code: "tooHigh", address: 0xbc00 });
    expect(isTvcPlacementProblem(placeTvcCode([seg(0xc000, 1)], undefined))).toBe(true);
  });

  it("types LOMEM above the code, then calls the entry", () => {
    const p = placeTvcCode([seg(0x6000, 0x10)], 0x6004) as TvcPlacement;
    expect(tvcRunCommands(p)).toBe("LOMEM 24592\nC=USR(24580)\n");
  });

  it("writes the launcher line as rtvc's BASIC_START does: C=USR(6704)", () => {
    // --- rtvc/info/developer.md shows its bytes at 19EFh, with line number 10
    expect(Array.from(tvcLauncherLine(6704))).toEqual([
      0x0f, 0x0a, 0x00, 0x43, 0x9a, 0x55, 0x53, 0x52, 0x96, 0x36, 0x37, 0x30, 0x34, 0x95, 0xff
    ]);
  });

  it("lays out a program file: the launcher, the program's end, and the code where it was assembled", () => {
    const p = placeTvcCode([{ startAddress: 0x1a30, emittedCode: [0x3e, 0x01, 0xc9] }], undefined) as TvcPlacement;
    const payload = tvcProgramPayload(p);
    expect(payload.length).toBe(0x1a33 - 0x19ef);
    expect(payload[0]).toBe(0x0f);
    expect(payload[0x0f]).toBe(0x00);
    expect(Array.from(payload.subarray(0x1a30 - 0x19ef))).toEqual([0x3e, 0x01, 0xc9]);
  });
});
