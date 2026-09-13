import { describe, expect, it } from "vitest";

import { messageOf } from "@mvc/core/errors";

describe("messageOf", () => {
  it.each([
    [new Error("boom"), "boom"],
    ["plain string failure", "plain string failure"],
    [{ message: "duck-typed error" }, "duck-typed error"],
    // --- A rejection with no readable message must still say something
    [undefined, "Unknown error"],
    [null, "Unknown error"],
    ["", "Unknown error"],
    [{ message: "" }, "Unknown error"],
    [{}, "Unknown error"],
    [42, "42"]
  ])("%o -> %s", (input, expected) => {
    expect(messageOf(input)).toBe(expected);
  });

  it("uses the caller's fallback when there is nothing to say", () => {
    expect(messageOf(undefined, "The smoke test failed.")).toBe("The smoke test failed.");
  });
});
