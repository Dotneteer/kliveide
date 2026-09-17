import type { ConfirmRequest } from "@mvc/dialogs/DialogPorts";
import type { DisassemblyItem } from "@renderer/appIde/disassemblers/common-types";

import type { NexAnnotationRegionType, NexFileAnnotations } from "../nexAnnotations";
import {
  goToDefinitionTarget,
  type NexGoToDefinitionTarget
} from "../nexGoToDefinition";
import {
  actionRange,
  isAnnotationEnabled,
  offsetSpanOf,
  selectedRange,
  type NexAnnotationEditorState
} from "./NexAnnotationEditorModel";

// ─── Messages ────────────────────────────────────────────────────────────────

export const ANNOTATION_LOAD_FAILED_MESSAGE = "Annotation file could not be loaded.";
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
  menuEnabled: boolean;
};

/**
 * One entry of the annotations menu.
 *
 * The menu is data rather than markup so that its enablement rules are decided here and asserted
 * without a DOM. `separator` entries carry no action.
 */
export type NexAnnotationMenuEntry =
  | { kind: "separator" }
  | {
      kind: "item";
      id: NexAnnotationMenuAction;
      text: string;
      disabled: boolean;
      /** The key that reaches this action from the listing, spelled for display. */
      shortcut?: string;
    };

export type NexAnnotationMenuAction =
  | "goto-definition"
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
  /**
   * The sidecar could not be written, so this bank's edits exist only in memory.
   *
   * Not "unsaved changes": annotations are written as they are made, so this is a failure state, not
   * a normal one. It is what the discard prompt on close asks about.
   */
  unwritten: boolean;
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
    unwritten: !!state.saveError
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
    // --- The menu acts on the selection, so with nothing selected there is nothing to act on.
    menuEnabled: enabled && state.selection?.activeIndex !== undefined
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
 * - **Manage Labels** acts on the whole bank, so it does not need a row.
 * - **Manage Regions** reads as bank-wide too, and was enabled on the same terms — but the
 *   controller seeds its dialog from the active row's offset and gives up when there is none, so
 *   the entry offered something it could not do and clicking it did nothing at all. It takes the
 *   row rule instead. That was invisible while this was a menu item a user might not click twice;
 *   it stopped being invisible once `R` reached it, because a dead keystroke explains nothing
 *   whereas a greyed entry does.
 */
/**
 * The keys that reach an annotation action from the focused listing.
 *
 * **Bare letters, and `Shift` for the wider variant of a pair.** Every other family of keys is
 * spoken for on at least one of the three platforms: the app menu already owns `F4`/`F5` and their
 * `Shift`/`Ctrl` forms (and `accelerator`s fire globally, so the renderer could not take them back),
 * macOS needs `Fn` for function keys at all, `Alt` opens the menu bar on Windows and Linux while
 * composing characters on macOS, and `Ctrl`+letter collides with macOS's own text-editing bindings
 * where `Cmd` is the idiom instead. A plain letter is reserved by nothing, anywhere — the same
 * reasoning the sprite editor's shortcuts already follow.
 *
 * Letters, not punctuation: `;` for a comment is tempting and more mnemonic in assembly, but it
 * moves around on non-US layouts, and `A`-`Z` do not.
 *
 * **This table is the whole set**, by decision rather than by accident: the Mark As commands and
 * Clear Row Annotations are reachable from the menu only. So the letters left over are simply free,
 * not held in reserve for anything — a later binding may take whichever it likes. Two choices here
 * were nevertheless made with the wider menu in view and still read oddly without it: `C` is the
 * comment rather than "code", and the two whole-bank managers pair up as `M`anage labels and
 * `R`egions, which is why Manage Labels does not take `L` — that is the label dialog itself.
 *
 * **Go to Definition is the one exception, and takes `Ctrl+F12`.** It is not an annotation command —
 * it reads rather than edits — and `F12` is what every other IDE binds Go to Definition to, which
 * the code editor here already follows. Plain `F12` was not available to take: it is the macOS
 * default for **Step Into** (`shortcuts.stepInto` in `app-menu.ts`), registered as a menu
 * accelerator, and those fire globally — so a renderer binding would have been dead on macOS and
 * alive everywhere else, which is worse than an unfamiliar chord. `Ctrl` rather than `Alt` or `Cmd`
 * for the same reasons the letters avoid them, and it matches the `WinCtrl+F12` Monaco already uses
 * for the same command in a code editor.
 *
 * **Shift is the second reading of a letter, not one fixed meaning.** `Shift+C` is the bigger of
 * the two comments — the synopsis block above the line rather than the note beside it — while
 * `Shift+L` is the narrower of the two labels, the one **l**ocal to the bank. Reading Shift as
 * "wider" everywhere would have made `L` the local label, and the unshifted key should be the one
 * reached most often.
 */
export const NEX_ANNOTATION_SHORTCUTS: {
  action: NexAnnotationMenuAction;
  /** Matched against `KeyboardEvent.key`, case-insensitively. */
  key: string;
  shift: boolean;
  /**
   * Whether the literal `Ctrl` key is required — `event.ctrlKey`, which is `Ctrl` on every platform
   * rather than `Cmd` on macOS. Absent means it must *not* be held, which is what keeps `Ctrl+C`
   * as copy rather than as the comment shortcut.
   */
  ctrl?: boolean;
  /** How the key is written in the menu. */
  hint: string;
}[] = [
  { action: "goto-definition", key: "f12", shift: false, ctrl: true, hint: "Ctrl+F12" },
  { action: "comment", key: "c", shift: false, hint: "C" },
  { action: "synopsis", key: "c", shift: true, hint: "Shift+C" },
  { action: "global-label", key: "l", shift: false, hint: "L" },
  { action: "local-label", key: "l", shift: true, hint: "Shift+L" },
  { action: "operand-label", key: "o", shift: false, hint: "O" },
  { action: "manage-labels", key: "m", shift: false, hint: "M" },
  { action: "manage-regions", key: "r", shift: false, hint: "R" }
];

/**
 * The action a keystroke stands for, or `undefined` for a key that is not ours.
 *
 * Pure, so the whole table is assertable without a DOM. The caller is responsible for refusing a
 * keystroke whose menu entry is disabled — see `menuEntryFor`, which is what keeps a shortcut and
 * its menu item from ever disagreeing about availability.
 */
export function annotationActionForKey(
  key: string,
  shift: boolean,
  ctrl = false
): NexAnnotationMenuAction | undefined {
  const lowered = key.toLowerCase();
  return NEX_ANNOTATION_SHORTCUTS.find(
    // --- Modifiers are matched *exactly*, not as a minimum: a bare-letter entry must refuse a
    // --- keystroke that holds Ctrl, or Ctrl+C would open the comment dialog instead of copying.
    (entry) => entry.key === lowered && entry.shift === shift && !!entry.ctrl === ctrl
  )?.action;
}

/** The menu entry for an action, so a caller can read the enablement the menu already decided. */
export function menuEntryFor(
  menu: NexAnnotationMenuEntry[],
  action: NexAnnotationMenuAction
): Extract<NexAnnotationMenuEntry, { kind: "item" }> | undefined {
  return menu.find(
    (entry): entry is Extract<NexAnnotationMenuEntry, { kind: "item" }> =>
      entry.kind === "item" && entry.id === action
  );
}

const SHORTCUT_HINTS = new Map(
  NEX_ANNOTATION_SHORTCUTS.map((entry) => [entry.action, entry.hint])
);

function selectMenu(
  state: NexAnnotationEditorState,
  enabled: boolean
): NexAnnotationMenuEntry[] {
  const rowActionsDisabled = !enabled || actionRange(state, undefined) === undefined;
  const item = (
    id: NexAnnotationMenuAction,
    text: string,
    disabled = rowActionsDisabled
  ): NexAnnotationMenuEntry => ({
    kind: "item",
    id,
    text,
    disabled,
    shortcut: SHORTCUT_HINTS.get(id)
  });

  return [
    /*
     * First, and on its own above the editing commands.
     *
     * It is the only entry that *reads* rather than edits — it moves the view and changes nothing —
     * and it is the one a reader following a call chain reaches for most often. Grouping it with the
     * label commands beneath would file it as an annotation action, which it is not.
     */
    item("goto-definition", "Go to Definition", !canGoToDefinition(state)),
    { kind: "separator" },
    item("manage-labels", "Manage Labels...", !enabled),
    item("manage-regions", "Manage Regions..."),
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
 * Where "Go to definition" would go from the row a gesture named.
 *
 * Exported so the controller acts on exactly the target the menu enabled itself for, rather than
 * working it out a second time from the same inputs.
 */
export function goToDefinitionTargetFor(
  state: NexAnnotationEditorState,
  rowIndex?: number
): NexGoToDefinitionTarget {
  if (!isAnnotationEnabled(state)) return { kind: "none" };
  const index = rowIndex ?? state.contextTarget?.rowIndex ?? state.selection?.activeIndex;
  if (index === undefined) return { kind: "none" };

  return goToDefinitionTarget({
    annotations: state.annotations,
    bank: state.env.bank,
    item: state.items[index],
    addressOffset: state.env.disassOffset
  });
}

/**
 * Is there a definition this row can jump to?
 *
 * Available whenever the definition is in the bank already on screen — that is a scroll, and needs
 * no machine. A definition outside this bank's window needs the live MMU to say which bank holds
 * that address, so it is offered only while a machine is running; without one the destination is
 * unknowable and a command that silently did nothing would be worse than a greyed one.
 */
export function canGoToDefinition(
  state: NexAnnotationEditorState,
  rowIndex?: number
): boolean {
  const target = goToDefinitionTargetFor(state, rowIndex);
  switch (target.kind) {
    case "same-bank":
      return true;
    case "other-bank":
      return state.env.machineRunning;
    default:
      return false;
  }
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
 * The question asked when closing a document whose annotations could not be written.
 *
 * Only ever asked in that case. Annotations are written as they are made, so closing normally asks
 * nothing — but a bank whose last write failed holds edits that exist nowhere else, and closing it
 * is the one gesture that drops them.
 *
 * It names the reason rather than asking about "unsaved changes", which would be a puzzle in an
 * editor that has no Save. A plain string, because this one is answered by the browser's
 * `window.confirm` rather than the app's own dialog — see `nativeConfirm` in the ports for why.
 */
export function discardConfirmMessage(state: NexAnnotationEditorState): string {
  const path = state.env.annotationPath ?? "the annotation file";
  const reason = state.saveError ? ` (${state.saveError})` : "";
  return (
    `${path} could not be written${reason}.\n\n` +
    "Closing this bank discards the annotation changes it still holds. Close anyway?"
  );
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
