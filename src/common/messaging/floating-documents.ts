// ====================================================================================================================
// The shared vocabulary of floating document windows (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md`).
//
// A floating window holds exactly one document. The shared store's `floatingDocuments` maps each
// open window's slot to its entry, so every renderer knows which documents float, and routes an
// "open this document" to the window that holds it instead of opening a second copy.
// ====================================================================================================================

import type { AppState } from "@common/state/AppState";
import { MAX_FLOATING_WINDOWS, isFloatSlot, type FloatSlot } from "./messages-core";

/**
 * A document as the workspace saves it, and as it moves between windows (plan §3.4)
 */
export type FloatingSavedDocument = {
  type: string;
  id: string;
  position?: {
    line: number;
    column?: number;
  };
  viewState?: any;
};

/**
 * A window's position and size
 */
export type FloatingWindowBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * One floating window in the shared store
 */
export type FloatingDocumentEntry = {
  /** The window's slot */
  slot: FloatSlot;
  /** The document it holds */
  document: FloatingSavedDocument;
  /** The document area of the IDE it came from (Dock puts it back there when it still exists) */
  sourceAreaId?: string;
  /** The window's bounds, remembered with the workspace (plan Q3) */
  bounds?: FloatingWindowBounds;
};

/**
 * A request to pop a document out into a floating window
 */
export type FloatingDocumentRequest = {
  document: FloatingSavedDocument;
  sourceAreaId?: string;
  bounds?: FloatingWindowBounds;
};

/**
 * The result of a pop-out request
 */
export type FloatingDocumentResult =
  | { slot: FloatSlot; error?: undefined }
  | { slot?: undefined; error: "limit" | "alreadyFloating" | "failed"; message?: string };

/**
 * A document docked back from a floating window
 */
export type DockedDocumentRequest = {
  document: FloatingSavedDocument;
  sourceAreaId?: string;
};

/**
 * Where to move the view of a floating document
 */
export type FloatingDocumentReveal = {
  documentId: string;
  line?: number;
  column?: number;
};

/**
 * The floating documents of the state, by slot
 */
export function getFloatingDocuments(
  state: Pick<AppState, "floatingDocuments"> | undefined
): FloatingDocumentEntry[] {
  const entries = state?.floatingDocuments ?? {};
  return Object.values(entries)
    .filter((entry): entry is FloatingDocumentEntry => !!entry && isFloatSlot(entry.slot))
    .sort((a, b) => a.slot - b.slot);
}

/**
 * The slot of the floating window holding the specified document; undefined when it does not float
 */
export function findFloatingSlot(
  state: Pick<AppState, "floatingDocuments"> | undefined,
  documentId: string
): FloatSlot | undefined {
  return getFloatingDocuments(state).find((entry) => entry.document?.id === documentId)?.slot;
}

/**
 * Whether another floating window may be opened
 */
export function canOpenFloatingWindow(state: Pick<AppState, "floatingDocuments"> | undefined): boolean {
  return getFloatingDocuments(state).length < MAX_FLOATING_WINDOWS;
}

/**
 * The lowest free slot; undefined when all are taken
 * @param used The slots in use
 */
export function allocateFloatSlot(used: Iterable<number>): FloatSlot | undefined {
  const taken = new Set(used);
  for (let slot = 1; slot <= MAX_FLOATING_WINDOWS; slot++) {
    if (!taken.has(slot)) return slot as FloatSlot;
  }
  return undefined;
}

/**
 * The first document hub ID of a floating window: hub ids key `ideView.documentHubState` in the
 * shared store, so a satellite's must not collide with the IDE's (plan §3.1)
 */
export function floatHubIdBase(slot: FloatSlot): number {
  return slot * 1000;
}
