import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { createMockStore, renderWithProviders } from "../react-test-utils";
import { setMachineTypeAction } from "@state/actions";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import type { NextSpriteState } from "@common/messaging/EmuApi";

/*
 * The Sprite Inspector document shell (`.plans/SPRITE_INSPECTOR_PLAN.md` Phase 4-5): the empty
 * state, the globals strip and the Sprites table, rendered against a canned snapshot.
 */

vi.hoisted(() => {
  const doc = globalThis.document as unknown as Record<string, unknown>;
  if (doc && typeof doc.queryCommandSupported !== "function") {
    doc.queryCommandSupported = () => false;
    doc.queryCommandEnabled = () => false;
  }
});

const emuApi = vi.hoisted(() => ({
  listBreakpoints: vi.fn(),
  getNextSpriteState: vi.fn(),
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
  useDocumentHubService: () => ({ setDocumentViewState: vi.fn() })
}));
vi.mock("@renderer/controls/SplitPanel", () => ({
  SplitPanel: ({ children }: { children: unknown }) => <div>{children as any}</div>
}));

import { createSpriteInspectorPanel } from "@renderer/appIde/DocumentPanels/SpriteInspector/SpriteInspectorPanel";

function snapshot(): NextSpriteState {
  const attributes = new Uint8Array(640);
  attributes.set([100, 100, 0x00, 0x80], 0); // --- sprite 0: visible, pattern 0, 4-byte
  attributes.set([10, 10, 0x00, 0x01, 0x40], 5); // --- sprite 1: hidden, stale attr4
  const resolved = new Uint8Array(1024);
  resolved.set([0x01, 100, 0, 100, 0, 0, 0, 0], 0);
  resolved.set([0x00, 10, 0, 10, 0, 0, 0, 2], 8);
  return {
    attributes,
    patterns: new Uint8Array(0x4000).fill(0x22),
    resolved,
    lastVisible: 0,
    control: 0x01,
    clip: [0, 255, 0, 191],
    clipIndex: 0,
    transparencyIndex: 0xe3,
    status: { tooMany: false, collision: true },
    upload: { spriteIndex: 2, spriteSub: 0, patternIndex: 1, patternSub: 0, mirrorIndex: 2, tied: true },
    spritePaletteBank: 0
  };
}

const tick = async () => {
  for (const fn of [...listeners]) await fn(MachineControllerState.Paused);
};

beforeEach(() => {
  listeners.length = 0;
  emuApi.getNextSpriteState.mockReset().mockResolvedValue(snapshot());
  emuApi.listBreakpoints.mockReset().mockResolvedValue({ breakpoints: [] });
  executeCommand.mockReset().mockResolvedValue({ success: true });
  emuApi.getCpuStateChunk.mockReset().mockResolvedValue({ state: MachineControllerState.Paused, pcValue: 0, tacts: 1 });
  emuApi.getPalettedDeviceInfo.mockReset().mockRejectedValue(new Error("none"));
});

const doc = { id: "$sprites", name: "Sprite Inspector", type: "SpriteInspector" } as any;

describe("Sprite Inspector document", () => {
  it("shows the empty state on a machine that is not a Next, and reads nothing", async () => {
    const store = createMockStore();
    store.dispatch(setMachineTypeAction("sp48"));
    renderWithProviders(createSpriteInspectorPanel({ document: doc }), { store });
    await tick();
    expect(screen.getByText("The Sprite Inspector shows a running ZX Spectrum Next")).toBeTruthy();
    expect(emuApi.getNextSpriteState).not.toHaveBeenCalled();
  });

  it("renders the globals strip and the sprite table from one snapshot", async () => {
    const store = createMockStore();
    store.dispatch(setMachineTypeAction("zxnext"));
    renderWithProviders(createSpriteInspectorPanel({ document: doc }), { store });
    await tick();
    await waitFor(() => expect(screen.getByRole("list", { name: "Sprite globals" })).toBeTruthy());
    const strip = screen.getByRole("list", { name: "Sprite globals" }).textContent!;
    expect(strip).toContain("(32,32)-(287,223)");
    expect(strip).toContain("collision");
    expect(strip).toContain("#2 (tied)");
    // --- Default filter: up to the last visible sprite
    const rows = document.querySelectorAll("[data-sprite]");
    expect(Array.from(rows).map((r) => r.getAttribute("data-sprite"))).toEqual(["0"]);
    expect(emuApi.getNextSpriteState).toHaveBeenCalledTimes(1);
    // --- jsdom has no width: the narrow layout, where *Both* is not offered and the table shows
    expect(document.querySelector('[data-layout="narrow"]')).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Both" })).toBeNull();
    expect(screen.queryByRole("listbox", { name: "Sprite pattern RAM" })).toBeNull();
    // --- The inspector is the band under the list, with the sprite-space map beside the details
    expect(document.querySelector('[data-layout="band"]')).toBeTruthy();
    expect(screen.getByRole("img", { name: "Sprite space" })).toBeTruthy();
    // --- The header and the rows are one table, so the header scrolls with its columns
    const table = screen.getByRole("table", { name: "Sprite attribute slots" });
    expect(table.querySelector("thead")).toBeTruthy();
    expect(table.querySelectorAll("tbody tr")).toHaveLength(1);
  });

  it("switches to the Patterns view from its tab, and selecting a row fills the inspector", async () => {
    const store = createMockStore();
    store.dispatch(setMachineTypeAction("zxnext"));
    renderWithProviders(createSpriteInspectorPanel({ document: doc }), { store });
    await tick();
    await waitFor(() => expect(document.querySelector("[data-sprite]")).toBeTruthy());
    fireEvent.click(document.querySelector('[data-sprite="0"]')!);
    await waitFor(() => expect(screen.getByText("Sprite #0")).toBeTruthy());
    expect(document.querySelector('[aria-label="Sprite Inspector selection"]')!.textContent).toContain(
      "drawn · 100,100"
    );
    fireEvent.click(screen.getByRole("tab", { name: "Patterns" }));
    await waitFor(() => expect(screen.getByRole("listbox", { name: "Sprite pattern RAM" })).toBeTruthy());
  });
});

describe("Sprite Inspector - sprite-attribute breakpoints (G3.8)", () => {
  const openMenu = async () => {
    const store = createMockStore();
    store.dispatch(setMachineTypeAction("zxnext"));
    renderWithProviders(createSpriteInspectorPanel({ document: doc }), { store });
    await tick();
    await waitFor(() => expect(document.querySelector('[data-sprite="0"]')).toBeTruthy());
    fireEvent.contextMenu(document.querySelector('[data-sprite="0"]')!);
  };

  it("sets an sp: breakpoint from the row menu", async () => {
    await openMenu();
    fireEvent.click(await screen.findByText("Break on attribute write"));
    await waitFor(() => expect(executeCommand).toHaveBeenCalledWith("bp-set sp:$00"));
  });

  it("runs until the sprite's attributes are written", async () => {
    await openMenu();
    fireEvent.click(await screen.findByText("Run until attribute write"));
    await waitFor(() => expect(executeCommand).toHaveBeenCalledWith("run-to sp:$00"));
  });

  it("marks a sprite that has a breakpoint, and offers to remove and edit it", async () => {
    emuApi.listBreakpoints.mockResolvedValue({ breakpoints: [{ spriteIndex: 0, exec: false }] });
    await openMenu();
    await waitFor(() =>
      expect(document.querySelector('[title^="Breaks when an attribute of sprite #0 is written"]')).toBeTruthy()
    );
    expect(await screen.findByText("Edit breakpoint...")).toBeTruthy();
    fireEvent.click(await screen.findByText("Remove attribute-write breakpoint"));
    await waitFor(() => expect(executeCommand).toHaveBeenCalledWith("bp-del sp:$00"));
  });
});
