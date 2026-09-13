import { describe, it, expect } from "vitest";
import React from "react";
import { screen } from "@testing-library/react";
import { createMockStore, renderWithProviders, act } from "../react-test-utils";
import { addWatchAction, removeWatchAction } from "@state/actions";
import type { WatchInfo } from "@state/AppState";

import { WatchBadge } from "@renderer/appIde/SiteBarPanels/WatchBadge";

const watch = (symbol: string): WatchInfo => ({ symbol, type: "b" });

/**
 * The Watch panel's header badge.
 *
 * Watch expressions are renderer state, so unlike `BreakpointsBadge` there is no fetch and no
 * refresh contract to pin — what matters here is that the badge tracks the store live and that the
 * empty case stays empty.
 */
describe("WatchBadge", () => {
  const render = (store = createMockStore()) => ({
    ...renderWithProviders(<WatchBadge panelId="watchPanel" expanded />, { store }),
    store
  });

  it("shows nothing when no watches are defined", () => {
    const { container } = render();
    expect(container.textContent).toBe("");
  });

  it("shows the number of watch expressions", () => {
    const store = createMockStore();
    store.dispatch(addWatchAction(watch("SCORE")));
    store.dispatch(addWatchAction(watch("LIVES")));
    render(store);
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByTitle("2 watch expressions")).toBeTruthy();
  });

  it("says 'expression', not 'expressions', for one", () => {
    const store = createMockStore();
    store.dispatch(addWatchAction(watch("SCORE")));
    render(store);
    expect(screen.getByTitle("1 watch expression")).toBeTruthy();
  });

  it("follows the store as watches are added and removed", () => {
    const { store } = render();
    expect(screen.queryByText("1")).toBeNull();

    act(() => {
      store.dispatch(addWatchAction(watch("SCORE")));
    });
    expect(screen.getByText("1")).toBeTruthy();

    act(() => {
      store.dispatch(addWatchAction(watch("LIVES")));
    });
    expect(screen.getByText("2")).toBeTruthy();

    act(() => {
      store.dispatch(removeWatchAction("LIVES"));
    });
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("goes back to showing nothing when the last watch is removed", () => {
    const store = createMockStore();
    store.dispatch(addWatchAction(watch("SCORE")));
    const { container } = render(store);
    expect(screen.getByText("1")).toBeTruthy();

    act(() => {
      store.dispatch(removeWatchAction("SCORE"));
    });
    expect(container.textContent).toBe("");
  });
});
