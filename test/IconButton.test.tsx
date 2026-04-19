import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderWithProviders, screen, fireEvent } from "./react-test-utils";
import { createMockStore } from "./react-test-utils";
import { emuLoadedAction } from "@state/actions";

/**
 * Smoke tests that verify renderWithProviders() and the mock store work correctly.
 * Full IconButton component tests will be added in Phase 4.
 */
describe("renderWithProviders + mock store", () => {
  it("renders children inside the provider tree", () => {
    renderWithProviders(<div data-testid="child">hello</div>);
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("createMockStore() returns a working store", () => {
    const store = createMockStore();
    expect(store.getState().emuLoaded).toBe(false);
    store.dispatch(emuLoadedAction(true));
    expect(store.getState().emuLoaded).toBe(true);
  });

  it("renderWithProviders passes store to children via context", () => {
    const store = createMockStore();
    store.dispatch(emuLoadedAction(true));

    // Verify the store instance is returned and has the dispatched state
    const { store: returnedStore } = renderWithProviders(<div />, { store });
    expect(returnedStore.getState().emuLoaded).toBe(true);
  });

  it("store subscriber is notified after dispatch inside rendered tree", () => {
    const store = createMockStore();
    const listener = vi.fn();
    store.subscribe(listener);

    renderWithProviders(<div />, { store });
    store.dispatch(emuLoadedAction(true));

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
