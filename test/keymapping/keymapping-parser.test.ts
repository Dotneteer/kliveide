import "mocha";
import { expect } from "expect";
import { spectrumKeyMappings } from "@renderer/appEmu/EmulatorArea/key-mappings";
import { parseKeyMappings } from "@main/key-mappings/keymapping-parser";
import { SpectrumKeyCode } from "@renderer/abstractions/SpectrumKeyCode";

describe("Key mappings", () => {
  it("default keymappings work", () => {
    const toParse = JSON.stringify(spectrumKeyMappings, null, 2);
    const parsed = parseKeyMappings(toParse);

    expect(parsed).not.toEqual(undefined);
    const mapping = parsed.mapping;
    expect(mapping.Digit1).toEqual(SpectrumKeyCode.N1);
    expect(mapping.KeyK).toEqual(SpectrumKeyCode.K);
    expect(mapping.Comma.length).toEqual(2);
    expect(mapping.Comma[0]).toEqual(SpectrumKeyCode.SShift);
    expect(mapping.Comma[1]).toEqual(SpectrumKeyCode.N);
    expect(parsed.merge).toEqual(false);
  });
});
