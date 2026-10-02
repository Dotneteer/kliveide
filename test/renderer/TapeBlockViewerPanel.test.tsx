import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * A tape block popped out as a BASIC listing or a screen (`.plans/TAPE_VIEWER_PLAN.md` §4.5).
 */

const FLOAT_SPY = new Uint8Array(readFileSync(join(__dirname, "../testfiles/floatspy.tap")));
// --- Block 1's payload: the flag and checksum stripped; the program is its first 5,476 bytes
const PROGRAM = FLOAT_SPY.subarray(2 + 19 + 2 + 1, 2 + 19 + 2 + 1 + 5476);

beforeEach(() => {
  Object.defineProperty(document, "queryCommandSupported", {
    configurable: true,
    value: vi.fn(() => false)
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderPanel(contents: Uint8Array, viewState: Record<string, unknown>) {
  const setDocumentViewState = vi.fn();
  const writeText = vi.fn(async () => undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  vi.doMock("@renderer/appIde/services/DocumentServiceProvider", () => ({
    useDocumentHubService: () => ({ setDocumentViewState })
  }));
  vi.doMock("@renderer/core/RendererProvider", () => ({
    useDispatch: () => vi.fn(),
    useSelector: (selector: (state: any) => any) => selector({ theme: "dark" })
  }));
  vi.doMock("@renderer/theming/ThemeProvider", () => ({
    useTheme: () => ({
      theme: { tone: "dark" },
      getIcon: () => ({ width: 16, height: 16, path: "" }),
      getThemeProperty: () => "currentColor"
    }),
    default: ({ children }: { children: ReactNode }) => <>{children}</>
  }));
  vi.doMock("@renderer/controls/Icon", () => ({
    Icon: ({ iconName }: { iconName: string }) => <span data-testid={`icon-${iconName}`} />
  }));
  vi.doMock("@renderer/controls/Next/ScreenCanvas", () => ({
    ScreenCanvas: () => <div data-testid="screen-canvas" />
  }));
  const { createTapeBlockViewerPanel } =
    await import("@renderer/appIde/DocumentPanels/Tape/TapeBlockViewerPanel");
  render(
    createTapeBlockViewerPanel({
      document: {
        id: "tapeBlock-basic/p/a.tap:1",
        name: "a.tap - Block #1",
        type: "TapeBlockViewer"
      },
      contents,
      viewState
    } as any)
  );
  return { setDocumentViewState, writeText };
}

describe("TapeBlockViewerPanel", () => {
  it("lists the program and copies it as text", async () => {
    const { writeText } = await renderPanel(PROGRAM, {
      view: "basic",
      basicEnd: 5476,
      autostart: 9996
    });
    expect(screen.getByText("95 lines · autostart LINE 9996")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy to clipboard" }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const text = (writeText.mock.calls[0] as unknown as [string])[0];
    expect(text).toContain("10 BORDER 1: PAPER 1: INK 9: CLEAR 49151");
  });

  it("remembers its display options", async () => {
    const { setDocumentViewState } = await renderPanel(PROGRAM, { view: "basic", basicEnd: 5476 });
    expect(setDocumentViewState).toHaveBeenCalledWith(
      "tapeBlock-basic/p/a.tap:1",
      expect.objectContaining({ showCodes: false, showSpectrumFont: true })
    );
  });

  it("draws a screen, and explains a block too short to be one", async () => {
    await renderPanel(new Uint8Array(6912), { view: "screen" });
    expect(screen.getByTestId("screen-canvas")).toBeInTheDocument();
    cleanup();
    vi.resetModules();
    await renderPanel(new Uint8Array(100), { view: "screen" });
    expect(screen.getByText(/A screen is 6,912 bytes; this block holds 100/)).toBeInTheDocument();
  });
});
