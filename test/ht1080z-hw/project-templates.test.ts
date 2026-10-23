import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { CodeToInject } from "@abstractions/CodeToInject";
import { playInjectionFlow, type FrameMachine } from "@common/headless/frameRunner";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { ht1080zExportFile } from "@renderer/appIde/utils/ht1080z-code";
import { createHtSession, Ht1080zTestSession } from "../harness/ht1080z";

/**
 * The HT-1080Z project template (`.plans/HT1080Z_CODE_INJECTION_PLAN.md` D8) assembles without
 * errors and does what its comments say, run as the IDE runs it and loaded from its export.
 */
const SOURCE = readFileSync(
  join(__dirname, "../../src/public/project-templates/ht1080z/default/code/code.kz80.asm"),
  "utf8"
);

async function build(): Promise<CodeToInject> {
  const out = await new Z80Assembler().compile(SOURCE);
  expect(out.errors).toEqual([]);
  return {
    model: "ht1080z",
    entryAddress: out.entryAddress,
    segments: out.segments.map((s) => ({ startAddress: s.startAddress, bankOffset: 0, emittedCode: s.emittedCode })),
    options: {}
  };
}

function expectWelcome(s: Ht1080zTestSession): void {
  const screen = s.screenText();
  // --- No cursor left behind where CLS put it
  expect(screen.slice(0, 6).every((l) => l === "")).toBe(true);
  expect(screen[6]).toBe(" ".repeat(22) + "WELCOME TO KLIVE IDE");
  expect(Array.from({ length: 20 }, (_, i) => s.screenCode(7, 22 + i))).toEqual(new Array(20).fill(0x83));
  expect(screen[8]).toBe(" ".repeat(28) + "HT-1080Z");
  // --- Back in BASIC, below the text
  expect(screen.slice(11).filter((l) => l)).toEqual(["READY", ">_"]);
}

describe("HT-1080Z project template", () => {
  it.each(["ht1080z-s1", "ht1080z-s2", "ht1080z-64"])("prints its welcome and returns to BASIC (%s)", async (model) => {
    const s = await createHtSession({ model });
    playInjectionFlow(s.machine as unknown as FrameMachine, await s.machine.getCodeInjectionFlow("ht1080z"), {
      code: await build()
    });
    s.runFrames(30);
    expectWelcome(s);
  });

  it("does the same loaded from its exported .cmd", async () => {
    const file = ht1080zExportFile("cmd", await build(), "ht1080z", {}, "code");
    if (!("data" in file)) throw new Error(file.error);
    const s = await createHtSession();
    s.loadTape(Ht1080zTestSession.tape(file.data, "code.cmd"), { maxFrames: 6000 });
    expectWelcome(s);
  });
});
