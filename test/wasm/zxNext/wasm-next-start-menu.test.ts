import { describe, expect, it } from "vitest";

import { checksumBootTrace, createBootTrace, readZxNextBootRomImages } from "./wasm-next-boot-trace";

const INITIAL_NEXTREG_BOOT_STEP_COUNT = 15;

// --- Pinned values (PC and tact checkpoints, screen and trace checksums) are the ones the
// --- TypeScript and WASM cores agreed on at tag pre-zxnext-ts-removal-2026-09-19.
const MILESTONE_PC_CHECKPOINTS = [
  0x0000, 0x0001, 0x00ef, 0x00f3, 0x00f7, 0x00fb, 0x00fd, 0x0100, 0x0103, 0x0106, 0x0109, 0x010a,
  0x010d, 0x0110, 0x0113, 0x0116
];
const MILESTONE_TACT_CHECKPOINTS = [
  0, 4, 14, 34, 58, 82, 91, 108, 125, 142, 159, 164, 181, 198, 215, 232
];
const MILESTONE_SCREEN_CHECKSUM = 1245418693;
const MILESTONE_TRACE_CHECKSUM = 0x440444e5;

describe("ZX Spectrum Next WASM NextZXOS start-menu milestone", () => {
  it("reaches the ROM0 initial NextReg boot milestone along the pinned trace", async () => {
    const roms = readZxNextBootRomImages();
    const trace = await createBootTrace(INITIAL_NEXTREG_BOOT_STEP_COUNT);
    const acceptedMilestone = trace.snapshots.at(-1)!;

    expect(trace.snapshots.map(snapshot => snapshot.pc)).toEqual(MILESTONE_PC_CHECKPOINTS);
    expect(trace.snapshots.map(snapshot => snapshot.tacts)).toEqual(MILESTONE_TACT_CHECKPOINTS);
    expect(checksumBootTrace(trace.snapshots)).toBe(MILESTONE_TRACE_CHECKSUM);
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
    expect(acceptedMilestone.screenChecksum).toBe(MILESTONE_SCREEN_CHECKSUM);
    // --- MMU slots 0-1 still page ROM0 ($FF), so the sampled reads are the ROM image's bytes
    expect(acceptedMilestone.romByteReads).toEqual({
      "0000": roms.nextRom[0x0000],
      "0001": roms.nextRom[0x0001],
      "0002": roms.nextRom[0x0002],
      "0003": roms.nextRom[0x0003],
      "00EF": roms.nextRom[0x00ef],
      "00F0": roms.nextRom[0x00f0]
    });
  });
});
