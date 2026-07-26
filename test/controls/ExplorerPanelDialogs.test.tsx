import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { MouseEvent, ReactNode } from "react";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("ExplorerPanel dialog migration", () => {
  it("opens add, rename, and delete dialogs through the dialog service", async () => {
    const state = {
      dimMenu: false,
      isWindows: false,
      project: {
        buildRoots: [],
        excludedItems: [],
        folderPath: "/project",
        isKliveProject: true
      },
      ideView: {
        explorerViewVersion: 1
      }
    };
    const store = {
      dispatch: vi.fn(),
      getState: vi.fn(() => state)
    };
    const dispatch = vi.fn();
    const node = {
      children: [{ data: { name: "sibling.asm" } }],
      collapseAll: vi.fn(),
      data: {
        fullPath: "/project/main.asm",
        isFolder: false,
        name: "main.asm",
        projectPath: "main.asm"
      },
      expandAll: vi.fn(),
      level: 1,
      parentNode: {}
    };
    const renameExplorerNode = vi.fn(() => Promise.resolve());
    const deleteExplorerNode = vi.fn(() => Promise.resolve());
    const addExplorerItem = vi.fn(() => Promise.resolve());
    const executeCommand = vi.fn(() => Promise.resolve({ success: true }));

    vi.doMock("@renderer/core/RendererProvider", () => ({
      useDispatch: () => dispatch,
      useRendererContext: () => ({ messenger: {}, store }),
      useSelector: (selector: (appState: unknown) => unknown) => selector(state)
    }));
    vi.doMock("@renderer/core/MainApi", () => ({
      useMainApi: () => ({ showItemInFolder: vi.fn() })
    }));
    vi.doMock("@renderer/core/EmuApi", () => ({
      useEmuApi: () => ({})
    }));
    vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
      useAppServices: () => ({
        ideCommandsService: { executeCommand },
        projectService: {
          getActiveDocumentHubService: () => ({
            isOpen: vi.fn(() => false),
            setActiveDocument: vi.fn()
          }),
          getDocumentHubServiceInstances: () => [],
          setPermanent: vi.fn()
        }
      })
    }));
    vi.doMock("@renderer/appIde/project/project-node", () => ({
      getFileTypeEntry: () => undefined
    }));
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
        tree: {
          getViewNodeByIndex: () => node,
          rootNode: {}
        },
        visibleNodes: [node]
      })
    }));
    vi.doMock("@renderer/features/explorer/ExplorerProjectItem", () => ({
      ExplorerProjectItem: ({
        node,
        onContextMenu
      }: {
        node: unknown;
        onContextMenu: (event: MouseEvent, node: unknown) => void;
      }) => (
        <button
          onClick={(event) => onContextMenu(event as MouseEvent, node)}
        >
          context node
        </button>
      )
    }));
    vi.doMock("@renderer/features/explorer/ExplorerContextMenu", () => ({
      ExplorerContextMenu: ({
        onDelete,
        onNewFile,
        onNewFolder,
        onRename
      }: {
        onDelete: () => void;
        onNewFile: () => void;
        onNewFolder: () => void;
        onRename: () => void;
      }) => (
        <div>
          <button onClick={onRename}>rename action</button>
          <button onClick={onDelete}>delete action</button>
          <button onClick={onNewFile}>new file action</button>
          <button onClick={onNewFolder}>new folder action</button>
        </div>
      )
    }));
    vi.doMock("@renderer/appIde/dialogs/RenameDialog", () => ({
      RenameDialog: ({ onRename }: { onRename: (name: string) => Promise<void> }) => (
        <button onClick={() => void onRename("renamed.asm")}>confirm rename</button>
      )
    }));
    vi.doMock("@renderer/appIde/dialogs/DeleteDialog", () => ({
      DeleteDialog: ({ onDelete }: { onDelete: () => Promise<void> }) => (
        <button onClick={() => void onDelete()}>confirm delete</button>
      )
    }));
    vi.doMock("@renderer/appIde/dialogs/NewItemDialog", () => ({
      NewItemDialog: ({
        isFolder,
        onAdd
      }: {
        isFolder?: boolean;
        onAdd: (name: string) => Promise<void>;
      }) => (
        <button onClick={() => void onAdd(isFolder ? "new-folder" : "new-file.asm")}>
          confirm new {isFolder ? "folder" : "file"}
        </button>
      )
    }));
    vi.doMock("@renderer/features/explorer/explorerFileOperations", () => ({
      addExplorerItem,
      deleteExplorerNode,
      renameExplorerNode
    }));

    const { DialogProvider } = await import("@renderer/controls/overlay/DialogProvider");
    const { ExplorerPanel } = await import("@renderer/features/explorer/ExplorerPanel");

    render(
      <DialogProvider>
        <ExplorerPanel />
      </DialogProvider>
    );

    fireEvent.click(screen.getByText("context node"));
    fireEvent.click(screen.getByText("rename action"));
    fireEvent.click(await screen.findByText("confirm rename"));
    await waitFor(() => {
      expect(renameExplorerNode).toHaveBeenCalledWith(
        expect.objectContaining({
          newName: "renamed.asm",
          selectedContextNode: node
        })
      );
    });

    fireEvent.click(screen.getByText("delete action"));
    fireEvent.click(await screen.findByText("confirm delete"));
    await waitFor(() => {
      expect(deleteExplorerNode).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedContextNode: node,
          selectedContextNodeIsFolder: false
        })
      );
    });

    fireEvent.click(screen.getByText("new file action"));
    fireEvent.click(await screen.findByText("confirm new file"));
    await waitFor(() => {
      expect(addExplorerItem).toHaveBeenCalledWith(
        expect.objectContaining({
          newItemIsFolder: false,
          newName: "new-file.asm",
          selectedContextNode: node
        })
      );
    });

    fireEvent.click(screen.getByText("new folder action"));
    fireEvent.click(await screen.findByText("confirm new folder"));
    await waitFor(() => {
      expect(addExplorerItem).toHaveBeenCalledWith(
        expect.objectContaining({
          newItemIsFolder: true,
          newName: "new-folder",
          selectedContextNode: node
        })
      );
    });
  });
});
