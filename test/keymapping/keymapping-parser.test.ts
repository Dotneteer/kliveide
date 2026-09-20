import { describe, it, expect } from "vitest";
import { parseKeyMappings } from "@main/key-mappings/keymapping-parser";
import { spectrumKeyMappings } from "@emu/machines/zxSpectrum/SpectrumKeyMappings";

describe("Key mappings", () => {
  it("default keymappings work", () => {
    const toParse = JSON.stringify(spectrumKeyMappings, null, 2);
    const parsed = parseKeyMappings(toParse);

    expect(parsed).not.toEqual(undefined);
    const mapping = parsed.mapping;
    expect(mapping.Digit1).toEqual("N1");
    expect(mapping.KeyK).toEqual("K");
    expect(mapping.Comma.length).toEqual(2);
    expect(mapping.Comma[0]).toEqual("SShift");
    expect(mapping.Comma[1]).toEqual("N");
    expect(parsed.merge).toEqual(false);
  });

  /*
   * A mapping is one key, or a modifier plus a key, and never more. Every machine types a character
   * as `primaryCode` + an optional `secondaryCode` (ZxSpectrumBase, Z88Machine, Z88WasmHost,
   * C64Machine), and the Next's membrane holds its extra keys as exactly two matrix keys
   * (`EXTRA_KEY_COMBOS`); extended mode is a latch entered by a prior keystroke, not a third key
   * held down. `KeySet` is typed to match, so these tests are what stops the runtime drifting
   * from it.
   */
  it("accepts a single key given as a bare string", () => {
    const parsed = parseKeyMappings(JSON.stringify({ Digit1: "N1" }));
    expect(parsed.mapping.Digit1).toEqual("N1");
  });

  it("accepts a one-item list", () => {
    const parsed = parseKeyMappings(JSON.stringify({ Digit1: ["N1"] }));
    expect(parsed.mapping.Digit1).toEqual(["N1"]);
  });

  it("accepts a modifier plus a key", () => {
    const parsed = parseKeyMappings(JSON.stringify({ ArrowLeft: ["CShift", "N5"] }));
    expect(parsed.mapping.ArrowLeft).toEqual(["CShift", "N5"]);
  });

  it("rejects a three-item list", () => {
    expect(() =>
      parseKeyMappings(JSON.stringify({ ArrowLeft: ["CShift", "SShift", "N5"] }))
    ).toThrowError(/should contain one or two items and not 3/);
  });

  it("rejects an empty list", () => {
    expect(() => parseKeyMappings(JSON.stringify({ ArrowLeft: [] }))).toThrowError(
      /should contain one or two items and not 0/
    );
  });

  it("rejects an unknown machine key inside a list", () => {
    expect(() =>
      parseKeyMappings(JSON.stringify({ ArrowLeft: ["CShift", "NoSuchKey"] }))
    ).toThrowError(/Unknown key code: 'NoSuchKey'/);
  });

  it("rejects an unknown host key code", () => {
    expect(() => parseKeyMappings(JSON.stringify({ NoSuchHostKey: "N1" }))).toThrowError(
      /Unknowm key code: 'NoSuchHostKey'/
    );
  });

  it("recognises the $merge marker without treating it as a key", () => {
    const parsed = parseKeyMappings(JSON.stringify({ $merge: true, Digit1: "N1" }));
    expect(parsed.merge).toEqual(true);
    expect(parsed.mapping.$merge).toBeUndefined();
    expect(parsed.mapping.Digit1).toEqual("N1");
  });
});
