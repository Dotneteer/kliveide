import { describe, expect, it } from "vitest";

import { createSession } from "../../harness/zxnext";

/*
 * The IDE's per-instruction loop (ZxNextWasmV2Machine.executeWasmV2DebugLoop) runs frames through
 * `zxnextExecuteInstruction` and never calls `zxnextBeginAudioMixerFrame` - it carries the whole
 * NextZXOS boot of a NEX launch. The mixer's sample buffer fills up there and stays full. Regression
 * (B79 follow-up, 2026-09-18): once the sample schedule carried across frames, a full buffer let the
 * frame wrap pull the schedule back every frame, and every T-state re-ran the beeper/PSG refresh for a
 * sample it could not store - ~300 ms a frame, so launching a NEX from the IDE never finished booting.
 */
describe("ZX Next WASM audio - per-instruction frames", () => {
  it("stays fast with the sample buffer full", async () => {
    const s = await createSession({ audioSampleRate: 48000 });
    await s.loadCode(" .org $8000\n di\nLoop: ld a,(hl)\n jr Loop");
    const wasm = (s.machine as any).wasmV2Runtime.exports;
    const start = Date.now();
    let frames = 0;
    while (frames < 50) {
      wasm.zxnextExecuteInstruction();
      if (wasm.zxnextGetFrameCompleted()) frames++;
    }
    expect(wasm.zxnextGetAudioMixerSampleCount(), "the buffer did fill").toBe(2048);
    // --- ~1 ms a frame when working, ~300 ms when broken
    expect(Date.now() - start).toBeLessThan(5000);
  });
});
