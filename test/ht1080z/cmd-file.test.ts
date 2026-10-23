import { describe, expect, it } from "vitest";

import { MC_HT_MODEL, MC_MEM_SIZE } from "@common/machines/constants";

import { buildHt1080zCmd, ht1080zModuleName } from "@common/ht1080z/cmdFile";
import { cmdToSystemTape } from "@emu/machines/ht1080z/Ht1080zTapeFile";
import { ht1080zExportFile, ht1080zExportFormatOf, ht1080zFormatProblem } from "@renderer/appIde/utils/ht1080z-code";

/*
 * The HT-1080Z's export files (`.plans/HT1080Z_CODE_INJECTION_PLAN.md` D6): the `.cmd` load module's
 * records, blocks split at 256 bytes, and the `.cas` made from it.
 */
describe("HT-1080Z .cmd and .cas export", () => {
  it("writes the module header, the load blocks and the transfer address", () => {
    const cmd = buildHt1080zCmd([{ startAddress: 0x7000, emittedCode: [0x3e, 0x48, 0xc9] }], 0x7000, "hello.cmd");
    expect(Array.from(cmd)).toEqual([
      0x05, 5, ...Array.from("HELLO", (c) => c.charCodeAt(0)),
      0x01, 5, 0x00, 0x70, 0x3e, 0x48, 0xc9,
      0x02, 2, 0x00, 0x70
    ]);
  });

  it("splits a long segment into blocks of 256 bytes, the 256-byte block's length written as 2", () => {
    const code = Array.from({ length: 300 }, (_, i) => i & 0xff);
    const cmd = buildHt1080zCmd([{ startAddress: 0x7000, emittedCode: code }], 0x7000, "LONG");
    const first = 2 + 4;
    expect(cmd[first]).toBe(0x01);
    expect(cmd[first + 1]).toBe(2);
    expect([cmd[first + 2], cmd[first + 3]]).toEqual([0x00, 0x70]);
    const second = first + 4 + 256;
    expect([cmd[second], cmd[second + 1], cmd[second + 2], cmd[second + 3]]).toEqual([0x01, 46, 0x00, 0x71]);
    // --- The tape converter reads it back: one SYSTEM tape with both blocks
    expect(() => cmdToSystemTape(cmd, "LONG")).not.toThrow();
  });

  it("cleans the module name", () => {
    expect(ht1080zModuleName("/x/my game!.cmd")).toBe("MYGAME");
    expect(ht1080zModuleName("...")).toBe("KLIVE");
  });

  it("exports .cmd by default for HT-1080Z code, and refuses another machine's format", () => {
    expect(ht1080zExportFormatOf(7, undefined)).toBe("cmd");
    expect(ht1080zExportFormatOf(undefined, "ht1080z")).toBe("cmd");
    expect(ht1080zExportFormatOf(1, "ht1080z")).toBeUndefined();
    expect(ht1080zFormatProblem("cas")).toBeUndefined();
    expect(ht1080zFormatProblem("tap")).toMatch(/\.cmd or \.cas/);
  });

  it("checks where the code goes, as Run does", () => {
    const rom = ht1080zExportFile("cmd", { segments: [{ startAddress: 0x3000, emittedCode: [0] }] }, undefined, {}, "X");
    expect(rom).toMatchObject({ error: expect.stringMatching(/ROM or keyboard/) });
    const high = { segments: [{ startAddress: 0x9000, emittedCode: [0] }] };
    // --- Beyond a 16K machine's RAM; on the /64 (48K) it fits
    expect(ht1080zExportFile("cas", high, undefined, {}, "X")).toMatchObject({ error: expect.stringMatching(/16K/) });
    expect(ht1080zExportFile("cas", high, "ht1080z", { [MC_HT_MODEL]: "s64", [MC_MEM_SIZE]: 48 }, "X")).toHaveProperty("data");
  });
});
