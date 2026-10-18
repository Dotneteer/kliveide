import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import { createSp48Session } from "../harness/sp48";
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
