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
  MEMORY_PANEL_ID
} from "@common/state/common-ids";
import type { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";

export type SpecialDocumentId =
  | typeof MEMORY_PANEL_ID
  | typeof DISASSEMBLY_PANEL_ID
  | typeof BASIC_PANEL_ID
  | typeof COPPER_PANEL_ID
  | typeof SPRITES_PANEL_ID
  | typeof TILEMAP_PANEL_ID
  | typeof LAYER2_PANEL_ID
  | typeof LAYERS_PANEL_ID;

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
    workspaceRestorable: true
  },
  [DISASSEMBLY_PANEL_ID]: {
    id: DISASSEMBLY_PANEL_ID,
    name: "Disassembly",
    type: DISASSEMBLY_EDITOR,
    iconName: "disassembly-icon",
    workspaceRestorable: true
  },
  [BASIC_PANEL_ID]: {
    id: BASIC_PANEL_ID,
    name: "BASIC Listing",
    type: BASIC_EDITOR,
    workspaceRestorable: true
  },
  // --- The ZX Spectrum Next Copper list (`.plans/COPPER_DEBUGGING_PLAN.md` §4.5)
  [COPPER_PANEL_ID]: {
    id: COPPER_PANEL_ID,
    name: "Copper List",
    type: COPPER_EDITOR,
    iconName: "bp-copper",
    workspaceRestorable: true
  },
  // --- The ZX Spectrum Next sprites and pattern RAM (`.plans/SPRITE_INSPECTOR_PLAN.md` §4.4)
  [SPRITES_PANEL_ID]: {
    id: SPRITES_PANEL_ID,
    name: "Sprite Inspector",
    type: SPRITES_EDITOR,
    iconName: "sprites",
    workspaceRestorable: true
  },
  // --- The ZX Spectrum Next tilemap and its tile definitions (`.plans/TILEMAP_INSPECTOR_PLAN.md` §4.4)
  [TILEMAP_PANEL_ID]: {
    id: TILEMAP_PANEL_ID,
    name: "Tilemap Inspector",
    type: TILEMAP_EDITOR,
    iconName: "tilemap",
    workspaceRestorable: true
  },
  // --- The ZX Spectrum Next's Layer 2 image, banks and windows (`.plans/LAYER2_INSPECTOR_PLAN.md` §4.4)
  [LAYER2_PANEL_ID]: {
    id: LAYER2_PANEL_ID,
    name: "Layer 2 Inspector",
    type: LAYER2_EDITOR,
    iconName: "layer2",
    workspaceRestorable: true
  },
  // --- The ZX Spectrum Next's layer composition (`.plans/LAYER_COMPOSITION_PLAN.md` D9)
  [LAYERS_PANEL_ID]: {
    id: LAYERS_PANEL_ID,
    name: "Layers",
    type: LAYERS_EDITOR,
    iconName: "layers",
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
