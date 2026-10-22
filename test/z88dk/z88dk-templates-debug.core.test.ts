import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import { playInjectionFlow, type FrameMachine } from "@common/headless/frameRunner";
import { createSp48Session } from "../harness/sp48";
import { createSp128Session } from "../harness/sp128";
import { createTimexSession, hasTimexRom } from "../harness/timex";
import { createSession as createNextSession } from "../harness/zxnext";
import { buildTemplate, codeToInjectOf, FIXTURES } from "./zccReplay";
import { debugWalkthrough, expectWalkthrough, withTemp, type DebugSession } from "./templateRun";

/*
 * Debug on the real cores, one per route (`.plans/ZX_SPECTRUM_C_TEMPLATES_PLAN.md` T4): each template's
 * debug build (zcc replayed) is delivered as Debug delivers it, then walked through the debugger as a
 * user does - a breakpoint in `square`, Step Over, Step Out, Continue - with the Call Stack and the
 * Variables panel built by the IDE's models at every stop (`templateRun.ts`, `debugWalkthrough`).
 */

const templateSource = (fixture: string) => fs.readFileSync(path.join(FIXTURES, fixture, "main.c"), "utf8");

/** Debug on a Spectrum route: the machine's injection flow, then the walkthrough until the program returns. */
async function debugSpectrum(s: DebugSession, fixture: string, machineId: string, modelId?: string) {
  return withTemp(async (temp) => {
    const out = await buildTemplate(temp, fixture, machineId, modelId, "debug");
    const code = codeToInjectOf(out);
    const machine = s.machine as unknown as FrameMachine & { getCodeInjectionFlow(model: string): Promise<any> };
    playInjectionFlow(machine, await machine.getCodeInjectionFlow(code.model), { code });
    // --- The flow pushed the address the program returns to (Run's `subroutine`)
    expect(code.subroutine).toBe(true);
    const returnTo = s.peekWord(s.machine.sp);
    expectWalkthrough(debugWalkthrough(s, out, templateSource(fixture), returnTo));
  });
}

describe("z88dk templates debug (one per route)", () => {
  it("48K: breakpoint, Call Stack, Variables, Step Over/Out and Continue in the sp48 template", async () => {
    await debugSpectrum((await createSp48Session()) as unknown as DebugSession, "tpl-sp48", "sp48", "pal");
  });

  it("128K: the same through the 48 BASIC injection (sp128 template)", async () => {
    await debugSpectrum((await createSp128Session("sp128")) as unknown as DebugSession, "tpl-sp128", "sp128", "sp128");
  });

  it.skipIf(!hasTimexRom("ts2068"))("TS2068 with its ROM (KLIVE_TS2068_ROM): the same for +ts2068 at $9C40", async () => {
    const s = await createTimexSession({ model: "ts2068", rom: "own" });
    await debugSpectrum(s as unknown as DebugSession, "tpl-timex-ts2068", "timex", "ts2068");
  });

  it("Next: the same in the zxnext template's .nex", async () => {
    await withTemp(async (temp) => {
      const out = await buildTemplate(temp, "tpl-zxnext", "zxnext", "standard", "debug");
      const nexFile = path.join(temp, "program.nex");
      fs.writeFileSync(nexFile, Uint8Array.from(out.prebuiltNex!));
      // --- Direct load with the 48K BASIC ROM as `.nexload` hands over (harness README, "Direct load")
      const s = await createNextSession();
      await s.prepareBasic();
      await s.loadProgramFile(nexFile);
      expectWalkthrough(debugWalkthrough(s as unknown as DebugSession, out, templateSource("tpl-zxnext")));
    });
  });
});
