import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor
} from "@testing-library/react";
import type { ReactNode } from "react";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("DocumentTabs", () => {
  it("uses the document path when duplicate tab names would be ambiguous", async () => {
    vi.doMock("@renderer/features/documents/DocumentTab", () => ({
      CloseMode: { All: 0, Others: 1, This: 2 },
      DocumentTab: ({ name }: { name: string }) => <div>{name}</div>
    }));

    const { DocumentTabs } = await import("@renderer/features/documents/DocumentTabs");

    render(
      <DocumentTabs
        activeDocIndex={0}
        awaiting={false}
        isProjectDebugging={false}
        openDocs={[
          createDocument("folder-a/main.asm", "main.asm"),
          createDocument("folder-b/main.asm", "main.asm")
        ]}
        onTabClicked={vi.fn()}
        onTabCloseClicked={vi.fn()}
        onTabDisplayed={vi.fn()}
        onTabDoubleClicked={vi.fn()}
        tabsCount={2}
      />
    );

    expect(screen.getByText("folder-a/main.asm")).toBeInTheDocument();
    expect(screen.getByText("folder-b/main.asm")).toBeInTheDocument();
  });
});

describe("DocumentTab", () => {
  it("reveals the close button when an inactive tab moves under the pointer", async () => {
    vi.doUnmock("@renderer/features/documents/DocumentTab");
    vi.doMock("@controls/TabButton", () => ({
      TabButton: ({ hide, iconName }: { hide?: boolean; iconName: string }) => (
        <span data-testid="tab-close-state">{hide ? "hidden" : iconName}</span>
      )
    }));
    vi.doMock("@controls/Tooltip", () => ({
      TooltipFactory: () => null,
      useTooltipRef: () => ({ current: null })
    }));
    vi.doMock("@renderer/core/RendererProvider", () => ({
      useRendererContext: () => ({
        store: { getState: () => ({ isWindows: false }) }
      })
    }));
    vi.doMock("@renderer/core/MainApi", () => ({
      useMainApi: () => ({ showItemInFolder: vi.fn() })
    }));
    vi.doMock("@renderer/theming/ThemeProvider", () => ({
      useTheme: () => ({
        getIcon: () => ({ width: 16, height: 16, path: "" }),
        getImage: () => ({ type: "png", data: "" }),
        getThemeProperty: () => "",
        theme: { tone: "dark" }
      })
    }));

    const { DocumentTab } = await import("@renderer/features/documents/DocumentTab");

    const { rerender } = render(<DocumentTab key="first" name="first.asm" />);

    expect(screen.getByTestId("tab-close-state")).toHaveTextContent("hidden");

    fireEvent.mouseMove(screen.getByText("first.asm").closest("div"), {
      clientX: 24,
      clientY: 10
    });

    const originalElementFromPoint = document.elementFromPoint;
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => screen.getByText("second.asm").closest("div"))
    });

    try {
      rerender(<DocumentTab key="second" name="second.asm" />);

      await waitFor(() =>
        expect(screen.getByTestId("tab-close-state")).toHaveTextContent("close")
      );
    } finally {
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: originalElementFromPoint
      });
    }
  });
});

describe("DocumentsHeader", () => {
  it("creates a project-scoped workspace payload from open documents", async () => {
    const { createDocumentWorkspace } = await import(
      "@renderer/features/documents/useDocumentWorkspacePersistence"
    );

    expect(
      createDocumentWorkspace(
        [
          createDocument("/project/src/a.asm", "a.asm", { line: 2, column: 4 }) as any,
          createDocument("/outside/c.asm", "c.asm", { line: 1, column: 1 }) as any
        ],
        0,
        "/project"
      )
    ).toEqual({
      documents: [
        {
          type: "code",
          id: "/project/src/a.asm",
          position: { line: 2, column: 4 }
        }
      ],
      activeDocumentId: "/project/src/a.asm"
    });
  });

  it("persists workspace document metadata and saves the project", async () => {
    const saveProject = vi.fn(() => Promise.resolve());
    const store = {
      dispatch: vi.fn(),
      getState: vi.fn(() => ({
        project: {
          folderPath: "/project",
          buildRoots: []
        },
        emulatorState: {
          isProjectDebugging: false
        },
        ideView: {
          editorVersion: 1
        }
      }))
    };
    const documentHubService = {
      closeAllExplorerDocuments: vi.fn(),
      getActiveDocumentIndex: vi.fn(() => 1),
      getDocumentViewState: vi.fn(() => ({})),
      getOpenDocuments: vi.fn(() => [
        createDocument("/project/src/a.asm", "a.asm", { line: 2, column: 4 }),
        createDocument("/project/src/b.asm", "b.asm", { line: 8, column: 1 }),
        createDocument("/outside/c.asm", "c.asm", { line: 1, column: 1 })
      ]),
      getOpenProjectFileDocument: vi.fn(() => Promise.resolve(undefined)),
      moveActiveToLeft: vi.fn(),
      moveActiveToRight: vi.fn(),
      setDocumentViewState: vi.fn()
    };
    const projectClosed = {
      on: vi.fn(),
      off: vi.fn()
    };

    vi.doMock("@renderer/core/RendererProvider", () => ({
      useDispatch: () => vi.fn(),
      useRendererContext: () => ({ store }),
      useSelector: (selector: (state: unknown) => unknown) => selector(store.getState())
    }));
    vi.doMock("@renderer/core/MainApi", () => ({
      useMainApi: () => ({ saveProject })
    }));
    vi.doMock("@appIde/services/AppServicesProvider", () => ({
      useAppServices: () => ({
        projectService: { projectClosed },
        outputPaneService: { getOutputPaneBuffer: vi.fn() },
        ideCommandsService: { executeCommand: vi.fn() }
      })
    }));
    vi.doMock("@renderer/appIde/services/DocumentServiceProvider", () => ({
      useDocumentHubService: () => documentHubService,
      useDocumentHubServiceVersion: () => 1
    }));
    vi.doMock("@renderer/appIde/project/project-node", () => ({
      getFileTypeEntry: () => undefined
    }));
    vi.doMock("@renderer/controls/ScrollViewer", () => ({
      default: ({
        apiLoaded,
        children
      }: {
        apiLoaded?: (api: unknown) => void;
        children?: ReactNode;
      }) => {
        apiLoaded?.({
          getScrollLeft: () => 0,
          scrollToHorizontal: vi.fn()
        });
        return <div>{children}</div>;
      }
    }));
    vi.doMock("@renderer/features/documents/DocumentTab", () => ({
      CloseMode: { All: 0, Others: 1, This: 2 },
      DocumentTab: ({ name }: { name: string }) => <div>{name}</div>
    }));
    vi.doMock("@controls/TabButton", () => ({
      TabButton: () => null,
      TabButtonSeparator: () => null,
      TabButtonSpace: () => null
    }));

    const { DOCS_WORKSPACE, DocumentsHeader } = await import(
      "@renderer/features/documents/DocumentsHeader"
    );

    render(<DocumentsHeader />);

    await waitFor(() =>
      expect(store.dispatch).toHaveBeenCalledWith(
        {
          type: "SET_WORKSPACE_SETTINGS",
          payload: {
            id: DOCS_WORKSPACE,
            value: {
              documents: [
                {
                  type: "code",
                  id: "/project/src/a.asm",
                  position: { line: 2, column: 4 }
                },
                {
                  type: "code",
                  id: "/project/src/b.asm",
                  position: { line: 8, column: 1 }
                }
              ],
              activeDocumentId: "/project/src/b.asm"
            }
          }
        },
        "ide"
      )
    );
    expect(saveProject).toHaveBeenCalled();
  });
});

describe("DocumentCommandBar", () => {
  it("renders editor actions and dispatches tab movement commands", async () => {
    vi.doMock("@controls/TabButton", () => ({
      TabButton: ({
        clicked,
        disabled,
        iconName
      }: {
        clicked?: () => void;
        disabled?: boolean;
        iconName: string;
      }) => (
        <button type="button" disabled={disabled} onClick={clicked}>
          {iconName}
        </button>
      ),
      TabButtonSeparator: () => null,
      TabButtonSpace: () => null
    }));
    vi.doMock("@appIde/services/AppServicesProvider", () => ({
      useAppServices: () => ({
        outputPaneService: { getOutputPaneBuffer: vi.fn() },
        ideCommandsService: { executeCommand: vi.fn() }
      })
    }));
    vi.doMock("@renderer/core/RendererProvider", () => ({
      useSelector: (selector: (state: unknown) => unknown) =>
        selector({ compilation: { inProgress: false } })
    }));

    const { DocumentCommandBar } = await import(
      "@renderer/features/documents/DocumentCommandBar"
    );
    const onMoveActiveLeft = vi.fn();
    const onMoveActiveRight = vi.fn();
    const onCloseAll = vi.fn();

    render(
      <DocumentCommandBar
        activeDocIndex={1}
        activeFullPath="/project/main.asm"
        editorInfo={{
          documentTabRenderer: (path) => <span>editor action {path}</span>
        } as any}
        openDocsLength={3}
        selectedIsBuildRoot={false}
        onCloseAll={onCloseAll}
        onMoveActiveLeft={onMoveActiveLeft}
        onMoveActiveRight={onMoveActiveRight}
      />
    );

    expect(screen.getByText("editor action /project/main.asm")).toBeInTheDocument();

    fireEvent.click(screen.getByText("arrow-small-left"));
    fireEvent.click(screen.getByText("arrow-small-right"));
    fireEvent.click(screen.getAllByText("close")[0]);

    expect(onMoveActiveLeft).toHaveBeenCalledTimes(1);
    expect(onMoveActiveRight).toHaveBeenCalledTimes(1);
    expect(onCloseAll).toHaveBeenCalledTimes(1);
  });

  it("runs build-root commands through the IDE command service", async () => {
    const buildPane = {};
    const executeCommand = vi.fn(async (command: string) =>
      command.startsWith("run-build-function") ? { value: 42 } : undefined
    );
    vi.doMock("@controls/TabButton", () => ({
      TabButton: ({
        clicked,
        disabled,
        iconName
      }: {
        clicked?: () => void;
        disabled?: boolean;
        iconName: string;
      }) => (
        <button type="button" disabled={disabled} onClick={clicked}>
          {iconName}
        </button>
      ),
      TabButtonSeparator: () => null,
      TabButtonSpace: () => null
    }));
    vi.doMock("@appIde/services/AppServicesProvider", () => ({
      useAppServices: () => ({
        outputPaneService: { getOutputPaneBuffer: vi.fn(() => buildPane) },
        ideCommandsService: { executeCommand }
      })
    }));
    vi.doMock("@renderer/core/RendererProvider", () => ({
      useSelector: (selector: (state: unknown) => unknown) =>
        selector({ compilation: { inProgress: false } })
    }));

    const { PANE_ID_BUILD } = await import("@common/integration/constants");
    const { DocumentCommandBar } = await import(
      "@renderer/features/documents/DocumentCommandBar"
    );

    render(
      <DocumentCommandBar
        activeDocIndex={0}
        openDocsLength={1}
        selectedIsBuildRoot={true}
        onCloseAll={vi.fn()}
        onMoveActiveLeft={vi.fn()}
        onMoveActiveRight={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("combine"));

    await waitFor(() =>
      expect(executeCommand).toHaveBeenCalledWith("run-build-function buildCode", buildPane)
    );
    expect(executeCommand).toHaveBeenCalledWith(`outp ${PANE_ID_BUILD}`);
  });
});

describe("ExplorerProjectItem", () => {
  it("renders collapsed and expanded folder icons", async () => {
    vi.doMock("@controls/Icon", () => ({
      Icon: ({ iconName }: { iconName: string }) => <span data-testid={`icon-${iconName}`} />
    }));
    vi.doMock("@controls/SpaceFiller", () => ({
      SpaceFiller: () => null
    }));
    vi.doMock("@renderer/controls/layout/LabelSeparator", () => ({
      LabelSeparator: () => null
    }));

    const { ExplorerProjectItem } = await import(
      "@renderer/features/explorer/ExplorerProjectItem"
    );
    const collapsedNode = createTreeNode({ isFolder: true, name: "src" });
    const expandedNode = { ...createTreeNode({ isFolder: true, name: "assets" }), isExpanded: true };
    const rootNode = { ...createTreeNode({ isFolder: true, name: "project" }), isExpanded: true };

    const props = {
      canShowExcludedItems: false,
      focused: false,
      isBuildRoot: false,
      isKliveProject: false,
      isRoot: false,
      isSelected: false,
      tabIndex: 0,
      onActivate: vi.fn(),
      onContextMenu: vi.fn(),
      onDoubleClick: vi.fn(),
      onExcludedItemsClick: vi.fn(),
      onFocus: vi.fn(),
      onSelect: vi.fn()
    };

    const { rerender } = render(
      <ExplorerProjectItem {...props} node={collapsedNode as any} />
    );

    expect(screen.getByTestId("icon-chevron-right")).toBeInTheDocument();
    expect(screen.getByTestId("icon-folder")).toBeInTheDocument();

    rerender(<ExplorerProjectItem {...props} node={expandedNode as any} />);

    expect(screen.getByTestId("icon-chevron-down")).toBeInTheDocument();
    expect(screen.getByTestId("icon-folder-opened")).toBeInTheDocument();

    rerender(
      <ExplorerProjectItem
        {...props}
        isKliveProject={true}
        isRoot={true}
        node={rootNode as any}
      />
    );

    expect(screen.getByTestId("icon-chevron-down")).toBeInTheDocument();
    expect(screen.getByTestId("icon-home")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-folder")).not.toBeInTheDocument();
    expect(screen.queryByTestId("icon-folder-opened")).not.toBeInTheDocument();
  });

  it("reserves the expand icon column for file nodes", async () => {
    vi.doMock("@controls/Icon", () => ({
      Icon: ({ iconName }: { iconName: string }) => <span data-testid={`icon-${iconName}`} />
    }));
    vi.doMock("@controls/SpaceFiller", () => ({
      SpaceFiller: () => null
    }));
    vi.doMock("@renderer/controls/layout/LabelSeparator", () => ({
      LabelSeparator: () => null
    }));

    const { ExplorerProjectItem } = await import(
      "@renderer/features/explorer/ExplorerProjectItem"
    );

    render(
      <ExplorerProjectItem
        canShowExcludedItems={false}
        focused={false}
        isBuildRoot={false}
        isKliveProject={false}
        isRoot={false}
        isSelected={false}
        node={createTreeNode({ isFolder: false, name: "main.asm" }) as any}
        tabIndex={0}
        onActivate={vi.fn()}
        onContextMenu={vi.fn()}
        onDoubleClick={vi.fn()}
        onExcludedItemsClick={vi.fn()}
        onFocus={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    const fileIcon = screen.getByTestId("icon-file-code");

    expect(fileIcon.parentElement?.childElementCount).toBe(2);
    expect(screen.queryByTestId("icon-chevron-right")).not.toBeInTheDocument();
    expect(screen.queryByTestId("icon-chevron-down")).not.toBeInTheDocument();
  });

  it("stops excluded-items clicks from activating the row", async () => {
    vi.doMock("@controls/Icon", () => ({
      Icon: ({ iconName }: { iconName: string }) => <span data-testid={`icon-${iconName}`} />
    }));
    vi.doMock("@controls/SpaceFiller", () => ({
      SpaceFiller: () => null
    }));
    vi.doMock("@renderer/controls/layout/LabelSeparator", () => ({
      LabelSeparator: () => null
    }));

    const { ExplorerProjectItem } = await import(
      "@renderer/features/explorer/ExplorerProjectItem"
    );
    const onActivate = vi.fn();
    const onExcludedItemsClick = vi.fn();

    render(
      <ExplorerProjectItem
        canShowExcludedItems={true}
        focused={false}
        isBuildRoot={false}
        isKliveProject={true}
        isRoot={true}
        isSelected={false}
        node={createTreeNode({ isFolder: true, name: "project" }) as any}
        tabIndex={0}
        onActivate={onActivate}
        onContextMenu={vi.fn()}
        onDoubleClick={vi.fn()}
        onExcludedItemsClick={onExcludedItemsClick}
        onFocus={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("icon-exclude"));

    expect(onExcludedItemsClick).toHaveBeenCalledTimes(1);
    expect(onActivate).not.toHaveBeenCalled();
  });
});

describe("ExplorerEmptyState", () => {
  it("runs folder and project actions from the empty explorer state", async () => {
    const onCreateProject = vi.fn();
    const onOpenFolder = vi.fn(() => Promise.resolve());
    const { ExplorerEmptyState } = await import(
      "@renderer/features/explorer/ExplorerEmptyState"
    );

    render(
      <ExplorerEmptyState
        dimmed={false}
        onCreateProject={onCreateProject}
        onOpenFolder={onOpenFolder}
      />
    );

    fireEvent.click(screen.getByText("Open Folder"));
    fireEvent.click(screen.getByText("Create a Klive Project"));

    expect(onOpenFolder).toHaveBeenCalledTimes(1);
    expect(onCreateProject).toHaveBeenCalledTimes(1);
  });

  it("disables empty-state actions while menus are dimmed", async () => {
    const { ExplorerEmptyState } = await import(
      "@renderer/features/explorer/ExplorerEmptyState"
    );

    render(
      <ExplorerEmptyState dimmed={true} onCreateProject={vi.fn()} onOpenFolder={vi.fn()} />
    );

    expect(screen.getByText("Open Folder")).toBeDisabled();
    expect(screen.getByText("Create a Klive Project")).toBeDisabled();
  });
});

describe("ExplorerContextMenu", () => {
  it("renders project-node actions and conceals before running commands", async () => {
    vi.doMock("@controls/ContextMenu", () => ({
      ContextMenu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      ContextMenuItem: ({
        clicked,
        disabled,
        text
      }: {
        clicked?: () => void;
        disabled?: boolean;
        text: string;
      }) => (
        <button type="button" disabled={disabled} onClick={clicked}>
          {text}
        </button>
      ),
      ContextMenuSeparator: () => <hr />,
      useContextMenuState: vi.fn()
    }));

    const onConceal = vi.fn();
    const onNewFile = vi.fn();
    const onRefresh = vi.fn(() => Promise.resolve());
    const { ExplorerContextMenu } = await import(
      "@renderer/features/explorer/ExplorerContextMenu"
    );

    render(
      <ExplorerContextMenu
        appServices={{} as any}
        isKliveProject={true}
        isWindows={false}
        onClickOutside={vi.fn()}
        onCollapseAll={vi.fn()}
        onConceal={onConceal}
        onDelete={vi.fn()}
        onExclude={vi.fn()}
        onExpandAll={vi.fn()}
        onNewFile={onNewFile}
        onNewFolder={vi.fn()}
        onRefresh={onRefresh}
        onRename={vi.fn()}
        onReveal={vi.fn()}
        onToggleBuildRoot={vi.fn()}
        selectedContextNode={createTreeNode({ isFolder: true, name: "project" }) as any}
        selectedContextNodeIsFolder={true}
        selectedNodeIsBuildRoot={false}
        selectedNodeIsProjectFile={false}
        selectedNodeIsRoot={true}
        state={{ contextVisible: true, contextRef: null, contextX: 0, contextY: 0 }}
        store={{} as any}
      />
    );

    fireEvent.click(screen.getByText("New file..."));
    fireEvent.click(screen.getByText("Refresh"));

    expect(onConceal).toHaveBeenCalledTimes(2);
    expect(onNewFile).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Reveal in Finder")).toBeInTheDocument();
  });
});

describe("explorer keyboard support", () => {
  it("moves focus with ArrowDown and ArrowUp without changing selection", async () => {
    const { handleExplorerKeyboardCommand } = await import(
      "@renderer/features/explorer/explorerKeyboard"
    );
    const nodes = [
      createTreeNode({ name: "project" }),
      createTreeNode({ name: "src" }),
      createTreeNode({ name: "main.asm" })
    ];
    const onFocusChange = vi.fn();
    const onSelectionChange = vi.fn();

    expect(
      handleExplorerKeyboardCommand({
        focusedIndex: -1,
        key: "ArrowDown",
        visibleNodes: nodes as any,
        onDelete: vi.fn(),
        onFocusChange,
        onRememberExpandedItems: vi.fn(),
        onSelectionChange,
        onTreeChanged: vi.fn()
      })
    ).toBe(true);
    expect(onFocusChange).toHaveBeenCalledWith(0);
    expect(onSelectionChange).not.toHaveBeenCalled();

    handleExplorerKeyboardCommand({
      focusedIndex: 0,
      key: "ArrowUp",
      visibleNodes: nodes as any,
      onDelete: vi.fn(),
      onFocusChange,
      onRememberExpandedItems: vi.fn(),
      onSelectionChange,
      onTreeChanged: vi.fn()
    });

    expect(onFocusChange).toHaveBeenLastCalledWith(0);
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it("toggles folders without selecting them and selects leaf files with Space", async () => {
    const { handleExplorerKeyboardCommand } = await import(
      "@renderer/features/explorer/explorerKeyboard"
    );
    const folder = createTreeNode({ isFolder: true, name: "src" });
    const file = createTreeNode({ isFolder: false, name: "main.asm" });
    const onLeafActivate = vi.fn();
    const onRememberExpandedItems = vi.fn();
    const onSelectionChange = vi.fn();
    const onTreeChanged = vi.fn();

    expect(
      handleExplorerKeyboardCommand({
        focusedIndex: 0,
        key: " ",
        visibleNodes: [folder, file] as any,
        onDelete: vi.fn(),
        onFocusChange: vi.fn(),
        onLeafActivate,
        onRememberExpandedItems,
        onSelectionChange,
        onTreeChanged
      })
    ).toBe(true);

    expect(folder.isExpanded).toBe(true);
    expect(onTreeChanged).toHaveBeenCalledTimes(1);
    expect(onRememberExpandedItems).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).not.toHaveBeenCalled();

    handleExplorerKeyboardCommand({
      focusedIndex: 1,
      key: " ",
      visibleNodes: [folder, file] as any,
      onDelete: vi.fn(),
      onFocusChange: vi.fn(),
      onLeafActivate,
      onRememberExpandedItems,
      onSelectionChange,
      onTreeChanged
    });

    expect(file.isExpanded).toBe(false);
    expect(onTreeChanged).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenCalledWith(1);
    expect(onLeafActivate).toHaveBeenCalledWith(file);
  });

  it("opens the delete flow only for nodes that can use the Delete context action", async () => {
    const { handleExplorerKeyboardCommand } = await import(
      "@renderer/features/explorer/explorerKeyboard"
    );
    const root = createTreeNode({ isFolder: true, name: "project" });
    const file = {
      ...createTreeNode({ isFolder: false, name: "main.asm" }),
      parentNode: root
    };
    const projectFile = {
      ...createTreeNode({ isFolder: false, name: "klive.project" }),
      level: 1,
      parentNode: root
    };
    const onDelete = vi.fn();
    const baseArgs = {
      key: "Delete",
      onDelete,
      onFocusChange: vi.fn(),
      onRememberExpandedItems: vi.fn(),
      onSelectionChange: vi.fn(),
      onTreeChanged: vi.fn()
    };

    expect(
      handleExplorerKeyboardCommand({
        ...baseArgs,
        focusedIndex: 1,
        visibleNodes: [root, file, projectFile] as any
      })
    ).toBe(true);
    expect(onDelete).toHaveBeenCalledWith(file);

    handleExplorerKeyboardCommand({
      ...baseArgs,
      focusedIndex: 0,
      visibleNodes: [root, file, projectFile] as any
    });
    handleExplorerKeyboardCommand({
      ...baseArgs,
      focusedIndex: 2,
      visibleNodes: [root, file, projectFile] as any
    });

    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

describe("useExplorerTree", () => {
  it("loads the project folder once on mount and refreshes without cache after explorer changes", async () => {
    const visibleNodes = [createTreeNode({ isFolder: true, name: "project" })];
    const tree = createTreeView(visibleNodes);
    const buildProjectTree = vi.fn(() => tree);
    vi.doMock("@renderer/appIde/project/project-node", () => ({ buildProjectTree }));

    const { clearExplorerFolderCache, useExplorerTree } = await import(
      "@renderer/features/explorer/useExplorerTree"
    );
    clearExplorerFolderCache();

    const excludedItems: string[] = [];
    const mainApi = {
      getDirectoryContent: vi.fn(() => Promise.resolve({ name: "project", children: [] }))
    };
    const projectService = {
      getDocumentById: vi.fn(),
      itemDeleted: createEvent(),
      itemRenamed: createEvent(),
      projectClosed: createEvent(),
      setProjectTree: vi.fn()
    };
    const store = {};

    const { result, rerender, unmount } = renderHook(
      ({ version }) =>
        useExplorerTree({
          excludedItems,
          explorerViewVersion: version,
          folderPath: "/project",
          mainApi: mainApi as any,
          projectService: projectService as any,
          store: store as any
        }),
      { initialProps: { version: 1 } }
    );

    await waitFor(() => expect(mainApi.getDirectoryContent).toHaveBeenCalledTimes(1));
    expect(result.current.visibleNodes).toBe(visibleNodes);
    expect(projectService.setProjectTree).toHaveBeenCalledWith(tree);

    rerender({ version: 2 });

    await waitFor(() => expect(mainApi.getDirectoryContent).toHaveBeenCalledTimes(2));
    expect(buildProjectTree).toHaveBeenCalledTimes(2);

    unmount();
    expect(projectService.projectClosed.off).toHaveBeenCalledTimes(1);
    expect(projectService.itemDeleted.off).toHaveBeenCalledTimes(1);
    expect(projectService.itemRenamed.off).toHaveBeenCalledTimes(1);
  });

  it("clears the selected index when the selected node is no longer visible", async () => {
    const root = createTreeNode({ isFolder: true, name: "project" });
    const folder = createTreeNode({ isFolder: true, name: "src" });
    const firstChild = createTreeNode({ isFolder: false, name: "one.asm" });
    const secondChild = createTreeNode({ isFolder: false, name: "two.asm" });
    const selectedChild = createTreeNode({ isFolder: false, name: "three.asm" });
    const nextVisibleSibling = createTreeNode({ isFolder: false, name: "after.asm" });
    let visibleNodes = [root, folder, firstChild, secondChild, selectedChild, nextVisibleSibling];
    const tree = createTreeView(visibleNodes);
    tree.getVisibleNodes = vi.fn(() => visibleNodes);
    const buildProjectTree = vi.fn(() => tree);
    vi.doMock("@renderer/appIde/project/project-node", () => ({ buildProjectTree }));

    const { clearExplorerFolderCache, useExplorerTree } = await import(
      "@renderer/features/explorer/useExplorerTree"
    );
    clearExplorerFolderCache();

    const mainApi = {
      getDirectoryContent: vi.fn(() => Promise.resolve({ name: "project", children: [] }))
    };
    const projectService = {
      getDocumentById: vi.fn(),
      itemDeleted: createEvent(),
      itemRenamed: createEvent(),
      projectClosed: createEvent(),
      setProjectTree: vi.fn()
    };

    const { result } = renderHook(() =>
      useExplorerTree({
        explorerViewVersion: 1,
        folderPath: "/project",
        mainApi: mainApi as any,
        projectService: projectService as any,
        store: {} as any
      })
    );

    await waitFor(() => expect(result.current.visibleNodes).toHaveLength(6));

    act(() => {
      result.current.setSelected(4);
    });

    expect(result.current.selected).toBe(4);

    visibleNodes = [root, folder, nextVisibleSibling];

    act(() => {
      result.current.refreshTree();
    });

    expect(result.current.visibleNodes).toHaveLength(3);
    expect(result.current.selected).toBe(-1);
  });
});

describe("explorer file operations", () => {
  it("renames files, breakpoints, and build-root metadata together", async () => {
    vi.doMock("@renderer/appIde/project/project-node", () => ({
      getNodeDir: (path: string) => path.split("/").slice(0, -1).join("/"),
      compareProjectNode: (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name),
      getFileTypeEntry: vi.fn()
    }));
    const { TreeNode } = await import("@renderer/core/tree-node");
    const { renameExplorerNode } = await import(
      "@renderer/features/explorer/explorerFileOperations"
    );
    const selectedContextNode = new TreeNode({
      isFolder: false,
      name: "old.asm",
      fullPath: "/project/src/old.asm",
      projectPath: "src/old.asm"
    });
    const dispatch = vi.fn();
    const mainApi = {
      displayMessageBox: vi.fn(),
      renameFileEntry: vi.fn(() => Promise.resolve()),
      saveProject: vi.fn(() => Promise.resolve())
    };
    const projectService = {
      performAllDelayedSavesNow: vi.fn(() => Promise.resolve()),
      renameDocument: vi.fn()
    };
    const emuApi = {
      renameBreakpoints: vi.fn(() => Promise.resolve())
    };
    const setSelectedNode = vi.fn();
    const refreshTree = vi.fn();

    await renameExplorerNode({
      buildRoots: ["src/old.asm"],
      dispatch,
      emuApi,
      mainApi,
      newName: "new.asm",
      projectService,
      refreshTree,
      selectedContextNode: selectedContextNode as any,
      setSelectedNode
    });

    expect(projectService.performAllDelayedSavesNow).toHaveBeenCalledTimes(1);
    expect(mainApi.renameFileEntry).toHaveBeenCalledWith(
      "/project/src/old.asm",
      "/project/src/new.asm"
    );
    expect(projectService.renameDocument).toHaveBeenCalledWith(
      "/project/src/old.asm",
      "/project/src/new.asm"
    );
    expect(emuApi.renameBreakpoints).toHaveBeenCalledWith("src/old.asm", "src/new.asm");
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_BUILD_ROOT",
      payload: { files: ["src/new.asm"], flag: true }
    });
    expect(mainApi.saveProject).toHaveBeenCalledTimes(1);
    expect(refreshTree).toHaveBeenCalledTimes(1);
    expect(setSelectedNode).toHaveBeenCalledWith(selectedContextNode);
  });

  it("deletes files from disk and removes their tree node", async () => {
    vi.doMock("@renderer/appIde/project/project-node", () => ({
      getNodeDir: (path: string) => path.split("/").slice(0, -1).join("/"),
      compareProjectNode: vi.fn(),
      getFileTypeEntry: vi.fn()
    }));
    const { TreeNode } = await import("@renderer/core/tree-node");
    const { deleteExplorerNode } = await import(
      "@renderer/features/explorer/explorerFileOperations"
    );
    const parent = new TreeNode({ isFolder: true, name: "src", fullPath: "/project/src" });
    const child = new TreeNode({
      isFolder: false,
      name: "old.asm",
      fullPath: "/project/src/old.asm",
      projectPath: "src/old.asm"
    });
    parent.appendChild(child);
    const mainApi = {
      checkBuildRoot: vi.fn(() => Promise.resolve()),
      deleteFileEntry: vi.fn(() => Promise.resolve())
    };
    const projectService = { signItemDeleted: vi.fn() };
    const refreshTree = vi.fn();

    await deleteExplorerNode({
      mainApi,
      projectService,
      refreshTree,
      selectedContextNode: child as any,
      selectedContextNodeIsFolder: false
    });

    expect(mainApi.deleteFileEntry).toHaveBeenCalledWith(false, "/project/src/old.asm");
    expect(parent.children).toHaveLength(0);
    expect(refreshTree).toHaveBeenCalledTimes(1);
    expect(projectService.signItemDeleted).toHaveBeenCalledWith(child);
    expect(mainApi.checkBuildRoot).toHaveBeenCalledWith("src/old.asm");
  });

  it("adds a new file node and schedules navigation to it", async () => {
    vi.doMock("@renderer/appIde/project/project-node", () => ({
      compareProjectNode: (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name),
      getFileTypeEntry: () => ({ icon: "file-code", editor: "code", isBinary: false }),
      getNodeDir: (path: string) => path.split("/").slice(0, -1).join("/")
    }));
    const { TreeNode } = await import("@renderer/core/tree-node");
    const { addExplorerItem } = await import(
      "@renderer/features/explorer/explorerFileOperations"
    );
    const selectedContextNode = new TreeNode({
      isFolder: true,
      name: "src",
      fullPath: "/project/src",
      projectPath: "src"
    });
    const mainApi = {
      addNewFileEntry: vi.fn(() => Promise.resolve()),
      displayMessageBox: vi.fn()
    };
    const projectService = { signItemAdded: vi.fn() };
    const ideCommandsService = { executeCommand: vi.fn(() => Promise.resolve()) };
    const setSelectedNode = vi.fn();
    const refreshTree = vi.fn();
    const scheduled: (() => Promise<void>)[] = [];

    const newNode = await addExplorerItem({
      ideCommandsService,
      mainApi,
      newItemIsFolder: false,
      newName: "new.asm",
      projectService,
      refreshTree,
      scheduleNavigation: (action) => scheduled.push(action),
      selectedContextNode: selectedContextNode as any,
      setSelectedNode,
      store: {} as any,
    });

    expect(mainApi.addNewFileEntry).toHaveBeenCalledWith("new.asm", false, "/project/src");
    expect(selectedContextNode.children).toContain(newNode);
    expect(newNode.data.editor).toBe("code");
    expect(refreshTree).toHaveBeenCalledTimes(1);
    expect(projectService.signItemAdded).toHaveBeenCalledWith(newNode);
    expect(setSelectedNode).toHaveBeenCalledWith(newNode);

    await scheduled[0]();
    expect(ideCommandsService.executeCommand).toHaveBeenCalledWith(
      'nav "/project/src/new.asm"'
    );
  });
});

function createDocument(id: string, name: string, editPosition = { line: 0, column: 0 }) {
  return {
    editPosition,
    editVersionCount: 0,
    iconFill: undefined,
    iconName: undefined,
    id,
    isLocked: false,
    isReadOnly: false,
    isTemporary: false,
    name,
    node: {
      fullPath: id,
      name,
      projectPath: id
    },
    path: id,
    savedVersionCount: 0,
    type: "code"
  };
}

function createTreeNode(data: Record<string, unknown>) {
  return {
    children: [],
    data: {
      fullPath: "/project",
      projectPath: "/project",
      ...data
    },
    isExpanded: false,
    level: 0
  };
}

function createTreeView(visibleNodes: unknown[]) {
  return {
    buildIndex: vi.fn(),
    findIndex: vi.fn(() => -1),
    getViewNodeByIndex: vi.fn((idx: number) => visibleNodes[idx]),
    getVisibleNodes: vi.fn(() => visibleNodes),
    rootNode: visibleNodes[0]
  };
}

function createEvent() {
  const handlers: unknown[] = [];
  return {
    handlers,
    off: vi.fn((handler: unknown) => {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    }),
    on: vi.fn((handler: unknown) => {
      handlers.push(handler);
    })
  };
}
