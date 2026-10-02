import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The `.tap`/`.tzx` viewer (`.plans/TAPE_VIEWER_PLAN.md` §4.4-4.5): the summary, the block browser
 * with its timeline, the BASIC preview, and the pop-outs. The model is tested without a DOM in
 * `test/renderer/tape/tapeView.test.ts`.
 */

const FLOAT_SPY = new Uint8Array(readFileSync(join(__dirname, "../testfiles/floatspy.tap")));

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

async function renderViewer(contents: Uint8Array, viewState: Record<string, unknown> = {}) {
  const openDocument = vi.fn(() => Promise.resolve());
  const setDocumentViewState = vi.fn();
  const recordJump = vi.fn(async (_reason: string, jump: () => unknown) => await jump());

  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({
      projectService: { getDocumentForProjectNode: vi.fn(() => Promise.resolve({})) },
      navigationHistoryService: { recordJump },
      machineService: { getMachineInfo: () => undefined }
    })
  }));
  vi.doMock("@renderer/appIde/services/DocumentServiceProvider", () => ({
    useDocumentHubService: () => ({
      setDocumentViewState,
      getDocument: vi.fn(() => undefined),
      getDocumentViewState: vi.fn(() => ({})),
      getDocumentApi: vi.fn(() => undefined),
      isOpen: vi.fn(() => false),
      setActiveDocument: vi.fn(),
      openDocument
    })
  }));
  vi.doMock("@renderer/core/RendererProvider", () => ({
    useDispatch: () => vi.fn(),
    useRendererContext: () => ({
      store: { getState: () => ({}), dispatch: vi.fn() },
      messenger: {}
    }),
    useSelector: (selector: (state: any) => any) =>
      selector({ theme: "dark", isWindows: false, project: { folderPath: "/project" } })
  }));
  vi.doMock("@renderer/theming/ThemeProvider", () => ({
    useTheme: () => ({
      theme: { tone: "dark" },
      getIcon: () => ({ width: 16, height: 16, path: "" }),
      getImage: () => ({ type: "png", data: "" }),
      getThemeProperty: () => "currentColor"
    }),
    default: ({ children }: { children: ReactNode }) => <>{children}</>
  }));
  vi.doMock("@renderer/controls/Icon", () => ({
    Icon: ({ iconName }: { iconName: string }) => <span data-testid={`icon-${iconName}`} />
  }));
  vi.doMock("@renderer/controls/layout/Panel", () => ({
    Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>
  }));
  // --- jsdom has no 2D canvas
  vi.doMock("@renderer/controls/Next/ScreenCanvas", () => ({
    ScreenCanvas: () => <div data-testid="screen-canvas" />
  }));

  const { createTapeViewerPanel } =
    await import("@renderer/appIde/DocumentPanels/Tape/TapeViewerPanel");
  render(
    createTapeViewerPanel({
      document: {
        id: "/project/floatspy.tap",
        name: "floatspy.tap",
        type: "TapViewer",
        path: "/project/floatspy.tap",
        node: {
          isFolder: false,
          name: "floatspy.tap",
          fullPath: "/project/floatspy.tap",
          projectPath: "floatspy.tap"
        }
      },
      contents,
      viewState
    } as any)
  );
  return { openDocument, setDocumentViewState, recordJump };
}

describe("TapeViewerPanel", () => {
  it("summarises the tape", async () => {
    await renderViewer(FLOAT_SPY);
    const summary = await screen.findByLabelText("Tape summary");
    expect(within(summary).getByText("TAP")).toBeInTheDocument();
    expect(within(summary).getByText("2 (1 basic program, 1 code)")).toBeInTheDocument();
  });

  it("lists every block, grouped by file, numbered #n", async () => {
    await renderViewer(FLOAT_SPY);
    const list = await screen.findByRole("listbox", { name: "Block list" });
    expect(within(list).getAllByRole("option")).toHaveLength(4);
    expect(within(list).getByText('Program "Float Spy"')).toBeInTheDocument();
    expect(within(list).getByText('Bytes "float.cde"')).toBeInTheDocument();
    expect(within(list).getByText("LINE 9996")).toBeInTheDocument();
    expect(within(list).getByText("$7FFC")).toBeInTheDocument();
  });

  it("previews a BASIC block's listing", async () => {
    await renderViewer(FLOAT_SPY, { selectedBlock: 1 });
    const preview = await screen.findByTestId("tape-basic-preview");
    expect(preview.textContent).toContain("BORDER");
    expect(screen.getByText(/more lines · pop out the listing/)).toBeInTheDocument();
  });

  it("shows a header's facts and offers no pop-out for it", async () => {
    await renderViewer(FLOAT_SPY, { selectedBlock: 0 });
    const details = await screen.findByRole("complementary", { name: "#0 details" });
    expect(within(details).getByText('"Float Spy"')).toBeInTheDocument();
    expect(within(details).getByText("LINE 9996")).toBeInTheDocument();
    expect(within(details).queryByRole("button", { name: /^Pop out in/ })).toBeNull();
  });

  it("pops a code block out as a disassembly at its load address", async () => {
    const { openDocument, recordJump } = await renderViewer(FLOAT_SPY, { selectedBlock: 3 });
    fireEvent.click(await screen.findByRole("button", { name: "Pop out Block #3" }));
    await waitFor(() => expect(openDocument).toHaveBeenCalled());
    expect(recordJump).toHaveBeenCalledWith("tapeBlock", expect.any(Function));
    const [doc, state] = openDocument.mock.calls[0] as unknown as [any, any];
    expect(doc.id).toBe("memoryDump-tapeBlockDump/project/floatspy.tap:3");
    expect(doc.name).toBe("floatspy.tap - Block #3");
    expect(doc.contents).toHaveLength(256);
    expect(state.disassOffset).toBe(32764);
    expect(state.viewMode).toBe("disassembly");
  });

  it("pops a BASIC block out as a listing", async () => {
    const { openDocument } = await renderViewer(FLOAT_SPY, { selectedBlock: 1 });
    fireEvent.click(await screen.findByRole("button", { name: "Pop out Block #1" }));
    await waitFor(() => expect(openDocument).toHaveBeenCalled());
    const [doc, state] = openDocument.mock.calls[0] as unknown as [any, any];
    expect(doc.type).toBe("TapeBlockViewer");
    expect(doc.id).toBe("tapeBlock-basic/project/floatspy.tap:1");
    expect(state).toMatchObject({ view: "basic", basicEnd: 5476, autostart: 9996 });
  });

  it("marks the selected block on the timeline, and selects from it", async () => {
    // --- jsdom has no layout: give the strip a width so it draws its segments
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (
      this: HTMLElement
    ) {
      return this.dataset.testid === "tape-timeline" ? 400 : 0;
    });
    const { setDocumentViewState } = await renderViewer(FLOAT_SPY, { selectedBlock: 1 });
    const timeline = await screen.findByTestId("tape-timeline");
    expect(timeline.getAttribute("aria-hidden")).toBe("true");
    const segments = timeline.querySelectorAll<HTMLElement>("[data-first]");
    expect(segments).toHaveLength(4);
    const ring = within(timeline).getByTestId("tape-timeline-selection");
    expect(ring.style.left).toBe(segments[1].style.left);

    fireEvent.click(segments[3]);
    await waitFor(() =>
      expect(setDocumentViewState).toHaveBeenLastCalledWith(
        "/project/floatspy.tap",
        expect.objectContaining({ selectedBlock: 3 })
      )
    );
  });

  it("explains a file that is not a tape", async () => {
    await renderViewer(new Uint8Array([1, 2, 3]));
    await waitFor(() => expect(screen.getByText(/./)).toBeInTheDocument());
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
