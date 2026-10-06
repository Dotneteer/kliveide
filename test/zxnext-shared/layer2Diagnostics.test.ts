import { describe, expect, it } from "vitest";

import { layer2Diagnostics } from "@common/zxnext/layer2/layer2Diagnostics";
import { l2regs } from "./layer2Fixtures";

const ids = (d: { id: string }[]) => d.map((x) => x.id);

describe("Layer 2 diagnostics", () => {
  it("says nothing for a plain enabled layer", () => {
    expect(layer2Diagnostics({ regs: l2regs() })).toEqual([]);
  });

  it("reports Layer 2 off", () => {
    expect(ids(layer2Diagnostics({ regs: l2regs({ enabled: false }) }))).toEqual(["off"]);
  });

  it("T1: writes to the displayed bank, or through the shadow bank", () => {
    expect(ids(layer2Diagnostics({ regs: l2regs({ port123B: 0x43 }) }))).toEqual(["writesShown"]);
    expect(ids(layer2Diagnostics({ regs: l2regs({ port123B: 0x0b }) }))).toEqual(["writesShadow"]);
    // --- the shadow set overlapping the displayed one still writes to the screen
    expect(ids(layer2Diagnostics({ regs: l2regs({ port123B: 0x0b, shadowBank: 9 }) }))).toEqual(["writesShown"]);
  });

  it("T5: banks past 2 MB, displayed or written", () => {
    expect(ids(layer2Diagnostics({ regs: l2regs({ activeBank: 110 }) }))).toEqual(["outsideRam"]);
    expect(ids(layer2Diagnostics({ regs: l2regs({ port123B: 0x0b, shadowBank: 120 }) }))).toEqual([
      "writesShadow",
      "writesPastRam"
    ]);
  });

  it("notes $12 = $13 and an empty clip window", () => {
    expect(ids(layer2Diagnostics({ regs: l2regs({ shadowBank: 8 }) }))).toEqual(["sameBanks"]);
    expect(ids(layer2Diagnostics({ regs: l2regs({ clip: [0, 255, 100, 50] }) }))).toEqual(["clipEmpty"]);
  });

  it("T6: every visible pixel transparent - two indices, one colour", () => {
    const displayed = Int16Array.from([3, 7, -1, 3]);
    const transparent = (i: number) => i === 3 || i === 7;
    expect(ids(layer2Diagnostics({ regs: l2regs(), displayed, isTransparent: transparent }))).toEqual(["allTransparent"]);
    expect(layer2Diagnostics({ regs: l2regs(), displayed, isTransparent: (i) => i === 3 })).toEqual([]);
  });
});
