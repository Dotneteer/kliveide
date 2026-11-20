import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { createMockStore, renderWithProviders } from "../react-test-utils";
import { setMachineTypeAction } from "@state/actions";
import { MachineControllerState } from "@abstractions/MachineControllerState";

/*
 * The Palette document (`dev/plans/NEXT_PALETTE_DEBUGGING_PLAN.md` §4), rendered against canned
 * palettes: the device tabs, the two banks, the written and watched marks, the details and the
 * breakpoint actions, and Follow.
 */

vi.hoisted(() => {
  const doc = globalThis.document as unknown as Record<string, unknown>;
  if (doc && typeof doc.queryCommandSupported !== "function") {
    doc.queryCommandSupported = () => false;
    doc.queryCommandEnabled = () => false;
  }
});

const emuApi = vi.hoisted(() => ({
  getPalettedDeviceInfo: vi.fn(),
  getPaletteVersion: vi.fn(),
  getCpuState: vi.fn(),
  listBreakpoints: vi.fn()
}));
vi.mock("@renderer/core/EmuApi", () => ({ useEmuApi: () => emuApi }));

const listeners: ((state: MachineControllerState) => Promise<void> | void)[] = [];
vi.mock("@renderer/appIde/useStateRefresh", () => ({
  useEmuStateListener: (_api: unknown, fn: (state: MachineControllerState) => Promise<void> | void) => {
    listeners.push(fn);
  }
}));
const executeCommand = vi.hoisted(() => vi.fn());
vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({ ideCommandsService: { executeCommand }, uiService: { dragging: false } })
}));
const openDialog = vi.hoisted(() => vi.fn());
vi.mock("@renderer/appIde/dialogs/useBreakpointDialog", () => ({ useBreakpointDialog: () => openDialog }));
const setDocumentViewState = vi.hoisted(() => vi.fn());
vi.mock("@renderer/appIde/services/DocumentServiceProvider", () => ({
  useDocumentHubService: () => ({ setDocumentViewState, isOpen: () => false, getDocumentApi: () => undefined })
}));

import { createPaletteDocumentPanel } from "@renderer/appIde/DocumentPanels/NextPalettes/PaletteDocumentPanel";
import { resetNextPaletteStops } from "@renderer/features/next-palette/useNextPaletteState";

const RAMP = Array.from({ length: 256 }, (_, i) => (i << 1) | (i & 2 ? 1 : 0));
const written = (marks: [number, number][]) => {
  const bytes = new Array(256).fill(0);
  for (const [slot, index] of marks) bytes[slot * 32 + (index >> 3)] |= 1 << (index & 7);
  return bytes;
};
const info = (over: any = {}) => ({
  ulaFirst: RAMP,
  ulaSecond: RAMP,
  layer2First: RAMP,
  layer2Second: RAMP,
  spriteFirst: RAMP,
  spriteSecond: RAMP,
  tilemapFirst: RAMP,
  tilemapSecond: RAMP,
  storedPaletteValue: 0,
  spriteTransparencyIndex: 0xe3,
  tilemapTransparencyIndex: 0x0f,
  reg43Value: 0x08,
  reg6bValue: 0,
  ulaNextFormat: 0,
  globalTransparency: 0xe3,
  written: new Array(256).fill(0),
  ...over
});

let tacts = 1;
const tick = async () => {
  for (const fn of [...listeners]) await fn(MachineControllerState.Paused);
};

beforeEach(() => {
  listeners.length = 0;
  tacts = 1;
  resetNextPaletteStops();
  emuApi.getPalettedDeviceInfo.mockReset().mockResolvedValue(info());
  emuApi.getPaletteVersion.mockReset().mockRejectedValue(new Error("no version"));
  emuApi.getCpuState.mockReset().mockImplementation(async () => ({ tacts }));
  emuApi.listBreakpoints.mockReset().mockResolvedValue({ breakpoints: [] });
  executeCommand.mockReset().mockResolvedValue({ success: true });
  openDialog.mockReset();
  setDocumentViewState.mockReset();
});

const doc = { id: "$palettes", name: "Palettes", type: "NextPalettes" } as any;

const renderDocument = async (viewState?: any) => {
  const store = createMockStore();
  store.dispatch(setMachineTypeAction("zxnext"));
  renderWithProviders(createPaletteDocumentPanel({ document: doc, viewState }), { store });
  await tick();
  await screen.findByRole("tablist");
};

const cell = (bank: number, index: number) =>
  screen.getAllByRole("grid")[bank].querySelectorAll('[role="gridcell"]')[index] as HTMLElement;

describe("Palette document", () => {
  it("shows the empty state on a machine that is not a Next", () => {
    const store = createMockStore();
    store.dispatch(setMachineTypeAction("sp48"));
    renderWithProviders(createPaletteDocumentPanel({ document: doc }), { store });
    expect(screen.getByText(/the current machine has none/)).toBeTruthy();
  });

  it("shows a device's two banks, the live one tagged, and the selected entry decoded", async () => {
    await renderDocument({ device: "sprites", bank: 0, index: 0x03 });
    expect(screen.getAllByRole("tab").map((t) => t.getAttribute("aria-selected"))).toEqual([
      "false",
      "false",
      "true",
      "false"
    ]);
    expect(screen.getAllByRole("grid")).toHaveLength(2);
    // --- $43 bit 3 is set: the sprites draw with bank 2
    expect(screen.getByRole("region", { name: "Bank 2" }).textContent).toContain("live");
    expect(screen.getByText("Sprites · bank 1 · entry $03")).toBeTruthy();
    // --- RAMP[3] = 7: blue 7
    expect(screen.getByText("$007")).toBeTruthy();
    expect(screen.getByText("bp-set pal:SPR1:$03")).toBeTruthy();
  });

  it("marks entries written since the last stop and shows the colour they replaced", async () => {
    await renderDocument({ device: "sprites", bank: 0, index: 0x03 });
    // --- The next stop: entry $03 of the first sprite bank was rewritten
    tacts = 2;
    emuApi.getPalettedDeviceInfo.mockResolvedValue(
      info({ spriteFirst: RAMP.map((v, n) => (n === 3 ? 0x1c0 : v)), written: written([[2, 3]]) })
    );
    await tick();
    await screen.findByText("1 written");
    expect(screen.getByText("$1C0")).toBeTruthy();
    expect(screen.getByText("was $007")).toBeTruthy();
    expect(cell(0, 3).querySelectorAll("span").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole("tab")[2].title).toBe("Sprites: 1 entries written since the last stop");
  });

  it("sets, removes and edits the entry's breakpoint through the commands and the dialog", async () => {
    await renderDocument({ device: "layer2", bank: 1, index: 0xaf });
    fireEvent.click(screen.getByRole("button", { name: /Break on writes to \$AF/ }));
    await waitFor(() => expect(executeCommand).toHaveBeenCalledWith("bp-set pal:l22:$af"));
    fireEvent.click(screen.getByRole("button", { name: /Break when \$AF changes/ }));
    await waitFor(() => expect(executeCommand).toHaveBeenCalledWith("bp-set pal:l22:$af -changed"));

    // --- With the breakpoint: the swatch is marked, the actions turn into Remove and Edit
    const bp = { paletteStop: "l22:$af" };
    emuApi.listBreakpoints.mockResolvedValue({ breakpoints: [bp] });
    fireEvent.click(screen.getByRole("button", { name: /Break on writes to \$AF/ }));
    await screen.findByRole("button", { name: /Remove breakpoint/ });
    fireEvent.click(screen.getByRole("button", { name: /Remove breakpoint/ }));
    await waitFor(() => expect(executeCommand).toHaveBeenCalledWith("bp-del pal:l22:$af"));
    fireEvent.click(screen.getByRole("button", { name: /Edit breakpoint/ }));
    await waitFor(() => expect(openDialog).toHaveBeenCalledWith(bp));
  });

  it("selects a device with its tab and an entry with a click", async () => {
    await renderDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Tilemap/ }));
    fireEvent.click(cell(1, 0x0f));
    expect(screen.getByText("Tilemap · bank 2 · entry $0F")).toBeTruthy();
    expect(screen.getByText("yes (Next Reg $4C)")).toBeTruthy();
    expect(setDocumentViewState).toHaveBeenLastCalledWith(
      "$palettes",
      expect.objectContaining({ device: "tilemap", bank: 1, index: 0x0f })
    );
  });

  it("follows the write a palette breakpoint stopped on", async () => {
    await renderDocument({ follow: true });
    tacts = 2;
    emuApi.getCpuState.mockImplementation(async () => ({
      tacts,
      lastPaletteWrite: {
        kind: "entry",
        slot: 6,
        index: 0x21,
        oldValue: 0,
        newValue: 0x1c0,
        origin: "copper",
        path: "$41",
        pc: 0x8009
      }
    }));
    emuApi.getPalettedDeviceInfo.mockResolvedValue(info({ written: written([[6, 0x21]]) }));
    await tick();
    await screen.findByText("Sprites · bank 2 · entry $21");
    expect(screen.getByText(/^at \$8009, /)).toBeTruthy();
  });
});
