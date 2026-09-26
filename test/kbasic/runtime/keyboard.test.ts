import { beforeEach, describe, expect, it } from "vitest";

import { createRuntimeRig, type RuntimeRig } from "./runtime-kit";

describe("Klive BASIC runtime - keyboard", () => {
  let rig: RuntimeRig;
  beforeEach(async () => {
    rig = await createRuntimeRig({ uses: ["KeyScan", "Inkey"], extra: "Idle:\n    jr Idle" });
  });

  /** Holds the keys for a frame and scans them. The CPU idles meanwhile, so the ROM's editor never sees them. */
  function scan(...keys: string[]): number {
    const idle = rig.program.symbol("Idle");
    rig.session.machine.pc = idle;
    rig.session.keyDown(...keys).runFrames(1);
    const code = rig.call("core.KeyScan").a;
    rig.session.keyUp(...keys).runFrames(1);
    return code;
  }

  it("decodes plain, shifted and symbol keys", () => {
    expect(scan()).toBe(0);
    expect(scan("Z")).toBe("z".charCodeAt(0));
    expect(scan("CShift", "Z")).toBe("Z".charCodeAt(0));
    expect(scan("SShift", "Z")).toBe(":".charCodeAt(0));
    expect(scan("SShift", "Q"), "the <= token").toBe(199);
    expect(scan("Space")).toBe(32);
  });

  it("gives digits their editing codes with CAPS SHIFT", () => {
    expect(scan("N0")).toBe(48);
    expect(scan("CShift", "N0"), "DELETE").toBe(12);
    expect(scan("CShift", "N5"), "cursor left").toBe(8);
    expect(scan("CShift", "N9"), "GRAPHICS").toBe(15);
  });

  it("gives nothing for a shift alone, and EXTEND for both", () => {
    expect(scan("CShift")).toBe(0);
    expect(scan("SShift")).toBe(0);
    expect(scan("CShift", "SShift")).toBe(14);
  });

  it("follows CAPS LOCK for letters only", () => {
    rig.session.poke(0x5c6a, rig.session.peek(0x5c6a) | 0x08);
    expect(scan("K")).toBe("K".charCodeAt(0));
    expect(scan("N3")).toBe("3".charCodeAt(0));
  });
});
