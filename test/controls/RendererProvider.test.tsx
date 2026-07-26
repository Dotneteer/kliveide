/**
 * Phase 2 — useSelector (2.1) and useDispatch (2.2) tests
 */

import { describe, it, expect, vi } from "vitest";
import React, { useRef, act } from "react";
import { render } from "@testing-library/react";
import { renderWithProviders, createMockStore } from "../react-test-utils";
import {
  useGlobalSetting,
  useSelector,
  useDispatch
} from "@renderer/core/RendererProvider";
import RendererProvider from "@renderer/core/RendererProvider";
import ThemeProvider from "@renderer/theming/ThemeProvider";
import { MockMessenger } from "../react-test-utils";
import {
  emuLoadedAction,
  dimMenuAction,
  setThemeAction,
  setGlobalSettingAction
} from "@state/actions";
import { SETTING_IDE_SHOW_TOOLBAR } from "@common/settings/setting-const";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Renders children inside the full provider tree with a fresh store. */
function renderInProviders(ui: React.ReactElement) {
  const store = createMockStore();
  const messenger = new MockMessenger();
  const { rerender, ...rest } = render(
    <RendererProvider store={store} messenger={messenger} messageSource="ide">
      <ThemeProvider>{ui}</ThemeProvider>
    </RendererProvider>
  );
  return {
    store,
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
// Step 2.1 — useSelector: shallowEqual prevents spurious re-renders
// ---------------------------------------------------------------------------

describe("useSelector — Step 2.1: shallowEqual gating", () => {
  it("returns the current mapped value on initial render", () => {
    let selected: boolean | undefined;

    function Subject() {
      selected = useSelector(s => s.emuLoaded);
      return null;
    }

    const { store } = renderInProviders(<Subject />);
    expect(selected).toBe(store.getState().emuLoaded);
  });

  it("re-renders when the selected slice changes", async () => {
    let renderCount = 0;

    function Subject() {
      renderCount++;
      useSelector(s => s.emuLoaded);
      return null;
    }

    const { store } = renderInProviders(<Subject />);
    const countBefore = renderCount;

    await act(async () => {
      store.dispatch(emuLoadedAction(), "ide");
    });

    expect(renderCount).toBeGreaterThan(countBefore);
    expect(store.getState().emuLoaded).toBe(true);
  });

  it("does NOT re-render when an unrelated slice changes", async () => {
    let renderCount = 0;

    function Subject() {
      renderCount++;
      useSelector(s => s.emuLoaded);
      return null;
    }

    const { store } = renderInProviders(<Subject />);
    const countBefore = renderCount;

    // Dispatch an action that doesn't affect emuLoaded
    await act(async () => {
      store.dispatch(dimMenuAction(true), "ide");
    });

    expect(renderCount).toBe(countBefore);
  });

  it("does NOT re-render when an object slice is re-dispatched with the same values", async () => {
    let renderCount = 0;

    function Subject() {
      renderCount++;
      // emulatorState is an object — shallowEqual should suppress re-render
      // when nothing inside it changed
      useSelector(s => ({ emuLoaded: s.emuLoaded, dimMenu: s.dimMenu }));
      return null;
    }

    const { store } = renderInProviders(<Subject />);
    const countBefore = renderCount;

    // Dispatch an action that doesn't touch emuLoaded or dimMenu
    await act(async () => {
      store.dispatch(setThemeAction("dark"), "ide");
    });

    expect(renderCount).toBe(countBefore);
  });

  it("uses the latest selector when selector props change", async () => {
    function Subject({ field }: { field: "emuLoaded" | "dimMenu" }) {
      const selected = useSelector(s => s[field]);
      return <span>{String(selected)}</span>;
    }

    const store = createMockStore();
    store.dispatch(dimMenuAction(true), "ide");

    const messenger = new MockMessenger();
    const { rerender, getByText } = render(
      <RendererProvider store={store} messenger={messenger} messageSource="ide">
        <ThemeProvider>
          <Subject field="emuLoaded" />
        </ThemeProvider>
      </RendererProvider>
    );

    expect(getByText("false")).toBeTruthy();

    rerender(
      <RendererProvider store={store} messenger={messenger} messageSource="ide">
        <ThemeProvider>
          <Subject field="dimMenu" />
        </ThemeProvider>
      </RendererProvider>
    );

    expect(getByText("true")).toBeTruthy();
  });

  it("unsubscribes from the store on unmount", () => {
    function Subject() {
      useSelector(s => s.emuLoaded);
      return null;
    }

    const store = createMockStore();
    const originalSubscribe = store.subscribe.bind(store);
    const unsubscribeSpy = vi.fn();
    const subscribeSpy = vi.spyOn(store, "subscribe").mockImplementation(listener => {
      const unsubscribe = originalSubscribe(listener);
      return () => {
        unsubscribeSpy();
        unsubscribe();
      };
    });

    const messenger = new MockMessenger();
    const { unmount } = render(
      <RendererProvider store={store} messenger={messenger} messageSource="ide">
        <Subject />
      </RendererProvider>
    );
    unmount();

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
  });

  it("throws a clear error when used outside RendererProvider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    function Subject() {
      useSelector(s => s.emuLoaded);
      return null;
    }

    expect(() => render(<Subject />)).toThrow(/RendererProvider/);
    consoleError.mockRestore();
  });
});

describe("useGlobalSetting — Step 2.1: selector-backed settings", () => {
  it("returns defaults and updates when settings change", async () => {
    function Subject() {
      const showToolbar = useGlobalSetting(SETTING_IDE_SHOW_TOOLBAR);
      return <span>{String(showToolbar)}</span>;
    }

    const { store, getByText } = renderInProviders(<Subject />);
    expect(getByText("true")).toBeTruthy();

    await act(async () => {
      store.dispatch(setGlobalSettingAction(SETTING_IDE_SHOW_TOOLBAR, false), "ide");
    });

    expect(getByText("false")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Step 2.2 — useDispatch: stable reference across re-renders
// ---------------------------------------------------------------------------

describe("useDispatch — Step 2.2: referential stability", () => {
  it("returns the same dispatcher function across re-renders", async () => {
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
    await act(async () => {
      rerender(<Subject count={3} />);
    });

    // All three renders should have received the same function reference
    expect(dispatchers[0]).toBe(dispatchers[1]);
    expect(dispatchers[1]).toBe(dispatchers[2]);
  });

  it("dispatches an action and updates the store", async () => {
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
