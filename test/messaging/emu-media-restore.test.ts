import { describe, expect, it, vi } from "vitest";

import { processMainToEmuMessages } from "@renderer/appEmu/MainToEmuProcessor";
import { mediaStore } from "@emu/machines/media/media-info";
import { MEDIA_TAPE } from "@common/structs/project-const";
import type { RequestMessage } from "@messaging/messages-core";

/** A minimal but genuinely valid TAP image: one block of two bytes. */
function makeTapFile(): Uint8Array {
  return new Uint8Array([0x02, 0x00, 0xff, 0x00]);
}

function callEmu(method: string, args: any[], machineService: any) {
  const message: RequestMessage = {
    type: "ApiMethodRequest",
    method,
    args
  } as RequestMessage;
  return processMainToEmuMessages(message, {} as any, {} as any, { machineService } as any);
}

describe("restoring media while the machine is still starting up", () => {
  it("stores a tape file even when no machine controller exists yet", async () => {
    // --- This is the startup race: the app restores the saved tape right after its own
    // --- setMachineType call returns, but that call may have been superseded by a concurrent one
    // --- (e.g. opening the last project), leaving no live machine for a moment.
    const machineService = { getMachineController: vi.fn(() => undefined) };

    const response = await callEmu("setTapeFile", ["/tmp/LTK128.TAP", makeTapFile()], machineService);

    // --- It must not blow up: the old code dereferenced `controller.machine` unconditionally and
    // --- produced "Cannot read properties of undefined (reading 'machine')", which made the
    // --- caller show an error dialog and eject the tape.
    expect(response.type).not.toBe("ErrorResponse");

    // --- The tape must still be recorded, because the controller re-attaches every stored medium
    // --- when a machine starts - that is what makes the tape survive the race.
    const stored = mediaStore.getMedia(MEDIA_TAPE);
    expect(stored?.mediaFile).toBe("/tmp/LTK128.TAP");
    expect(stored?.mediaContents?.length).toBeGreaterThan(0);
  });

  it("attaches the tape immediately when a machine is live", async () => {
    const setMachineProperty = vi.fn();
    const machineService = {
      getMachineController: vi.fn(() => ({ machine: { setMachineProperty } }))
    };

    await callEmu("setTapeFile", ["/tmp/other.TAP", makeTapFile()], machineService);

    expect(setMachineProperty).toHaveBeenCalledWith(MEDIA_TAPE, expect.anything());
  });

  it("does not fail setting disk write protection without a machine", async () => {
    const machineService = { getMachineController: vi.fn(() => undefined) };

    const response = await callEmu("setDiskWriteProtection", [0, true], machineService);

    expect(response.type).not.toBe("ErrorResponse");
  });
});
