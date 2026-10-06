import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { createMockStore, renderWithProviders } from "../react-test-utils";
import { setMachineTypeAction } from "@state/actions";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import type { NextLayer2State } from "@common/messaging/EmuApi";
import { LAYER2_READ_BYTES } from "@common/zxnext/layer2/layer2Decode";

/*
 * The Layer 2 Inspector document shell (`.plans/LAYER2_INSPECTOR_PLAN.md` Phase 3-5): the empty
 * state, the globals strip with the write window in words, the Banks strip, a clicked pixel in the
 * inspector, and the shadow banks read only when the Shadow source is chosen (T9).
 */

vi.hoisted(() => {
  const doc = globalThis.document as unknown as Record<string, unknown>;
  if (doc && typeof doc.queryCommandSupported !== "function") {
    doc.queryCommandSupported = () => false;
    doc.queryCommandEnabled = () => false;
  }
});

const emuApi = vi.hoisted(() => ({
  getNextLayer2State: vi.fn(),
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
const executeCommand = vi.hoisted(() => vi.fn());
vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({ ideCommandsService: { executeCommand } })
}));
vi.mock("@renderer/appIde/services/DocumentServiceProvider", () => ({
  useDocumentHubService: () => ({ setDocumentViewState: vi.fn(), isOpen: () => false, getDocumentApi: () => undefined })
}));
vi.mock("@renderer/controls/SplitPanel", () => ({
  SplitPanel: ({ children }: { children: unknown }) => <div>{children as any}</div>
}));

import { createLayer2InspectorPanel } from "@renderer/appIde/DocumentPanels/Layer2Inspector/Layer2InspectorPanel";

function snapshot(options?: { shadow?: boolean }): NextLayer2State {
  const displayed = new Uint8Array(LAYER2_READ_BYTES);
  displayed[(5 << 8) | 5] = 0x2a; // --- 256x192: row 5, column 5
  return {
    regs: {
      enabled: true,
      activeBank: 8,
      shadowBank: 11,
      port123B: 0x0b,
      bankOffset: 0,
      resolution: 0,
      paletteOffset: 0,
      scrollX: 0,
      scrollY: 0,
      clip: [0, 255, 0, 191],
      clipIndex: 0,
      globalTransparency: 0xe3,
      secondPalette: false
    },
    displayed,
    shadow: options?.shadow ? new Uint8Array(LAYER2_READ_BYTES) : undefined,
    slotOffsets: [0, 0x2000, 0x054000, 0x056000, 0x044000, 0x046000, 0x040000, 0x042000],
    copperRunning: false
  };
}

const palettes = () => {
  const p = Array.from({ length: 256 }, (_, i) => i << 1);
  return {
    ulaFirst: p, ulaSecond: p, layer2First: p, layer2Second: p, spriteFirst: p, spriteSecond: p,
    tilemapFirst: p, tilemapSecond: p, storedPaletteValue: 0, spriteTransparencyIndex: 0xe3,
    tilemapTransparencyIndex: 0x0f, reg43Value: 0, reg6bValue: 0, ulaNextFormat: 0
  };
};

const tick = async () => {
  for (const fn of [...listeners]) await fn(MachineControllerState.Paused);
};

beforeEach(() => {
  listeners.length = 0;
  emuApi.getNextLayer2State.mockReset().mockImplementation(async (o?: { shadow?: boolean }) => snapshot(o));
  emuApi.getCpuStateChunk.mockReset().mockResolvedValue({ state: MachineControllerState.Paused, pcValue: 0, tacts: 1 });
  emuApi.getPalettedDeviceInfo.mockReset().mockResolvedValue(palettes());
});

const doc = { id: "$layer2", name: "Layer 2 Inspector", type: "Layer2Inspector" } as any;

describe("Layer 2 Inspector document", () => {
  it("shows the empty state on a machine that is not a Next, and reads nothing", async () => {
    const store = createMockStore();
    store.dispatch(setMachineTypeAction("sp48"));
    renderWithProviders(createLayer2InspectorPanel({ document: doc }), { store });
    await tick();
    expect(screen.getByText("The Layer 2 Inspector shows a running ZX Spectrum Next")).toBeTruthy();
    expect(emuApi.getNextLayer2State).not.toHaveBeenCalled();
  });

  it("renders the globals and banks, a clicked pixel fills the inspector, and Shadow reads the shadow banks", async () => {
    const store = createMockStore();
    store.dispatch(setMachineTypeAction("zxnext"));
    renderWithProviders(createLayer2InspectorPanel({ document: doc }), { store });
    await tick();
    await tick();
    await waitFor(() => expect(screen.getByRole("list", { name: "Layer 2 globals" })).toBeTruthy());
    const strip = screen.getByRole("list", { name: "Layer 2 globals" }).textContent!;
    expect(strip).toContain("write window maps the shadow bank");
    expect(strip).toContain("256×192");
    expect(strip).toContain("$0B: writes → bank 11 ($0000-$3FFF)");
    const banks = screen.getByRole("list", { name: "Layer 2 banks" }).textContent!;
    expect(banks).toContain("bank 8 · pages 16–17");
    expect(emuApi.getNextLayer2State).toHaveBeenLastCalledWith({ shadow: false });

    // --- zoom 2 and a zero-sized rectangle: client (10, 10) is pixel (5, 5)
    fireEvent.click(screen.getByRole("img", { name: "Layer 2 image" }), { clientX: 10, clientY: 10 });
    await waitFor(() => expect(screen.getByText(/Pixel \(5, 5\) · bank 8/)).toBeTruthy());
    const inspector = screen.getByLabelText("Inspector").textContent!;
    expect(inspector).toContain("8:$0505");
    expect(inspector).toContain("$2A");

    // --- Bank 8 is not mapped: the page view and a bank-relative breakpoint, both enabled
    executeCommand.mockReset().mockResolvedValue({ success: true });
    const showButton = screen.getByRole("button", { name: /^Show in memory \(page 10:\$0505\)$/ });
    const breakButton = screen.getByRole("button", { name: /^Break on write \(08:\+\$0505\)$/ });
    expect((showButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(breakButton);
    await waitFor(() => expect(executeCommand).toHaveBeenCalledWith("bp-set 08:+$0505 -w"));
    fireEvent.click(showButton);
    await waitFor(() => expect(executeCommand).toHaveBeenCalledWith("show-memory"));

    fireEvent.click(screen.getByRole("button", { name: "Shadow" }));
    await waitFor(() => expect(emuApi.getNextLayer2State).toHaveBeenLastCalledWith({ shadow: true }));
    await waitFor(() => expect(screen.getByRole("list", { name: "Layer 2 banks" }).textContent).toContain("bank 11"));
  });
});
