import { describe, expect, it, vi } from "vitest";
import { createDocumentHubService } from "@renderer/appIde/services/DocumentHubService";

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
});

function createDocument(id: string, name: string) {
  return {
    editVersionCount: 0,
    id,
    name,
    savedVersionCount: 0,
    type: "code" as const
  };
}
