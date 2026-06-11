import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGeneratedTapeSaveDefaultPath,
  normalizeGeneratedTapeFileName
} from "../../src/main/generated-tape-save";

describe("generated tape save helpers", () => {
  it("adds a TZX extension when missing", () => {
    expect(normalizeGeneratedTapeFileName("demo")).toBe("demo.tzx");
  });

  it("preserves an existing TZX extension case-insensitively", () => {
    expect(normalizeGeneratedTapeFileName("demo.TZX")).toBe("demo.TZX");
  });

  it("uses a safe fallback for an empty generated name", () => {
    expect(normalizeGeneratedTapeFileName("   ")).toBe("saved.tzx");
  });

  it("strips accidental path components from the generated name", () => {
    expect(normalizeGeneratedTapeFileName("some/folder/demo")).toBe("demo.tzx");
    expect(normalizeGeneratedTapeFileName("some\\folder\\demo")).toBe("demo.tzx");
  });

  it("uses the last tape folder before falling back to the home folder", () => {
    expect(createGeneratedTapeSaveDefaultPath("demo", "/tmp/tapes", "/home/me")).toBe(
      path.join("/tmp/tapes", "demo.tzx")
    );
    expect(createGeneratedTapeSaveDefaultPath("demo", undefined, "/home/me")).toBe(
      path.join("/home/me", "demo.tzx")
    );
  });
});
