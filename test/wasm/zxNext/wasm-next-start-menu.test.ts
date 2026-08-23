import { describe, expect, it } from "vitest";

import { createBootTrace } from "./wasm-next-boot-trace";

const INITIAL_NEXTREG_BOOT_STEP_COUNT = 15;

describe("ZX Spectrum Next WASM NextZXOS start-menu milestone", () => {
  it("does not diverge before the ROM0 initial NextReg boot milestone", async () => {
    const trace = await createBootTrace(INITIAL_NEXTREG_BOOT_STEP_COUNT);
    const acceptedMilestone = trace.wasm.at(-1)!;

    expect(withoutTacts(trace.wasm)).toEqual(withoutTacts(trace.oracle));
    expect(acceptedMilestone).toMatchObject({
      label: "step-15",
      pc: 0x0116,
      nextRegs: {
        "03": 0xb0,
        "07": 0x03,
        "80": 0x00,
        "81": 0x00,
        "82": 0xff,
        "83": 0xff,
        "84": 0xff,
        "85": 0xff,
        "8A": 0x00,
        "8F": 0x00,
        "C0": 0x08
      },
      sdState: {
        hostCommand: 0,
        responseReady0: false,
        responseReady1: false
      },
      stopReason: "DebugEvent"
    });
    expect(acceptedMilestone.screenChecksum).toBe(trace.oracle.at(-1)!.screenChecksum);
    expect(acceptedMilestone.romByteReads).toEqual(trace.oracle.at(-1)!.romByteReads);
  });
});

function withoutTacts<T extends { tacts: number }>(snapshots: T[]): Omit<T, "tacts">[] {
  return snapshots.map(({ tacts: _tacts, ...snapshot }) => snapshot);
}
