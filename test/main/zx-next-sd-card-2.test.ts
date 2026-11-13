import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

/*
 * The ZX Spectrum Next's second SD card on the main-process side (`dev/plans/ZXNEXT_KS3_FOLLOWUP_PLAN.md`
 * phase 2): Machine › SD Card offers it on a model with two readers only (the KS3), and card 1 is its
 * own image (`MEDIA_SD_CARD_2`), an empty slot of 0 sectors until one is chosen.
 */

const state: { media: Record<string, any>; emulatorState: Record<string, any> } = { media: {}, emulatorState: {} };

vi.mock("electron", () => ({ app: { getPath: () => os.tmpdir() }, dialog: {}, BrowserWindow: class {} }));
vi.mock("@main/main-store", () => ({ mainStore: { getState: () => state, dispatch: vi.fn() } }));
vi.mock("@main/projects", () => ({ saveKliveProject: vi.fn() }));
vi.mock("@main/registeredMachines", () => ({ logEmuEvent: vi.fn(), setMachineType: vi.fn() }));
vi.mock("@main/settings-utils", () => ({
  appSettings: {},
  saveAppSettings: vi.fn(),
  getSettingValue: vi.fn(),
  setSettingValue: vi.fn()
}));
vi.mock("@messaging/MainToEmuMessenger", () => ({ getEmuApi: vi.fn() }));
vi.mock("@messaging/MainToIdeMessenger", () => ({ getIdeApi: vi.fn() }));

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MEDIA_SD_CARD_2 } from "@common/structs/project-const";
import { getSdCardDevice, invalidateSdCardHandler, sdCardMenuRenderer } from "@main/machine-menus/zx-next-menus";

const itemIds = (modelId: string) => {
  state.emulatorState = { modelId, machineState: MachineControllerState.Stopped };
  return sdCardMenuRenderer({ emuWindow: undefined } as any, undefined as any, undefined as any).map((i) => i.id);
};

describe("the Next's second SD card", () => {
  let folder: string;

  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), "klive-sd2-"));
    state.media = {};
  });

  afterEach(() => {
    invalidateSdCardHandler();
    fs.rmSync(folder, { recursive: true, force: true });
  });

  it("Machine › SD Card offers it on the KS3 model only", () => {
    expect(itemIds("ks3-30303")).toContain("select_sd_card_2");
    expect(itemIds("ks3-30303")).toContain("eject_sd_card_2");
    for (const model of ["ks2-30201", "ks2-30204", "ks2-30303"]) {
      expect(itemIds(model), model).not.toContain("select_sd_card_2");
    }
  });

  it("without an image card 1 is an empty slot: 0 sectors, and a write fails", () => {
    const card = getSdCardDevice(1);
    expect(card.totalSectors).toBe(0);
    expect(() => card.writeSector(0, new Uint8Array(512))).toThrow();
  });

  it("with an image card 1 reads and writes that image, sector by sector", () => {
    const file = path.join(folder, "card2.img");
    const image = new Uint8Array(64 * 512);
    for (let i = 0; i < 512; i++) image[5 * 512 + i] = (i * 13 + 7) & 0xff;
    fs.writeFileSync(file, image);
    state.media[MEDIA_SD_CARD_2] = file;

    const card = getSdCardDevice(1);
    expect(card.totalSectors).toBe(64);
    expect(Array.from(card.readSector(5))).toEqual(Array.from(image.subarray(5 * 512, 6 * 512)));
    card.writeSector(6, new Uint8Array(512).fill(0xa5));
    invalidateSdCardHandler();
    expect(fs.readFileSync(file)[6 * 512]).toBe(0xa5);
  });
});
