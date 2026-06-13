import { describe, expect, it } from "vitest";
import { parseKeyMappings } from "../../src/main/key-mappings/keymapping-parser";

describe("parseKeyMappings", () => {
  it("parses merged key mappings", () => {
    const mappings = parseKeyMappings(JSON.stringify({
      $merge: true,
      KeyQ: "A",
      ArrowLeft: ["CShift", "N5"]
    }));

    expect(mappings).toEqual({
      merge: true,
      mapping: {
        KeyQ: "A",
        ArrowLeft: ["CShift", "N5"]
      }
    });
  });

  it("rejects unknown physical keys", () => {
    expect(() => parseKeyMappings(JSON.stringify({ NotAKey: "A" }))).toThrow(
      "Unknown key code"
    );
  });

  it("rejects unknown Spectrum keys", () => {
    expect(() => parseKeyMappings(JSON.stringify({ KeyQ: "NoSuchSpectrumKey" }))).toThrow(
      "Unknown key code"
    );
  });
});
