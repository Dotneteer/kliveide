import type { IProjectService } from "@renderer/abstractions/IProjectService";
import type { DisassemblyItem } from "@renderer/appIde/disassemblers/common-types";
import type { NexAnnotationEditorPorts } from "@renderer/appIde/DocumentPanels/Next/annotationEditor/NexAnnotationEditorPorts";
import {
  regionTypeOfAction,
  type NexAnnotationMenuAction
} from "@renderer/appIde/DocumentPanels/Next/annotationEditor/NexAnnotationEditorViewModel";
import type { NexAnnotationEditorIntent } from "@renderer/appIde/DocumentPanels/Next/annotationEditor/NexAnnotationEditorIntents";

import { NexAnnotationEditorController } from "@renderer/appIde/DocumentPanels/Next/annotationEditor/NexAnnotationEditorController";
import { loadAnnotationSidecar } from "./annotationSidecar";
import { peekAnnotationSession, seedAnnotationSession, updateAnnotationSession } from "./annotationSession";
import {
  createDefaultAnnotations,
  DEFAULT_REGION,
  getBankAnnotation,
  type BankAnnotation,
  type ProgramAnnotations
} from "./programAnnotations";
import type { LiveRowTarget } from "./liveListingPort";

/*
 * Editing annotations from the live Disassembly view (§4.5 of
 * `.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md`).
 *
 * The controller is the bank document's, **reused unchanged**: for one action it is given the bank
 * the row is in (`liveRowTarget`), the rows of that piece, and the intent; it opens the same dialog
 * and publishes through the same session (T5). Before that, the sidecar — or the bank in it — is
 * created if this is its first annotation: a snapshot's `.dis` and a project's `annotations.dis` are
 * made by the first edit. A ROM page's working copy is not: it is a copy of the shipped sidecar,
 * made deliberately (`rom-ann-new`), and a ROM row without one is not editable at all.
 */

/** The intent a live row's menu entry or shortcut stands for. */
export function liveIntentForAction(
  action: NexAnnotationMenuAction,
  rowIndex: number
): NexAnnotationEditorIntent | undefined {
  const regionType = regionTypeOfAction(action);
  if (regionType) return { type: "regionTypeMarked", regionType, rowIndex };
  switch (action) {
    case "global-label":
    case "local-label":
      // --- A live row is always a bank site: its label is local to the bank (or ROM page)
      return { type: "labelRequested", scope: "local", rowIndex };
    case "synopsis":
      return { type: "synopsisCommentRequested", rowIndex };
    case "comment":
      return { type: "endOfLineCommentRequested", rowIndex };
    case "operand-label":
      return { type: "operandLabelRequested", rowIndex };
    case "goto-definition":
      return { type: "goToDefinitionRequested", rowIndex };
    case "bank-comment":
      return { type: "bankCommentRequested" };
    case "manage-labels":
      return { type: "manageLabelsRequested" };
    case "manage-regions":
      return { type: "manageRegionsRequested" };
    case "clear":
      return { type: "rowAnnotationsCleared", rowIndex };
    default:
      return undefined;
  }
}

/**
 * The target's annotations with its bank present, created when missing — the sidecar on disk too,
 * written through the session so the writer stays the only one (T5).
 */
export async function ensureAnnotatedBank(
  target: LiveRowTarget,
  projectService: Pick<IProjectService, "readFileContent" | "saveFileContent">
): Promise<ProgramAnnotations | undefined> {
  let annotations = peekAnnotationSession(target.annotationPath);
  if (!annotations) {
    const state = await loadAnnotationSidecar(projectService, { fullPath: target.annotationPath });
    if (state.status === "loaded") {
      annotations = state.annotations;
      seedAnnotationSession(target.annotationPath, annotations!);
    } else if (state.status === "missing") {
      // --- A ROM page is edited only in a working copy that exists (rom-ann-new makes one): the
      // --- first edit never makes it, or a page would quietly stop showing its shipped annotations
      if (target.kind === "rom") return undefined;
      annotations = createDefaultAnnotations({ machine: target.create.machine, loadedBanks: [] });
    } else {
      // --- A file that does not validate is not overwritten by an edit
      return undefined;
    }
  }
  if (!annotations) return undefined;
  if (getBankAnnotation(annotations, target.bank)) {
    if (!peekAnnotationSession(target.annotationPath)) {
      seedAnnotationSession(target.annotationPath, annotations);
    }
    return annotations;
  }
  const bank: BankAnnotation = {
    offsetIndex: target.create.offsetIndex,
    regions: [{ ...DEFAULT_REGION }]
  };
  const withBank: ProgramAnnotations = {
    ...annotations,
    banks: { ...annotations.banks, [String(target.bank)]: bank }
  };
  updateAnnotationSession(target.annotationPath, withBank, projectService);
  return withBank;
}

/**
 * Run one annotation action on a live row through the bank document's controller.
 *
 * @param rows The listing rows of the target's piece (`rowsOfTarget`)
 * @param row The row acted on
 */
export async function runLiveAnnotationAction(args: {
  ports: NexAnnotationEditorPorts;
  target: LiveRowTarget;
  rows: DisassemblyItem[];
  row: DisassemblyItem;
  action: NexAnnotationMenuAction;
  decimalView: boolean;
  machineRunning: boolean;
  projectService: Pick<IProjectService, "readFileContent" | "saveFileContent">;
}): Promise<boolean> {
  const { target } = args;
  const annotations = await ensureAnnotatedBank(target, args.projectService);
  if (!annotations) return false;

  // --- By address: `rowsOfTarget` hands the editor copies of the listing's rows
  const rowIndex = args.rows.findIndex((row) => row.address === args.row.address && !row.isPrefixItem);
  const intent = liveIntentForAction(args.action, rowIndex < 0 ? 0 : rowIndex);
  if (!intent) return false;

  const controller = new NexAnnotationEditorController(args.ports, {
    annotationPath: target.annotationPath,
    bank: target.bank,
    viewMode: "disassembly",
    decimalView: args.decimalView,
    disassOffset: target.disassOffset,
    machineRunning: args.machineRunning
  });
  try {
    await controller.dispatch({ type: "opened" });
    await controller.dispatch({ type: "listingChanged", items: args.rows });
    await controller.dispatch(intent);
    await controller.settle();
  } finally {
    controller.dispose();
  }
  return true;
}
