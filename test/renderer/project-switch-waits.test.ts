import { describe, expect, it, vi } from "vitest";

/*
 * Creating a project while another one is open: the main process opens the new folder and forwards
 * the change to the IDE asynchronously, so for a while the previous project's tree and workspace are
 * still loaded. The waits must hold out for the new project's, or the New Project dialog opens the
 * previous project's `code/code.kz80.asm` (a ZX Spectrum 48K one in a new TVC project).
 */

vi.mock("@renderer/registry", () => ({
  outputPaneRegistry: { panes: [], getPane: vi.fn(), registerPane: vi.fn() },
  fileTypeRegistry: [],
  documentPanelRegistry: []
}));

const { ensureProjectLoaded, ensureWorkspaceLoaded, isSameFolder } = await import("@renderer/appIde/IdeEventsHandler");

const OLD = "/Users/me/KliveProjects/spectrum";
const NEW = "/Users/me/KliveProjects/tvc";

const treeOf = (folder: string) => ({ rootNode: { data: { fullPath: folder }, children: [] } }) as any;

describe("waiting for a newly opened project", () => {
  it("compares folders whatever their separators and trailing separator", () => {
    expect(isSameFolder("C:\\Klive\\tvc\\", "C:/Klive/tvc")).toBe(true);
    expect(isSameFolder(OLD, NEW)).toBe(false);
    expect(isSameFolder(undefined, NEW)).toBe(false);
  });

  it("does not take the previous project's tree for the new one", async () => {
    let tree = treeOf(OLD);
    const projectService = { getProjectTree: () => tree } as any;
    setTimeout(() => (tree = treeOf(NEW)), 150);
    const started = Date.now();
    expect(await ensureProjectLoaded(projectService, NEW)).toBe(true);
    expect(Date.now() - started).toBeGreaterThanOrEqual(100);
    // --- Without a folder, any tree will do (the IDE's own wait right after the folder changed)
    expect(await ensureProjectLoaded({ getProjectTree: () => treeOf(OLD) } as any)).toBe(true);
  });

  it("does not take the previous project's workspace for the new one", async () => {
    let project: any = { folderPath: OLD, workspaceLoaded: true };
    const store = { getState: () => ({ project }) } as any;
    setTimeout(() => (project = { folderPath: NEW, workspaceLoaded: false }), 100);
    setTimeout(() => (project = { folderPath: NEW, workspaceLoaded: true }), 250);
    const started = Date.now();
    await ensureWorkspaceLoaded(store, NEW);
    expect(Date.now() - started).toBeGreaterThanOrEqual(200);
    expect(project.folderPath).toBe(NEW);
  });
});

describe("ProjectService on a folder change", () => {
  it("drops the previous folder's tree", async () => {
    const { createProjectService } = await import("@renderer/appIde/services/ProjectService");
    let state: any = { project: { folderPath: OLD } };
    const listeners: (() => void)[] = [];
    const store = { getState: () => state, subscribe: (l: () => void) => listeners.push(l), dispatch: vi.fn() } as any;
    const service = createProjectService(store, {} as any);
    listeners.forEach((l) => l());
    service.setProjectTree(treeOf(OLD));
    expect(service.getProjectTree()).toBeDefined();

    state = { project: { folderPath: NEW } };
    listeners.forEach((l) => l());
    expect(service.getProjectTree()).toBeUndefined();
  });
});
