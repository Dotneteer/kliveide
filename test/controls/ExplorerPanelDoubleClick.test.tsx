import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

/*
 * A double-click on a file in the Explorer is click, click, dblclick. Opening reads the file before
 * the document exists, so each of the three used to see "not open" and open its own document object;
 * the document hub then threw "Duplicated document with ID ..." for the later ones. A binary file
 * (a `.nex` or `.z88` viewer) is read slowly enough to hit it every time.
 */

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

const PATH = "/project/game.z88";

async function renderExplorer() {
  const state = {
    dimMenu: false,
    isWindows: false,
    project: { buildRoots: [], excludedItems: [], folderPath: "/project", isKliveProject: false },
    ideView: { explorerViewVersion: 1 }
  };
  const store = { dispatch: vi.fn(), getState: vi.fn(() => state) };
  const node = {
    children: [],
    data: { fullPath: PATH, isFolder: false, name: "game.z88", projectPath: "game.z88" },
    level: 1,
    parentNode: {}
  };

  // --- The file read: held until the test releases it
  let finishRead: () => void = () => {};
  const getDocumentForProjectNode = vi.fn(
    () =>
      new Promise((resolve) => {
        finishRead = () => resolve({ id: PATH, name: "game.z88", node: node.data });
      })
  );

  // --- A document hub that behaves like the real one on a duplicate
  const open = new Map<string, unknown>();
  const openDocument = vi.fn(async (doc: { id: string }) => {
    if (open.has(doc.id) && open.get(doc.id) !== doc) {
      throw new Error(`Duplicated document with ID '${doc.id}'`);
    }
    open.set(doc.id, doc);
  });
  const hub = {
    getDocument: vi.fn((id: string) => open.get(id)),
    isOpen: vi.fn((id: string) => open.has(id)),
    setActiveDocument: vi.fn(() => Promise.resolve()),
    openDocument
  };
  const executeCommand = vi.fn(() => Promise.resolve({ success: true }));
  const setPermanent = vi.fn();

  vi.doMock("@renderer/core/RendererProvider", () => ({
    useDispatch: () => vi.fn(),
    useRendererContext: () => ({ messenger: {}, store }),
    useSelector: (selector: (appState: unknown) => unknown) => selector(state)
  }));
  vi.doMock("@renderer/core/MainApi", () => ({ useMainApi: () => ({}) }));
  vi.doMock("@renderer/core/EmuApi", () => ({ useEmuApi: () => ({}) }));
  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({
      ideCommandsService: { executeCommand },
      navigationHistoryService: {
        recordJump: async (_reason: string, jump: () => unknown) => await jump()
      },
      projectService: {
        getActiveDocumentHubService: () => hub,
        getDocumentHubServiceInstances: () => [],
        getDocumentForProjectNode,
        setPermanent
      }
    })
  }));
  vi.doMock("@renderer/appIde/project/project-node", () => ({ getFileTypeEntry: () => undefined }));
  vi.doMock("@renderer/controls/VirtualizedList", () => ({
    VirtualizedList: ({
      apiLoaded,
      renderItem
    }: {
      apiLoaded?: (api: unknown) => void;
      renderItem: (index: number) => ReactNode;
    }) => {
      apiLoaded?.({ scrollToIndex: vi.fn() });
      return <div>{renderItem(0)}</div>;
    }
  }));
  vi.doMock("@renderer/features/explorer/useExplorerTree", () => ({
    clearExplorerFolderCache: vi.fn(),
    useExplorerTree: () => ({
      refreshTree: vi.fn(),
      rememberExpandedItems: vi.fn(),
      selected: 0,
      setSelected: vi.fn(),
      setSelectedNode: vi.fn(),
      tree: { getViewNodeByIndex: () => node, rootNode: {} },
      visibleNodes: [node]
    })
  }));
  vi.doMock("@renderer/features/explorer/ExplorerProjectItem", () => ({
    ExplorerProjectItem: ({
      onActivate,
      onDoubleClick
    }: {
      onActivate: () => void;
      onDoubleClick: () => void;
    }) => (
      <>
        <button onClick={() => onActivate()}>activate</button>
        <button onClick={() => onDoubleClick()}>double-click</button>
      </>
    )
  }));

  const { DialogProvider } = await import("@renderer/controls/overlay/DialogProvider");
  const { ExplorerPanel } = await import("@renderer/features/explorer/ExplorerPanel");
  render(
    <DialogProvider>
      <ExplorerPanel />
    </DialogProvider>
  );
  return {
    finishRead: () => finishRead(),
    getDocumentForProjectNode,
    openDocument,
    hub,
    executeCommand,
    setPermanent
  };
}

describe("ExplorerPanel - double-click on a file being opened", () => {
  it("opens the document once, and makes it permanent", async () => {
    const errors: unknown[] = [];
    const onRejection = (reason: unknown) => errors.push(reason);
    process.on("unhandledRejection", onRejection);
    try {
      const e = await renderExplorer();

      // --- click, click, dblclick - all before the file has been read
      await act(async () => {
        fireEvent.click(screen.getByText("activate"));
        fireEvent.click(screen.getByText("activate"));
        fireEvent.click(screen.getByText("double-click"));
      });
      expect(e.getDocumentForProjectNode).toHaveBeenCalledTimes(1);

      await act(async () => {
        e.finishRead();
      });

      expect(e.openDocument).toHaveBeenCalledTimes(1);
      expect(e.executeCommand).not.toHaveBeenCalled();
      expect(e.setPermanent).toHaveBeenCalledWith(PATH);
      expect(e.hub.setActiveDocument).toHaveBeenCalledWith(PATH);
      expect(errors).toEqual([]);
    } finally {
      process.off("unhandledRejection", onRejection);
    }
  });

  it("a single click opens the file as before", async () => {
    const e = await renderExplorer();
    await act(async () => {
      fireEvent.click(screen.getByText("activate"));
    });
    await act(async () => {
      e.finishRead();
    });
    expect(e.openDocument).toHaveBeenCalledTimes(1);
    expect(e.openDocument.mock.calls[0][2]).toBe(true);
  });

  it("a double-click on a file nobody is opening still opens it through `nav`", async () => {
    const e = await renderExplorer();
    await act(async () => {
      fireEvent.click(screen.getByText("double-click"));
    });
    expect(e.executeCommand).toHaveBeenCalledWith(`nav "${PATH}" -r explorer`);
  });
});
