import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/*
 * Setting up a Next model's SD card when the emulator switches to it (`dev/plans/NEXT_SD_CARDS_PLAN.md`,
 * phase 0). A release carries only the default model's base image, so for another model there is no
 * card to copy: Klive must say so and offer the default model instead of booting a Next that stops
 * with "Drive C: not found". A card chosen earlier and deleted since falls back to the model's own.
 */

const home = { dir: "" };
const state: { media: Record<string, any>; emulatorState: Record<string, any>; ideViewOptions?: any } = {
  media: {},
  emulatorState: {}
};
const showMessageBox = vi.fn();
const logEmuEvent = vi.fn();

vi.mock("electron", () => ({
  app: { getPath: () => os.tmpdir() },
  dialog: { showMessageBox: (...args: any[]) => showMessageBox(...args), showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })) },
  BrowserWindow: class {
    static getFocusedWindow = () => ({ id: 1 });
    static getAllWindows = () => [{ id: 1 }];
  }
}));
vi.mock("@main/main-store", () => ({
  mainStore: {
    getState: () => state,
    dispatch: (action: any) => {
      if (action?.type === "SET_MEDIA") state.media[action.payload.id] = action.payload.value;
    }
  }
}));
vi.mock("@main/portable", () => ({ getKliveHomeBase: () => home.dir }));
vi.mock("@main/projects", () => ({ saveKliveProject: vi.fn() }));
vi.mock("@main/registeredMachines", () => ({ logEmuEvent: (...args: any[]) => logEmuEvent(...args), setMachineType: vi.fn() }));
vi.mock("@main/settings-utils", () => ({
  appSettings: {},
  saveAppSettings: vi.fn(),
  getSettingValue: vi.fn(),
  setSettingValue: vi.fn()
}));
vi.mock("@messaging/MainToEmuMessenger", () => ({ getEmuApi: vi.fn() }));
vi.mock("@messaging/MainToIdeMessenger", () => ({ getIdeApi: vi.fn() }));

import { createHash } from "node:crypto";
import { MEDIA_SD_CARD } from "@common/structs/project-const";
import { NEXT_ROM_SETS, type NextSdBaseImage } from "@common/zxnext/romSets";
import { nextProfileOf, romSetOf } from "@emu/machines/zxNext/nextProfiles";
import { defaultSdCardOf, initializeZxSpectrumNext, setupZxSpectrumNext } from "@main/machine-menus/zx-next-menus";
import { bundledCardPaths } from "@main/next-sd/nextSdCards";

/** The manifest entries a test pointed at its stand-in cards, to restore */
const patchedManifest = new Map<NextSdBaseImage, { size: number; sha256: string }>();

/**
 * A stand-in raw base image: setup copies it, it never parses it. The model's set's manifest entry is
 * pointed at its bytes for the test, as the copy checks them.
 */
function installBaseImage(modelId: string): string {
  const setId = romSetOf(nextProfileOf(modelId)).id;
  const file = bundledCardPaths(setId).find((card) => !card.compressed)!.file;
  const bytes = new Uint8Array(4096).fill(0x5a);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
  const entry = NEXT_ROM_SETS[setId].sdBaseImage;
  if (!patchedManifest.has(entry)) patchedManifest.set(entry, { size: entry.size, sha256: entry.sha256 });
  Object.assign(entry, { size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  return file;
}

const workingCopy = (modelId: string) => defaultSdCardOf(modelId).workingCopy;

describe("setting up a Next model's SD card", () => {
  let savedPublic: string | undefined;

  beforeEach(() => {
    home.dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-next-sd-setup-"));
    savedPublic = process.env.PUBLIC;
    process.env.PUBLIC = path.join(home.dir, "resources");
    state.media = {};
    state.emulatorState = {};
    showMessageBox.mockReset();
    logEmuEvent.mockReset();
  });

  afterEach(() => {
    for (const [entry, original] of patchedManifest) Object.assign(entry, original);
    patchedManifest.clear();
    process.env.PUBLIC = savedPublic;
    fs.rmSync(home.dir, { recursive: true, force: true });
  });

  it("makes the working copy from an installed base image, with no message box and no partial file", async () => {
    installBaseImage("ks3-30303");
    expect(await setupZxSpectrumNext("ks3-30303")).toBeUndefined();
    expect(fs.existsSync(workingCopy("ks3-30303"))).toBe(true);
    expect(fs.existsSync(`${workingCopy("ks3-30303")}.partial`)).toBe(false);
    expect(showMessageBox).not.toHaveBeenCalled();
    expect(state.media[MEDIA_SD_CARD]).toBe(defaultSdCardOf("ks3-30303").workingCopy);
  });

  it("refuses a base card that is not the manifest's, and makes no working copy", async () => {
    const file = installBaseImage("ks3-30303");
    fs.writeFileSync(file, new Uint8Array(4096).fill(0xa5));
    expect(await initializeZxSpectrumNext("ks3-30303")).toBe(false);
    expect(fs.existsSync(workingCopy("ks3-30303"))).toBe(false);
    expect(fs.existsSync(`${workingCopy("ks3-30303")}.partial`)).toBe(false);
    expect(logEmuEvent.mock.calls.map(([text]) => text).join("\n")).toContain("is not the expected SD card");
  });

  it("reports a model whose base image is not installed", async () => {
    expect(await initializeZxSpectrumNext("ks2-30204")).toBe(false);
    expect(fs.existsSync(workingCopy("ks2-30204"))).toBe(false);
  });

  it("offers the default model when the selected model's card is not installed, and switches on that choice", async () => {
    installBaseImage("ks3-30303");
    showMessageBox.mockResolvedValue({ response: 0 });
    expect(await setupZxSpectrumNext("ks2-30204")).toBe("ks3-30303");
    const [, options] = showMessageBox.mock.calls[0];
    expect(options.message).toContain('"Drive C: not found"');
    expect(options.buttons).toEqual([
      "Switch to the ZX Spectrum Next (KS3, core 3.03.03)",
      "Select an Image...",
      "Continue Without a Card"
    ]);
    expect(state.media[MEDIA_SD_CARD]).toBe(defaultSdCardOf("ks3-30303").workingCopy);
    expect(logEmuEvent.mock.calls.map(([text]) => text).join("\n")).toContain("is not installed");
  });

  it("keeps the selected model when the user continues without a card", async () => {
    installBaseImage("ks3-30303");
    showMessageBox.mockResolvedValue({ response: 2 });
    expect(await setupZxSpectrumNext("ks2-30204")).toBeUndefined();
    expect(state.media[MEDIA_SD_CARD]).toBe(defaultSdCardOf("ks2-30204").workingCopy);
  });

  it("does not offer to switch when the default model's own card is missing", async () => {
    showMessageBox.mockResolvedValue({ response: 1 });
    expect(await setupZxSpectrumNext("ks3-30303")).toBeUndefined();
    expect(showMessageBox.mock.calls[0][1].buttons).toEqual(["Select an Image...", "Continue Without a Card"]);
  });

  it("falls back to the model's own card when the image chosen earlier is gone", async () => {
    installBaseImage("ks3-30303");
    state.media[MEDIA_SD_CARD] = path.join(home.dir, "moved-away.cim");
    expect(await setupZxSpectrumNext("ks3-30303")).toBeUndefined();
    expect(state.media[MEDIA_SD_CARD]).toBe(defaultSdCardOf("ks3-30303").workingCopy);
    expect(showMessageBox).not.toHaveBeenCalled();
    expect(logEmuEvent.mock.calls.map(([text]) => text).join("\n")).toContain("moved-away.cim; using the default card");
  });

  it("keeps an image chosen earlier that still exists", async () => {
    installBaseImage("ks3-30303");
    const own = path.join(home.dir, "own.cim");
    fs.writeFileSync(own, new Uint8Array(512));
    state.media[MEDIA_SD_CARD] = own;
    await setupZxSpectrumNext("ks3-30303");
    expect(state.media[MEDIA_SD_CARD]).toBe(own);
  });
});
