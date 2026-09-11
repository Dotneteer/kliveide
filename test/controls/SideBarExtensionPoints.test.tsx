import { describe, it, expect, vi } from "vitest";
import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../react-test-utils";

import { SideBarHeader } from "@renderer/appIde/SideBar/SideBarHeader";
import { SideBarBadge } from "@renderer/appIde/SideBar/SideBarBadge";
import { ContextMenuItem } from "@controls/ContextMenu";
import type { Activity, SideBarCommandsProps } from "@renderer/abstractions/Activity";
import type { SideBarPanelBadgeProps } from "@renderer/abstractions/SideBarPanelInfo";

/**
 * The two sidebar extension points.
 *
 * Both are deliberately unused today — no activity defines `commands`, no panel defines `badge` —
 * which is exactly why they need tests. Infrastructure with no call sites has nothing else holding
 * it to its contract: a break would stay invisible until the first real menu or badge was written,
 * and would then look like a bug in *that* feature rather than in the slot it plugged into.
 */

const PLAIN: Activity = { id: "debug-view", title: "Debug", iconName: "debug" };

describe("sidebar header commands menu", () => {
  it("renders no button when the activity defines no commands", () => {
    // The whole point of the opt-in: today's activities must look untouched.
    renderWithProviders(<SideBarHeader activity={PLAIN} />);
    expect(screen.getByText("Debug")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders no button when there is no activity at all", () => {
    // The sidebar renders before an activity resolves; `activity?.commands` must not throw.
    renderWithProviders(<SideBarHeader />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders a button, and opens the activity's commands, when they are defined", () => {
    const chosen = vi.fn();
    const Commands = ({ close }: SideBarCommandsProps) => (
      <ContextMenuItem
        text="Remove all breakpoints"
        clicked={() => {
          close();
          chosen();
        }}
      />
    );
    renderWithProviders(<SideBarHeader activity={{ ...PLAIN, commands: Commands }} />);

    // Closed to begin with: the menu is not merely hidden, it is not mounted.
    expect(screen.queryByText("Remove all breakpoints")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Debug actions" }));
    const item = screen.getByRole("menuitem", { name: /Remove all breakpoints/ });
    expect(item).toBeTruthy();

    fireEvent.click(item);
    expect(chosen).toHaveBeenCalledTimes(1);
    // `close` was called by the command, so the menu unmounts again.
    expect(screen.queryByText("Remove all breakpoints")).toBeNull();
  });

  it("does not mount the command component until the menu is opened", () => {
    // Command components subscribe to the store. Mounting them eagerly would re-render the sidebar
    // header on every machine tick, for a menu nobody has opened.
    const render = vi.fn();
    const Commands = (_: SideBarCommandsProps) => {
      render();
      return <ContextMenuItem text="Anything" />;
    };
    renderWithProviders(<SideBarHeader activity={{ ...PLAIN, commands: Commands }} />);
    expect(render).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Debug actions" }));
    expect(render).toHaveBeenCalled();
  });
});

describe("SideBarBadge", () => {
  it("renders nothing for an empty count", () => {
    // A badge reading "0" draws the eye to a panel exactly when it has nothing in it.
    for (const count of [0, -1, undefined, NaN]) {
      const { container, unmount } = renderWithProviders(<SideBarBadge count={count} />);
      expect(container.textContent, `count=${count}`).toBe("");
      unmount();
    }
  });

  it("renders a positive count", () => {
    renderWithProviders(<SideBarBadge count={5} title="5 breakpoints" />);
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByTitle("5 breakpoints")).toBeTruthy();
  });

  it("renders non-numeric content, and lets children win over count", () => {
    const { container } = renderWithProviders(<SideBarBadge count={0}>muted</SideBarBadge>);
    expect(container.textContent).toBe("muted");
  });

  it("applies a distinct class per tone", () => {
    const classFor = (tone: any) => {
      // Query the badge itself. `container.firstElementChild` is ThemeProvider's `#themeRoot`
      // wrapper, which is identical for every tone and would make this assertion vacuous.
      const { unmount } = renderWithProviders(<SideBarBadge count={1} tone={tone} />);
      const cls = screen.getByText("1").className;
      unmount();
      return cls;
    };
    const tones = ["neutral", "accent", "warning", "error"].map(classFor);
    // Four tones must not collapse onto one styling hook.
    expect(new Set(tones).size).toBe(4);
  });
});

describe("panel header badge slot", () => {
  it("is typed to receive the panel id and expansion state", () => {
    // Compile-time contract, asserted at runtime so a prop rename cannot pass silently.
    const seen: SideBarPanelBadgeProps[] = [];
    const Badge = (props: SideBarPanelBadgeProps) => {
      seen.push(props);
      return <SideBarBadge count={3} />;
    };
    renderWithProviders(<Badge panelId="breakpoints" expanded={false} />);
    expect(seen).toEqual([{ panelId: "breakpoints", expanded: false }]);
    expect(screen.getByText("3")).toBeTruthy();
  });
});
