import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { createMockStore, renderWithProviders } from "../react-test-utils";
import { addWatchAction } from "@state/actions";

/**
 * Phase 16 — the panels that were already called "modernized" and still carried live bugs.
 *
 * Each test here pins one defect that shipped inside a converted panel. They are grouped rather than
 * scattered into the panels' own suites because what they have in common is the *reason* they
 * existed: a panel that looks finished stops being read closely.
 *
 * See `.plans/UI_MODERNIZATION_BATCH_2_PLAN.md` Phase 16.
 */

/*
 * jsdom has no `queryCommandSupported`, and importing these panels reaches Monaco's clipboard
 * contribution, which calls it at module scope. `vi.hoisted` runs before the imports, which is the
 * only place this can be installed.
 */
vi.hoisted(() => {
  const doc = globalThis.document as unknown as Record<string, unknown>;
  if (doc && typeof doc.queryCommandSupported !== "function") {
    doc.queryCommandSupported = () => false;
    doc.queryCommandEnabled = () => false;
  }
});

const emuApi = vi.hoisted(() => ({
  getMemoryContents: vi.fn(),
  getCallStack: vi.fn(),
  getUlaState: vi.fn(),
  setKeyStatus: vi.fn()
}));
vi.mock("@renderer/core/EmuApi", () => ({ useEmuApi: () => emuApi }));

// --- Drive the refresh callback by hand rather than on a timer: these tests are about *whether* a
// --- fetch happens, not when.
const listeners: (() => Promise<void> | void)[] = [];
vi.mock("@renderer/appIde/useStateRefresh", () => ({
  useEmuStateListener: (_api: unknown, fn: () => Promise<void> | void) => {
    listeners.push(fn);
  }
}));

import { WatchPanel } from "@renderer/appIde/SideBarPanels/WatchPanel";
import { CallStackPanel } from "@renderer/appIde/SideBarPanels/CallStackPanel";

const tick = async () => {
  for (const fn of [...listeners]) await fn();
};

beforeEach(() => {
  listeners.length = 0;
  emuApi.getMemoryContents.mockReset().mockResolvedValue({ memory: new Uint8Array(0x10000) });
  emuApi.getCallStack.mockReset().mockResolvedValue({ sp: 0xff00, frames: [] });
});

describe("WatchPanel", () => {
  /*
   * The panel pulls the machine's entire 64K to evaluate watch expressions. With none defined —
   * the default state of the panel — there is nothing to evaluate, and it was pulling anyway, once
   * per refresh tick, for as long as the sidebar was open.
   */
  it("does not fetch memory when no watch expressions are defined", async () => {
    renderWithProviders(<WatchPanel />, { store: createMockStore() });
    await tick();
    await tick();
    expect(emuApi.getMemoryContents).not.toHaveBeenCalled();
  });

  it("fetches memory once a watch expression exists", async () => {
    const store = createMockStore();
    store.dispatch(addWatchAction({ symbol: "SCORE", type: "b" }));
    renderWithProviders(<WatchPanel />, { store });
    await tick();
    await waitFor(() => expect(emuApi.getMemoryContents).toHaveBeenCalled());
  });
});

describe("CallStackPanel", () => {
  /*
   * `EmptyState` was shown only while the *first* refresh was outstanding. Once one landed with no
   * frames the panel drew an empty list and said nothing at all, which reads as a panel that failed
   * rather than a stack that is empty.
   */
  it("says the stack is empty once a refresh has landed with no frames", async () => {
    renderWithProviders(<CallStackPanel />, { store: createMockStore() });
    await waitFor(() => expect(emuApi.getCallStack).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("The call stack is empty")).toBeTruthy());
  });

  it("shows the frames when there are some", async () => {
    emuApi.getCallStack.mockResolvedValue({ sp: 0xff00, frames: [0x8000, 0x9000] });
    renderWithProviders(<CallStackPanel />, { store: createMockStore() });
    await waitFor(() => expect(screen.queryByText("The call stack is empty")).toBeNull());
  });
});
