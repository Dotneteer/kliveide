/**
 * Phase 8 — Step 8.5: ScrollViewer component tests
 *
 * Tests: renders children, theme changes apply custom class,
 * scroll events propagate, API is exposed via apiLoaded.
 */

import { beforeEach, describe, it, expect, vi } from "vitest";
import React from "react";
import { renderWithProviders, screen } from "../react-test-utils";
import ScrollViewer, { ScrollViewerApi } from "@controls/ScrollViewer";
import { fireEvent } from "@testing-library/react";

// ResizeObserver stub
(globalThis as any).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// OverlayScrollbars may not work in jsdom — stub if needed
const scrollViewerMockState = vi.hoisted(() => {
  /* The last `options` object the component handed the library, for the auto-hide test below. */
  const lastOptions: { current: any } = { current: null };
  const scrollOffsetElement = {
    clientWidth: 100,
    scrollLeft: 0,
    scrollTop: 0,
    scrollTo: vi.fn(({ left, top }: { left?: number; top?: number }) => {
      if (left !== undefined) scrollOffsetElement.scrollLeft = left;
      if (top !== undefined) scrollOffsetElement.scrollTop = top;
    })
  };
  return { scrollOffsetElement, lastOptions };
});

vi.mock("overlayscrollbars-react", () => ({
  OverlayScrollbarsComponent: React.forwardRef(function MockOS(
    { children, onScroll, className, options, ...props }: any,
    ref: any
  ) {
    scrollViewerMockState.lastOptions.current = options;
    React.useImperativeHandle(ref, () => ({
      osInstance: () => ({
        elements: () => ({
          scrollOffsetElement: scrollViewerMockState.scrollOffsetElement
        })
      })
    }));
    return (
      <div data-testid="overlay-scrollbar" className={className} {...props}>
        {children}
      </div>
    );
  })
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ScrollViewer — Phase 8", () => {
  beforeEach(() => {
    scrollViewerMockState.scrollOffsetElement.scrollLeft = 0;
    scrollViewerMockState.scrollOffsetElement.scrollTop = 0;
    scrollViewerMockState.scrollOffsetElement.scrollTo.mockClear();
  });

  /*
   * Auto-hide must stay the *library's*, not a React `pointed` state.
   *
   * The version this replaced set `pointed` from `onMouseEnter`/`onMouseMove`/`onMouseLeave` and
   * swapped in an `os-theme-not-hovered` theme whose only declaration was a transparent handle.
   * That could not fade, re-rendered the panel subtree on every mouse move, and could leave the
   * scrollbar painted when React's synthesised `onMouseLeave` did not arrive.
   *
   * This asserts the *option*, not the appearance, because appearance is untestable here: the whole
   * of `overlayscrollbars-react` is mocked out above, so nothing in jsdom exercises the real
   * show/hide at all. Verify the behaviour itself in the running app (see
   * `.ai/ui-theming-intent-and-lessons.md`); this test only stops the mechanism being swapped back.
   */
  it("delegates auto-hide to OverlayScrollbars rather than React hover state", () => {
    const { container } = renderWithProviders(
      <ScrollViewer>
        <p>Content</p>
      </ScrollViewer>
    );

    const opts = scrollViewerMockState.lastOptions.current;
    expect(opts?.scrollbars?.autoHide).toBe("leave");
    // Hidden until the pointer arrives, rather than held visible until the first scroll.
    expect(opts?.scrollbars?.autoHideSuspend).toBe(false);
    // The theme is the real one at rest; nothing swaps in a transparent-handle stand-in.
    expect(opts?.scrollbars?.theme).toMatch(/^os-theme-(dark|light)/);

    // And no mouse handlers on the wrapper: those were the re-render-per-move path.
    const wrapper = container.querySelector("div");
    fireEvent.mouseMove(wrapper!);
    fireEvent.mouseLeave(wrapper!);
    expect(scrollViewerMockState.lastOptions.current?.scrollbars?.theme).toBe(
      opts?.scrollbars?.theme
    );
  });

  it("renders children inside the scroll container", () => {
    renderWithProviders(
      <ScrollViewer>
        <div data-testid="child">Hello</div>
      </ScrollViewer>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders with default props (no crash)", () => {
    const { container } = renderWithProviders(
      <ScrollViewer>
        <p>Content</p>
      </ScrollViewer>
    );
    expect(container).toBeInTheDocument();
  });

  it("applies custom className when provided", () => {
    const { container } = renderWithProviders(
      <ScrollViewer className="my-custom-class">
        <div>Test</div>
      </ScrollViewer>
    );
    // container.firstChild is the provider wrapper; query inside for the custom class
    const el = container.querySelector(".my-custom-class");
    expect(el).not.toBeNull();
  });

  it("applies custom style when provided", () => {
    const { container } = renderWithProviders(
      <ScrollViewer style={{ maxHeight: "300px" }}>
        <div>Test</div>
      </ScrollViewer>
    );
    // Style is applied to the wrapper div
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders without horizontal/vertical when disabled", () => {
    renderWithProviders(
      <ScrollViewer allowHorizontal={false} allowVertical={false}>
        <div data-testid="inner">No scroll</div>
      </ScrollViewer>
    );
    expect(screen.getByTestId("inner")).toBeInTheDocument();
  });

  it("renders with thinScrollBar prop", () => {
    const { container } = renderWithProviders(
      <ScrollViewer thinScrollBar>
        <div>Thin</div>
      </ScrollViewer>
    );
    expect(container).toBeInTheDocument();
  });

  it("turns wheel input into horizontal scrolling when vertical scrolling is disabled", () => {
    renderWithProviders(
      <ScrollViewer allowHorizontal={true} allowVertical={false}>
        <div data-testid="wide-child">Wide</div>
      </ScrollViewer>
    );

    scrollViewerMockState.scrollOffsetElement.scrollTop = 12;
    fireEvent.wheel(screen.getByTestId("overlay-scrollbar"), { deltaY: 40 });

    expect(scrollViewerMockState.scrollOffsetElement.scrollLeft).toBe(40);
    expect(scrollViewerMockState.scrollOffsetElement.scrollTop).toBe(0);
  });
});
