import { describe, expect, it } from "vitest";

import { createSamSession } from "../harness/samcoupe";
import { SAM_COPYRIGHT_KEY_WAIT } from "@emu/machines/samcoupe/SamWasmHost";
import type { CodeToInject } from "@abstractions/CodeToInject";

/*
 * Run and Debug (plan §12, D7): the flow reaches the copyright screen, then the machine boots the program
 * through Klive's loader on a disk in drive 1. A unit test being debugged is written directly.
 */

const code = (bytes: number[], startAddress = 0x8000, extra: Partial<CodeToInject> = {}): CodeToInject => ({
  model: "sam",
  segments: [{ startAddress, bankOffset: 0, emittedCode: bytes }],
  options: {},
  ...extra
});

describe("SAM Run", () => {
  it("the flow waits at the copyright screen, then boots the program through the loader", async () => {
    const s = await createSamSession();
    const flow = await s.machine.getCodeInjectionFlow("sam");
    expect(flow[0]).toMatchObject({ type: "ReachExecPoint", execPoint: SAM_COPYRIGHT_KEY_WAIT });
    expect(flow.map((step) => step.type)).toEqual(["ReachExecPoint", "Inject", "KeepPc"]);
    s.bootToCopyright();
    s.machine.injectCodeToRun(code([0x3e, 0x02, 0xd3, 0xfe, 0x18, 0xfe]));
    s.runUntil(() => s.wasm.samGetBorder() === 0x02, { maxFrames: 1500 }, "the program");
    expect(s.wasm.samGetCpuPc()).toBe(0x8004);
  });

  it("refuses code in the ROM's 16K", async () => {
    const s = await createSamSession();
    expect(() => s.machine.injectCodeToRun(code([0x00], 0x1000))).toThrow(/ROM/);
  });

  it("a unit test is written straight into its page, with Run's paging", async () => {
    const s = await createSamSession();
    s.bootToCopyright();
    const entry = s.machine.injectCodeToRun(
      code([0x01, 0x02, 0x03], 0x9000, { unitTest: { id: "t", testAddress: 0x9000, labels: {} as never, stopAtStart: true } })
    );
    expect(entry).toBe(0x9000);
    expect(s.wasm.samGetHmpr()).toBe(1);
    expect([s.peek(0x9000), s.peek(0x9001), s.peek(0x9002)]).toEqual([1, 2, 3]);
  });
});
