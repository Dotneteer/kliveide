import {
  BASIC_EDITOR,
  BASIC_PANEL_ID,
  COPPER_EDITOR,
  COPPER_PANEL_ID,
  DISASSEMBLY_EDITOR,
  DISASSEMBLY_PANEL_ID,
  MEMORY_EDITOR,
  SPRITES_EDITOR,
  SPRITES_PANEL_ID,
  TILEMAP_EDITOR,
  TILEMAP_PANEL_ID,
  LAYER2_EDITOR,
  LAYER2_PANEL_ID,
  LAYERS_EDITOR,
  LAYERS_PANEL_ID,
  HISTORY_EDITOR,
  HISTORY_PANEL_ID,
  MEMORY_PANEL_ID,
  PROFILER_EDITOR,
  PROFILER_PANEL_ID,
  GRAPHICS_EDITOR,
  GRAPHICS_PANEL_ID,
  FILE_MANAGER_EDITOR,
  FILE_MANAGER_PANEL_ID
} from "@common/state/common-ids";
import type { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { withTexts } from "@common/i18n/labels";

export type SpecialDocumentId =
  | typeof MEMORY_PANEL_ID
  | typeof DISASSEMBLY_PANEL_ID
  | typeof BASIC_PANEL_ID
  | typeof COPPER_PANEL_ID
  | typeof SPRITES_PANEL_ID
  | typeof TILEMAP_PANEL_ID
  | typeof LAYER2_PANEL_ID
  | typeof LAYERS_PANEL_ID
  | typeof HISTORY_PANEL_ID
  | typeof PROFILER_PANEL_ID
  | typeof GRAPHICS_PANEL_ID
  | typeof FILE_MANAGER_PANEL_ID;

export type SpecialDocumentDefinition = Pick<
  ProjectDocumentState,
  "id" | "name" | "type" | "iconName" | "iconFill"
> & {
  workspaceRestorable: boolean;
};

const specialDocumentDefinitions: Record<SpecialDocumentId, SpecialDocumentDefinition> = {
  [MEMORY_PANEL_ID]: withTexts({
    id: MEMORY_PANEL_ID,
    type: MEMORY_EDITOR,
    iconName: "memory-icon",
    workspaceRestorable: true
  }, { name: "panels.document.machineMemory" }),
  [DISASSEMBLY_PANEL_ID]: withTexts({
    id: DISASSEMBLY_PANEL_ID,
    type: DISASSEMBLY_EDITOR,
    iconName: "disassembly-icon",
    workspaceRestorable: true
  }, { name: "panels.document.disassembly" }),
  [BASIC_PANEL_ID]: withTexts({
    id: BASIC_PANEL_ID,
    type: BASIC_EDITOR,
    workspaceRestorable: true
  }, { name: "panels.document.basicListing" }),
  // --- The ZX Spectrum Next Copper list (`.plans/COPPER_DEBUGGING_PLAN.md` §4.5)
  [COPPER_PANEL_ID]: withTexts({
    id: COPPER_PANEL_ID,
    type: COPPER_EDITOR,
    iconName: "bp-copper",
    workspaceRestorable: true
  }, { name: "panels.document.copperList" }),
  // --- The ZX Spectrum Next sprites and pattern RAM (`.plans/SPRITE_INSPECTOR_PLAN.md` §4.4)
  [SPRITES_PANEL_ID]: withTexts({
    id: SPRITES_PANEL_ID,
    type: SPRITES_EDITOR,
    iconName: "sprites",
    workspaceRestorable: true
  }, { name: "panels.document.spriteInspector" }),
  // --- The ZX Spectrum Next tilemap and its tile definitions (`.plans/TILEMAP_INSPECTOR_PLAN.md` §4.4)
  [TILEMAP_PANEL_ID]: withTexts({
    id: TILEMAP_PANEL_ID,
    type: TILEMAP_EDITOR,
    iconName: "tilemap",
    workspaceRestorable: true
  }, { name: "panels.document.tilemapInspector" }),
  // --- The ZX Spectrum Next's Layer 2 image, banks and windows (`.plans/LAYER2_INSPECTOR_PLAN.md` §4.4)
  [LAYER2_PANEL_ID]: withTexts({
    id: LAYER2_PANEL_ID,
    type: LAYER2_EDITOR,
    iconName: "layer2",
    workspaceRestorable: true
  }, { name: "panels.document.layer2Inspector" }),
  // --- The ZX Spectrum Next's layer composition (`.plans/LAYER_COMPOSITION_PLAN.md` D9)
  [LAYERS_PANEL_ID]: withTexts({
    id: LAYERS_PANEL_ID,
    type: LAYERS_EDITOR,
    iconName: "layers",
    workspaceRestorable: true
  }, { name: "panels.document.layers" }),
  // --- The execution history (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §4.6, D13)
  [HISTORY_PANEL_ID]: withTexts({
    id: HISTORY_PANEL_ID,
    type: HISTORY_EDITOR,
    iconName: "history",
    workspaceRestorable: true
  }, { name: "panels.document.executionHistory" }),
  // --- The profiler (`.plans/PROFILER_PLAN.md` D14)
  [PROFILER_PANEL_ID]: withTexts({
    id: PROFILER_PANEL_ID,
    type: PROFILER_EDITOR,
    iconName: "gauge",
    workspaceRestorable: true
  }, { name: "panels.document.profiler" }),
  // --- The graphics finder over the paused machine (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §5.3)
  [GRAPHICS_PANEL_ID]: withTexts({
    id: GRAPHICS_PANEL_ID,
    type: GRAPHICS_EDITOR,
    iconName: "sprite",
    workspaceRestorable: true
  }, { name: "panels.document.graphics" }),
  // --- The two-pane File Manager (`.plans/FILE_MANAGER_PLAN.md`, D1)
  [FILE_MANAGER_PANEL_ID]: withTexts({
    id: FILE_MANAGER_PANEL_ID,
    type: FILE_MANAGER_EDITOR,
    iconName: "columns-2",
    workspaceRestorable: true
  }, { name: "panels.document.fileManager" })
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

/**
 * The name a document shows. A special document's name is stored in the document state when it
 * opens, so it would stay in the language of that moment; this reads its definition instead, which
 * translates on every read.
 */
export function documentDisplayName(document: Pick<ProjectDocumentState, "id" | "type" | "name">): string {
  if (!isSpecialDocumentId(document.id)) return document.name;
  const definition = getSpecialDocumentDefinition(document.id);
  return definition.type === document.type ? definition.name : document.name;
}
