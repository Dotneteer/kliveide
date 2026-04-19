/**
 * Phase 8 — Step 8.2: useSelector hook tests
 *
 * Tests: initial value, updates on relevant dispatch, no update on irrelevant
 * dispatch, cleanup on unmount, shallowEqual on object slices,
 * useGlobalSetting reactivity.
 */

import { describe, it, expect, vi } from "vitest";
import React, { act } from "react";
import { render } from "@testing-library/react";
import { createMockStore, MockMessenger } from "../react-test-utils";
import { useSelector, useDispatch, useGlobalSetting } from "@renderer/core/RendererProvider";
import RendererProvider from "@renderer/core/RendererProvider";
import ThemeProvider from "@renderer/theming/ThemeProvider";
import {
  emuLoadedAction,
  dimMenuAction,
  setThemeAction,
  muteSoundAction
} from "@state/actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderInProviders(ui: React.ReactElement) {
  const store = createMockStore();
  const messenger = new MockMessenger();
  const { rerender, unmount, ...rest } = render(
    <RendererProvider store={store} messenger={messenger} messageSource="ide">
      <ThemeProvider>{ui}</ThemeProvider>
    </RendererProvider>
  );
  return {
    store,
    unmount,
    rerender: (next: React.ReactElement) =>
      rerender(
        <RendererProvider store={store} messenger={messenger} messageSource="ide">
          <ThemeProvider>{next}</ThemeProvider>
        </RendererProvider>
      ),
    ...rest
  };
}

// ---------------------------------------------------------------------------
// useSelector
// ---------------------------------------------------------------------------

describe("useSelector — Phase 8 comprehensive tests", () => {
  it("returns initial value from store", () => {
    let selected: boolean | undefined;

    function Subject() {
      selected = useSelector((s) => s.emuLoaded);
      return null;
    }

    renderInProviders(<Subject />);
    expect(selected).toBe(false);
  });

  it("updates when the selected slice changes", async () => {
    let selected: boolean | undefined;

    function Subject() {
      selected = useSelector((s) => s.emuLoaded);
      return null;
    }

    const { store } = renderInProviders(<Subject />);
    expect(selected).toBe(false);

    await act(async () => {
      store.dispatch(emuLoadedAction(), "ide");
    });

    expect(selected).toBe(true);
  });

  it("does NOT re-render on unrelated dispatch", async () => {
    let renderCount = 0;

    function Subject() {
      renderCount++;
      useSelector((s) => s.emuLoaded);
      return null;
    }

    const { store } = renderInProviders(<Subject />);
    const countBefore = renderCount;

    await act(async () => {
      store.dispatch(dimMenuAction(true), "ide");
    });

    expect(renderCount).toBe(countBefore);
  });

  it("suppresses re-render when shallowEqual object slice is unchanged", async () => {
    let renderCount = 0;

    function Subject() {
      renderCount++;
      useSelector((s) => ({ loaded: s.emuLoaded, dim: s.dimMenu }));
      return null;
    }

    const { store } = renderInProviders(<Subject />);
    const countBefore = renderCount;

    // Dispatch something that doesn't change emuLoaded or dimMenu
    await act(async () => {
      store.dispatch(setThemeAction("dark"), "ide");
    });

    expect(renderCount).toBe(countBefore);
  });

  it("re-renders when one key in an object slice changes", async () => {
    let renderCount = 0;
    let selected: { loaded: boolean; dim: boolean } | undefined;

    function Subject() {
      renderCount++;
      selected = useSelector((s) => ({ loaded: s.emuLoaded, dim: s.dimMenu }));
      return null;
    }

    const { store } = renderInProviders(<Subject />);
    const countBefore = renderCount;

    await act(async () => {
      store.dispatch(dimMenuAction(true), "ide");
    });

    expect(renderCount).toBeGreaterThan(countBefore);
    expect(selected?.dim).toBe(true);
  });

  it("unsubscribes on unmount — no setState after unmount", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    function Subject() {
      useSelector((s) => s.emuLoaded);
      return <div>hi</div>;
    }

    const { store, unmount } = renderInProviders(<Subject />);

    unmount();

    // Dispatch after unmount — should NOT cause "setState on unmounted component"
    await act(async () => {
      store.dispatch(emuLoadedAction(), "ide");
    });

    const reactErrors = consoleSpy.mock.calls.filter(
      (args) => typeof args[0] === "string" && args[0].includes("unmounted")
    );
    expect(reactErrors.length).toBe(0);
    consoleSpy.mockRestore();
  });

  it("handles primitive selector (number)", async () => {
    let selected: number | undefined;

    function Subject() {
      selected = useSelector((s) => s.emulatorState?.soundLevel ?? 0);
      return null;
    }

    renderInProviders(<Subject />);
    // Default soundLevel is 0.8 per initialAppState
    expect(selected).toBe(0.8);
  });
});

// ---------------------------------------------------------------------------
// useDispatch
// ---------------------------------------------------------------------------

describe("useDispatch — Phase 8 comprehensive tests", () => {
  it("returns a stable function reference across re-renders", async () => {
    const dispatchers: unknown[] = [];

    function Subject({ count }: { count: number }) {
      const dispatch = useDispatch();
      dispatchers.push(dispatch);
      return <span>{count}</span>;
    }

    const { rerender } = renderInProviders(<Subject count={1} />);

    await act(async () => {
      rerender(<Subject count={2} />);
    });

    expect(dispatchers[0]).toBe(dispatchers[1]);
  });

  it("dispatches an action that updates store state", async () => {
    let dispatch: ReturnType<typeof useDispatch> | null = null;

    function Subject() {
      dispatch = useDispatch();
      return null;
    }

    const { store } = renderInProviders(<Subject />);

    await act(async () => {
      dispatch!(emuLoadedAction());
    });

    expect(store.getState().emuLoaded).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// useGlobalSetting
// ---------------------------------------------------------------------------

describe("useGlobalSetting — Phase 8 tests", () => {
  it("returns the default value when setting is not yet configured", () => {
    let value: any;

    function Subject() {
      value = useGlobalSetting("emu.stayOnTop");
      return null;
    }

    renderInProviders(<Subject />);
    // Default for stayOnTop is typically false/undefined
    expect(value === false || value === undefined || value === null).toBe(true);
  });

  it("returns null for an unknown setting ID", () => {
    let value: any;

    function Subject() {
      value = useGlobalSetting("nonexistent.setting.xyz");
      return null;
    }

    renderInProviders(<Subject />);
    expect(value).toBeNull();
  });
});
