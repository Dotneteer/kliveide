import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The ZX81 `.P` viewer: the summary, the parts in the bank browser, their details and the pop-outs.
 * Set up as `TapeViewerPanel.test.tsx` is; the model is tested without a DOM in
 * `test/renderer/pfile/pFileView.test.ts`.
 */

const TAPES = join(__dirname, "../../_input/zx81-tapes");
const CHARACTERS = new Uint8Array(readFileSync(join(TAPES, "basic/Characters.P")));
const BYTE_FOREVER = new Uint8Array(readFileSync(join(TAPES, "1k/byteForever.p")));
const DEC_TO_FP = new Uint8Array(readFileSync(join(TAPES, "basic/DEC-TO-FP-2.p")));
const ROM = new Uint8Array(readFileSync(join(__dirname, "../../src/public/roms/zx81.rom")));

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

  vi.doMock("@renderer/core/MainApi", () => ({
    useMainApi: () => ({ readBinaryFile: () => Promise.resolve(ROM) })
  }));

  const { createPFileViewerPanel } =
    await import("@renderer/appIde/DocumentPanels/PFile/PFileViewerPanel");
  render(
    createPFileViewerPanel({
      document: {
        id: "/project/Characters.P",
        name: "Characters.P",
        type: "PFileViewer",
        path: "/project/Characters.P",
        node: {
          isFolder: false,
          name: "Characters.P",
          fullPath: "/project/Characters.P",
          projectPath: "Characters.P"
        }
      },
      contents,
      viewState
    } as any)
  );
  return { openDocument, setDocumentViewState, recordJump };
}

describe("PFileViewerPanel", () => {
  it("summarises the program", async () => {
    await renderViewer(CHARACTERS);
    const summary = await screen.findByLabelText("Program summary");
    expect(within(summary).getByText("ZX81 program (.P)")).toBeInTheDocument();
    expect(within(summary).getByText("16K RAM")).toBeInTheDocument();
    expect(within(summary).getByText("Needs RUN")).toBeInTheDocument();
    expect(within(summary).getByText("FAST")).toBeInTheDocument();
  });

  it("names the line a self-starting program runs from", async () => {
    await renderViewer(DEC_TO_FP);
    const summary = await screen.findByLabelText("Program summary");
    expect(within(summary).getByText("LINE 5")).toBeInTheDocument();
    expect(within(summary).getByText("SLOW")).toBeInTheDocument();
  });

  it("lists the parts, numbered by their address", async () => {
    await renderViewer(CHARACTERS);
    const list = await screen.findByRole("listbox", { name: "Part list" });
    expect(within(list).getAllByRole("option")).toHaveLength(4);
    expect(within(list).getByText("$407D")).toBeInTheDocument();
    expect(within(list).getByText("6 lines")).toBeInTheDocument();
    expect(within(list).getByText("2 variables")).toBeInTheDocument();
  });

  it("selects the BASIC program first, and pops its listing out in ZX81 form", async () => {
    const { openDocument, recordJump } = await renderViewer(CHARACTERS);
    expect((await screen.findByTestId("p-file-basic-summary")).textContent).toBe("6 lines");
    fireEvent.click(screen.getByRole("button", { name: "Pop out the listing" }));
    await waitFor(() => expect(openDocument).toHaveBeenCalled());
    expect(recordJump).toHaveBeenCalledWith("pFileRegion", expect.any(Function));
    const [doc, state] = openDocument.mock.calls[0] as unknown as [any, any];
    expect(doc.type).toBe("TapeBlockViewer");
    expect(doc.id).toBe("pFileRegion-basic/project/Characters.P:program");
    expect(doc.name).toBe("Characters.P - Listing");
    expect(state).toMatchObject({ view: "basic", format: "zx81", basicEnd: 0x40f3 - 0x407d });
  });

  it("pops a part out in memory at its own address", async () => {
    const { openDocument } = await renderViewer(CHARACTERS, {
      selectedRegion: "sysvars"
    });
    fireEvent.click(await screen.findByRole("button", { name: "Pop out Part $4009" }));
    await waitFor(() => expect(openDocument).toHaveBeenCalled());
    const [doc, state] = openDocument.mock.calls[0] as unknown as [any, any];
    expect(doc.id).toBe("memoryDump-pFileRegionDump/project/Characters.P:sysvars");
    expect(doc.contents).toHaveLength(0x407d - 0x4009);
    expect(state).toMatchObject({ disassOffset: 0x4009, viewMode: "memory" });
  });

  it("shows the system variables that say what the file is", async () => {
    await renderViewer(CHARACTERS, { selectedRegion: "sysvars" });
    const details = await screen.findByRole("complementary", { name: "$4009 details" });
    // --- D_FILE, and NXTLIN pointing at it: saved by a command, so no line runs next
    expect(within(details).getAllByText("$40F3")).toHaveLength(2);
    expect(within(details).getByText("$00 (FAST)")).toBeInTheDocument();
  });

  it("draws the display file with the ROM's characters", async () => {
    await renderViewer(CHARACTERS, { selectedRegion: "display" });
    const details = await screen.findByRole("complementary", { name: "$40F3 details" });
    expect(within(details).getByText("Full: 24 lines of 32 characters")).toBeInTheDocument();
    expect(await within(details).findByTestId("screen-canvas")).toBeInTheDocument();
  });

  it("lists the variables", async () => {
    await renderViewer(CHARACTERS, { selectedRegion: "variables" });
    const details = await screen.findByRole("complementary", { name: "$440C details" });
    expect(within(details).getByText("N")).toBeInTheDocument();
    expect(within(details).getByText("F")).toBeInTheDocument();
  });

  it("explains a file whose system variables do not describe it", async () => {
    await renderViewer(BYTE_FOREVER);
    expect((await screen.findByRole("note")).textContent).toMatch(/do not describe its parts/);
    const list = screen.getByRole("listbox", { name: "Part list" });
    expect(within(list).getAllByRole("option")).toHaveLength(2);
  });

  it("explains a file that is not a program", async () => {
    await renderViewer(new Uint8Array([1, 2, 3]));
    await waitFor(() => expect(screen.getByText(/116 bytes of system variables/)).toBeInTheDocument());
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
