import { describe, expect, it } from "vitest";

import { TvcChars } from "@common/machines/char-codes";
import { createTvcSession } from "../harness/tvc";

/*
 * The TVC character set (`char-codes.ts`): the codes BASIC stores for the Hungarian letters, typed
 * into a string on both models, are the ones the memory panel names.
 */

const BASIC_TEXT = 0x19ef;
const LETTERS = "áéíóöőúüűÁÉÍÓÖŐÚÜŰ";

describe("TVC character set", () => {
  it.each(["tvc64", "tvc64p"])("names the codes %s's BASIC stores for the Hungarian letters", async (model) => {
    const s = (await createTvcSession({ model })).bootToBasic();
    s.typeKeys(`10 a$="${LETTERS}"\n`, { settle: 10 });
    // --- Length, line number, A, $, the = token, the opening quote
    const stored = Array.from({ length: LETTERS.length }, (_, i) => s.peek(BASIC_TEXT + 7 + i));
    expect(stored.map((code) => TvcChars[code]?.v).join("")).toBe(LETTERS);
    expect(s.peek(BASIC_TEXT + 7 + LETTERS.length)).toBe(0x22);
  });
});
