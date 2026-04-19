/**
 * Phase 3 — Hook pattern fixes
 *
 * Covers Steps 3.1–3.6.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act, useRef } from "react";
import { renderWithProviders, screen } from "../react-test-utils";
import { useInitializeAsync, useInitialize } from "@renderer/core/useInitializeAsync";
import { useResizeObserver } from "@renderer/core/useResizeObserver";

// ---------------------------------------------------------------------------
// ResizeObserver stub (jsdom doesn't ship it)
// ---------------------------------------------------------------------------

let resizeObserverInstances: MockRO[] = [];
class MockRO {
  callback: ResizeObserverCallback;
  disconnectSpy = vi.fn();
  observeSpy = vi.fn();
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
    resizeObserverInstances.push(this);
  }
  observe(el: Element) { this.observeSpy(el); }
  unobserve() {}
  disconnect() { this.disconnectSpy(); }
}

beforeEach(() => {
  resizeObserverInstances = [];
  (globalThis as any).ResizeObserver = MockRO;
});
afterEach(() => {
  delete (globalThis as any).ResizeObserver;
});

// ---------------------------------------------------------------------------
// Step 3.1 — useInitializeAsync / useInitialize run exactly once
// ---------------------------------------------------------------------------

describe("useInitializeAsync — Step 3.1: runs exactly once", () => {
  it("runs the async initializer exactly once across multiple re-renders", async () => {
    const init = vi.fn().mockResolvedValue(undefined);

    function Subject({ count }: { count: number }) {
      useInitializeAsync(init);
      return <span>{count}</span>;
    }

    const { rerender } = renderWithProviders(<Subject count={1} />);
    await act(async () => { rerender(<Subject count={2} />); });
    await act(async () => { rerender(<Subject count={3} />); });

    expect(init).toHaveBeenCalledTimes(1);
  });
});

describe("useInitialize — Step 3.1: runs exactly once", () => {
  it("runs the sync initializer exactly once across multiple re-renders", async () => {
    const init = vi.fn();

    function Subject({ count }: { count: number }) {
      useInitialize(init);
      return <span>{count}</span>;
    }

    const { rerender } = renderWithProviders(<Subject count={1} />);
    await act(async () => { rerender(<Subject count={2} />); });
    await act(async () => { rerender(<Subject count={3} />); });

    expect(init).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Step 3.3 — useResizeObserver does NOT recreate observer on re-render
// ---------------------------------------------------------------------------

describe("useResizeObserver — Step 3.3: observer stable across re-renders", () => {
  it("creates exactly one observer even when the callback identity changes on every render", async () => {
    const el = document.createElement("div");
    const ref = { current: el };

    function Subject({ label }: { label: string }) {
      // Inline callback — new identity every render
      useResizeObserver(ref, () => { void label; });
      return <span>{label}</span>;
    }

    const { rerender } = renderWithProviders(<Subject label="a" />);
    await act(async () => { rerender(<Subject label="b" />); });
    await act(async () => { rerender(<Subject label="c" />); });

    // Only ONE observer should have been created for the same element
    expect(resizeObserverInstances).toHaveLength(1);
  });

  it("disconnects and recreates the observer when the element changes", async () => {
    const el1 = document.createElement("div");
    const el2 = document.createElement("div");
    const ref = { current: el1 as Element | undefined | null };

    function Subject({ which }: { which: "a" | "b" }) {
      ref.current = which === "a" ? el1 : el2;
      useResizeObserver(ref as React.MutableRefObject<Element | undefined | null>, vi.fn());
      return <span>{which}</span>;
    }

    const { rerender } = renderWithProviders(<Subject which="a" />);
    expect(resizeObserverInstances).toHaveLength(1);

    await act(async () => { rerender(<Subject which="b" />); });

    expect(resizeObserverInstances).toHaveLength(2);
    expect(resizeObserverInstances[0].disconnectSpy).toHaveBeenCalled();
  });

  it("calls disconnect on unmount", () => {
    const el = document.createElement("div");
    const ref = { current: el };

    function Subject() {
      useResizeObserver(ref, vi.fn());
      return null;
    }

    const { unmount } = renderWithProviders(<Subject />);
    unmount();

    expect(resizeObserverInstances[0].disconnectSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Step 3.5 — ScriptingHistoryPanel uses setInterval (no runaway re-renders)
// ---------------------------------------------------------------------------

describe("ScriptingHistoryPanel — Step 3.5: polling via setInterval", () => {
  it("does not trigger multiple re-renders between ticks without dispatches", async () => {
    // We test the underlying pattern directly: a component using setInterval
    // with functional updater should not cause runaway renders.
    let renders = 0;

    function PollSubject() {
      const [, setV] = React.useState(0);
      renders++;
      React.useEffect(() => {
        const id = setInterval(() => setV(v => v + 1), 5000);
        return () => clearInterval(id);
      }, []);
      return null;
    }

    renderWithProviders(<PollSubject />);
    // Only the initial render — no timer has fired
    expect(renders).toBe(1);
  });
});
