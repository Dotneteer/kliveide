import { describe, expect, it } from "vitest";

import { createTvcSession } from "../harness/tvc";
import { canTypeOnTvc } from "@emu/machines/tvc/TvcTyper";
import { TvcKeyCode as K } from "@emu/machines/tvc/TvcKeyCode";

/*
 * The TVC keyboard and the typer (`.plans/VIDEOTON_TVC_PLAN.md` §8; `TvcTyper.ts`). Each character
 * was first typed key by key and read off the screen by eye; here the typer types them into a BASIC
 * string and the test finds them, unchanged, in the program BASIC stored.
 */

const BASIC_TEXT = 0x19ef;
const ASCII = "aZ09'+!%/=(),?.:-_;$^~*#@`[{]}\\|<>";

describe("TVC typer", () => {
  it("types every ASCII character it knows into a BASIC string, as the same codes", async () => {
    const s = await createTvcSession();
    s.bootToBasic();
    s.typeKeys(`10 a$="${ASCII}"\n`, { settle: 10 });
    const program = Array.from({ length: 64 }, (_, i) => s.peek(BASIC_TEXT + i));
    const text = String.fromCharCode(...program);
    expect(text).toContain(ASCII);
  });

  it("knows the Hungarian accented letters and refuses what has no key", () => {
    for (const c of "áéíóöőúüűÁÉÍÓÖŐÚÜŰ") expect(canTypeOnTvc(c), c).toBe(true);
    expect(canTypeOnTvc("€")).toBe(false);
  });
});

describe("TVC keyboard: INS (row 8, column 0)", () => {
  /** Types `POKE 30000,13`, steps back onto the 3, optionally presses INS, types 2, and runs it */
  async function editWith(ins: boolean): Promise<number> {
    const s = await createTvcSession();
    s.bootToBasic();
    s.typeKeys("POKE 30000,13", { settle: 10 });
    s.pressKey(K.Left, { hold: 3, gap: 6 });
    if (ins) s.pressKey(K.Ins, { hold: 3, gap: 6 });
    s.typeKeys("2\n", { settle: 40 });
    return s.peek(30000);
  }

  it("the editor overwrites without it and inserts after it", async () => {
    expect(await editWith(false)).toBe(12);
    expect(await editWith(true)).toBe(123);
  });
});
