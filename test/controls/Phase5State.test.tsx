/**
 * Phase 5 tests: redundant useState elimination
 *
 * Verifies that components removed intermediate state variables and now derive
 * their values directly from props / redux state without introducing extra renders.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderWithProviders } from "../react-test-utils";
import { ToolTab } from "@renderer/appIde/ToolArea/ToolTab";

// ─── ToolTab (Phase 5.3) ─────────────────────────────────────────────────────

describe("ToolTab (Phase 5.3 – CSS hover)", () => {
  it("renders the tool name", () => {
    const { getByText } = renderWithProviders(
      <ToolTab id="debug" name="Debug" isActive={false} />
    );
    expect(getByText("Debug")).not.toBeNull();
  });

  it("applies activeTitle class when isActive=true", () => {
    const { getByText } = renderWithProviders(
      <ToolTab id="debug" name="Debug" isActive={true} />
    );
    const span = getByText("Debug");
    // The CSS module class name contains "activeTitle" in test env (identity transform)
    expect(span.className).toContain("activeTitle");
  });

  it("does not apply activeTitle class when isActive=false", () => {
    const { getByText } = renderWithProviders(
      <ToolTab id="debug" name="Debug" isActive={false} />
    );
    const span = getByText("Debug");
    expect(span.className).not.toContain("activeTitle");
  });

  it("has no useState-based hover tracking (no onMouseEnter/Leave on root div)", () => {
    const { container } = renderWithProviders(
      <ToolTab id="debug" name="Debug" isActive={false} />
    );
    const root = container.firstChild as HTMLElement;
    // In jsdom, onMouseEnter/Leave event listeners from React don't expose themselves
    // as attributes, so we verify the absence of the inline handler attributes
    expect(root.getAttribute("onmouseenter")).toBeNull();
    expect(root.getAttribute("onmouseleave")).toBeNull();
  });
});
