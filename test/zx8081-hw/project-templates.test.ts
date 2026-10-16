import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { CodeToInject } from "@abstractions/CodeToInject";
import { playInjectionFlow } from "@common/headless/frameRunner";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { createZx81Session } from "../harness/zx81";

/**
 * The ZX81 and ZX80 project templates (`.plans/ZX8081_CODE_INJECTION_PLAN.md` phase 5) assemble
 * without errors and do what their comments say when run as the IDE runs them.
 */
const TEMPLATES = join(__dirname, "../../src/public/project-templates");

async function runTemplate(machineId: "zx81" | "zx80", model?: string) {
  const source = readFileSync(join(TEMPLATES, machineId, "default/code/code.kz80.asm"), "utf8");
  const out = await new Z80Assembler().compile(source);
  expect(out.errors).toEqual([]);
  const code: CodeToInject = {
    model: machineId,
    entryAddress: out.entryAddress,
    segments: out.segments.map((s) => ({ startAddress: s.startAddress, bankOffset: 0, emittedCode: s.emittedCode })),
    options: {}
  };
  const s = await createZx81Session({ machineId, model });
  s.bootToBasic();
  playInjectionFlow(s.machine, await s.machine.getCodeInjectionFlow(machineId), { code });
  s.runFrames(200);
  return s;
}

describe("ZX80/ZX81 project templates", () => {
  it.each(["zx81-16k", "zx81-1k"])(
    "the ZX81 template prints its welcome in the middle of the screen, the machine in inverse (%s)",
    async (model) => {
      const s = await runTemplate("zx81", model);
      const screen = s.screenText();
      expect(screen[10]).toBe("      WELCOME TO KLIVE IDE");
      expect(screen[11]).toBe("        " + [..."(SINCLAIR ZX81)"].map((c) => `[${c}]`).join(""));
      expect(screen[23]).toBe("0/2");
    }
  );

  it("the ZX80 template adds up 1 to 10 at 16443", async () => {
    const s = await runTemplate("zx80");
    expect(s.peek(16443)).toBe(55);
    expect(s.screenText()[23]).toBe("0/2");
  });
});
