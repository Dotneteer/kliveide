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
    const getFileContent = vi.fn(() => Promise.reject(new Error("File does not exist")));
    const saveFileContent = vi.fn(() => Promise.resolve());
    const dispatch = vi.fn();

    await renderNexViewer({ getFileContent, saveFileContent, dispatch });

    expect(await screen.findByText("No annotation file")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Create"));

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
    expect(await screen.findByText("Loaded")).toBeInTheDocument();
  });

  it("uses the loaded annotation offset for bank pop-out disassembly defaults", async () => {
    const getFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [{ start: 0, end: 0x3fff, type: "disassemble" }]
            }
          }
        })
      )
    );

    await renderNexViewer({ getFileContent });

    await waitFor(() => expect(screen.getByTestId("memory-viewer-bank-5")).toHaveAttribute("data-offset", "32768"));
    expect(screen.getByTestId("memory-viewer-bank-5")).toHaveAttribute(
      "data-annotation-path",
      "/project/ScrollNutter.nex.dis"
    );
    expect(await screen.findByText("Loaded")).toBeInTheDocument();
  });
});

async function renderNexViewer({
  getFileContent = vi.fn(() => Promise.reject(new Error("File does not exist"))),
  saveFileContent = vi.fn(() => Promise.resolve()),
  dispatch = vi.fn()
}: {
  getFileContent?: ReturnType<typeof vi.fn>;
  saveFileContent?: ReturnType<typeof vi.fn>;
  dispatch?: ReturnType<typeof vi.fn>;
}) {
  const setDocumentViewState = vi.fn();
  const openDocument = vi.fn(() => Promise.resolve());
  const projectService = {
    getFileContent,
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
  vi.doMock("@renderer/controls/memory/MemoryDumpViewer", () => ({
    MemoryDumpViewer: (props: {
      bank?: number;
      disassOffset?: number;
      nexAnnotationPath?: string;
    }) => (
      <div
        data-testid={`memory-viewer-bank-${props.bank ?? "none"}`}
        data-offset={props.disassOffset}
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
      contents: createNexWithBank5(),
      viewState: { bankExpanded: { 0: true } }
    } as any)
  );
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
