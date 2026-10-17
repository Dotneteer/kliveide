import { describe, expect, it, vi } from "vitest";

import { ExportCodeCommand } from "@renderer/appIde/commands/KliveCompilerCommands";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";

/*
 * A compiler that writes its own tape (a banked Boriel BASIC 128K program,
 * `.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` §7) hands it over as `prebuiltTape`: the TAP/TZX export
 * saves those blocks, because zxbc's loader pages the banks the way its runtime expects and Klive's
 * 128K loader does not (the program crashed after loading).
 */

/** A TAP block: length, then flag, data and checksum. */
const tapBlock = (flag: number, data: number[]) => {
  const body = [flag, ...data];
  body.push(body.reduce((x, b) => x ^ b, 0));
  return [body.length & 0xff, body.length >> 8, ...body];
};
const header = tapBlock(0x00, [3, ...Array.from("boriel    ", (c) => c.charCodeAt(0)), 3, 0, 0, 0x80, 0, 0x80]);
const code = tapBlock(0xff, [0x3e, 0x01, 0xc9]);
const tape = [...header, ...code];

function contextWith() {
  const saved: { file: string; data: Uint8Array }[] = [];
  const lines: string[] = [];
  const context = {
    store: { getState: () => ({ emulatorState: { machineId: "sp128" } }) },
    mainApi: {
      saveBinaryFile: vi.fn(async (file: string, data: Uint8Array) => {
        saved.push({ file, data });
        return file;
      })
    },
    output: { color: vi.fn(), resetStyle: vi.fn(), writeLine: (line: string) => lines.push(line), write: vi.fn() }
  };
  return { context: context as any, saved, lines };
}

const output = {
  errors: [],
  modelType: SpectrumModelType.Spectrum128,
  entryAddress: 0x8000,
  injectOptions: {},
  segments: [
    { startAddress: 0x8000, emittedCode: [1, 2, 3] },
    { startAddress: 0xc000, bank: 1, bankOffset: 0, emittedCode: [4, 5] }
  ],
  prebuiltTape: tape
} as any;

describe("exporting a compiler-written tape", () => {
  it("saves its blocks unchanged as a TAP file", async () => {
    const { context, saved } = contextWith();
    const result = await new ExportCodeCommand().exportCompiledCode(context, output, { filename: "banked.tap", "-f": "tap" });
    expect(result.success).toBe(true);
    expect(Array.from(saved[0].data)).toEqual(tape);
  });

  it("wraps the same blocks in a TZX file", async () => {
    const { context, saved } = contextWith();
    await new ExportCodeCommand().exportCompiledCode(context, output, { filename: "banked.tzx", "-f": "tzx" });
    const bytes = saved[0].data;
    expect(new TextDecoder().decode(bytes.subarray(0, 7))).toBe("ZXTape!");
    // --- Both blocks, as standard-speed blocks (ID $10), each with its own data
    expect(bytes.filter((b, i) => b === 0x10 && i >= 10).length).toBeGreaterThanOrEqual(2);
    expect(bytes.length).toBeGreaterThan(tape.length);
  });

  it("says which of Klive's loader options it cannot apply to that tape", async () => {
    const { context, lines } = contextWith();
    await new ExportCodeCommand().exportCompiledCode(context, output, { filename: "banked.tap", "-f": "tap", "-as": true, "-b": 2 });
    expect(lines.join("\n")).toMatch(/own loader; -as, -b has no effect/);
  });
});
