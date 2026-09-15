import { describe, expect, it } from "vitest";

import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";
import { convertAsciiStringToNextKeyCodes } from "@emu/machines/zxNext/NextKeyboardDevice";

/*
 * Capitals are CAPS SHIFT + letter. They were encoded as SYMBOL SHIFT + letter, which does not
 * produce a capital at all but the symbol printed on the key — SYMBOL SHIFT + N is `,`. Injecting
 * `.nexload ScrollNutter.nex` therefore typed a comma where the `N` belonged.
 *
 * See .plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md §15.13.
 */

describe("ASCII to ZX Next key codes", () => {
  it("encodes capitals with CAPS SHIFT, not SYMBOL SHIFT", () => {
    const [n] = convertAsciiStringToNextKeyCodes("N");
    expect(n.primaryCode).toBe(SpectrumKeyCode.N);
    expect(n.secondaryCode).toBe(SpectrumKeyCode.CShift);

    const [s] = convertAsciiStringToNextKeyCodes("S");
    expect(s.primaryCode).toBe(SpectrumKeyCode.S);
    expect(s.secondaryCode).toBe(SpectrumKeyCode.CShift);
  });

  it("encodes every capital with CAPS SHIFT and its own letter key", () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (const letter of letters) {
      const [code] = convertAsciiStringToNextKeyCodes(letter);
      expect(code, `capital ${letter}`).toBeDefined();
      expect(code.secondaryCode, `capital ${letter} shift`).toBe(SpectrumKeyCode.CShift);
      expect(code.primaryCode, `capital ${letter} key`).toBe(
        convertAsciiStringToNextKeyCodes(letter.toLowerCase())[0].primaryCode
      );
    }
  });

  it("keeps SYMBOL SHIFT for punctuation, where the symbol is what is wanted", () => {
    // --- `.` really is SYMBOL SHIFT + M; that entry was never wrong.
    const [dot] = convertAsciiStringToNextKeyCodes(".");
    expect(dot.primaryCode).toBe(SpectrumKeyCode.M);
    expect(dot.secondaryCode).toBe(SpectrumKeyCode.SShift);

    const [comma] = convertAsciiStringToNextKeyCodes(",");
    expect(comma.primaryCode).toBe(SpectrumKeyCode.N);
    expect(comma.secondaryCode).toBe(SpectrumKeyCode.SShift);
  });

  it("distinguishes a capital N from a comma", () => {
    // --- The exact confusion that produced `,utter.nex`: these must not encode identically.
    const [capitalN] = convertAsciiStringToNextKeyCodes("N");
    const [commaKey] = convertAsciiStringToNextKeyCodes(",");
    expect(capitalN.primaryCode).toBe(commaKey.primaryCode);
    expect(capitalN.secondaryCode).not.toBe(commaKey.secondaryCode);
  });

  it("encodes the launch command the NEX flow types", () => {
    const codes = convertAsciiStringToNextKeyCodes(".nexload ScrollNutter.nex");
    // --- One key code per character, nothing silently dropped by the map.
    expect(codes).toHaveLength(".nexload ScrollNutter.nex".length);

    // --- The two capitals carry CAPS SHIFT; the lower-case letters carry no shift at all.
    const capitals = [9, 15]; // S of ScrollNutter, N of Nutter
    for (const index of capitals) {
      expect(codes[index].secondaryCode, `index ${index}`).toBe(SpectrumKeyCode.CShift);
    }
    expect(codes[1].secondaryCode).toBeUndefined(); // n
    expect(codes[10].secondaryCode).toBeUndefined(); // c
  });
});
