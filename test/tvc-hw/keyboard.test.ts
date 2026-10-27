import { describe, expect, it } from "vitest";

import { createTvcSession } from "../harness/tvc";
import { canTypeOnTvc } from "@emu/machines/tvc/TvcTyper";

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
