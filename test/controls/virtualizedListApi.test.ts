import { describe, expect, it, vi } from "vitest";
import type { VirtualizerHandle } from "virtua";

import { toVirtualizedListApi } from "@renderer/controls/VirtualizedList";

/*
 * `virtua` has no `findStartIndex`. Three panels called it on the raw handle anyway, so every
 * scroll threw a `TypeError` inside their `onScroll` handler — which meant the index they record
 * there was never updated, and `onScrollEnd` then restored a stale one. Jumping to an address
 * scrolled and immediately snapped back.
 *
 * The adapter supplies it from the API `virtua` does have: `findItemIndex(scrollOffset)`.
 */

/** A fake handle whose scroll position can be moved, so the getter's liveness is observable. */
function aHandle(overrides: Partial<VirtualizerHandle> = {}) {
  let offset = 0;
  const handle = {
    findItemIndex: vi.fn((at: number) => Math.floor(at / 20)),
    get scrollOffset() {
      return offset;
    },
    scrollToIndex: vi.fn(),
    ...overrides
  } as unknown as VirtualizerHandle;
  return { handle, scrollTo: (value: number) => (offset = value) };
}

describe("toVirtualizedListApi", () => {
  it("answers findStartIndex from the item at the current scroll offset", () => {
    const { handle, scrollTo } = aHandle();
    scrollTo(120);

    const api = toVirtualizedListApi(handle);

    expect(api.findStartIndex()).toBe(6);
    expect(handle.findItemIndex).toHaveBeenCalledWith(120);
  });

  it("keeps reading the live scroll offset rather than the one it was wrapped at", () => {
    // --- The reason for the prototype-based wrap: a spread would have snapshotted `scrollOffset`
    // --- at mount, and `apiLoaded` fires once per list.
    const { handle, scrollTo } = aHandle();
    const api = toVirtualizedListApi(handle);

    expect(api.findStartIndex()).toBe(0);
    scrollTo(400);
    expect(api.findStartIndex()).toBe(20);
  });

  it("passes the handle's own methods through", () => {
    const { handle } = aHandle();
    const api = toVirtualizedListApi(handle);

    api.scrollToIndex(7, { align: "start" });

    expect(handle.scrollToIndex).toHaveBeenCalledWith(7, { align: "start" });
  });

  it("does not throw where the raw handle would", () => {
    // --- The regression itself: `findStartIndex` is not a function on what `virtua` returns.
    const { handle } = aHandle();

    expect(() => (handle as any).findStartIndex()).toThrow(TypeError);
    expect(() => toVirtualizedListApi(handle).findStartIndex()).not.toThrow();
  });
});
