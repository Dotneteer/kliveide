import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import createAppStore from "@state/store";
import { MI_HT1080Z, MI_SPECTRUM_48, MI_TVC } from "@common/machines/constants";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { buildTvcCasFile, isTvcTapeFile } from "@emu/machines/tvc/TvcCasFile";

/*
 * A `.cas` set in the emulator goes to the machine whose tape it is, read from its bytes. At startup
 * the remembered tape is set while the machine is still being set up (the last session's machine and
 * the project's race); it must not be read as the other machine's tape, and goes into the deck once
 * its machine is set.
 */

const displayMessageBox = vi.fn(async () => undefined);
vi.mock("@common/messaging/MainApi", () => ({ createMainApi: () => ({ displayMessageBox }) }));

const { processMainToEmuMessages, clearPendingCasTape } = await import("@renderer/appEmu/MainToEmuProcessor");

const TVC_CAS = buildTvcCasFile(Uint8Array.from([0x08, 0x0a, 0x00, 0xdd, 0x20, 0x34, 0x32, 0xff, 0x00]), 0x01, true);
const HT_CAS = new Uint8Array(readFileSync(join(__dirname, "../testfiles/ht1080z/galaxy.cas")));

afterEach(() => {
  clearPendingCasTape();
  displayMessageBox.mockClear();
});

/** A machine service whose machine can be absent (being set up) or switched */
function machineServiceWith(machineId: string | undefined) {
  const properties = new Map<string, unknown>();
  let current = machineId;
  const machineService = {
    getMachineController: () =>
      current
        ? { machine: { machineId: current, setMachineProperty: (key: string, value: unknown) => properties.set(key, value) } }
        : undefined,
    setMachineType: vi.fn(async (id: string) => {
      current = id;
      return true;
    })
  };
  return { machineService, properties };
}

const call = (machineService: unknown, method: string, ...args: unknown[]) =>
  processMainToEmuMessages(
    { type: "ApiMethodRequest", method, args } as any,
    createAppStore("test-cas-routing"),
    {} as any,
    { machineService } as any
  );

describe(".cas tapes in the emulator", () => {
  it("does not read a TVC tape as an HT-1080Z one while no machine is set up yet, and inserts it on the TVC", async () => {
    const { machineService, properties } = machineServiceWith(undefined);
    await call(machineService, "setTapeFile", "/d/Bombman.cas", TVC_CAS);
    expect(displayMessageBox).not.toHaveBeenCalled();
    expect(properties.has(MEDIA_TAPE)).toBe(false);

    await call(machineService, "setMachineType", MI_TVC);
    expect(isTvcTapeFile(properties.get(MEDIA_TAPE))).toBe(true);
    expect(displayMessageBox).not.toHaveBeenCalled();
  });

  it("inserts a TVC tape on the TVC and an HT-1080Z tape on the HT-1080Z", async () => {
    const tvc = machineServiceWith(MI_TVC);
    await call(tvc.machineService, "setTapeFile", "/d/a.cas", TVC_CAS);
    expect(isTvcTapeFile(tvc.properties.get(MEDIA_TAPE))).toBe(true);

    const ht = machineServiceWith(MI_HT1080Z);
    await call(ht.machineService, "setTapeFile", "/d/galaxy.cas", HT_CAS);
    expect(ht.properties.get(MEDIA_TAPE)).toMatchObject({ kind: expect.anything() });
    expect(displayMessageBox).not.toHaveBeenCalled();
  });

  it("keeps a tape set on another machine, says so, and inserts it once its machine is set", async () => {
    const { machineService, properties } = machineServiceWith(MI_HT1080Z);
    await call(machineService, "setTapeFile", "/d/Bombman.cas", TVC_CAS);
    expect(properties.has(MEDIA_TAPE)).toBe(false);
    expect(displayMessageBox).toHaveBeenCalledWith(
      "info",
      expect.any(String),
      "/d/Bombman.cas is a Videoton TVC tape. It goes into the tape deck when the Videoton TVC runs."
    );

    // --- Not on yet another machine
    await call(machineService, "setMachineType", MI_SPECTRUM_48);
    expect(properties.has(MEDIA_TAPE)).toBe(false);
    await call(machineService, "setMachineType", MI_TVC);
    expect(isTvcTapeFile(properties.get(MEDIA_TAPE))).toBe(true);
  });

  it("forgets a waiting tape when another tape is set", async () => {
    const { machineService, properties } = machineServiceWith(undefined);
    await call(machineService, "setTapeFile", "/d/Bombman.cas", TVC_CAS);
    await call(machineService, "setTapeFile", "", new Uint8Array());
    await call(machineService, "setMachineType", MI_TVC);
    expect(properties.has(MEDIA_TAPE)).toBe(false);
  });
});
