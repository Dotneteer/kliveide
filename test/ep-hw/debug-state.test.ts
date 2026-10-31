import { describe, expect, it } from "vitest";

import { createEpSession } from "../harness/enterprise";
import { bareMachine, standardLpt } from "./bare";

/*
 * The NICK and DAVE panels' state (`EpWasmV2Machine.getEpNickState` / `getEpDaveState`,
 * `EpDebugState.ts`) read from the running core.
 */

describe("The NICK panel's state", () => {
  it("lists the LPT the test wrote, marks the block NICK shows and decodes the ports", async () => {
    const s = await createEpSession();
    const lpt = standardLpt({ vintLines: 2 });
    bareMachine(s, { lpt });
    s.wasm.epWritePort(0x80, 0x15);
    s.wasm.epWritePort(0x81, 0x2a);

    const state = s.machine.getEpNickState();
    expect(state.lptBase).toBe(0x3000);
    expect(state.lpt).toHaveLength(lpt.length);
    expect(state.lpt.map((b) => b.lines)).toEqual(lpt.map((b) => b.lines));
    expect(state.lpt[state.lpt.length - 1].reload).toBe(true);
    expect(state.lpt[1].vint).toBe(true);
    expect(state.currentIndex).toBe((state.lptAddress - 0x3000) / 16);
    expect(state.current.address).toBe(state.lptAddress);
    expect(state.fixBias).toBe(0x15);
    expect(state.border).toBe(0x2a);
    expect(state.rgb[state.border]).toBe(s.wasm.epNickGetRgb(0x2a) >>> 0);
    // --- The harness reads NICK through the same decoder
    expect(s.lpt()).toEqual(state.lpt);
  });

  it("shows EXOS's own LPT after boot, its current block among them", async () => {
    const s = await createEpSession();
    s.bootToBasic();
    const state = s.machine.getEpNickState();
    expect(state.lpt.length).toBeGreaterThan(2);
    expect(state.lpt.some((b) => b.mode === 0)).toBe(true);
    expect(state.currentIndex).toBeGreaterThanOrEqual(0);
  });
});

describe("The DAVE panel's state", () => {
  it("shows the pages, BFh and the sound registers decoded", async () => {
    const s = await createEpSession();
    bareMachine(s);
    s.wasm.epWritePort(0xa0, 99);
    s.wasm.epWritePort(0xa1, 0x10);
    s.wasm.epWritePort(0xa7, 0x22);
    s.wasm.epWritePort(0xa8, 0x3f);
    s.wasm.epWritePort(0xb4, 0x05);

    const state = s.machine.getEpDaveState();
    expect(state.pages).toEqual([0xf8, 0xf9, 0xfa, 0xff]);
    expect(state.pageLabels).toEqual(state.pages.map((p) => s.machine.getPartitionLabels()[p]));
    expect(state.bf).toBe(0x0c);
    expect(state.waitMode).toBe(3);
    expect(state.tones[0]).toMatchObject({ code: 99, frequency: 1250, distortion: 1, left: 0x3f });
    expect(state.tones[1].sync).toBe(true);
    expect(state.intSelect).toBe(1);
    expect(state.interrupts.map((i) => i.enabled)).toEqual([true, true, false, false]);
  });
});
