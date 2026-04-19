import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderWithProviders, act } from "../react-test-utils";
import { AttachedShadow } from "@controls/AttachedShadow";

// ---------------------------------------------------------------------------
// jsdom does not include ResizeObserver — provide a mock
// ---------------------------------------------------------------------------

let observerInstances: MockResizeObserver[] = [];

class MockResizeObserver {
  callback: ResizeObserverCallback;
  observed: Element[] = [];
  disconnectSpy = vi.fn();
  observeSpy = vi.fn();
  unobserveSpy = vi.fn();

  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
    observerInstances.push(this);
  }
  observe(el: Element) {
    this.observeSpy(el);
    this.observed.push(el);
  }
  unobserve(el: Element) {
    this.unobserveSpy(el);
  }
  disconnect() {
    this.disconnectSpy();
  }
}

beforeEach(() => {
  observerInstances = [];
  (globalThis as any).ResizeObserver = MockResizeObserver;
});

afterEach(() => {
  delete (globalThis as any).ResizeObserver;
});

function makeElement(tag = "div"): HTMLElement {
  return document.createElement(tag);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AttachedShadow — Step 1.5: ResizeObserver cleanup", () => {
  it("creates a ResizeObserver and observes the parentElement", () => {
    const parent = makeElement();
    renderWithProviders(<AttachedShadow parentElement={parent} visible={true} />);

    expect(observerInstances).toHaveLength(1);
    expect(observerInstances[0].observeSpy).toHaveBeenCalledWith(parent);
  });

  it("calls disconnect() when the component unmounts", () => {
    const parent = makeElement();
    const { unmount } = renderWithProviders(
      <AttachedShadow parentElement={parent} visible={true} />
    );

    const observer = observerInstances[0];
    unmount();

    expect(observer.disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it("calls disconnect() on the old observer when parentElement changes", async () => {
    const parent1 = makeElement();
    const parent2 = makeElement();

    const { rerender } = renderWithProviders(
      <AttachedShadow parentElement={parent1} visible={true} />
    );
    const firstObserver = observerInstances[0];

    await act(async () => {
      rerender(<AttachedShadow parentElement={parent2} visible={true} />);
    });

    // First observer must have been disconnected before the new one was created
    expect(firstObserver.disconnectSpy).toHaveBeenCalledTimes(1);
    // A second observer is now active on parent2
    expect(observerInstances).toHaveLength(2);
    expect(observerInstances[1].observeSpy).toHaveBeenCalledWith(parent2);
  });
});
