import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import {
  ToolbarGroup,
  ToolbarOverflowButton,
  ToolbarOverflowProvider
} from "@renderer/controls/ToolbarOverflow";

/*
 * The More menu belongs to the More button. The button component stays mounted while every group
 * fits (it renders nothing then), so an open menu used to survive the window getting wider and
 * reappear at the next overflow, anchored to the old, detached button - at the window's left edge.
 *
 * jsdom has no layout, so the strip's geometry is stubbed: the strip is `stripWidth` wide, a group
 * is 100px, the More button 30px, and a ResizeObserver stub lets the test say "the window resized".
 */

vi.mock("@renderer/controls/overlay/useOverlayRoot", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getOverlayRoot: () => document.body
}));

vi.mock("react-popper", () => ({
  usePopper: () => ({ styles: { popper: {} }, attributes: { popper: {} } })
}));

vi.mock("@renderer/controls/Icon", () => ({
  Icon: ({ iconName }: { iconName: string }) => <span data-testid={`icon-${iconName}`} />
}));

let stripWidth = 0;
const resizeCallbacks: (() => void)[] = [];

const rect = (width: number) =>
  ({ left: 0, top: 0, right: width, bottom: 20, width, height: 20, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

beforeEach(() => {
  stripWidth = 0;
  resizeCallbacks.length = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resizeCallbacks.push(() => callback());
      }
      observe() {}
      disconnect() {}
    }
  );
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const el = this as HTMLElement;
    if (el.dataset.testStrip !== undefined) return rect(stripWidth);
    if (el.dataset.toolbarGroup !== undefined) return rect(100);
    if (el.hasAttribute("data-toolbar-more")) return rect(30);
    return rect(0);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const Strip = () => {
  const stripRef = useRef<HTMLDivElement>(null);
  return (
    <ToolbarOverflowProvider stripRef={stripRef}>
      <div ref={stripRef} data-test-strip="">
        <ToolbarGroup id="tape" priority={10} overflowItems={[{ id: "rewind", text: "Rewind", clicked: () => {} }]}>
          <button type="button">tape</button>
        </ToolbarGroup>
        <ToolbarOverflowButton />
      </div>
    </ToolbarOverflowProvider>
  );
};

/** The window changes width: the strip reports its new size */
async function resizeTo(width: number) {
  stripWidth = width;
  await act(async () => {
    resizeCallbacks.forEach((cb) => cb());
  });
}

describe("the toolbar's More menu", () => {
  it("closes when the window gets wide enough, and stays closed at the next overflow", async () => {
    stripWidth = 50;
    render(<Strip />);
    await resizeTo(50);

    // --- Too narrow: the group is out and More opens its menu
    const more = () => screen.queryByLabelText("More");
    expect(more()).not.toBeNull();
    fireEvent.click(more()!);
    expect(screen.getByRole("menuitem", { name: "Rewind" })).toBeTruthy();

    // --- Wide enough: the group is back, the button and its menu are gone
    await resizeTo(200);
    expect(more()).toBeNull();
    expect(screen.queryByRole("menuitem")).toBeNull();

    // --- Narrow again: only the button comes back, not the menu
    await resizeTo(50);
    expect(more()).not.toBeNull();
    expect(screen.queryByRole("menuitem")).toBeNull();
  });
});
