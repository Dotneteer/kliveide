import type { DisassemblyItem } from "@renderer/appIde/disassemblers/common-types";

import type {
  NexAnnotationBankView,
  NexAnnotationLabelScope,
  NexAnnotationRegionType
} from "../nexAnnotations";
import type { NexAnnotationEditorEnvironment } from "./NexAnnotationEditorModel";

/**
 * Everything a user can do to a NEX bank's annotations, in the user's own vocabulary.
 *
 * A test drives the whole editor by dispatching these: nothing here mentions React, the DOM, or
 * which dialog answers a question. `rowIndex` is optional throughout because every annotation action
 * is reachable two ways — from a row's own context menu, which names the row, and from the toolbar,
 * which acts on the current selection.
 *
 * See `.ai/ui-mvc-guide.md` for the Intent/Event split, and `.plans/NEX_DEBUGGING_PLAN.md` §9.
 */
export type NexAnnotationEditorIntent =
  // --- The document appeared: subscribe to the shared session for this sidecar.
  | { type: "opened" }
  // --- The document's bank, sidecar path or display settings changed underneath the editor.
  | { type: "environmentChanged"; env: NexAnnotationEditorEnvironment }
  /*
   * The surrounding component regenerated the listing.
   *
   * Generation lives out there rather than here because it has a path the editor knows nothing
   * about: a dump with no annotation sidecar still shows a plain disassembly. The editor needs the
   * rows all the same — selection, ranges and every action are expressed in terms of them.
   */
  | { type: "listingChanged"; items: DisassemblyItem[] }

  // ─── Selection ─────────────────────────────────────────────────────────────
  // --- `extend` is the Shift-click / Shift-arrow gesture: keep the anchor, move the active end.
  | { type: "rowSelected"; index: number; extend: boolean }
  | { type: "selectionMoved"; delta: number; extend: boolean }
  | { type: "selectionCleared" }
  /*
   * A menu was opened on a row, or from the toolbar on the current selection.
   *
   * Right-clicking a row *outside* the selection re-anchors the selection there, so the action and
   * the highlight agree about what is being changed.
   */
  | { type: "contextMenuRequested"; rowIndex: number }
  | { type: "toolbarMenuRequested" }

  // ─── Per-bank display settings, which persist into the sidecar ──────────────
  | { type: "viewModeSelected"; view: NexAnnotationBankView }
  | { type: "decimalViewSelected"; value: boolean }
  | { type: "disassemblyOffsetSelected"; offset: number }

  // ─── Editing ───────────────────────────────────────────────────────────────
  | { type: "synopsisCommentRequested"; rowIndex?: number }
  | { type: "endOfLineCommentRequested"; rowIndex?: number }
  // --- Global and local labels are authored through one dialog, opened on a chosen scope.
  | { type: "labelRequested"; scope: NexAnnotationLabelScope; rowIndex?: number }
  | { type: "manageLabelsRequested" }
  | { type: "operandLabelRequested"; rowIndex?: number }
  | { type: "regionRequested"; rowIndex?: number }
  | { type: "manageRegionsRequested" }
  // --- The one-gesture region changes: "mark this row or range as bytes/words/skip/code".
  | { type: "regionTypeMarked"; regionType: NexAnnotationRegionType; rowIndex?: number }
  | { type: "rowAnnotationsCleared"; rowIndex?: number }

  // ─── Saving ────────────────────────────────────────────────────────────────
  | { type: "saveRequested" }
  // --- Closing a dirty document: the answer decides whether the close may proceed.
  | { type: "disposeRequested" };
