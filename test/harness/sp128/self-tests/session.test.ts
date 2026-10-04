import { describe, expect, it } from "vitest";
import { createSp128Session } from "..";

describe("sp128 harness", () => {
  it.each(["sp128", "nofdd", "fdd1"] as const)("boots the %s from its real ROM", async (model) => {
    const s = await createSp128Session(model);
    s.runFrames(100);
    expect(s.frames).toBe(100);
    // --- The ROM has run: PC left page 0's start and the paging is unlocked
    expect(s.cpu().pc).not.toBe(0);
    expect(s.paging().locked).toBe(false);
    expect(s.border()).toBeGreaterThanOrEqual(0);
  });

  it("steps single instructions and reads banks", async () => {
    const s = await createSp128Session("sp128");
    const before = s.cpu().pc;
    s.step();
    expect(s.cpu().pc).not.toBe(before);
    expect(s.bank(5).length).toBe(0x4000);
  });
});
