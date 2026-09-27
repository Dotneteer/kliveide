import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { compileBasic } from "./run-kit";

/**
 * Source breakpoints in CODEBANK code as the IDE resolves them (`refreshSourceCodeBreakpoints`):
 * banks share the window's addresses, so a line breakpoint and a statement (column) breakpoint in a
 * bank must carry the bank's 8K page, or it fires in whichever bank is paged in.
 */
const resolved: { address: number; partition?: number; line: number; column?: number }[][] = [];
let userBreakpoints: BreakpointInfo[] = [];

vi.mock("@common/messaging/EmuApi", () => ({
  createEmuApi: () => ({
    resetBreakpointsTo: vi.fn().mockResolvedValue(undefined),
    resolveBreakpoints: vi.fn(async (bps: never[]) => {
      resolved.push(bps);
    })
  })
}));
vi.mock("@renderer/appIde/utils/breakpoint-utils", () => ({
  getBreakpoints: vi.fn(async () => userBreakpoints.map((b) => ({ ...b })))
}));

const { refreshSourceCodeBreakpoints } = await import("@common/utils/breakpoints");

const SOURCE = [
  "CODEBANK 1", // 1
  "SUB One()", // 2
  "  PRINT 1 : PRINT 11", // 3
  "END SUB", // 4
  "END CODEBANK", // 5
  "CODEBANK 2", // 6
  "SUB Two()", // 7
  "  PRINT 2 : PRINT 22", // 8
  "END SUB", // 9
  "END CODEBANK", // 10
  "One : Two", // 11
  ""
].join("\n");

describe("source breakpoints in CODEBANK banks", () => {
  beforeEach(() => {
    resolved.length = 0;
  });

  it("resolve line and statement breakpoints to their bank's page", async () => {
    const { generated } = await compileBasic(SOURCE, { target: "next" });
    const classic = generated.debug.classic;
    const result = {
      errors: [],
      segments: generated.output.segments,
      sourceFileList: [{ filename: "/test/main.bas", includes: [] }],
      listFileItems: classic.listFileItems,
      sourceMap: classic.sourceMap,
      sourceLevelDebug: generated.debug.sourceLevel
    };
    const store = { getState: () => ({ compilation: { result }, emulatorState: { machineId: "zxnext" } }) };
    userBreakpoints = [
      { resource: "main.bas", line: 3, exec: true },
      { resource: "main.bas", line: 8, exec: true },
      { resource: "main.bas", line: 3, column: 12, exec: true },
      { resource: "main.bas", line: 8, column: 12, exec: true }
    ] as BreakpointInfo[];
    await refreshSourceCodeBreakpoints(store as never, {} as never);
    const bps = resolved[0];
    expect(bps.map((b) => [b.line, b.column, b.partition])).toEqual([
      [3, undefined, 30],
      [8, undefined, 31],
      [3, 12, 30],
      [8, 12, 31]
    ]);
    // --- Both banks' first statements are at the window's addresses
    expect(bps.every((b) => b.address >> 13 === 3)).toBe(true);
  });
});
