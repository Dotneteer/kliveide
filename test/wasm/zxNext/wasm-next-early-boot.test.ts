import { describe, expect, it } from "vitest";

import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";

import {
  checksumBootTrace,
  checksumBytes,
  createEarlyBootTrace,
  readZxNextBootRomImages
} from "./wasm-next-boot-trace";

// --- Pinned values (the trace checksum) are the ones the TypeScript and WASM cores agreed on at tag
// --- pre-zxnext-ts-removal-2026-09-19.
const EARLY_BOOT_TRACE_CHECKSUM = 0x13927d32;

describe("ZX Spectrum Next WASM early boot smoke", () => {
  it("follows the reset-vector boot trace before storage is involved", async () => {
    const roms = readZxNextBootRomImages();
    const trace = await createEarlyBootTrace();

    expect(trace.wasmDiagnostics).toEqual({
      nextRomChecksum: checksumBytes(roms.nextRom),
      divMmcRomChecksum: checksumBytes(roms.divMmcRom),
      multifaceRomChecksum: checksumBytes(roms.multifaceRom),
      altRomChecksum: checksumBytes(roms.altRom),
      physicalBytes: {
        nextRom0: roms.nextRom[0],
        divMmcRom0: roms.divMmcRom[0],
        multifaceRom0: roms.multifaceRom[0],
        altRom0: roms.altRom[0]
      }
    });

    expect(checksumBootTrace(trace.snapshots)).toBe(EARLY_BOOT_TRACE_CHECKSUM);
    expect(trace.snapshots[0]).toMatchObject({
      label: "reset",
      pc: 0x0000,
      sp: 0xffff,
      tacts: 0,
      romByteReads: {
        "0000": 0xf3,
        "0001": 0xc3,
        "0002": 0xef,
        "0003": 0x00
      }
    });
    // --- ROM0 starts with DI (4 T-states) and JP $00EF (10 T-states)
    expect(trace.snapshots[1]).toMatchObject({
      termination: FrameTerminationMode.DebugEvent,
      lastTerminationReason: FrameTerminationMode.DebugEvent,
      pc: 0x0001,
      tacts: 4
    });
    expect(trace.snapshots[2]).toMatchObject({
      termination: FrameTerminationMode.DebugEvent,
      lastTerminationReason: FrameTerminationMode.DebugEvent,
      pc: 0x00ef,
      tacts: 14
    });
    expect(trace.snapshots.slice(1).some(snapshot => snapshot.pc === 0x0000)).toBe(false);
  });
});
