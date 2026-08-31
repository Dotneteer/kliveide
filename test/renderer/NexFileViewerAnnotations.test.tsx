import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const HEADER_SIZE = 512;
const BANK_SIZE = 0x4000;

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

describe("NexFileViewerPanel annotations", () => {
  it("shows missing sidecar state and creates a default annotation file", async () => {
    const readFileContent = vi.fn(() => Promise.reject(new Error("File does not exist")));
    const saveFileContent = vi.fn(() => Promise.resolve());
    const dispatch = vi.fn();

    await renderNexViewer({ readFileContent, saveFileContent, dispatch });

    expect(await screen.findByText("No annotation file attached.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Click to create one!" })).toBeInTheDocument();
    expect(screen.queryByText("No annotation sidecar file found.")).not.toBeInTheDocument();
    expect(screen.queryByText("Open JSON")).not.toBeInTheDocument();
    expect(screen.queryByText("Reload")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Click to create one!" }));

    await waitFor(() => expect(saveFileContent).toHaveBeenCalledTimes(1));
    expect(saveFileContent).toHaveBeenCalledWith(
      "/project/ScrollNutter.nex.dis",
      expect.any(String)
    );
    expect(JSON.parse(saveFileContent.mock.calls[0][1])).toMatchObject({
      schemaVersion: 1,
      source: { fileName: "ScrollNutter.nex" },
      banks: {
        "5": {
          offsetIndex: 1,
          regions: [{ start: 0, end: 0x3fff, type: "disassemble" }]
        }
      }
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "INC_EXPLORER_VIEW_VERSION" }));
    await waitFor(() =>
      expect(screen.queryByText("No annotation file attached.")).not.toBeInTheDocument()
    );
    expect(screen.queryByText("Loaded")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Click to create one!" })).not.toBeInTheDocument();
    expect(screen.queryByText("Open JSON")).not.toBeInTheDocument();
    expect(screen.queryByText("Reload")).not.toBeInTheDocument();
  });

  it("uses the loaded annotation offset for bank pop-out disassembly defaults", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          banks: {
            "5": {
              offsetIndex: 2,
              lastView: "disassembly",
              decimalView: true,
              regions: [{ start: 0, end: 0x3fff, type: "disassemble" }]
            }
          }
        })
      )
    );

    await renderNexViewer({ readFileContent });

    await waitFor(() => expect(screen.getByTestId("memory-viewer-bank-5")).toHaveAttribute("data-offset", "32768"));
    expect(screen.getByTestId("memory-viewer-bank-5")).toHaveAttribute(
      "data-view-mode",
      "disassembly"
    );
    expect(screen.getByTestId("memory-viewer-bank-5")).toHaveAttribute(
      "data-decimal-view",
      "true"
    );
    expect(screen.getByTestId("memory-viewer-bank-5")).toHaveAttribute(
      "data-annotation-path",
      "/project/ScrollNutter.nex.dis"
    );
    await waitFor(() => expect(readFileContent).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Loaded")).not.toBeInTheDocument();
    expect(screen.queryByText("No annotation file attached.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Click to create one!" })).not.toBeInTheDocument();
    expect(screen.queryByText("Open JSON")).not.toBeInTheDocument();
    expect(screen.queryByText("Reload")).not.toBeInTheDocument();
  });

  it("opens a bank from the expandable bank header pop-out icon", async () => {
    const openDocument = vi.fn(() => Promise.resolve());
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          banks: {
            "5": {
              offsetIndex: 2,
              lastView: "disassembly",
              decimalView: true,
              regions: [{ start: 0, end: 0x3fff, type: "disassemble" }]
            }
          }
        })
      )
    );

    await renderNexViewer({ readFileContent, openDocument });

    fireEvent.click(await screen.findByTestId("icon-pop-out"));

    await waitFor(() =>
      expect(openDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "memoryDump-bankDumpScrollNutter.nex:5"
        }),
        expect.objectContaining({
          disassemblyEnabled: true,
          disassOffset: 0x8000,
          decimalView: true,
          viewMode: "disassembly",
          nexAnnotationPath: "/project/ScrollNutter.nex.dis",
          nexAnnotationBank: 5
        }),
        false
      )
    );
  });

  it("shows a short error when an existing sidecar cannot be loaded", async () => {
    const readFileContent = vi.fn(() => Promise.resolve("{"));

    await renderNexViewer({ readFileContent });

    expect(await screen.findByText("Annotation file could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Click to create one!" })).not.toBeInTheDocument();
    expect(screen.queryByText("Loaded")).not.toBeInTheDocument();
  });

  it("does not rerender the Layer 2 loading screen while the viewer scrolls", async () => {
    const layer2ScreenRender = vi.fn(() => <div data-testid="layer2-screen" />);

    const harness = await renderNexViewer({
      contents: createNexWithLayer2AndBank5(),
      layer2ScreenRender,
      viewState: {
        layer2LoadingScreenExpanded: true
      }
    });

    await screen.findByTestId("layer2-screen");
    const initialRenderCount = layer2ScreenRender.mock.calls.length;
    const panel = screen.getByTestId("generic-file-panel");
    fireEvent.scroll(panel, { target: { scrollTop: 320 } });

    await waitFor(() =>
      expect(harness.setDocumentViewState).toHaveBeenCalledWith(
        "/project/ScrollNutter.nex",
        expect.objectContaining({ scrollPosition: 320 })
      )
    );
    expect(layer2ScreenRender).toHaveBeenCalledTimes(initialRenderCount);
  });
});

async function renderNexViewer({
  readFileContent = vi.fn(() => Promise.reject(new Error("File does not exist"))),
  saveFileContent = vi.fn(() => Promise.resolve()),
  dispatch = vi.fn(),
  openDocument = vi.fn(() => Promise.resolve()),
  contents = createNexWithBank5(),
  layer2ScreenRender = vi.fn(() => <div data-testid="layer2-screen" />),
  viewState = { bankExpanded: { 0: true } }
}: {
  readFileContent?: ReturnType<typeof vi.fn>;
  saveFileContent?: ReturnType<typeof vi.fn>;
  dispatch?: ReturnType<typeof vi.fn>;
  openDocument?: ReturnType<typeof vi.fn>;
  contents?: Uint8Array;
  layer2ScreenRender?: ReturnType<typeof vi.fn>;
  viewState?: Record<string, unknown>;
}) {
  const setDocumentViewState = vi.fn();
  const projectService = {
    readFileContent,
    saveFileContent,
    getNodeForFile: vi.fn(() => undefined),
    getDocumentForProjectNode: vi.fn(() => Promise.resolve({}))
  };

  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({ projectService })
  }));
  vi.doMock("@renderer/appIde/services/DocumentServiceProvider", () => ({
    useDocumentHubService: () => ({
      setDocumentViewState,
      getDocument: vi.fn(() => undefined),
      isOpen: vi.fn(() => false),
      setActiveDocument: vi.fn(),
      openDocument
    })
  }));
  vi.doMock("@renderer/core/RendererProvider", () => ({
    useDispatch: () => dispatch,
    useRendererContext: () => ({
      store: { getState: () => ({}), dispatch },
      messenger: {},
      messageSource: "ide"
    }),
    useSelector: (selector: (state: any) => any) => selector({ theme: "dark", isWindows: false })
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
    Panel: ({
      children,
      initialScrollPosition,
      onScrolled
    }: {
      children: ReactNode;
      initialScrollPosition?: number;
      onScrolled?: (pos: number) => void;
    }) => (
      <div
        data-testid="generic-file-panel"
        data-initial-scroll-position={initialScrollPosition}
        onScroll={(event) => onScrolled?.(event.currentTarget.scrollTop)}
      >
        {children}
      </div>
    )
  }));
  vi.doMock("@renderer/controls/Next/Layer2Screen", () => ({
    Layer2Screen: layer2ScreenRender
  }));
  vi.doMock("@renderer/controls/memory/MemoryDumpViewer", () => ({
    MemoryDumpViewer: (props: {
      bank?: number;
      disassOffset?: number;
      decimalView?: boolean;
      viewMode?: string;
      nexAnnotationPath?: string;
    }) => (
      <div
        data-testid={`memory-viewer-bank-${props.bank ?? "none"}`}
        data-offset={props.disassOffset}
        data-decimal-view={String(props.decimalView)}
        data-view-mode={props.viewMode}
        data-annotation-path={props.nexAnnotationPath}
      />
    )
  }));

  const { createNexFileViewerPanel } = await import(
    "@renderer/appIde/DocumentPanels/Next/NexFileViewerPanel"
  );

  render(
    createNexFileViewerPanel({
      document: {
        id: "/project/ScrollNutter.nex",
        name: "ScrollNutter.nex",
        type: "NexViewer",
        path: "/project/ScrollNutter.nex",
        node: {
          isFolder: false,
          name: "ScrollNutter.nex",
          fullPath: "/project/ScrollNutter.nex",
          projectPath: "ScrollNutter.nex"
        }
      },
      contents,
      viewState
    } as any)
  );

  return {
    setDocumentViewState
  };
}

function createNexWithBank5(): Uint8Array {
  const contents = new Uint8Array(HEADER_SIZE + BANK_SIZE);
  contents.set([0x4e, 0x65, 0x78, 0x74], 0); // Next
  contents.set([0x56, 0x31, 0x2e, 0x32], 4); // V1.2
  contents[9] = 1;
  contents[18 + 5] = 1;
  contents[HEADER_SIZE] = 0x55;
  return contents;
}

function createNexWithLayer2AndBank5(): Uint8Array {
  const contents = new Uint8Array(HEADER_SIZE + 512 + 0xc000 + BANK_SIZE);
  contents.set([0x4e, 0x65, 0x78, 0x74], 0); // Next
  contents.set([0x56, 0x31, 0x2e, 0x32], 4); // V1.2
  contents[9] = 1;
  contents[10] = 0x01;
  contents[18 + 5] = 1;
  contents[HEADER_SIZE + 512] = 0x22;
  contents[HEADER_SIZE + 512 + 0xc000] = 0x55;
  return contents;
}
