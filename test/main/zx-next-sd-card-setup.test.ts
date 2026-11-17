import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/*
 * Setting up a Next model's SD card when the emulator switches to it (`dev/plans/NEXT_SD_CARDS_PLAN.md`,
 * phases 0 and 5). A release carries only the default model's base card, so for another model there may
 * be no card to copy: Klive offers the download (the gate) instead of booting a Next that stops with
 * "Drive C: not found", and declining it declines the machine change. A card chosen earlier and deleted
 * since falls back to the model's own.
 */

const home = { dir: "" };
const state: { media: Record<string, any>; emulatorState: Record<string, any>; ideViewOptions?: any } = {
  media: {},
  emulatorState: {}
};
const showMessageBox = vi.fn();
const logEmuEvent = vi.fn();
const displayDialog = vi.fn();
const checkCard = vi.fn();
const onDispatch = vi.fn();

vi.mock("electron", () => ({
  app: { getPath: () => os.tmpdir(), isPackaged: false },
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
      onDispatch(action);
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
vi.mock("@messaging/MainToEmuMessenger", () => ({ getEmuApi: () => ({ displayDialog }) }));
vi.mock("@messaging/MainToIdeMessenger", () => ({ getIdeApi: vi.fn() }));
// --- The stand-in cards are not real cards: the boot check passes unless a test says otherwise
vi.mock("@main/next-sd/checkNextSdCard", () => ({ checkNextSdCard: (...args: any[]) => checkCard(...args) }));

import { createHash } from "node:crypto";
import { MEDIA_DIVMMC_SD_CARD, MEDIA_SD_CARD, SD_CARD_DIVMMC } from "@common/structs/project-const";
import { NEXT_SD_DOWNLOAD_DIALOG } from "@common/messaging/dialog-ids";
import { NEXT_ROM_SETS, type NextSdBaseImage } from "@common/zxnext/romSets";
import { nextProfileOf, romSetOf } from "@emu/machines/zxNext/nextProfiles";
import {
  activeSdCardFile,
  activeSdCardSlot,
  defaultSdCardOf,
  ensureNextSdCardFor,
  nextSdCardFileFor,
  getSdCardDevice,
  initializeZxSpectrumNext,
  setSelectedSdCardFile,
  setupZxSpectrumNext,
  brokenCardName,
  sdCardMenuRenderer
} from "@main/machine-menus/zx-next-menus";
import { downloadedCardPath } from "@main/next-sd/nextSdCards";
import { splitSavedSdCardSlots } from "@main/next-sd/sdCardSlots";
import { bundledCardPaths } from "@main/next-sd/nextSdCards";
import { gzipSync } from "node:zlib";

/** The manifest entries a test pointed at its stand-in cards, to restore */
const patchedManifest = new Map<NextSdBaseImage, { size: number; sha256: string }>();

/**
 * A stand-in base image, gzipped where the installer puts it: setup decompresses it, it never parses
 * it. The model's set's manifest entry is pointed at its raw bytes for the test, as the copy checks them.
 */
function installBaseImage(modelId: string): string {
  const setId = romSetOf(nextProfileOf(modelId)).id;
  const file = bundledCardPaths(setId).find((card) => card.compressed)!.file;
  const bytes = new Uint8Array(4096).fill(0x5a);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, gzipSync(bytes));
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
    displayDialog.mockReset();
    checkCard.mockReset().mockImplementation((file: string) => ({ status: "ok", file }));
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
    fs.writeFileSync(file, gzipSync(new Uint8Array(4096).fill(0xa5)));
    expect(await initializeZxSpectrumNext("ks3-30303")).toBe(false);
    expect(fs.existsSync(workingCopy("ks3-30303"))).toBe(false);
    expect(fs.existsSync(`${workingCopy("ks3-30303")}.partial`)).toBe(false);
    expect(logEmuEvent.mock.calls.map(([text]) => text).join("\n")).toContain("is not the expected SD card");
  });

  it("reports a model whose base image is not installed", async () => {
    expect(await initializeZxSpectrumNext("ks2-30204")).toBe(false);
    expect(fs.existsSync(workingCopy("ks2-30204"))).toBe(false);
  });

  it("offers the download when the model's card is not here, and goes on once it is", async () => {
    displayDialog.mockImplementation(async () => {
      // --- The dialog downloads the card: here it is "installed" by the test
      installBaseImage("ks2-30204");
      return "ready";
    });
    expect(await setupZxSpectrumNext("ks2-30204")).toBeUndefined();
    const [dialogId, data] = displayDialog.mock.calls[0];
    expect(dialogId).toBe(NEXT_SD_DOWNLOAD_DIALOG);
    expect(data).toMatchObject({
      modelId: "ks2-30204",
      modelName: "ZX Spectrum Next (KS2, core 3.02.04)",
      setId: "nextzxos-2.10",
      url: "https://kliveide.net/next-sd/nextzxos-2.10.cim.gz"
    });
    expect(fs.existsSync(workingCopy("ks2-30204"))).toBe(true);
    expect(state.media[MEDIA_SD_CARD]).toBe(defaultSdCardOf("ks2-30204").workingCopy);
    expect(logEmuEvent.mock.calls.map(([text]) => text).join("\n")).toContain("is not on this computer");
  });

  it("declines the machine change when the user does not download the card", async () => {
    displayDialog.mockResolvedValue("declined");
    expect(await setupZxSpectrumNext("ks2-30204")).toBe(false);
    expect(fs.existsSync(workingCopy("ks2-30204"))).toBe(false);
    expect(state.media[MEDIA_SD_CARD]).toBeUndefined();
  });

  // --- Loading a state saved on a Next from another machine: the card that model boots from
  it("names the card a model boots from, whatever machine runs: its own, not another model's", () => {
    state.emulatorState = { machineId: "sp48" };
    expect(nextSdCardFileFor("ks2-30204")).toBe(workingCopy("ks2-30204"));
    fs.mkdirSync(path.dirname(workingCopy("ks3-30303")), { recursive: true });
    fs.writeFileSync(workingCopy("ks3-30303"), new Uint8Array(16));
    state.media[MEDIA_SD_CARD] = workingCopy("ks3-30303");
    expect(nextSdCardFileFor("ks2-30204")).toBe(workingCopy("ks2-30204"));
    const mine = path.join(home.dir, "mine.cim");
    fs.writeFileSync(mine, new Uint8Array(16));
    state.media[MEDIA_SD_CARD] = mine;
    expect(nextSdCardFileFor("ks2-30204")).toBe(mine);
  });

  it("makes sure that card is here, offering its download", async () => {
    displayDialog.mockResolvedValue("declined");
    expect(await ensureNextSdCardFor("ks2-30204")).toBe(false);
    expect(displayDialog).toHaveBeenCalledTimes(1);
    installBaseImage("ks3-30303");
    expect(await ensureNextSdCardFor("ks3-30303")).toBe(true);
    expect(fs.existsSync(workingCopy("ks3-30303"))).toBe(true);
    expect(displayDialog).toHaveBeenCalledTimes(1);
  });

  it("shows no dialog for a model whose card is here", async () => {
    installBaseImage("ks3-30303");
    expect(await setupZxSpectrumNext("ks3-30303")).toBeUndefined();
    expect(displayDialog).not.toHaveBeenCalled();
  });

  it("needs no base card for a model whose working copy exists (D-7)", async () => {
    fs.mkdirSync(path.dirname(workingCopy("ks2-30204")), { recursive: true });
    fs.writeFileSync(workingCopy("ks2-30204"), new Uint8Array(512));
    expect(await setupZxSpectrumNext("ks2-30204")).toBeUndefined();
    expect(displayDialog).not.toHaveBeenCalled();
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

describe("the check before a Next boots", () => {
  let savedPublic: string | undefined;

  beforeEach(() => {
    home.dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-next-sd-check-"));
    savedPublic = process.env.PUBLIC;
    process.env.PUBLIC = path.join(home.dir, "resources");
    state.media = {};
    state.emulatorState = {};
    showMessageBox.mockReset();
    logEmuEvent.mockReset();
    displayDialog.mockReset();
    checkCard.mockReset();
  });

  afterEach(() => {
    for (const [entry, original] of patchedManifest) Object.assign(entry, original);
    patchedManifest.clear();
    process.env.PUBLIC = savedPublic;
    fs.rmSync(home.dir, { recursive: true, force: true });
  });

  const brokenOnce = () =>
    checkCard
      .mockImplementationOnce((file: string) => ({ status: "noPartition", file, message: "no MBR" }))
      .mockImplementation((file: string) => ({ status: "ok", file }));

  it("says what is wrong, and resets a broken working copy, keeping the old one aside (D-9)", async () => {
    installBaseImage("ks3-30303");
    const own = workingCopy("ks3-30303");
    fs.mkdirSync(path.dirname(own), { recursive: true });
    fs.writeFileSync(own, new Uint8Array(512).fill(7));
    brokenOnce();
    showMessageBox.mockResolvedValue({ response: 0 });
    expect(await setupZxSpectrumNext("ks3-30303")).toBeUndefined();
    const [, options] = showMessageBox.mock.calls[0];
    expect(options.message).toBe("The ZX Spectrum Next (KS3, core 3.03.03) may not boot from its SD card.");
    expect(options.detail).toContain("has no FAT16 or FAT32 partition");
    expect(options.buttons).toEqual(["Reset to the Default Card", "Select an Image...", "Continue Anyway"]);
    const aside = fs.readdirSync(path.dirname(own)).filter((name) => name.includes(".broken-"));
    expect(aside).toHaveLength(1);
    expect(new Uint8Array(fs.readFileSync(path.join(path.dirname(own), aside[0])))).toEqual(new Uint8Array(512).fill(7));
    expect(new Uint8Array(fs.readFileSync(own))).toEqual(new Uint8Array(4096).fill(0x5a));
    expect(state.media[MEDIA_SD_CARD]).toBe(own);
  });

  it("puts the broken card back when its base card cannot be had", async () => {
    const own = workingCopy("ks2-30204");
    fs.mkdirSync(path.dirname(own), { recursive: true });
    fs.writeFileSync(own, new Uint8Array(512).fill(7));
    brokenOnce();
    showMessageBox.mockResolvedValue({ response: 0 });
    displayDialog.mockResolvedValue("declined");
    expect(await setupZxSpectrumNext("ks2-30204")).toBe(false);
    expect(new Uint8Array(fs.readFileSync(own))).toEqual(new Uint8Array(512).fill(7));
    expect(fs.readdirSync(path.dirname(own)).filter((name) => name.includes(".broken-"))).toEqual([]);
  });

  it("boots the card as it is on Continue Anyway", async () => {
    installBaseImage("ks3-30303");
    brokenOnce();
    showMessageBox.mockResolvedValue({ response: 2 });
    expect(await setupZxSpectrumNext("ks3-30303")).toBeUndefined();
    expect(state.media[MEDIA_SD_CARD]).toBe(workingCopy("ks3-30303"));
    expect(fs.readdirSync(path.dirname(workingCopy("ks3-30303"))).filter((name) => name.includes(".broken-"))).toEqual([]);
  });

  it("offers the model's own card for an image the user picked", async () => {
    installBaseImage("ks3-30303");
    const picked = path.join(home.dir, "picked.cim");
    fs.writeFileSync(picked, new Uint8Array(512));
    state.media[MEDIA_SD_CARD] = picked;
    checkCard
      .mockImplementationOnce((file: string) => ({ status: "wrongRelease", file, expected: "nextzxos-26.11", found: "nextzxos-2.08" }))
      .mockImplementation((file: string) => ({ status: "ok", file }));
    showMessageBox.mockResolvedValue({ response: 0 });
    await setupZxSpectrumNext("ks3-30303");
    expect(showMessageBox.mock.calls[0][1].buttons[0]).toBe("Use the Default Card");
    expect(showMessageBox.mock.calls[0][1].detail).toContain("another NextZXOS release");
    expect(state.media[MEDIA_SD_CARD]).toBe(workingCopy("ks3-30303"));
    expect(fs.existsSync(picked)).toBe(true);
  });

  it("names the card kept aside by the time it was replaced", () => {
    expect(brokenCardName("/home/me/Klive/ks3-30303.cim", new Date(2026, 10, 17, 15, 3, 9))).toBe(
      path.join("/home/me/Klive", "ks3-30303.broken-20261117-150309.cim")
    );
  });
});

describe("Machine › SD Card › Downloaded SD Cards", () => {
  beforeEach(() => {
    home.dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-next-sd-menu-"));
    state.media = {};
    state.emulatorState = { modelId: "ks2-30204" };
    showMessageBox.mockReset();
    logEmuEvent.mockReset();
    onDispatch.mockReset();
  });
  afterEach(() => fs.rmSync(home.dir, { recursive: true, force: true }));

  const submenu = () =>
    (sdCardMenuRenderer({ emuWindow: { id: 1 } } as any, undefined as any) as any[]).find((i) => i.id === "downloaded_sd_cards")
      .submenu as any[];
  const download = (setId: string) => {
    fs.mkdirSync(path.dirname(downloadedCardPath(setId as any)), { recursive: true });
    fs.writeFileSync(downloadedCardPath(setId as any), new Uint8Array(2_500_000));
  };

  it("says so when nothing is downloaded", () => {
    expect(submenu()).toEqual([expect.objectContaining({ label: "No Downloaded Cards", enabled: false })]);
  });

  it("lists each card with its size, and keeps the one the running model needs", () => {
    download("nextzxos-2.08");
    download("nextzxos-2.10");
    expect(submenu().map((i) => [i.label, i.enabled])).toEqual([
      ["Delete nextzxos-2.08 (2.5 MB)...", true],
      ["Delete nextzxos-2.10 (2.5 MB)...", false]
    ]);
  });

  it("deletes a card only when the user says yes", async () => {
    download("nextzxos-2.08");
    showMessageBox.mockResolvedValueOnce({ response: 1 });
    await submenu()[0].click();
    expect(fs.existsSync(downloadedCardPath("nextzxos-2.08"))).toBe(true);
    showMessageBox.mockResolvedValueOnce({ response: 0 });
    await submenu()[0].click();
    expect(fs.existsSync(downloadedCardPath("nextzxos-2.08"))).toBe(false);
  });

  it("changes the state after the delete, so the menu is rebuilt without the card", async () => {
    download("nextzxos-2.08");
    // --- What the menu would be rebuilt to at each state change during the click
    const menus: string[][] = [];
    onDispatch.mockImplementation(() => menus.push(submenu().map((i) => i.label)));
    showMessageBox.mockResolvedValueOnce({ response: 0 });
    await submenu()[0].click();
    expect(menus.at(-1)).toEqual(["No Downloaded Cards"]);
  });
});

describe("when a Next's working copy is made", () => {
  // --- The registry pulls in the whole main process, so this reads its source: the Next names no
  // --- `initializer`, which `src/main/index.ts` would run for every user at every start
  it("is not at startup: the Next has no machine initializer, only its setup", () => {
    const registry = fs.readFileSync(path.join(__dirname, "../../src/main/machine-menus/machine-menu-registry.ts"), "utf8");
    const next = registry.substring(registry.indexOf("[MI_ZXNEXT]: {"));
    expect(next).toContain("setup: setupZxSpectrumNext");
    expect(next).not.toMatch(/^\s*initializer\s*:/m);
    expect(registry).not.toContain("initializeZxSpectrumNext");
  });
});

describe("the Next's and the DivMMC's SD card slots (D-10)", () => {
  beforeEach(() => {
    home.dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-sd-slots-"));
    state.media = {};
    state.emulatorState = {};
  });
  afterEach(() => {
    fs.rmSync(home.dir, { recursive: true, force: true });
  });

  it("a Next reads its own slot, or its model's working copy", () => {
    state.emulatorState = { machineId: "zxnext", modelId: "ks3-30303" };
    state.media = { [MEDIA_DIVMMC_SD_CARD]: "/cards/esxdos.img" };
    expect(activeSdCardSlot()).toBe(MEDIA_SD_CARD);
    expect(activeSdCardFile()).toBe(defaultSdCardOf("ks3-30303").workingCopy);
    state.media[MEDIA_SD_CARD] = "/cards/mine.cim";
    expect(activeSdCardFile()).toBe("/cards/mine.cim");
  });

  it("a DivMMC machine reads the DivMMC's slot, never the Next's card", () => {
    state.emulatorState = { machineId: "sp48", modelId: "pal" };
    state.media = { [MEDIA_SD_CARD]: "/cards/mine.cim" };
    expect(activeSdCardSlot()).toBe(MEDIA_DIVMMC_SD_CARD);
    expect(activeSdCardFile()).toBeUndefined();
    state.media[MEDIA_DIVMMC_SD_CARD] = "/cards/esxdos.img";
    expect(activeSdCardFile()).toBe("/cards/esxdos.img");
  });

  it("a DivMMC with no card is an empty slot of no sectors", () => {
    // --- The machine names its card: the store may still name the previous machine while a new one
    // --- is set up and asks for its card's size
    state.emulatorState = { machineId: "zxnext", modelId: "ks3-30303" };
    state.media = { [MEDIA_SD_CARD]: "/cards/mine.cim" };
    const device = getSdCardDevice(SD_CARD_DIVMMC);
    expect(device.totalSectors).toBe(0);
    expect(() => device.writeSector(0, new Uint8Array(512))).toThrow();
  });

  it("a DivMMC reads its own card and a Next its own, whichever machine the store names", () => {
    const img = path.join(home.dir, "esxdos.img");
    fs.writeFileSync(img, new Uint8Array(4 * 512).fill(0x11));
    state.emulatorState = { machineId: "sp48", modelId: "pal" };
    state.media = { [MEDIA_DIVMMC_SD_CARD]: img };
    expect(getSdCardDevice(SD_CARD_DIVMMC).totalSectors).toBe(4);
    expect(getSdCardDevice(SD_CARD_DIVMMC).readSector(0)[0]).toBe(0x11);
    // --- Card 0 is the Next's: its model's working copy, not the DivMMC's image
    expect(() => getSdCardDevice(0)).toThrow(/ks2\.cim/);
  });

  it("a DivMMC image goes into the DivMMC's slot", async () => {
    await setSelectedSdCardFile("/cards/esxdos.img", MEDIA_DIVMMC_SD_CARD);
    expect(state.media).toEqual({ [MEDIA_DIVMMC_SD_CARD]: "/cards/esxdos.img" });
  });

  describe("splitting settings saved before the DivMMC's slot", () => {
    it("keeps the card a Next saved", () => {
      const media = { [MEDIA_SD_CARD]: "/cards/mine.cim" };
      expect(splitSavedSdCardSlots(media, "zxnext")).toBe(media);
    });

    it("moves another machine's card to the DivMMC's slot, whatever its extension", () => {
      expect(splitSavedSdCardSlots({ [MEDIA_SD_CARD]: "/cards/esxdos.cim", tape: "t.tap" }, "spp3e")).toEqual({
        tape: "t.tap",
        [MEDIA_DIVMMC_SD_CARD]: "/cards/esxdos.cim"
      });
    });

    it("keeps a DivMMC card already in its own slot", () => {
      expect(
        splitSavedSdCardSlots({ [MEDIA_SD_CARD]: "/old.img", [MEDIA_DIVMMC_SD_CARD]: "/new.img" }, "sp48")
      ).toEqual({ [MEDIA_DIVMMC_SD_CARD]: "/new.img" });
    });

    it("leaves media without a card alone", () => {
      expect(splitSavedSdCardSlots(undefined, "sp48")).toBeUndefined();
      const media = { tape: "t.tap" };
      expect(splitSavedSdCardSlots(media, "sp48")).toBe(media);
    });
  });
});
