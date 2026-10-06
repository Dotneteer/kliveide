import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { createMockStore, renderWithProviders } from "../react-test-utils";
import { setMachineTypeAction } from "@state/actions";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import type { NextTilemapState } from "@common/messaging/EmuApi";

/*
 * The Tilemap Inspector document shell (`.plans/TILEMAP_INSPECTOR_PLAN.md` Phase 4-6): the empty
 * state, the globals strip with its overlap chip, a cell selected on the map, the tile it shows.
 */

vi.hoisted(() => {
  const doc = globalThis.document as unknown as Record<string, unknown>;
  if (doc && typeof doc.queryCommandSupported !== "function") {
    doc.queryCommandSupported = () => false;
    doc.queryCommandEnabled = () => false;
  }
});

const emuApi = vi.hoisted(() => ({
  getNextTilemapState: vi.fn(),
  getCpuStateChunk: vi.fn(),
  getPalettedDeviceInfo: vi.fn()
}));
vi.mock("@renderer/core/EmuApi", () => ({ useEmuApi: () => emuApi }));

const listeners: ((state: MachineControllerState) => Promise<void> | void)[] = [];
vi.mock("@renderer/appIde/useStateRefresh", () => ({
  useEmuStateListener: (_api: unknown, fn: (state: MachineControllerState) => Promise<void> | void) => {
    listeners.push(fn);
  }
}));
vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({ ideCommandsService: { executeCommand: vi.fn() } })
}));
vi.mock("@renderer/appIde/services/DocumentServiceProvider", () => ({
  useDocumentHubService: () => ({ setDocumentViewState: vi.fn() })
}));
vi.mock("@renderer/controls/SplitPanel", () => ({
  SplitPanel: ({ children }: { children: unknown }) => <div>{children as any}</div>
}));

import { createTilemapInspectorPanel } from "@renderer/appIde/DocumentPanels/TilemapInspector/TilemapInspectorPanel";

function snapshot(): NextTilemapState {
  const bank5 = new Uint8Array(0x4000);
  bank5[0x1800 + 2 * 41] = 7; // --- cell (1, 1) shows tile 7; the map is at $5800, over the ULA attributes
  return {
    regs: {
      enabled: true,
      control: 0x80,
      defaultAttr: 0,
      mapBank7: false,
      mapMsb: 0x18,
      defBank7: false,
      defMsb: 0x20,
      scrollX: 0,
      scrollY: 0,
      transparencyIndex: 0x0f,
      globalTransparency: 0xe3,
      clip: [0, 159, 0, 255],
      clipIndex: 0,
      ulaDisabled: false
    },
    bank5,
    bank7: new Uint8Array(0x4000),
    slotOffsets: [0, 0x2000, 0x054000, 0x056000, 0x044000, 0x046000, 0x040000, 0x042000],
    copperRunning: false
  };
}

const palettes = () => {
  const p = Array.from({ length: 256 }, (_, i) => i << 1);
  return {
    ulaFirst: p, ulaSecond: p, layer2First: p, layer2Second: p, spriteFirst: p, spriteSecond: p,
    tilemapFirst: p, tilemapSecond: p, storedPaletteValue: 0, spriteTransparencyIndex: 0xe3,
    tilemapTransparencyIndex: 0x0f, reg43Value: 0, reg6bValue: 0x80, ulaNextFormat: 0
  };
};

const tick = async () => {
  for (const fn of [...listeners]) await fn(MachineControllerState.Paused);
};

beforeEach(() => {
  listeners.length = 0;
  emuApi.getNextTilemapState.mockReset().mockResolvedValue(snapshot());
  emuApi.getCpuStateChunk.mockReset().mockResolvedValue({ state: MachineControllerState.Paused, pcValue: 0, tacts: 1 });
  emuApi.getPalettedDeviceInfo.mockReset().mockResolvedValue(palettes());
});

const doc = { id: "$tilemap", name: "Tilemap Inspector", type: "TilemapInspector" } as any;

describe("Tilemap Inspector document", () => {
  it("shows the empty state on a machine that is not a Next, and reads nothing", async () => {
    const store = createMockStore();
    store.dispatch(setMachineTypeAction("sp48"));
    renderWithProviders(createTilemapInspectorPanel({ document: doc }), { store });
    await tick();
    expect(screen.getByText("The Tilemap Inspector shows a running ZX Spectrum Next")).toBeTruthy();
    expect(emuApi.getNextTilemapState).not.toHaveBeenCalled();
  });

  it("renders the globals with the overlap chip, and a clicked cell fills the inspector", async () => {
    const store = createMockStore();
    store.dispatch(setMachineTypeAction("zxnext"));
    renderWithProviders(createTilemapInspectorPanel({ document: doc }), { store });
    await tick();
    await tick();
    await waitFor(() => expect(screen.getByRole("list", { name: "Tilemap globals" })).toBeTruthy());
    const strip = screen.getByRole("list", { name: "Tilemap globals" }).textContent!;
    expect(strip).toContain("map overlaps ULA attributes");
    expect(strip).toContain("40×32");
    // --- jsdom has no width: narrow, tabs without *Both*, the map showing
    expect(document.querySelector('[data-layout="narrow"]')).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Both" })).toBeNull();
    const map = screen.getByRole("img", { name: "Tilemap" });
    // --- zoom 2 and a zero-sized rectangle: client (20, 20) is layer pixel (10, 10), cell (1, 1)
    fireEvent.click(map, { clientX: 20, clientY: 20 });
    await waitFor(() => expect(screen.getByText(/Cell \(1, 1\) · tile 7/)).toBeTruthy());
    expect(screen.getByLabelText("Inspector").textContent).toContain("5:$1852");
    fireEvent.click(screen.getByText("Show tile 7 and its users"));
    await waitFor(() => expect(screen.getByRole("img", { name: "Tile definitions" })).toBeTruthy());
    expect(screen.getByText(/Tile 7 · 1 cell use it/)).toBeTruthy();
  });
});
