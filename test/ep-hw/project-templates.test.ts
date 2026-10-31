import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { CodeToInject } from "@abstractions/CodeToInject";
import { playInjectionFlow, type FrameMachine } from "@common/headless/frameRunner";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { epExportFile } from "@renderer/appIde/utils/ep-code";
import { createEpSession, type EpTestSession } from "../harness/enterprise";
import { pictureHash, writeShotIfAsked } from "./bare";

/**
 * The Enterprise project template (`.plans/ENTERPRISE_PLAN.md` Phase 8) assembles without errors and
 * does what its comments say, run as the IDE runs it and loaded from its `.com` export. The picture -
 * the two lines in green at the top of a black page, the cursor under them - was checked by eye
 * (`EP_SHOTS_PNG=<dir>` writes it).
 */
const SOURCE = readFileSync(join(__dirname, "../../src/public/project-templates/ep/default/code/code.kz80.asm"), "utf8");
const TEMPLATE_PICTURE_SHA1 = "fe305b4c6b338e62ee48d84b547e2a3c53468b89";

async function build(): Promise<{ code: CodeToInject; segments: { startAddress: number; emittedCode: number[] }[]; entryAddress?: number }> {
  const out = await new Z80Assembler().compile(SOURCE);
  expect(out.errors).toEqual([]);
  const segments = out.segments.map((s) => ({ startAddress: s.startAddress, emittedCode: s.emittedCode }));
  return {
    code: { model: "ep", entryAddress: out.entryAddress, segments: segments.map((s) => ({ ...s, bankOffset: 0 })), options: {} },
    segments,
    entryAddress: out.entryAddress
  };
}

async function settle(s: EpTestSession): Promise<void> {
  for (let i = 0; i < 300; i++) await s.runFramesWithHost(1);
}

describe("Enterprise project template", () => {
  it.each(["ep128", "ep64"] as const)("%s: Run shows the two lines", async (model) => {
    const s = await createEpSession({ model });
    playInjectionFlow(s.machine as unknown as FrameMachine, await s.machine.getCodeInjectionFlow("ep"), { code: (await build()).code, maxFrames: 2000 });
    await settle(s);
    await writeShotIfAsked(s, `template-${model}`);
    expect(s.screenText()).toMatch(/Welcome to Klive IDE\s*\n\s*on the Enterprise/);
    if (model === "ep128") expect(await pictureHash(s)).toBe(TEMPLATE_PICTURE_SHA1);
  });

  it("the .com export loads with LOAD \"FILE:...\" and shows the same picture", async () => {
    const built = await build();
    const file = epExportFile(built);
    if ("error" in file) throw new Error(file.error);
    expect(Array.from(file.data.subarray(0, 4))).toEqual([0x00, 0x05, (file.data.length - 16) & 0xff, (file.data.length - 16) >> 8]);
    const s = (await createEpSession()).bootToBasic();
    s.files.files.set("HELLO.COM", file.data);
    await s.typeWithHost('LOAD "FILE:HELLO.COM"\n');
    await settle(s);
    expect(s.screenText()).toMatch(/Welcome to Klive IDE\s*\n\s*on the Enterprise/);
    expect(await pictureHash(s)).toBe(TEMPLATE_PICTURE_SHA1);
  });
});
