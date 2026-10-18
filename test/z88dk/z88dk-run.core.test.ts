import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import { createSp48Session } from "../harness/sp48";
import { createSp128Session } from "../harness/sp128";
import { tapeBlocksOf } from "@common/headless/tapeBlocks";
import { createZx81Session, Zx81TestSession } from "../harness/zx81";
import { mapValue, parseZ88dkMap } from "@main/z88dk-integration/z88dk-map";

/*
 * z88dk programs on the real cores (`.plans/Z88DK_INTEGRATION_PLAN.md` §3, spike 1): the committed
 * fixtures are zcc output, so these prove the entry and exit conventions `.ai/z88dk/targets.md`
 * records - the +zx crt0 runs as a subroutine and returns to BASIC, the ZX81 `.P` loads and runs.
 */

const FIXTURES = path.join(__dirname, "fixtures");
const read = (fixture: string, file: string) => fs.readFileSync(path.join(FIXTURES, fixture, file));
const symbol = (fixture: string, name: string) => mapValue(parseZ88dkMap(read(fixture, "program.map").toString("utf8")), name)!;

describe("z88dk +zx on the 48K", () => {
  it("runs main as a subroutine, prints and returns to BASIC", async () => {
    const s = await createSp48Session();
    s.bootToBasic();
    const image = read("zx-hello", "program");
    const origin = symbol("zx-hello", "CRT_ORG_CODE");
    expect(origin).toBe(0x8000);
    image.forEach((byte, i) => s.poke(origin + i, byte));
    // --- `call` runs until the routine returns to the BASIC main loop: the crt0 restores SP and RETs
    s.call(origin);
    expect(s.peekWord(symbol("zx-hello", "_counter"))).toBe(7);
    expect(s.peek(symbol("zx-hello", "_pt"))).toBe(7);
    // --- z88dk's console draws its own font (not the ROM's), so the text is not ROM characters:
    // --- the first character row holds ink
    let ink = 0;
    for (let line = 0; line < 8; line++) for (let col = 0; col < 32; col++) ink |= s.peek(0x4000 + line * 256 + col);
    expect(ink).not.toBe(0);
  });
});

describe("z88dk +zx81 on the ZX81", () => {
  it("loads the .P appmake wrote and runs it", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    const file = Zx81TestSession.readProgram(path.join(FIXTURES, "zx81-hello", "program.P"));
    s.loadProgram(file, { autoRun: true });
    const counter = symbol("zx81-hello", "_counter");
    s.runUntil(() => s.peekWord(counter) === 42, { maxFrames: 500 }, "main's result in _counter");
    expect(s.peekWord(counter)).toBe(42);
  });
});

describe("z88dk banked code on the 128K (§9)", () => {
  it("loads appmake's tape through the Tape Loader, which pages bank 1 in for the banked call", async () => {
    const s = await createSp128Session("sp128");
    const tape = tapeBlocksOf(read("zx-banked", "program.tap"));
    if ("error" in tape) throw new Error(tape.error);
    s.insertTape(tape.blocks);
    s.runFlow(s.machine.getTapeLoadFlow(), { checkRom: false, maxFrames: 1500 });
    const counter = symbol("zx-banked", "_counter");
    for (let i = 0; i < 1500 && s.peekWord(counter) !== 7; i++) s.runFrames(1);
    expect(s.peekWord(counter)).toBe(7);
    expect(Array.from(s.bank(1).slice(0, 4))).toEqual(Array.from(read("zx-banked", "program_BANK_1.bin").subarray(0, 4)));
  });
});

describe("z88dk +zx on the 128K family, injected in 48 BASIC", () => {
  for (const model of ["sp128", "plus3-fdd1"]) {
    it(`runs on the ${model} through the sp48 injection flow`, async () => {
      const s = await createSp128Session(model as any);
      const origin = symbol("zx-hello", "CRT_ORG_CODE");
      const code = {
        model: "sp48",
        entryAddress: origin,
        subroutine: true,
        segments: [{ startAddress: origin, bankOffset: 0, emittedCode: Array.from(read("zx-hello", "program")) }],
        options: { subroutine: true }
      };
      s.runFlow(await s.machine.getCodeInjectionFlow("sp48"), { code, checkRom: false, maxFrames: 1500 });
      const counter = symbol("zx-hello", "_counter");
      for (let i = 0; i < 300 && s.peekWord(counter) !== 7; i++) s.runFrames(1);
      expect(s.peekWord(counter)).toBe(7);
    });
  }
});
