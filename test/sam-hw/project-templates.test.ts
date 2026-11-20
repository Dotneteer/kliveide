import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { CodeToInject } from "@abstractions/CodeToInject";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { readMgtDirectory } from "@common/samcoupe/mgtImage";
import { samExportFile } from "@renderer/appIde/utils/sam-code";
import { createSamSession } from "../harness/samcoupe";
import { SamKeyCode } from "@emu/machines/samcoupe/SamKeyCode";

/**
 * The SAM Coupé project template (`src/public/project-templates/sam/`) assembles for `.model SAMCOUPE`
 * without errors, runs as the IDE runs it (the border cycles through the first eight CLUT entries), and
 * exports as the bootable .mgt disk Run boots (Klive's loader, then the program as a CODE file).
 */
const SOURCE = readFileSync(join(__dirname, "../../src/public/project-templates/sam/default/code/code.kz80.asm"), "utf8");

async function build() {
  const out = await new Z80Assembler().compile(SOURCE);
  expect(out.errors).toEqual([]);
  expect(out.modelType).toBe(SpectrumModelType.SamCoupe);
  const segments = out.segments.map((s) => ({ startAddress: s.startAddress, emittedCode: s.emittedCode }));
  const code: CodeToInject = { model: "sam", entryAddress: out.entryAddress, segments: segments.map((s) => ({ ...s, bankOffset: 0 })), options: {} };
  return { code, segments, entryAddress: out.entryAddress };
}

describe("SAM Coupé project template", () => {
  it("Run cycles the border", async () => {
    const { code } = await build();
    expect(code.segments[0].startAddress).toBe(0x8000);
    const s = await createSamSession();
    s.bootToCopyright();
    s.machine.injectCodeToRun(code);
    const seen = new Set<number>();
    s.runUntil(
      () => {
        seen.add(s.wasm.samGetBorder() & 0x07);
        return seen.size >= 4;
      },
      { maxFrames: 3000 },
      "the border cycling"
    );
    expect(s.wasm.samGetCpuPc()).toBeGreaterThanOrEqual(0x8000);
  });

  it("exports the bootable .mgt Run boots: the loader, then the program at page 1, 8000h; F9 runs it", async () => {
    const built = await build();
    const file = samExportFile("mgt", built, "template.mgt");
    if ("error" in file) throw new Error(file.error);
    const entries = readMgtDirectory(file.data);
    expect(entries.map((e) => e.name)).toEqual(["kliveboot", "template"]);
    expect(entries[1]).toMatchObject({ type: 19, startPage: 1, startOffset: 0x8000, execPage: 1, execOffset: 0x8000 });
    const raw = samExportFile("bin", built, "template.bin");
    if ("error" in raw) throw new Error(raw.error);
    expect(Array.from(raw.data.subarray(0, 2))).toEqual([0xf3, 0x31]);
    // --- The exported disk boots on the machine
    const s = await createSamSession();
    s.insertDisk(0, file.data);
    s.bootToCopyright();
    s.pressKey(SamKeyCode.Space).runFrames(20).pressKey(SamKeyCode.F9);
    s.runUntil(() => s.wasm.samGetHmpr() === 1 && s.wasm.samGetCpuPc() >= 0x8000, { maxFrames: 1500 }, "the program");
  });
});
