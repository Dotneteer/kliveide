import { describe, expect, it } from "vitest";

import type { CodeToInject } from "@abstractions/CodeToInject";
import { tokenizeBasicProgram } from "@common/basic/spectrumBasicTokenizer";
import { MicrodriveFileSystem } from "@common/diskfs/mdrfs";
import { SP128_RETURN_TO_EDITOR, SP48_MAIN_ENTRY } from "@emu/machines/ZxSpectrumBase";
import { createFormattedMdr } from "@emu/machines/microdrive/mdrImage";
import { sp128MicrodriveBootFlow, sp48MicrodriveBootFlow } from "@emu/machines/zxSpectrum/if1/microdriveBootFlows";
import { createSp128Session } from "../../harness/sp128";
import { installProgram, sp48WithInterface1 } from "./if1TestSupport";

/*
 * The Interface 1 on the 128K, and RUN's auto-load of "run" (`.plans/MICRODRIVE_PLAN.md` Phase 4.2,
 * 4.3; `_input/microdrive/model-compatibility.md` §2, `test-material.md` T9, T10).
 */

const EMPTY = (model: "sp48" | "sp128"): CodeToInject => ({
  model,
  subroutine: true,
  entryAddress: 0x8000,
  segments: [{ startAddress: 0x8000, bankOffset: 0, emittedCode: [0xc9] }],
  options: { noCls: true }
});

/** A cartridge holding a program "run" that POKEs 40000 with 42 */
function bootCartridge(): Uint8Array {
  const fs = new MicrodriveFileSystem(createFormattedMdr("BOOT"));
  const program = tokenizeBasicProgram("10 POKE 40000,42");
  fs.write({ name: "run", kind: "basic", data: program, start: 10, variablesOffset: program.length });
  return fs.image();
}

async function sp128In(basic: "sp48" | "sp128") {
  const s = await createSp128Session("sp128");
  s.runFlow(await s.machine.getCodeInjectionFlow(basic), { code: EMPTY(basic) });
  s.runTo(basic === "sp48" ? SP48_MAIN_ENTRY : SP128_RETURN_TO_EDITOR, { rom: basic === "sp48" ? 1 : 0, maxFrames: 5 });
  s.runFrames(30);
  return s;
}

describe("Interface 1 on the 128K", () => {
  it("works from 48 BASIC too", async () => {
    const s = await sp128In("sp48");
    s.connectInterface1().insertCartridge(0, createFormattedMdr("TEST"));
    installProgram(s, `10 CAT 1`);
    s.typeKeys([["R"], ["Enter"]]).runFrames(800);
    const text = s.screenText();
    expect(text).toContain("TEST");
    expect(text).toContain("127");
    expect(text).toContain("0 OK, 10:1");
  }, 120_000);

  it("the 128 editor's report line is one character short for an IF1 report (Farrow's ROM 0 bug list)", async () => {
    const s = await sp128In("sp128");
    s.connectInterface1();
    s.typeText(`1000 OPEN #4,"x"\n`, { hold: 4, gap: 8 }).runFrames(50);
    s.typeText(`run\n`, { hold: 4, gap: 8 }).runFrames(300);
    // --- "Invalid device expression, 1000:1" is 33 characters: the editor's line holds 32, so the
    // --- statement number wraps onto a line of its own - the overrun Farrow's list describes
    const lines = s.screenText().split("\n").map((l) => l.trimEnd()).filter((l) => l.length > 0);
    expect(lines.slice(-2)).toEqual(["Invalid device expression, 1000:", "1"]);
  }, 120_000);
});

describe("RUN with no program loads \"run\" from Microdrive 1 (T9)", () => {
  it("on the 48K", async () => {
    const s = (await sp48WithInterface1()).insertCartridge(0, bootCartridge());
    s.typeKeys([["R"], ["Enter"]]).runFrames(800);
    expect(s.peek(40000)).toBe(42);
  }, 120_000);

  it("on the 128K, from 48 BASIC", async () => {
    const s = await sp128In("sp48");
    s.connectInterface1().insertCartridge(0, bootCartridge());
    s.typeKeys([["R"], ["Enter"]]).runFrames(800);
    expect(s.peek(40000)).toBe(42);
  }, 120_000);

  it("on the 128K, from 128 BASIC too: the editor's RUN reaches the IF1 as 48K BASIC's does", async () => {
    const s = await sp128In("sp128");
    s.connectInterface1().insertCartridge(0, bootCartridge());
    s.typeText(`run\n`).runFrames(800);
    expect(s.peek(40000)).toBe(RECORDED.autoRunFrom128Basic);
  }, 120_000);
});

/** What the real ROMs did (plan §9) */
const RECORDED = {
  autoRunFrom128Basic: 42
};

describe("the Microdrive Loader (Phase 4.3)", () => {
  it("the 48K's flow: RUN at the main loop loads and runs \"run\"", async () => {
    const s = (await sp48WithInterface1()).insertCartridge(0, bootCartridge());
    s.typeFlowKeys(sp48MicrodriveBootFlow()).runFrames(800);
    expect(s.peek(40000)).toBe(42);
  }, 120_000);

  it("the 128K's flow: from the menu to 128 BASIC, then run", async () => {
    const s = await createSp128Session("sp128");
    s.connectInterface1().insertCartridge(0, bootCartridge());
    s.runFlow(sp128MicrodriveBootFlow());
    s.runFrames(800);
    expect(s.screenText()).toContain("0 OK, 10:1");
    expect(s.peek(40000)).toBe(42);
  }, 120_000);

  it("the machines hand out the flow only with the Interface 1 connected", async () => {
    const s = await createSp128Session("sp128");
    expect(s.machine.getMicrodriveBootFlow?.()).toBeUndefined();
  }, 60_000);
});
