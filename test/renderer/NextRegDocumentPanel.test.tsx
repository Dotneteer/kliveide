import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { createMockStore, renderWithProviders } from "../react-test-utils";
import { setMachineTypeAction } from "@state/actions";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { NEXT_REG_DESCRIPTORS } from "@emu/machines/zxNext/nextRegDescriptors";
import type { SideBarPanelBadgeProps } from "@renderer/abstractions/SideBarPanelInfo";

/*
 * The Next Registers document and the Debug sidebar panel's pop-out button, rendered against a
 * canned register state.
 */

vi.hoisted(() => {
  const doc = globalThis.document as unknown as Record<string, unknown>;
  if (doc && typeof doc.queryCommandSupported !== "function") {
    doc.queryCommandSupported = () => false;
    doc.queryCommandEnabled = () => false;
  }
  // --- jsdom lays nothing out, so it has no scrollIntoView
  const proto = (globalThis as any).Element?.prototype;
  if (proto && !proto.scrollIntoView) proto.scrollIntoView = () => {};
});

const emuApi = vi.hoisted(() => ({
  getNextRegDescriptors: vi.fn(),
  getNextRegState: vi.fn(),
  getCpuStateChunk: vi.fn()
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
const setDocumentViewState = vi.hoisted(() => vi.fn());
vi.mock("@renderer/appIde/services/DocumentServiceProvider", () => ({
  useDocumentHubService: () => ({ setDocumentViewState, isOpen: () => false, getDocumentApi: () => undefined })
}));

import { createNextRegDocumentPanel } from "@renderer/appIde/DocumentPanels/NextRegs/NextRegDocumentPanel";
import { NextRegPanelActions } from "@renderer/appIde/SideBarPanels/NextRegPanel";
import { SideBarPanel } from "@renderer/appIde/SideBar/SideBarPanel";
import { resetNextRegStops } from "@renderer/features/nextRegs/useNextRegState";

let values: Record<number, number> = {};
let tacts = 1;
const regState = () => ({
  lastRegisterIndex: 0x15,
  regs: NEXT_REG_DESCRIPTORS.map((d) => ({
    id: d.id,
    value: d.isWriteOnly ? undefined : values[d.id] ?? 0,
    lastWrite: d.isReadOnly ? undefined : values[d.id]
  }))
});

const tick = async () => {
  for (const fn of [...listeners]) await fn(MachineControllerState.Paused);
};

beforeEach(() => {
  listeners.length = 0;
  values = { 0x15: 0x0b, 0x52: 0x0a };
  tacts = 1;
  resetNextRegStops();
  emuApi.getNextRegDescriptors.mockReset().mockResolvedValue({ descriptors: NEXT_REG_DESCRIPTORS });
  emuApi.getNextRegState.mockReset().mockImplementation(async () => regState());
  emuApi.getCpuStateChunk
    .mockReset()
    .mockImplementation(async () => ({ state: MachineControllerState.Paused, pcValue: 0, tacts }));
  executeCommand.mockReset().mockResolvedValue({ success: true });
  setDocumentViewState.mockReset();
});

const doc = { id: "$nextRegs", name: "Next Registers", type: "NextRegisters" } as any;

const renderDocument = async (viewState?: any) => {
  const store = createMockStore();
  store.dispatch(setMachineTypeAction("zxnext"));
  renderWithProviders(createNextRegDocumentPanel({ document: doc, viewState }), { store });
  await tick();
  await waitFor(() => expect(document.querySelector('[data-reg="21"]')).toBeTruthy());
};

const shownRegs = () =>
  Array.from(document.querySelectorAll("[data-reg]")).map((r) => Number(r.getAttribute("data-reg")));

describe("Next Registers document", () => {
  it("shows the empty state on a machine that is not a Next", async () => {
    const store = createMockStore();
    store.dispatch(setMachineTypeAction("sp48"));
    renderWithProviders(createNextRegDocumentPanel({ document: doc }), { store });
    expect(screen.getByText("The Next registers exist on the ZX Spectrum Next only.")).toBeTruthy();
  });

  it("lists every register by index and decodes the selected one", async () => {
    await renderDocument({ selected: 0x15 });
    expect(shownRegs()).toEqual(NEXT_REG_DESCRIPTORS.map((d) => d.id));
    expect(screen.getByText("$00–$0F")).toBeTruthy();
    // --- The inspector decodes $15: its value, a field and its value names
    expect(screen.getAllByText("Sprite and Layers System").length).toBeGreaterThan(1);
    expect(screen.getAllByText("$0B").length).toBeGreaterThan(0);
    expect(screen.getByText("nextreg $15, $0B")).toBeTruthy();
    // --- The $243B readout names the register the port selects
    expect(screen.getByRole("button", { name: /\$243B selects/ }).textContent).toContain("$15");
  });

  it("groups by category, listing a register in each of its categories", async () => {
    await renderDocument();
    fireEvent.click(screen.getByRole("button", { name: "By category" }));
    expect(screen.getByText("Memory (MMU)")).toBeTruthy();
    expect(shownRegs().filter((id) => id === 0x69)).toHaveLength(2);
    expect(setDocumentViewState).toHaveBeenLastCalledWith("$nextRegs", expect.objectContaining({ grouping: "category" }));
  });

  it("filters by register number and by text", async () => {
    await renderDocument();
    const filter = screen.getByRole("textbox");
    fireEvent.change(filter, { target: { value: "$52" } });
    expect(shownRegs()).toEqual([0x52]);
    fireEvent.change(filter, { target: { value: "lores" } });
    expect(shownRegs()).toContain(0x15);
    expect(shownRegs()).not.toContain(0x52);
  });

  it("marks and filters the registers that changed since the previous stop", async () => {
    await renderDocument();
    values = { ...values, 0x52: 0x0c };
    tacts = 2;
    await tick();
    await waitFor(() => expect(screen.getByText("1 changed")).toBeTruthy());
    fireEvent.click(screen.getByText("Changed:"));
    expect(shownRegs()).toEqual([0x52]);
  });

  it("selects with the keyboard and opens a register's fields", async () => {
    await renderDocument({ selected: 0x14 });
    const list = screen.getByRole("grid");
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(document.querySelector('[data-reg="21"]')!.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(screen.getAllByText(/Enable lores mode/).length).toBeGreaterThan(1);
  });
});

describe("Next Registers panel pop-out", () => {
  const panel = (headerActions?: (props: SideBarPanelBadgeProps) => React.ReactElement | null) => ({
    id: "nextRegPanel",
    title: "Next Registers",
    hostActivity: "debug-view",
    renderer: () => <div>content</div>,
    headerActions
  });

  it("adds nothing to a header without actions", () => {
    renderWithProviders(<SideBarPanel sideBar={panel()} index={0} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens the document without folding the panel", () => {
    const { store } = renderWithProviders(
      <SideBarPanel sideBar={panel(NextRegPanelActions)} index={0} expanded={true} />
    );
    const before = store.getState().ideView?.sideBarPanels;
    const button = screen.getByRole("button");
    fireEvent.click(button);
    fireEvent.keyDown(button, { code: "Enter" });
    expect(executeCommand).toHaveBeenCalledWith("show-nextregs");
    expect(store.getState().ideView?.sideBarPanels).toEqual(before);
    // --- The header itself still folds the panel
    fireEvent.click(screen.getByText("Next Registers"));
    expect(store.getState().ideView?.sideBarPanels?.nextRegPanel?.expanded).toBe(false);
  });
});
