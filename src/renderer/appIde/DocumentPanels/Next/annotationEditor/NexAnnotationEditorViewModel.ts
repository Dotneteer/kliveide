import type { ConfirmRequest } from "@mvc/dialogs/DialogPorts";
import type { DisassemblyItem } from "@renderer/appIde/disassemblers/common-types";

import type { NexAnnotationRegionType, NexFileAnnotations } from "../nexAnnotations";
import {
  actionRange,
  isAnnotationEnabled,
  offsetSpanOf,
  selectedRange,
  type NexAnnotationEditorState
} from "./NexAnnotationEditorModel";

// ─── Messages ────────────────────────────────────────────────────────────────

export const ANNOTATION_LOAD_FAILED_MESSAGE = "Annotation file could not be loaded.";
export const SAVE_ANNOTATIONS_TITLE = "Save annotations";
export const ANNOTATIONS_MENU_TITLE = "Annotations";

// ─── View model shape ────────────────────────────────────────────────────────

/**
 * The warning indicator beside the annotation buttons.
 *
 * A string discriminant, not a boolean: this project compiles with `strictNullChecks: false`, under
 * which TypeScript does not narrow a union on a boolean-literal discriminant (trap 2 in
 * `.ai/ui-mvc-guide.md`).
 */
export type NexAnnotationWarningViewModel =
  | { kind: "none" }
  | { kind: "warning"; title: string };

export type NexAnnotationToolbarViewModel = {
  /** The whole annotation block is absent for a document with no sidecar. */
  visible: boolean;
  warning: NexAnnotationWarningViewModel;
  saveEnabled: boolean;
  /** True while there are unsaved edits, which tints the save button. */
  saveHighlighted: boolean;
  menuEnabled: boolean;
  busy: boolean;
};

/**
 * One entry of the annotations menu.
 *
 * The menu is data rather than markup so that its enablement rules are decided here and asserted
 * without a DOM. `separator` entries carry no action.
 */
export type NexAnnotationMenuEntry =
  | { kind: "separator" }
  | { kind: "item"; id: NexAnnotationMenuAction; text: string; disabled: boolean };

export type NexAnnotationMenuAction =
  | "manage-labels"
  | "manage-regions"
  | "synopsis"
  | "comment"
  | "global-label"
  | "local-label"
  | "operand-label"
  | "mark-disassembly"
  | "mark-bytes"
  | "mark-words"
  | "mark-skip"
  | "clear";

export type NexAnnotationEditorViewModel = {
  toolbar: NexAnnotationToolbarViewModel;
  menu: NexAnnotationMenuEntry[];
  /**
   * Is there anything to annotate at all?
   *
   * Distinct from `toolbar.menuEnabled`, which also needs a selection: a right-click on a row is
   * allowed to *create* the selection, so it asks this instead.
   */
  annotationsAvailable: boolean;
  /** The generated listing, and the rows currently highlighted within it. */
  listing: {
    items: DisassemblyItem[];
    selectedRange?: { start: number; end: number };
  };
  /**
   * The loaded annotation model, for the component that generates the listing.
   *
   * The editor does not generate it: a dump with no sidecar still disassembles, plainly, and that
   * path belongs to the component around it. So the model goes out and the rows come back in.
   */
  annotations?: NexFileAnnotations;
  /** The load failure to show in place of the listing, when there is one. */
  loadError?: string;
  /** Everything an unsaved-changes prompt needs, read by the controller on dispose. */
  hasUnsavedChanges: boolean;
};

// ─── Selector ────────────────────────────────────────────────────────────────

export function selectViewModel(state: NexAnnotationEditorState): NexAnnotationEditorViewModel {
  const enabled = isAnnotationEnabled(state);
  return {
    toolbar: selectToolbar(state, enabled),
    menu: selectMenu(state, enabled),
    annotationsAvailable: enabled,
    listing: {
      items: state.items,
      selectedRange: selectedRange(state)
    },
    annotations: state.annotations,
    loadError: state.loadError,
    hasUnsavedChanges: state.dirty
  };
}

function selectToolbar(
  state: NexAnnotationEditorState,
  enabled: boolean
): NexAnnotationToolbarViewModel {
  return {
    // --- Keyed on the *path*, not on a loaded model: a sidecar that failed to load still has to
    // --- show its warning, which is the whole point of the indicator.
    visible: !!state.env.annotationPath,
    warning: selectWarning(state, enabled),
    saveEnabled: state.dirty && !!state.annotations && state.busy !== "saving",
    saveHighlighted: state.dirty,
    // --- The menu acts on the selection, so with nothing selected there is nothing to act on.
    menuEnabled: enabled && state.selection?.activeIndex !== undefined,
    busy: state.busy !== undefined
  };
}

function selectWarning(
  state: NexAnnotationEditorState,
  enabled: boolean
): NexAnnotationWarningViewModel {
  // --- While a load is still running there is nothing to warn about yet.
  const failed = !!state.saveError || !!state.loadError || (!state.loading && !enabled);
  if (!failed) return { kind: "none" };
  return {
    kind: "warning",
    // --- A save failure is the more recent news, so it wins the tooltip.
    title: state.saveError ?? state.loadError ?? ANNOTATION_LOAD_FAILED_MESSAGE
  };
}

/**
 * The annotations menu, with each entry's enablement decided here.
 *
 * Two rules beyond "annotations must be available":
 *
 * - **Assign Operand Label** needs a row with decoded 16-bit operands to attach to, so it is
 *   unavailable on a prefix row (a synopsis comment) and on any instruction with no operand.
 * - **Manage Labels** and **Manage Regions** act on the whole bank, so they do not need a row.
 */
function selectMenu(
  state: NexAnnotationEditorState,
  enabled: boolean
): NexAnnotationMenuEntry[] {
  const rowActionsDisabled = !enabled || actionRange(state, undefined) === undefined;
  const item = (
    id: NexAnnotationMenuAction,
    text: string,
    disabled = rowActionsDisabled
  ): NexAnnotationMenuEntry => ({ kind: "item", id, text, disabled });

  return [
    item("manage-labels", "Manage Labels...", !enabled),
    item("manage-regions", "Manage Regions...", !enabled),
    { kind: "separator" },
    item("synopsis", "Synopsis Comment..."),
    item("comment", "End-of-Line Comment..."),
    { kind: "separator" },
    item("global-label", "Add/Edit Global Label..."),
    item("local-label", "Add/Edit Local Label..."),
    item("operand-label", "Assign Operand Label...", !canAssignOperandLabel(state)),
    { kind: "separator" },
    item("mark-disassembly", "Mark As Disassembly"),
    item("mark-bytes", "Mark As Bytes"),
    item("mark-words", "Mark As Words"),
    item("mark-skip", "Mark As Skip"),
    { kind: "separator" },
    item("clear", "Clear Row Annotations")
  ];
}

/**
 * Can an operand label be attached to the row a gesture named?
 *
 * A prefix row is a generated synopsis line, not an instruction, and an instruction with no decoded
 * 16-bit operand has nothing for a label to name.
 */
export function canAssignOperandLabel(
  state: NexAnnotationEditorState,
  rowIndex?: number
): boolean {
  if (!isAnnotationEnabled(state)) return false;
  const index = rowIndex ?? state.contextTarget?.rowIndex ?? state.selection?.activeIndex;
  if (index === undefined) return false;
  const item = state.items[index];
  if (!item?.annotation) return false;
  return !item.isPrefixItem && !!item.operandCandidates?.length;
}

/**
 * The bank-offset span an action on `rowIndex` would cover.
 *
 * The controller reads this to turn a menu gesture into a region or comment edit; it is here rather
 * than in the controller so the rule is testable without ports.
 */
export function actionOffsetSpan(
  state: NexAnnotationEditorState,
  rowIndex?: number
): { start: number; end: number } | undefined {
  return offsetSpanOf(state, actionRange(state, rowIndex));
}

/**
 * The question asked when a document with unsaved annotation edits is being closed.
 *
 * A plain string, because this one is answered by the browser's `window.confirm` rather than the
 * app's own dialog — see `nativeConfirm` in the ports for why that is preserved rather than fixed
 * here. The fallback wording matches the existing behaviour exactly.
 */
export function discardConfirmMessage(state: NexAnnotationEditorState): string {
  return `Discard unsaved annotation changes in ${
    state.env.annotationPath ?? "the annotation file"
  }?`;
}

/** The question asked before a region edit rewrites the whole 16K bank. Text preserved verbatim. */
export const WHOLE_BANK_CONFIRM_MESSAGE = "This changes the entire 16K bank. Continue?";

/**
 * The confirmation shown before deleting a label, through the app's own dialog.
 *
 * Every delete is confirmed, not only a referenced one: a label is a name the user chose and typed,
 * and the list offers no undo. Where it *is* referenced, the count is the part that matters, because
 * clearing those operand references is a second, invisible consequence of saying yes.
 */
export function deleteLabelConfirmRequest(args: {
  scope: "global" | "local";
  name: string;
  referenceCount: number;
}): ConfirmRequest {
  return {
    title: "Delete label",
    lines: [`Delete this ${args.scope === "global" ? "global" : "bank"} label?`],
    code: args.name,
    linesAfterCode:
      args.referenceCount > 0
        ? [
            `${args.referenceCount} operand reference${
              args.referenceCount === 1 ? "" : "s"
            } to it will be cleared.`
          ]
        : undefined,
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
    danger: true
  };
}

/** The region type a menu action names, or `undefined` for an action that is not a region change. */
export function regionTypeOfAction(
  action: NexAnnotationMenuAction
): NexAnnotationRegionType | undefined {
  switch (action) {
    case "mark-disassembly":
      return "disassemble";
    case "mark-bytes":
      return "bytes";
    case "mark-words":
      return "words";
    case "mark-skip":
      return "skip";
    default:
      return undefined;
  }
}
