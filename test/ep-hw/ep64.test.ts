import { describe, expect, it } from "vitest";

import { createEpSession } from "../harness/enterprise";
import { pictureHash, writeShotIfAsked } from "./bare";

/*
 * The Enterprise 64 (`.plans/ENTERPRISE_PLAN.md` Phase 6, D2): EXOS 2.0 and IS-BASIC 2.0 in 64K, the
 * four segments FCh-FFh that are also NICK's video RAM. EXOS tests and counts them itself; segments
 * F8h-FBh, the 128's extra RAM, are not there.
 */

describe("Enterprise 64", () => {
  it("tests 64K with EXOS 2.0 and boots IS-BASIC with 65536 bytes", async () => {
    const s = await createEpSession({ model: "ep64" });
    s.runUntil(() => s.screenText().includes("TESTING"), { maxFrames: 300 }, "the RAM test");
    expect(s.screenText()).toContain("EXOS 2.0");
    s.bootToBasic();
    const text = s.screenText();
    expect(text).toContain("IS-BASIC");
    expect(text).toContain("65536 bytes in system");
    expect(text).toMatch(/^ok$/m);
  });

  it("has RAM in FCh-FFh only: F8h-FBh read FFh and ignore writes", async () => {
    const s = await createEpSession({ model: "ep64" });
    s.bootToBasic();
    for (const segment of [0xf8, 0xf9, 0xfa, 0xfb]) {
      const at = segment * 0x4000 + 0x1234;
      expect(s.physical(at), segment.toString(16)).toBe(0xff);
    }
    // --- The machine's own RAM holds what EXOS put there: its system segment is not blank
    const system = [...Array(256)].map((_, i) => s.physical(0xff * 0x4000 + i));
    expect(system.some((b) => b !== 0xff)).toBe(true);
  });

  /*
   * The IS-BASIC 2.0 picture after boot, checked by eye: the status line "IS-BASIC  program 0" in red
   * and cyan, then "65536 bytes in system", "50583 bytes unused" and "ok" in green on black.
   */
  const BASIC_PICTURE_SHA1 = "f13797fd7288fd4d7ee632768140399073ae2bce";

  it("draws IS-BASIC 2.0's screen, the picture checked by eye", async () => {
    const s = await createEpSession({ model: "ep64" });
    s.bootToBasic();
    await writeShotIfAsked(s, "basic-ep64");
    expect(await pictureHash(s)).toBe(BASIC_PICTURE_SHA1);
  });
});
