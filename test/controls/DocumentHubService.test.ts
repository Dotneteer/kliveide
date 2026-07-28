import { describe, expect, it, vi } from "vitest";
import { createDocumentHubService } from "@renderer/appIde/services/DocumentHubService";
import { TEXT_EDITOR } from "@state/common-ids";
import { DocumentApi } from "@renderer/abstractions/DocumentApi";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";

describe("DocumentHubService", () => {
  it("reorders documents and preserves the active document", async () => {
    const store = {
      dispatch: vi.fn(),
      getState: vi.fn(() => ({}))
    };
    const projectService = {
      closeInDocumentHub: vi.fn(),
      closeDocumentHubService: vi.fn(),
      openInDocumentHub: vi.fn(),
      projectClosed: {
        off: vi.fn(),
        on: vi.fn()
      }
    };
    const hub = createDocumentHubService(1, store as never, projectService as never);

    await hub.openDocumentTab(createDocument("doc-a", "Doc A"));
    await hub.openDocumentTab(createDocument("doc-b", "Doc B"));
    await hub.openDocumentTab(createDocument("doc-c", "Doc C"));
    await hub.setActiveDocument("doc-b");
    store.dispatch.mockClear();

    hub.moveDocument("doc-c", "doc-a");

    expect(hub.getOpenDocuments().map((doc) => doc.id)).toEqual([
      "doc-c",
      "doc-a",
      "doc-b"
    ]);
    expect(hub.getActiveDocument()?.id).toBe("doc-b");
    expect(hub.getActiveDocumentIndex()).toBe(2);
    expect(store.dispatch).toHaveBeenCalledTimes(1);
  });

  it("assigns renderer icon metadata when opening a document without explicit icons", async () => {
    const store = createStoreMock();
    const projectService = createProjectServiceMock();
    const hub = createDocumentHubService(1, store as never, projectService as never);

    await hub.openDocumentTab(createDocument("doc-a", "Doc A", TEXT_EDITOR));

    expect(hub.getDocument("doc-a")).toEqual(
      expect.objectContaining({
        iconFill: "--console-ansi-bright-yellow",
        iconName: "note"
      })
    );
  });

  it("does not signal a change when moving the last active tab to the right", async () => {
    const store = createStoreMock();
    const projectService = createProjectServiceMock();
    const hub = createDocumentHubService(1, store as never, projectService as never);

    await hub.openDocumentTab(createDocument("doc-a", "Doc A"));
    await hub.openDocumentTab(createDocument("doc-b", "Doc B"));
    await hub.setActiveDocument("doc-b");
    store.dispatch.mockClear();

    hub.moveActiveToRight();

    expect(hub.getOpenDocuments().map((doc) => doc.id)).toEqual(["doc-a", "doc-b"]);
    expect(hub.getActiveDocumentIndex()).toBe(1);
    expect(store.dispatch).not.toHaveBeenCalled();
  });

  it("opens the same document instance in two hubs", async () => {
    const store = createStoreMock();
    const document = createDocument("doc-a", "Doc A");
    const projectService = createProjectServiceMock([document]);
    const firstHub = createDocumentHubService(1, store as never, projectService as never);
    const secondHub = createDocumentHubService(2, store as never, projectService as never);

    await firstHub.openDocumentTab(document);
    await secondHub.openDocumentTab(document);

    expect(firstHub.getDocument("doc-a")).toBe(document);
    expect(secondHub.getDocument("doc-a")).toBe(document);
    expect(document.usedIn).toEqual([firstHub, secondHub]);
  });

  it("keeps a shared document cached when one hub closes its view", async () => {
    const store = createStoreMock();
    const document = createDocument("doc-a", "Doc A");
    const projectService = createProjectServiceMock([document]);
    const firstHub = createDocumentHubService(1, store as never, projectService as never);
    const secondHub = createDocumentHubService(2, store as never, projectService as never);

    await firstHub.openDocumentTab(document);
    await secondHub.openDocumentTab(document);

    await firstHub.closeDocument("doc-a");

    expect(projectService.getDocumentById("doc-a")).toBe(document);
    expect(document.usedIn).toEqual([secondHub]);
    expect(secondHub.getDocument("doc-a")).toBe(document);
  });

  it("keeps document view state independent for each hub", async () => {
    const store = createStoreMock();
    const document = createDocument("doc-a", "Doc A");
    const projectService = createProjectServiceMock([document]);
    const firstHub = createDocumentHubService(1, store as never, projectService as never);
    const secondHub = createDocumentHubService(2, store as never, projectService as never);

    await firstHub.openDocumentTab(document);
    await secondHub.openDocumentTab(document);
    firstHub.setDocumentViewState("doc-a", { line: 10 });
    secondHub.setDocumentViewState("doc-a", { line: 30 });

    expect(firstHub.getDocumentViewState("doc-a")).toEqual({ line: 10 });
    expect(secondHub.getDocumentViewState("doc-a")).toEqual({ line: 30 });
  });

  it("keeps document APIs independent for each hub", async () => {
    const store = createStoreMock();
    const document = createDocument("doc-a", "Doc A");
    const projectService = createProjectServiceMock([document]);
    const firstHub = createDocumentHubService(1, store as never, projectService as never);
    const secondHub = createDocumentHubService(2, store as never, projectService as never);
    const firstApi = createDocumentApi();
    const secondApi = createDocumentApi();

    await firstHub.openDocumentTab(document);
    await secondHub.openDocumentTab(document);
    firstHub.setDocumentApi("doc-a", firstApi);
    secondHub.setDocumentApi("doc-a", secondApi);

    expect(firstHub.getDocumentApi("doc-a")).toBe(firstApi);
    expect(secondHub.getDocumentApi("doc-a")).toBe(secondApi);
  });

  it("requests hub closure after closing its last tab", async () => {
    const store = createStoreMock();
    const document = createDocument("doc-a", "Doc A");
    const projectService = createProjectServiceMock([document]);
    const hub = createDocumentHubService(1, store as never, projectService as never);

    await hub.openDocumentTab(document);
    await hub.closeDocument("doc-a");

    expect(hub.getOpenDocuments()).toEqual([]);
    expect(projectService.closeDocumentHubService).toHaveBeenCalledWith(hub);
  });
});

function createStoreMock() {
  return {
    dispatch: vi.fn(),
    getState: vi.fn(() => ({}))
  };
}

function createProjectServiceMock(documents: ProjectDocumentState[] = []) {
  const documentCache = new Map(documents.map((document) => [document.id, document]));
  return {
    closeInDocumentHub: vi.fn((id: string, hub: IDocumentHubService) => {
      const document = documentCache.get(id);
      if (!document?.usedIn) return;
      document.usedIn = document.usedIn.filter((usedHub) => usedHub !== hub);
      if (!document.usedIn.length) {
        documentCache.delete(id);
      }
    }),
    closeDocumentHubService: vi.fn(),
    getDocumentById: vi.fn((id: string) => documentCache.get(id)),
    openInDocumentHub: vi.fn((id: string, hub: IDocumentHubService) => {
      const document = documentCache.get(id);
      if (!document) return;
      document.usedIn ??= [];
      if (!document.usedIn.includes(hub)) {
        document.usedIn.push(hub);
      }
    }),
    projectClosed: {
      off: vi.fn(),
      on: vi.fn()
    }
  };
}

function createDocument(id: string, name: string, type = "code") {
  return {
    editVersionCount: 0,
    id,
    name,
    savedVersionCount: 0,
    type
  };
}

function createDocumentApi(): DocumentApi {
  return {
    beforeDocumentDisposal: vi.fn()
  };
}
