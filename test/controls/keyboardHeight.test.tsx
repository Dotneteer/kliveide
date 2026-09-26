import { describe, expect, it } from "vitest";
import { keyboardHeightFor } from "@renderer/features/emulator/keyboardHeight";

/*
 * Issue #1377: each machine keeps its own keyboard height; a machine not yet adjusted starts at
 * the height last set on any machine.
 */
describe("keyboardHeightFor", () => {
  it("uses the machine's own height", () => {
    expect(keyboardHeightFor({ z88: "220px", sp48: "300px" }, "z88", "33%")).toBe("220px");
  });

  it("falls back to the last height for a machine without one", () => {
    expect(keyboardHeightFor({ z88: "220px" }, "sp48", "280px")).toBe("280px");
    expect(keyboardHeightFor({}, undefined, "33%")).toBe("33%");
  });

  it("does not trust the settings file's shape", () => {
    expect(keyboardHeightFor(undefined, "z88", "33%")).toBe("33%");
    expect(keyboardHeightFor(["220px"], "0", "33%")).toBe("33%");
    expect(keyboardHeightFor({ z88: 220 }, "z88", "33%")).toBe("33%");
    expect(keyboardHeightFor({ z88: "" }, "z88", "33%")).toBe("33%");
  });
});
