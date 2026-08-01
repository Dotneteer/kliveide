import { describe, expect, it } from "vitest";
import {
  BASIC_PANEL_ID,
  DISASSEMBLY_EDITOR,
  DISASSEMBLY_PANEL_ID,
  MEMORY_EDITOR,
  MEMORY_PANEL_ID
} from "@common/state/common-ids";
import {
  createSpecialDocument,
  isSpecialDocumentId,
  isWorkspaceRestorableSpecialDocument
} from "@renderer/features/documents/specialDocuments";

describe("special documents", () => {
  it("creates fresh metadata for each special document view", () => {
    const firstMemoryView = createSpecialDocument(MEMORY_PANEL_ID);
    const secondMemoryView = createSpecialDocument(MEMORY_PANEL_ID);

    expect(firstMemoryView).toEqual({
      id: MEMORY_PANEL_ID,
      name: "Machine Memory",
      type: MEMORY_EDITOR,
      iconName: "memory-icon",
      iconFill: "--console-ansi-bright-cyan"
    });
    expect(secondMemoryView).toEqual(firstMemoryView);
    expect(secondMemoryView).not.toBe(firstMemoryView);
  });

  it("recognizes only supported workspace-restorable special documents", () => {
    expect(isSpecialDocumentId(DISASSEMBLY_PANEL_ID)).toBe(true);
    expect(isSpecialDocumentId("$other")).toBe(false);
    expect(
      isWorkspaceRestorableSpecialDocument({
        id: DISASSEMBLY_PANEL_ID,
        type: DISASSEMBLY_EDITOR
      })
    ).toBe(true);
    expect(
      isWorkspaceRestorableSpecialDocument({ id: BASIC_PANEL_ID, type: "Other" })
    ).toBe(false);
  });
});
