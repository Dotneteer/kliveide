import { afterEach, describe, expect, it, vi } from "vitest";
import { CODE_EDITOR, MEMORY_EDITOR, MEMORY_PANEL_ID } from "@common/state/common-ids";
import { createDocumentHubService } from "@renderer/appIde/services/DocumentHubService";
import { createProjectService } from "@renderer/appIde/services/ProjectService";
import {
  captureSavedDocument,
  getPopOutBlocker,
  openDockedDocument,
  popOutDocument,
  routeToFloatingDocument
} from "@renderer/features/documents/floatingDocumentTransfer";
import { setDocumentAreaCommandTarget } from "@renderer/features/documents/documentAreaCommandTarget";
import {
  createDocumentAreaWorkspace,
  getMultiAreaDocumentWorkspace,
  getSavedFloatingDocuments
} from "@renderer/features/documents/useDocumentWorkspacePersistence";
import { createSingleAreaLayout } from "@renderer/features/documents/documentAreaLayout";
import { restoreFloatingDocuments } from "@renderer/appIde/restoreLastOpenDocuments";
import { processMainToIdeMessages } from "@renderer/appIde/MainToIdeProcessor";
import { NavigateToDocumentCommand } from "@renderer/appIde/commands/DocumentCommands";
import { createMockContext } from "../commands/test-helpers/mock-context";
import { floatHubIdBase } from "@common/messaging/floating-documents";

const PROJECT = "/project";
const FILE = `${PROJECT}/src/main.asm`;

function storeWith(state: Record<string, any>) {
  return { dispatch: vi.fn(), getState: vi.fn(() => state), subscribe: vi.fn(() => () => {}) };
}

function projectServiceFor(hubs: any[] = []) {
  const shells = new Map<string, any>();
  const service: any = {
    closeInDocumentHub: vi.fn(),
    closeDocumentHubService: vi.fn(),
    openInDocumentHub: vi.fn(),
    projectClosed: { off: vi.fn(), on: vi.fn() },
    performAllDelayedSavesNow: vi.fn(async () => {}),
    getDocumentHubServiceInstances: vi.fn(() => hubs),
    getActiveDocumentHubService: vi.fn(() => hubs[0]),
    setActiveDocumentHubService: vi.fn(),
    createDocumentHubService: vi.fn(),
    getDocumentForProjectNode: vi.fn(async () => {}),
    getNodeForFile: vi.fn((id: string) =>
      id.startsWith(`${PROJECT}/`)
        ? { data: { editor: CODE_EDITOR, fullPath: id, name: id.split("/").pop(), isFolder: false } }
        : undefined
    ),
    getDocumentShellForProjectNode: vi.fn((node: any) => {
      if (!shells.has(node.fullPath)) {
        shells.set(node.fullPath, {
          id: node.fullPath,
          name: node.name,
          path: node.fullPath,
          type: node.editor,
          contents: "ld a,1",
          editVersionCount: 1,
          savedVersionCount: 1
        });
      }
      return shells.get(node.fullPath);
    })
  };
  return service;
}

function fileDocument(id = FILE) {
  return {
    id,
    name: id.split("/").pop(),
    path: id,
    type: CODE_EDITOR,
    contents: "ld a,1",
    editPosition: { line: 17, column: 5 },
    editVersionCount: 1,
    savedVersionCount: 1
  } as any;
}

afterEach(() => setDocumentAreaCommandTarget(undefined as any));

describe("Pop Out to Window: which documents may float (plan Q5)", () => {
  const state = (count = 0) => {
    const floatingDocuments: Record<number, any> = {};
    for (let slot = 1; slot <= count; slot++) {
      floatingDocuments[slot] = { slot, document: { id: `${PROJECT}/f${slot}`, type: CODE_EDITOR } };
    }
    return { project: { folderPath: PROJECT }, floatingDocuments } as any;
  };

  it("lets a project file and a restorable special document float", () => {
    expect(getPopOutBlocker({ id: FILE, type: CODE_EDITOR }, state())).toBeUndefined();
    expect(getPopOutBlocker({ id: MEMORY_PANEL_ID, type: MEMORY_EDITOR }, state())).toBeUndefined();
  });

  it("disables it at 8 windows", () => {
    expect(getPopOutBlocker({ id: FILE, type: CODE_EDITOR }, state(7))).toBeUndefined();
    expect(getPopOutBlocker({ id: FILE, type: CODE_EDITOR }, state(8))).toBe("limit");
  });

  it("keeps out what the workspace cannot restore, and kinds marked not floatable", () => {
    expect(getPopOutBlocker({ id: "/elsewhere/x.asm", type: CODE_EDITOR }, state())).toBe("notFloatable");
    expect(getPopOutBlocker({ id: "lib/x.bas", type: CODE_EDITOR }, state())).toBe("notFloatable");
    expect(getPopOutBlocker({ id: FILE, type: CODE_EDITOR, floatable: false }, state())).toBe(
      "notFloatable"
    );
  });
});

describe("moving a document between windows (plan §3.4)", () => {
  it("flushes the saves, asks main for a window, and only then lets the tab go", async () => {
    const store = storeWith({});
    const projectService = projectServiceFor();
    const hub = createDocumentHubService(1, store as never, projectService as never);
    await hub.openDocument(fileDocument(), { scrollTop: 120, cursor: { line: 17 } }, false);
    const order: string[] = [];
    projectService.performAllDelayedSavesNow.mockImplementation(async () => order.push("save"));
    const mainApi = {
      openFloatingDocument: vi.fn(async () => {
        order.push("open");
        expect(hub.isOpen(FILE)).toBe(true);
        return { slot: 3 as const };
      })
    };

    const result = await popOutDocument({
      hub,
      documentId: FILE,
      sourceAreaId: "document-area-2",
      projectService,
      mainApi
    });

    expect(result).toEqual({ slot: 3 });
    expect(order).toEqual(["save", "open"]);
    expect(mainApi.openFloatingDocument).toHaveBeenCalledWith({
      document: {
        type: CODE_EDITOR,
        id: FILE,
        position: { line: 17, column: 5 },
        viewState: { scrollTop: 120, cursor: { line: 17 } }
      },
      sourceAreaId: "document-area-2"
    });
    expect(hub.isOpen(FILE)).toBe(false);
  });

  it("leaves the tab where it was when main refuses", async () => {
    const store = storeWith({});
    const projectService = projectServiceFor();
    const hub = createDocumentHubService(1, store as never, projectService as never);
    await hub.openDocument(fileDocument(), undefined, false);
    const result = await popOutDocument({
      hub,
      documentId: FILE,
      projectService,
      mainApi: { openFloatingDocument: vi.fn(async () => ({ error: "limit" as const })) }
    });
    expect(result).toEqual({ error: "limit" });
    expect(hub.isOpen(FILE)).toBe(true);
  });

  it("round-trips the position and view state into the area the document came from", async () => {
    const store = storeWith({ project: { folderPath: PROJECT } });
    const satelliteService = projectServiceFor();
    const satelliteHub = createDocumentHubService(1001, store as never, satelliteService as never);
    const viewState = { scrollTop: 340, selections: [{ line: 40 }] };
    await satelliteHub.openDocument(fileDocument(), viewState, false);
    const saved = captureSavedDocument(satelliteHub, satelliteHub.getDocument(FILE)!);

    // --- The IDE: two areas, the document came from the second
    const ideService = projectServiceFor();
    const area1 = createDocumentHubService(1, store as never, ideService as never);
    const area2 = createDocumentHubService(2, store as never, ideService as never);
    ideService.getDocumentHubServiceInstances.mockReturnValue([area1, area2]);
    ideService.getActiveDocumentHubService.mockReturnValue(area1);
    const activateArea = vi.fn();
    setDocumentAreaCommandTarget({
      getHubForArea: (id: string) => (id === "document-area-2" ? area2 : undefined),
      activateArea
    } as any);

    expect(
      await openDockedDocument(ideService, store as never, {
        document: saved,
        sourceAreaId: "document-area-2"
      })
    ).toBe(true);

    expect(area1.isOpen(FILE)).toBe(false);
    expect(area2.getActiveDocument()?.id).toBe(FILE);
    expect(area2.getActiveDocument()?.editPosition).toEqual({ line: 17, column: 5 });
    expect(area2.getDocumentViewState(FILE)).toEqual(viewState);
    expect(activateArea).toHaveBeenCalledWith("document-area-2");
  });

  it("docks into the active area when the source area is gone", async () => {
    const store = storeWith({ project: { folderPath: PROJECT } });
    const ideService = projectServiceFor();
    const area1 = createDocumentHubService(1, store as never, ideService as never);
    ideService.getDocumentHubServiceInstances.mockReturnValue([area1]);
    ideService.getActiveDocumentHubService.mockReturnValue(area1);
    setDocumentAreaCommandTarget({ getHubForArea: () => undefined } as any);
    await openDockedDocument(ideService, store as never, {
      document: { id: FILE, type: CODE_EDITOR, position: { line: 2, column: 1 } },
      sourceAreaId: "document-area-9"
    });
    expect(area1.getActiveDocument()?.id).toBe(FILE);
  });

  it("refuses a document that no longer exists", async () => {
    const store = storeWith({ project: { folderPath: PROJECT } });
    const ideService = projectServiceFor();
    ideService.getNodeForFile.mockReturnValue(undefined);
    expect(
      await openDockedDocument(ideService, store as never, {
        document: { id: FILE, type: CODE_EDITOR }
      })
    ).toBe(false);
  });
});

describe("opening a floating document elsewhere (plan §2.3)", () => {
  const floatingState = {
    project: { folderPath: PROJECT },
    floatingDocuments: { 4: { slot: 4, document: { id: FILE, type: CODE_EDITOR } } }
  };

  it("focuses its window instead of opening a second copy", async () => {
    const mainApi = { focusFloatingDocument: vi.fn(async () => true) };
    expect(
      await routeToFloatingDocument(storeWith(floatingState) as never, mainApi, FILE, 12, 3)
    ).toBe(true);
    expect(mainApi.focusFloatingDocument).toHaveBeenCalledWith({ documentId: FILE, line: 12, column: 3 });
    expect(
      await routeToFloatingDocument(storeWith(floatingState) as never, mainApi, `${PROJECT}/x.asm`)
    ).toBe(false);
  });

  it("nav in the IDE goes to the floating window", async () => {
    const context: any = createMockContext();
    context.messageSource = "ide";
    context.store.getState.mockReturnValue(floatingState);
    context.service.projectService.getNodeForFile.mockReturnValue({ data: { fullPath: FILE } });
    context.mainApi.focusFloatingDocument = vi.fn(async () => true);
    const docService = context.service.projectService.getActiveDocumentHubService();

    const result = await new NavigateToDocumentCommand().execute(context, { filename: FILE, lineNo: 9 });

    expect(result.success).toBe(true);
    expect(context.mainApi.focusFloatingDocument).toHaveBeenCalledWith({
      documentId: FILE,
      line: 9,
      column: undefined
    });
    expect(docService.openDocument).not.toHaveBeenCalled();
  });

  it("nav in a floating window opens another document in the IDE", async () => {
    const context: any = createMockContext();
    context.messageSource = "float2";
    context.store.getState.mockReturnValue({ project: { folderPath: PROJECT } });
    const other = `${PROJECT}/src/other.asm`;
    context.service.projectService.getNodeForFile.mockReturnValue({ data: { fullPath: other } });
    const docService = context.service.projectService.getActiveDocumentHubService();
    docService.isOpen = vi.fn(() => false);
    context.mainApi.navigateInIde = vi.fn(async () => {});

    await new NavigateToDocumentCommand().execute(context, { filename: other, lineNo: 4, columnNo: 2 });

    expect(context.mainApi.navigateInIde).toHaveBeenCalledWith(other, 4, 2);
    expect(docService.openDocument).not.toHaveBeenCalled();
  });
});

describe("the workspace remembers floating documents (plan Q3, version 3)", () => {
  const entries = [
    {
      slot: 1 as const,
      document: { id: FILE, type: CODE_EDITOR, position: { line: 3, column: 1 }, viewState: { a: 1 } },
      sourceAreaId: "document-area-1",
      bounds: { x: 1, y: 2, width: 300, height: 200 }
    },
    { slot: 2 as const, document: { id: "/elsewhere/z.asm", type: CODE_EDITOR } },
    { slot: 3 as const, document: { id: MEMORY_PANEL_ID, type: MEMORY_EDITOR } }
  ];

  it("saves them with their bounds as version 3, and stays version 2 without them", () => {
    const layout = createSingleAreaLayout("document-area-1");
    const withFloating = createDocumentAreaWorkspace(layout, new Map(), "document-area-1", PROJECT, entries);
    expect(withFloating.version).toBe(3);
    expect(withFloating.floating).toEqual([
      {
        document: { id: FILE, type: CODE_EDITOR, position: { line: 3, column: 1 }, viewState: { a: 1 } },
        sourceAreaId: "document-area-1",
        bounds: { x: 1, y: 2, width: 300, height: 200 }
      },
      { document: { id: MEMORY_PANEL_ID, type: MEMORY_EDITOR, position: { line: 0, column: 0 } } }
    ]);
    const without = createDocumentAreaWorkspace(layout, new Map(), "document-area-1", PROJECT);
    expect(without.version).toBe(2);
    expect(without).not.toHaveProperty("floating");
  });

  it("reads version 3 like version 2, and version 2 as having none", () => {
    const layout = createSingleAreaLayout("document-area-1");
    const v3 = createDocumentAreaWorkspace(layout, new Map(), "document-area-1", PROJECT, entries);
    expect(getMultiAreaDocumentWorkspace(v3)?.areas).toHaveLength(1);
    expect(getSavedFloatingDocuments(v3)).toHaveLength(2);
    expect(getSavedFloatingDocuments({ ...v3, version: 2, floating: undefined })).toEqual([]);
    expect(getSavedFloatingDocuments({ documents: [] })).toEqual([]);
  });

  it("reopens them floating, skipping what is open, missing or already floating", async () => {
    const layout = createSingleAreaLayout("document-area-1");
    const missing = `${PROJECT}/gone.asm`;
    const openInIde = `${PROJECT}/open.asm`;
    const workspace = createDocumentAreaWorkspace(layout, new Map(), "document-area-1", PROJECT, [
      ...entries,
      { slot: 4, document: { id: missing, type: CODE_EDITOR } },
      { slot: 5, document: { id: openInIde, type: CODE_EDITOR } }
    ]);
    const store = storeWith({
      project: { folderPath: PROJECT },
      workspaceSettings: { docsWorkspace: workspace },
      floatingDocuments: {}
    });
    const projectService = projectServiceFor([{ isOpen: (id: string) => id === openInIde }]);
    projectService.getNodeForFile.mockImplementation((id: string) =>
      id === missing ? undefined : { data: { fullPath: id } }
    );
    const mainApi = { openFloatingDocument: vi.fn(async () => ({ slot: 1 as const })) };

    await restoreFloatingDocuments(store as never, mainApi, projectService);

    expect(mainApi.openFloatingDocument.mock.calls.map((c: any[]) => c[0].document.id)).toEqual([
      FILE,
      MEMORY_PANEL_ID
    ]);
    expect(mainApi.openFloatingDocument.mock.calls[0][0]).toMatchObject({
      sourceAreaId: "document-area-1",
      bounds: { x: 1, y: 2, width: 300, height: 200 }
    });
  });
});

describe("a satellite's services (plan §3.1, §3.5)", () => {
  it("takes its document hub IDs from its own range", () => {
    const store = storeWith({});
    const service = createProjectService(store as never, {} as never, { hubIdBase: floatHubIdBase(3) });
    const first = service.createDocumentHubService();
    const second = service.createDocumentHubService();
    expect(first.hubId).toBe(3001);
    expect(second.hubId).toBe(3002);
    const ide = createProjectService(store as never, {} as never);
    expect(ide.createDocumentHubService().hubId).toBe(1);
  });

  it("drops a file another renderer saved from the file-content cache", async () => {
    const forgetFile = vi.fn();
    const response = await processMainToIdeMessages(
      { type: "ApiMethodRequest", method: "fileContentChanged", args: [FILE] } as any,
      storeWith({}) as never,
      { projectService: { forgetFile } } as any
    );
    expect(response.type).toBe("ApiMethodResponse");
    expect(forgetFile).toHaveBeenCalledWith(FILE);
  });

  it("answers the floating-only calls with an error in the IDE window", async () => {
    const response = await processMainToIdeMessages(
      { type: "ApiMethodRequest", method: "requestFloatingClose", args: [] } as any,
      storeWith({}) as never,
      {} as any
    );
    expect(response.type).toBe("ErrorResponse");
  });

  it("replays a forwarded action under the source it is given", async () => {
    const store = storeWith({});
    await processMainToIdeMessages(
      { type: "ForwardAction", action: { type: "SET_THEME" }, sourceId: "ide" } as any,
      store as never,
      {} as any,
      "main"
    );
    expect(store.dispatch).toHaveBeenCalledWith({ type: "SET_THEME" }, "main");
  });
});
