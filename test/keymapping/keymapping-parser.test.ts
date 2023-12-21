import "mocha";
import { expect } from "expect";
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
});
