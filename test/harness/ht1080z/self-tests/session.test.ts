import { describe, expect, it } from "vitest";

import { createHtSession } from "..";
import { HT1080Z_TACTS_IN_FRAME } from "@emu/machines/ht1080z/ht1080zMachineInfo";

describe("HT-1080Z harness", () => {
  it("boots Series II to the READY ? question, then to the > prompt", async () => {
    const s = await createHtSession();
    s.runUntil(() => s.hasFirstPrompt(), { maxFrames: 200 }, "READY ?");
    expect(s.screenText()[0]).toBe("READY ? _");
    s.bootToPrompt();
    expect(s.screenText().filter((line) => line !== "")).toEqual(["READY", ">_"]);
  });

  it("boots every model", async () => {
    for (const [model, first, top] of [
      ["ht1080z-s1", "READY ? _", 0x7fff],
      ["ht1080z-s2", "READY ? _", 0x7fff],
      ["ht1080z-64", "MEMORY SIZE? _", 0xffff]
    ] as const) {
      const s = await createHtSession({ model });
      s.runUntil(() => s.hasFirstPrompt(), { maxFrames: 200 }, `${model}'s first prompt`);
      expect(s.screenText()[0], model).toBe(first);
      s.bootToPrompt();
      // --- The ROM sized the memory itself (MEMSIZ, 40B1h): 16K, or 48K on the /64
      expect(s.peekWord(0x40b1), model).toBe(top);
    }
  });

  it("keeps the frame length across a power-on, which the controller paces the UI by", async () => {
    const s = await createHtSession();
    await s.machine.hardReset();
    expect(s.machine.tactsInFrame).toBe(HT1080Z_TACTS_IN_FRAME);
    expect(s.wasm.ht1080zGetTactsInFrame()).toBe(34_944);
  });
});
