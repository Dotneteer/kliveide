import { describe, it, expect } from "vitest";
import { execa } from "execa";

describe("execa", () => {
  it("cli works", async () => {
    // --- Act
    const result = await execa("/Users/dotneteer/z88dk/bin/zcc", ["Hello", "world!"]);
    // --- Assert
    console.log(result);
  });
});
