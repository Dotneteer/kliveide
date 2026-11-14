import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { FullScreenEdgeBar } from "@renderer/appEmu/fullScreen/FullScreenEdgeBar";
import { useFullScreenChrome } from "@renderer/appEmu/fullScreen/useFullScreenChrome";
import { HIDE_GRACE_MS, REVEAL_DWELL_MS } from "@renderer/appEmu/fullScreen/fullScreenChromeModel";

/*
 * The full screen mode's bars in the DOM (`dev/plans/EMU_FULL_SCREEN_MODE_PLAN.md` §2.3): the hook
 * fed by real mouse events, with a fake clock.
 */

function Harness({
  enabled,
  dialogOpen = false,
  topInset = 0
}: {
  enabled: boolean;
  dialogOpen?: boolean;
  topInset?: number;
}) {
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const { toolbarShown, statusBarShown } = useFullScreenChrome(enabled, top, bottom, dialogOpen, topInset);
  return (
    <>
      <FullScreenEdgeBar edge="top" active={enabled} shown={toolbarShown} inset={topInset} ref={top}>
        <button data-testid="tool">tool</button>
      </FullScreenEdgeBar>
      <FullScreenEdgeBar edge="bottom" active={enabled} shown={statusBarShown} ref={bottom}>
        <span>status</span>
      </FullScreenEdgeBar>
      <div id="overlayRoot" />
    </>
  );
}

const shown = (edge: "top" | "bottom") =>
  screen.getByTestId(`emu-full-screen-${edge}`).getAttribute("data-shown") === "true";

function moveTo(y: number, target: EventTarget = document.body) {
  act(() => {
    target.dispatchEvent(new MouseEvent("mousemove", { clientY: y, bubbles: true }));
  });
}

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("full screen chrome in the DOM", () => {
  it("slides the toolbar in at the top edge and out after the grace", () => {
    render(<Harness enabled />);
    expect(shown("top")).toBe(false);
    expect(screen.getByTestId("emu-full-screen-top").hasAttribute("inert")).toBe(true);

    moveTo(0);
    expect(shown("top")).toBe(false);
    wait(REVEAL_DWELL_MS + 5);
    expect(shown("top")).toBe(true);
    expect(screen.getByTestId("emu-full-screen-top").hasAttribute("inert")).toBe(false);

    // --- Over the bar: it stays
    moveTo(20, screen.getByTestId("tool"));
    wait(HIDE_GRACE_MS * 3);
    expect(shown("top")).toBe(true);

    // --- Off the bar: gone after the grace
    moveTo(400);
    wait(HIDE_GRACE_MS + 5);
    expect(shown("top")).toBe(false);
  });

  it("slides the status bar in at the bottom edge", () => {
    render(<Harness enabled />);
    moveTo(window.innerHeight - 1);
    wait(REVEAL_DWELL_MS + 5);
    expect(shown("bottom")).toBe(true);
    expect(shown("top")).toBe(false);
  });

  it("keeps a bar while one of its popup menus is open", async () => {
    render(<Harness enabled />);
    moveTo(0);
    wait(REVEAL_DWELL_MS + 5);

    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    await act(async () => {
      document.getElementById("overlayRoot")!.appendChild(menu);
    });
    moveTo(400);
    wait(HIDE_GRACE_MS * 3);
    expect(shown("top")).toBe(true);

    // --- The menu closes with the pointer at rest (the observer re-evaluates): the grace starts
    await act(async () => {
      menu.remove();
    });
    wait(HIDE_GRACE_MS + 5);
    expect(shown("top")).toBe(false);
  });

  it("keeps a bar while a dialog is open", () => {
    const { rerender } = render(<Harness enabled />);
    moveTo(0);
    wait(REVEAL_DWELL_MS + 5);
    rerender(<Harness enabled dialogOpen />);
    moveTo(400);
    wait(HIDE_GRACE_MS * 3);
    expect(shown("top")).toBe(true);
    rerender(<Harness enabled dialogOpen={false} />);
    wait(HIDE_GRACE_MS + 5);
    expect(shown("top")).toBe(false);
  });

  it("hides the bars when the pointer leaves the window", () => {
    render(<Harness enabled />);
    moveTo(0);
    wait(REVEAL_DWELL_MS + 5);
    act(() => {
      document.documentElement.dispatchEvent(new MouseEvent("mouseleave"));
    });
    expect(shown("top")).toBe(false);
  });

  it("reveals the toolbar under the macOS menu bar and keeps it while the pointer is on the menu bar", () => {
    render(<Harness enabled topInset={30} />);
    const bar = screen.getByTestId("emu-full-screen-top");
    expect(bar.style.getPropertyValue("--emu-full-screen-inset")).toBe("30px");

    moveTo(0);
    wait(REVEAL_DWELL_MS + 5);
    expect(shown("top")).toBe(true);

    // --- The menu bar covers the pointer: the page sees it leave through the top edge
    act(() => {
      document.documentElement.dispatchEvent(new MouseEvent("mouseleave"));
    });
    wait(HIDE_GRACE_MS * 3);
    expect(shown("top")).toBe(true);

    // --- Back in the page below the toolbar: the grace runs
    moveTo(400);
    wait(HIDE_GRACE_MS + 5);
    expect(shown("top")).toBe(false);
  });

  it("reveals nothing while the mode is off, and leaves the bars in the layout", () => {
    render(<Harness enabled={false} />);
    moveTo(0);
    wait(REVEAL_DWELL_MS * 3);
    expect(shown("top")).toBe(false);
    expect(screen.getByTestId("emu-full-screen-top").hasAttribute("inert")).toBe(false);
  });

  it("keeps the same bar element when the mode switches", () => {
    const { rerender } = render(<Harness enabled={false} />);
    const tool = screen.getByTestId("tool");
    rerender(<Harness enabled />);
    expect(screen.getByTestId("tool")).toBe(tool);
    rerender(<Harness enabled={false} />);
    expect(screen.getByTestId("tool")).toBe(tool);
  });
});
