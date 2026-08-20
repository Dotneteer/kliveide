import { describe, expect, it } from "vitest";

import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";

import {
  checksumBytes,
  createEarlyBootTrace,
  readZxNextBootRomImages
} from "./wasm-next-boot-trace";

describe("ZX Spectrum Next WASM early boot smoke", () => {
  it("matches the TypeScript reset-vector boot trace before storage is involved", async () => {
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

    expect(trace.wasm).toEqual(trace.oracle);
    expect(trace.wasm[0]).toMatchObject({
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
    expect(trace.wasm[1]).toMatchObject({
      termination: FrameTerminationMode.DebugEvent,
      lastTerminationReason: FrameTerminationMode.DebugEvent,
      pc: 0x0001
    });
    expect(trace.wasm[2]).toMatchObject({
      termination: FrameTerminationMode.DebugEvent,
      lastTerminationReason: FrameTerminationMode.DebugEvent,
      pc: 0x00ef
    });
    expect(trace.wasm.slice(1).some(snapshot => snapshot.pc === 0x0000)).toBe(false);
  });

});
