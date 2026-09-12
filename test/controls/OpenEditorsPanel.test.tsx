import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

/**
 * The Open Editors panel and its header badge.
 *
 * The behaviour worth pinning is the ordering rule — most recently activated first, with the
 * editor the user is actually in always on top — because it is the one thing a reader of the
 * component cannot check by looking at it: it depends on activation stamps handed out by the
 * document hubs, and on the split-view case where the current editor carries an older stamp than
 * the document activated in the pane beside it.
 */
describe("OpenEditorsPanel", () => {
  it("lists open documents with the most recently activated first", async () => {
    const hub = createHub(1, [document("a.asm"), document("b.asm"), document("c.asm")], 2, {
      "a.asm": 3,
      "b.asm": 1,
      "c.asm": 7
    });
    await renderPanel([hub], hub);

    expect(rowNames()).toEqual(["c.asm", "a.asm", "b.asm"]);
  });

  it("keeps never-activated documents in tab order, below the activated ones", async () => {
    // Background tabs all carry stamp 0; a stable sort must not shuffle them.
    const hub = createHub(1, [document("a.asm"), document("b.asm"), document("c.asm")], 0, {
      "a.asm": 4
    });
    await renderPanel([hub], hub);

    expect(rowNames()).toEqual(["a.asm", "b.asm", "c.asm"]);
  });

  it("puts the active document of the active hub first, even with an older stamp", async () => {
    // The split-view case: clicking into a pane makes its document the current editor without
    // activating it again, so it still carries the stamp from when it was last opened.
    const left = createHub(1, [document("left.asm")], 0, { "left.asm": 2 });
    const right = createHub(2, [document("right.asm")], 0, { "right.asm": 9 });
    await renderPanel([left, right], left);

    expect(rowNames()).toEqual(["left.asm", "right.asm"]);
  });

  it("lists the documents of every hub, and the same document once per hub", async () => {
    const left = createHub(1, [document("shared.asm")], 0, { "shared.asm": 5 });
    const right = createHub(2, [document("shared.asm"), document("other.asm")], 1, {
      "shared.asm": 1,
      "other.asm": 3
    });
    await renderPanel([left, right], left);

    expect(rowNames()).toEqual(["shared.asm", "other.asm", "shared.asm"]);
  });

  it("activates the document, and its hub, when a row is clicked", async () => {
    const left = createHub(1, [document("left.asm")], 0, {});
    const right = createHub(2, [document("right.asm")], 0, {});
    const { projectService } = await renderPanel([left, right], left);

    fireEvent.click(screen.getByText("right.asm"));

    await waitFor(() => {
      expect(right.setActiveDocument).toHaveBeenCalledWith("right.asm");
    });
    expect(projectService.setActiveDocumentHubService).toHaveBeenCalledWith(right);
    expect(left.setActiveDocument).not.toHaveBeenCalled();
  });

  it("does not re-activate the hub the user is already in", async () => {
    const hub = createHub(1, [document("a.asm")], 0, {});
    const { projectService } = await renderPanel([hub], hub);

    fireEvent.click(screen.getByText("a.asm"));

    await waitFor(() => {
      expect(hub.setActiveDocument).toHaveBeenCalledWith("a.asm");
    });
    expect(projectService.setActiveDocumentHubService).not.toHaveBeenCalled();
  });

  it("promotes a preview tab to a permanent one on double click", async () => {
    const hub = createHub(1, [{ ...document("a.asm"), isTemporary: true }], 0, {});
    await renderPanel([hub], hub);

    fireEvent.doubleClick(screen.getByText("a.asm"));

    await waitFor(() => {
      expect(hub.setPermanent).toHaveBeenCalledWith("a.asm");
    });
  });

  it("activates a row from the keyboard", async () => {
    const hub = createHub(1, [document("a.asm")], 0, {});
    await renderPanel([hub], hub);

    // Exactly "a.asm": the row. The close button inside it is named "Close a.asm".
    fireEvent.keyDown(screen.getByRole("button", { name: "a.asm" }), { code: "Enter" });

    await waitFor(() => {
      expect(hub.setActiveDocument).toHaveBeenCalledWith("a.asm");
    });
  });

  it("shows the folder only for names that more than one open document shares", async () => {
    const hub = createHub(
      1,
      [
        document("code.asm", "/proj/first/code.asm"),
        document("code.asm", "/proj/second/code.asm"),
        document("main.asm", "/proj/third/main.asm")
      ],
      0,
      {}
    );
    await renderPanel([hub], hub);

    expect(screen.getByText("first")).toBeTruthy();
    expect(screen.getByText("second")).toBeTruthy();
    expect(screen.queryByText("third")).toBeNull();
  });

  it("marks documents with unsaved changes", async () => {
    const hub = createHub(
      1,
      [
        { ...document("clean.asm"), editVersionCount: 3, savedVersionCount: 3 },
        { ...document("dirty.asm"), editVersionCount: 4, savedVersionCount: 3 }
      ],
      0,
      {}
    );
    await renderPanel([hub], hub);

    expect(screen.getAllByTitle("Unsaved changes")).toHaveLength(1);
  });

  it("offers a close button for every open document", async () => {
    const hub = createHub(1, [document("a.asm"), document("b.asm")], 0, {});
    await renderPanel([hub], hub);

    expect(screen.getByRole("button", { name: "Close a.asm" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close b.asm" })).toBeTruthy();
  });

  it("closes the document when its close button is clicked", async () => {
    const hub = createHub(1, [document("a.asm"), document("b.asm")], 0, {});
    await renderPanel([hub], hub);

    fireEvent.click(screen.getByRole("button", { name: "Close b.asm" }));

    await waitFor(() => {
      expect(hub.closeDocument).toHaveBeenCalledWith("b.asm");
    });
  });

  it("closes without activating the document or its hub", async () => {
    // The close button sits inside a row that is itself clickable: closing must not also be read
    // as a click on the row, which would jump the user to the document they are getting rid of.
    const left = createHub(1, [document("left.asm")], 0, {});
    const right = createHub(2, [document("right.asm")], 0, {});
    const { projectService } = await renderPanel([left, right], left);

    fireEvent.click(screen.getByRole("button", { name: "Close right.asm" }));

    await waitFor(() => {
      expect(right.closeDocument).toHaveBeenCalledWith("right.asm");
    });
    expect(right.setActiveDocument).not.toHaveBeenCalled();
    expect(projectService.setActiveDocumentHubService).not.toHaveBeenCalled();
  });

  it("closes the document in the hub the row belongs to", async () => {
    // The same file can be open in both halves of a split view; only the row's own copy closes.
    const left = createHub(1, [document("shared.asm")], 0, { "shared.asm": 5 });
    const right = createHub(2, [document("shared.asm")], 0, { "shared.asm": 1 });
    await renderPanel([left, right], left);

    // Top row is the current editor — the left hub's copy; the second row is the right hub's.
    fireEvent.click(screen.getAllByRole("button", { name: "Close shared.asm" })[1]);

    await waitFor(() => {
      expect(right.closeDocument).toHaveBeenCalledWith("shared.asm");
    });
    expect(left.closeDocument).not.toHaveBeenCalled();
  });

  it("says so when nothing is open", async () => {
    await renderPanel([], undefined);
    expect(screen.getByText("No open editors")).toBeTruthy();
  });
});

describe("OpenEditorsBadge", () => {
  it("counts the open editors of every hub", async () => {
    const left = createHub(1, [document("a.asm")], 0, {});
    const right = createHub(2, [document("b.asm"), document("c.asm")], 0, {});
    await renderBadge([left, right], left);

    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByTitle("3 open editors")).toBeTruthy();
  });

  it("says 'editor', not 'editors', for one", async () => {
    const hub = createHub(1, [document("a.asm")], 0, {});
    await renderBadge([hub], hub);

    expect(screen.getByTitle("1 open editor")).toBeTruthy();
  });

  it("shows nothing when no editor is open", async () => {
    // A badge reading "0" would draw the eye to the panel exactly when it has nothing in it.
    const { container } = await renderBadge([], undefined);
    expect(container.textContent).toBe("");
  });
});

// --- Test helpers

type TestHub = {
  hubId: number;
  getOpenDocuments: () => ProjectDocumentState[];
  getActiveDocumentIndex: () => number;
  getActivationStamp: (id: string) => number;
  setActiveDocument: ReturnType<typeof vi.fn>;
  setPermanent: ReturnType<typeof vi.fn>;
  closeDocument: ReturnType<typeof vi.fn>;
};

/** A document as the hub hands it out: clean, permanent, and inside the test project folder. */
function document(name: string, path = `/proj/${name}`): ProjectDocumentState {
  return {
    id: name,
    name,
    path,
    type: "CodeEditor",
    editVersionCount: 1,
    savedVersionCount: 1
  };
}

/**
 * A stand-in for a document hub.
 *
 * The stamps are supplied rather than accumulated: what this file tests is how the panel *reads*
 * them. That hubs hand them out in activation order is `DocumentHubService`'s own contract, tested
 * against the real service in DocumentHubService.test.ts.
 */
function createHub(
  hubId: number,
  docs: ProjectDocumentState[],
  activeIndex: number,
  stamps: Record<string, number>
): TestHub {
  return {
    hubId,
    getOpenDocuments: () => docs,
    getActiveDocumentIndex: () => activeIndex,
    getActivationStamp: (id: string) => stamps[id] ?? 0,
    setActiveDocument: vi.fn(async () => {}),
    setPermanent: vi.fn(),
    closeDocument: vi.fn(async () => {})
  };
}

function mockPanelDependencies(hubs: TestHub[], activeHub?: TestHub) {
  const state = {
    ideView: { documentHubState: { 1: 1 }, editorVersion: 1 },
    project: { folderPath: "/proj" }
  };
  let currentHub = activeHub;
  const projectService = {
    getDocumentHubServiceInstances: () => hubs,
    getActiveDocumentHubService: () => currentHub,
    setActiveDocumentHubService: vi.fn((hub: TestHub) => {
      currentHub = hub;
    })
  };

  vi.doMock("@renderer/core/RendererProvider", () => ({
    useSelector: (selector: (appState: unknown) => unknown) => selector(state)
  }));
  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({ projectService })
  }));
  // The real Icon needs a ThemeProvider; nothing here is about how a glyph is drawn.
  vi.doMock("@controls/Icon", () => ({
    Icon: ({ iconName }: { iconName: string }) => <span data-icon={iconName} />
  }));

  return { projectService };
}

async function renderPanel(hubs: TestHub[], activeHub?: TestHub) {
  const mocks = mockPanelDependencies(hubs, activeHub);
  const { OpenEditorsPanel } = await import(
    "@renderer/features/openEditors/OpenEditorsPanel"
  );
  return { ...render(<OpenEditorsPanel />), ...mocks };
}

async function renderBadge(hubs: TestHub[], activeHub?: TestHub) {
  const mocks = mockPanelDependencies(hubs, activeHub);
  const { OpenEditorsBadge } = await import(
    "@renderer/features/openEditors/OpenEditorsBadge"
  );
  return {
    ...render(<OpenEditorsBadge panelId="openEditorsPanel" expanded={false} />),
    ...mocks
  };
}

/** The row labels, top to bottom — the panel's whole visible contract. */
function rowNames(): string[] {
  return screen
    .getAllByRole("button")
    // Rows are divs carrying a button role; the close affordance inside each one is a real
    // <button>, and would otherwise appear here as an empty label.
    .filter((element) => element.tagName === "DIV")
    .map((row) => row.querySelector("span:not([data-icon])")?.textContent ?? "");
}
