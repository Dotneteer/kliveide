import {
  BASIC_EDITOR,
  BASIC_PANEL_ID,
  DISASSEMBLY_EDITOR,
  DISASSEMBLY_PANEL_ID,
  MEMORY_EDITOR,
  MEMORY_PANEL_ID
} from "@common/state/common-ids";
import type { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";

export type SpecialDocumentId =
  | typeof MEMORY_PANEL_ID
  | typeof DISASSEMBLY_PANEL_ID
  | typeof BASIC_PANEL_ID;

export type SpecialDocumentDefinition = Pick<
  ProjectDocumentState,
  "id" | "name" | "type" | "iconName" | "iconFill"
> & {
  workspaceRestorable: boolean;
};

const specialDocumentDefinitions: Record<SpecialDocumentId, SpecialDocumentDefinition> = {
  [MEMORY_PANEL_ID]: {
    id: MEMORY_PANEL_ID,
    name: "Machine Memory",
    type: MEMORY_EDITOR,
    iconName: "memory-icon",
    iconFill: "--console-ansi-bright-cyan",
    workspaceRestorable: true
  },
  [DISASSEMBLY_PANEL_ID]: {
    id: DISASSEMBLY_PANEL_ID,
    name: "Disassembly",
    type: DISASSEMBLY_EDITOR,
    iconName: "disassembly-icon",
    iconFill: "--console-ansi-bright-cyan",
    workspaceRestorable: true
  },
  [BASIC_PANEL_ID]: {
    id: BASIC_PANEL_ID,
    name: "BASIC Listing",
    type: BASIC_EDITOR,
    workspaceRestorable: true
  }
};

export function isSpecialDocumentId(id: string): id is SpecialDocumentId {
  return id in specialDocumentDefinitions;
}

export function getSpecialDocumentDefinition(
  id: SpecialDocumentId
): SpecialDocumentDefinition {
  return specialDocumentDefinitions[id];
}

export function createSpecialDocument(id: SpecialDocumentId): ProjectDocumentState {
  const { workspaceRestorable: _, ...document } = getSpecialDocumentDefinition(id);
  return { ...document };
}

export function isWorkspaceRestorableSpecialDocument(
  document: Pick<ProjectDocumentState, "id" | "type">
): document is Pick<ProjectDocumentState, "id" | "type"> & { id: SpecialDocumentId } {
  if (!isSpecialDocumentId(document.id)) return false;

  const definition = getSpecialDocumentDefinition(document.id);
  return definition.workspaceRestorable && definition.type === document.type;
}

export function getLegacySpecialDocumentWorkspaceSettingIds(): string[] {
  return Object.values(specialDocumentDefinitions)
    .filter((definition) => definition.workspaceRestorable)
    .map((definition) => definition.type);
}
