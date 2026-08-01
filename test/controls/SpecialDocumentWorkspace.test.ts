import { describe, expect, it } from "vitest";
import {
  BASIC_PANEL_ID,
  DISASSEMBLY_PANEL_ID,
  MEMORY_PANEL_ID,
  STATIC_MEMORY_DUMP_VIEWER
} from "@common/state/common-ids";
import { createSpecialDocument } from "@renderer/features/documents/specialDocuments";
import { createDocumentAreaWorkspace } from "@renderer/features/documents/useDocumentWorkspacePersistence";

describe("special document workspace persistence", () => {
  it("persists only approved special documents with the owning hub view state", () => {
    const layout = {
      type: "split",
      direction: "horizontal",
      first: { type: "leaf", areaId: "left" },
      second: { type: "leaf", areaId: "right" }
    } as const;
    const memory = createSpecialDocument(MEMORY_PANEL_ID);
    const disassembly = createSpecialDocument(DISASSEMBLY_PANEL_ID);
    const basic = createSpecialDocument(BASIC_PANEL_ID);
    const staticDump = {
      id: "memoryDump-1",
      name: "Dump",
      type: STATIC_MEMORY_DUMP_VIEWER
    };

    const workspace = createDocumentAreaWorkspace(
        layout,
        new Map([
          [
            "left",
            {
              getActiveDocument: () => memory,
              getDocumentViewState: (id: string) =>
                id === MEMORY_PANEL_ID ? { topIndex: 12 } : undefined,
              getOpenDocuments: () => [memory, staticDump]
            } as never
          ],
          [
            "right",
            {
              getActiveDocument: () => basic,
              getDocumentViewState: (id: string) =>
                id === DISASSEMBLY_PANEL_ID ? { topAddress: 0x8000 } : { topIndex: 48 },
              getOpenDocuments: () => [disassembly, basic]
            } as never
          ]
        ]),
        "right",
        "/project"
      );

    expect(workspace.areas[0].documents.map((document) => document.id)).toEqual([
      MEMORY_PANEL_ID
    ]);
    expect(workspace.areas[1].documents.map((document) => document.id)).toEqual([
      DISASSEMBLY_PANEL_ID,
      BASIC_PANEL_ID
    ]);
    expect(workspace).toMatchObject({
      areas: [
        {
          areaId: "left",
          activeDocumentId: MEMORY_PANEL_ID,
          documents: [
            {
              id: MEMORY_PANEL_ID,
              type: memory.type,
              viewState: { topIndex: 12 }
            }
          ]
        },
        {
          areaId: "right",
          activeDocumentId: BASIC_PANEL_ID,
          documents: [
            {
              id: DISASSEMBLY_PANEL_ID,
              type: disassembly.type,
              viewState: { topAddress: 0x8000 }
            },
            {
              id: BASIC_PANEL_ID,
              type: basic.type,
              viewState: { topIndex: 48 }
            }
          ]
        }
      ]
    });
  });
});
