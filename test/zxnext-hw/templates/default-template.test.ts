import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createSession } from "../../harness/zxnext";

/*
 * The ZX Spectrum Next's `default` project template (Klive Z80 assembly, `.model next`): built into a
 * NEX with the assembler and NEX writer the IDE uses, loaded as `.nexload` loads it (the harness's
 * direct load, with the 48K ROM paged in for the font, as NextZXOS leaves it), and run.
 */

const TEMPLATE = join(__dirname, "../../../src/public/project-templates/zxnext/default/code/code.kz80.asm");

describe("the ZX Spectrum Next default template", () => {
  it("prints its welcome at 28 MHz and stays in its trap loop", async () => {
    const s = await createSession();
    await s.prepareBasic();
    await s.loadProgramFile(TEMPLATE);
    // --- The screen still shows the 48K BASIC boot screen before the program runs
    expect(s.screenLine(10).trim()).toBe("");
    s.runFrames(5);

    expect(s.screenLine(10)).toBe("      Welcome to Klive IDE");
    expect(s.screenLine(11)).toBe("       (ZX Spectrum Next)");
    // --- The two lines on a green band (PAPER 4), the second BRIGHT; the rest PAPER 7, INK 0
    expect(s.peek(0x5800 + 10 * 32 + 6)).toBe(0x20);
    expect(s.peek(0x5800 + 11 * 32 + 7)).toBe(0x60);
    expect(s.peek(0x5800)).toBe(0x38);
    // --- 28 MHz (NextReg $07 = 3)
    expect(s.nextRegValue(0x07) & 0x03).toBe(3);
    // --- The program does not return: it stays in its trap loop
    const pc = s.machine.pc;
    s.runFrames(5);
    expect(s.machine.pc).toBe(pc);
    expect(s.peek(pc)).toBe(0x18); // jr
    expect(s.peek(pc + 1)).toBe(0xfe); // to itself
  });
});
