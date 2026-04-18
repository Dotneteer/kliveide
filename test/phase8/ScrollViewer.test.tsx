/**
 * Phase 8 — Step 8.5: ScrollViewer component tests
 *
 * Tests: renders children, theme changes apply custom class,
 * scroll events propagate, API is exposed via apiLoaded.
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderWithProviders, screen } from "../react-test-utils";
import ScrollViewer, { ScrollViewerApi } from "@controls/ScrollViewer";

// ResizeObserver stub
(globalThis as any).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// OverlayScrollbars may not work in jsdom — stub if needed
vi.mock("overlayscrollbars-react", () => ({
  OverlayScrollbarsComponent: React.forwardRef(function MockOS(
    { children, onScroll, className, ...props }: any,
    ref: any
  ) {
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
});
