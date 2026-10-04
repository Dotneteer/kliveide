import { describe, expect, it } from "vitest";

import { createZx81Session, Zx81TestSession } from "..";

describe("ZX81 harness", () => {
  it("boots the real ROM to the K cursor", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    expect(s.hasKCursor()).toBe(true);
    // --- MARGIN: 55 blank lines on a UK (PAL) machine (ROM KEYBOARD)
    expect(s.peek(0x4028)).toBe(55);
    expect(s.screenText()[23]).toBe("[K]");
  });

  it("types a command and prints", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    // --- In K mode P is PRINT; SHIFT+P is the quote
    s.typeKeys('P"HELLO"\n', { settle: 20 });
    expect(s.screenText()[0]).toBe("HELLO");
    expect(s.screenText()[23]).toBe("0/0");
  });

  it("loads a program file and runs it", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    const frames = s.loadProgram(Zx81TestSession.readProgram("basic/Characters.P"));
    expect(frames).toBeLessThan(100);
    s.runFrames(200);
    // --- The program prints the character set, each followed by its inverse
    expect(s.screenText()[0].startsWith(" [ ]")).toBe(true);
  });

  it("keeps the frame length across a power-on, which the controller paces the UI by", async () => {
    for (const [model, tacts] of [["zx81-16k", 65_000], ["zx81-16k-us", 54_167]] as const) {
      const s = await createZx81Session({ model });
      await s.machine.hardReset();
      expect(s.machine.tactsInFrame, model).toBe(tacts);
      expect(s.wasm.zx8081GetTactsInFrame(), model).toBe(tacts);
    }
  });
});
