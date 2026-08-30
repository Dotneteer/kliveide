import { describe, expect, it, vi } from "vitest";
import { CODE_EDITOR } from "@common/state/common-ids";
import {
  createNexAnnotationProjectNode,
  createNexAnnotationSidecar,
  formatNexAnnotations,
  getAnnotatedDisassemblyOffsetForBank,
  getNexAnnotationSidecarPaths,
  loadNexAnnotationSidecar,
  openNexAnnotationSidecarDocument
} from "@renderer/appIde/DocumentPanels/Next/nexAnnotationSidecar";

describe("NEX annotation sidecar helpers", () => {
  it("derives annotation paths from a NEX document", () => {
    expect(
      getNexAnnotationSidecarPaths({
        id: "/project/ScrollNutter.nex",
        name: "ScrollNutter.nex",
        type: "NexViewer",
        node: {
          isFolder: false,
          name: "ScrollNutter.nex",
          fullPath: "/project/ScrollNutter.nex",
          projectPath: "ScrollNutter.nex"
        }
      })
    ).toEqual({
      fullPath: "/project/ScrollNutter.nex.dis",
      projectPath: "ScrollNutter.nex.dis"
    });
  });

  it("reports a missing sidecar without treating it as an error", async () => {
    const projectService = {
      readFileContent: vi.fn(() => Promise.reject(new Error("File does not exist")))
    };

    const state = await loadNexAnnotationSidecar(
      projectService,
      { fullPath: "/project/game.nex.dis" },
      [0, 2, 5]
    );

    expect(state).toMatchObject({
      status: "missing",
      diagnostics: [],
      message: "No annotation sidecar file found."
    });
  });

  it("loads and validates an existing sidecar", async () => {
    const projectService = {
      readFileContent: vi.fn(() =>
        Promise.resolve(
          JSON.stringify({
            schemaVersion: 1,
            globalLabels: [{ name: "Start", value: 0xc000 }],
            banks: {
              "5": { offsetIndex: 3 }
            }
          })
        )
      )
    };

    const state = await loadNexAnnotationSidecar(
      projectService,
      { fullPath: "/project/game.nex.dis" },
      [5]
    );

    expect(state.status).toBe("loaded");
    expect(state.annotations?.banks["5"].offsetIndex).toBe(3);
    expect(state.diagnostics).toEqual([]);
    expect(projectService.readFileContent).toHaveBeenCalledWith("/project/game.nex.dis", false);
  });

  it("bypasses cached sidecar contents when checking the annotation file", async () => {
    const projectService = {
      getFileContent: vi.fn(() =>
        Promise.resolve(
          formatNexAnnotations({
            schemaVersion: 1,
            banks: {
              "5": {
                offsetIndex: 1,
                regions: [{ start: 0, end: 0x3fff, type: "disassemble" }]
              }
            }
          })
        )
      ),
      readFileContent: vi.fn(() => Promise.reject(new Error("File does not exist")))
    };

    const state = await loadNexAnnotationSidecar(
      projectService,
      { fullPath: "/project/game.nex.dis" },
      [5]
    );

    expect(state.status).toBe("missing");
    expect(projectService.getFileContent).not.toHaveBeenCalled();
  });

  it("keeps invalid sidecars available for read-only JSON opening", async () => {
    const projectService = {
      readFileContent: vi.fn(() =>
        Promise.resolve(
          JSON.stringify({
            schemaVersion: 1,
            banks: {
              "5": { offsetIndex: 4 }
            }
          })
        )
      )
    };

    const state = await loadNexAnnotationSidecar(
      projectService,
      { fullPath: "/project/game.nex.dis" },
      [5]
    );

    expect(state.status).toBe("invalid");
    expect(state.annotations).toBeUndefined();
    expect(state.diagnostics[0]).toMatchObject({
      severity: "error",
      path: "$.banks.5.offsetIndex"
    });
  });

  it("creates a default sidecar only when the file is missing", async () => {
    const savedContent: string[] = [];
    const projectService = {
      readFileContent: vi.fn(() => Promise.reject(new Error("File does not exist"))),
      saveFileContent: vi.fn((_path: string, content: string) => {
        savedContent.push(content);
        return Promise.resolve();
      })
    };

    const state = await createNexAnnotationSidecar(
      projectService,
      {
        fullPath: "/project/game.nex.dis",
        projectPath: "game.nex.dis"
      },
      {
        nexPath: "/project/game.nex",
        loadedBanks: [5, 2],
        getDefaultOffsetIndex: (bank) => (bank === 5 ? 1 : 2)
      }
    );

    expect(state.status).toBe("loaded");
    expect(projectService.saveFileContent).toHaveBeenCalledWith(
      "/project/game.nex.dis",
      savedContent[0]
    );
    expect(JSON.parse(savedContent[0])).toMatchObject({
      schemaVersion: 1,
      source: { fileName: "game.nex" },
      banks: {
        "5": { offsetIndex: 1 },
        "2": { offsetIndex: 2 }
      }
    });
    expect(savedContent[0].endsWith("\n")).toBe(true);
  });

  it("does not overwrite an existing sidecar", async () => {
    const projectService = {
      readFileContent: vi.fn(() =>
        Promise.resolve(
          formatNexAnnotations({
            schemaVersion: 1,
            banks: {
              "5": {
                offsetIndex: 1,
                regions: [{ start: 0, end: 0x3fff, type: "disassemble" }]
              }
            }
          })
        )
      ),
      saveFileContent: vi.fn()
    };

    const state = await createNexAnnotationSidecar(
      projectService,
      { fullPath: "/project/game.nex.dis" },
      { loadedBanks: [5] }
    );

    expect(state.status).toBe("loaded");
    expect(projectService.saveFileContent).not.toHaveBeenCalled();
  });

  it("uses annotation bank offsets before fallback offsets", () => {
    expect(
      getAnnotatedDisassemblyOffsetForBank(
        {
          schemaVersion: 1,
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [{ start: 0, end: 0x3fff, type: "disassemble" }]
            }
          }
        },
        5,
        0x4000
      )
    ).toBe(0x8000);
    expect(getAnnotatedDisassemblyOffsetForBank(undefined, 5, 0x4000)).toBe(0x4000);
  });

  it("creates a typed JSON project node for annotation files", () => {
    const node = createNexAnnotationProjectNode(
      {
        fullPath: "/project/game.nex.dis",
        projectPath: "game.nex.dis"
      },
      createStoreMock() as never
    );

    expect(node).toMatchObject({
      isFolder: false,
      name: "game.nex.dis",
      fullPath: "/project/game.nex.dis",
      projectPath: "game.nex.dis",
      editor: CODE_EDITOR,
      subType: "json",
      isReadOnly: true
    });
  });

  it("opens the sidecar document from the project tree or a synthetic node", async () => {
    const existingNode = {
      data: {
        isFolder: false,
        name: "game.nex.dis",
        fullPath: "/project/game.nex.dis",
        projectPath: "game.nex.dis",
        editor: CODE_EDITOR,
        subType: "json",
        isReadOnly: true
      }
    };
    const document = {
      id: "/project/game.nex.dis",
      name: "game.nex.dis",
      type: CODE_EDITOR,
      language: "json",
      isReadOnly: true
    };
    const projectService = {
      getNodeForFile: vi.fn(() => existingNode),
      getDocumentForProjectNode: vi.fn(() => Promise.resolve(document))
    };
    const documentHubService = {
      getDocument: vi.fn(() => undefined),
      setActiveDocument: vi.fn(),
      openDocument: vi.fn(() => Promise.resolve())
    };

    await openNexAnnotationSidecarDocument(
      projectService as never,
      documentHubService,
      { fullPath: "/project/game.nex.dis" },
      createStoreMock() as never
    );

    expect(projectService.getDocumentForProjectNode).toHaveBeenCalledWith(existingNode.data);
    expect(documentHubService.openDocument).toHaveBeenCalledWith(document, undefined, true);
  });
});

function createStoreMock() {
  return {
    dispatch: vi.fn(),
    getState: vi.fn(() => ({}))
  };
}
