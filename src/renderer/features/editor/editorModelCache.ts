// ====================================================================================================================
// The code editor keeps one Monaco model per document path (`keepCurrentModel`), so reopening a document
// keeps its undo history. A document that comes back from a floating window must not reuse that model:
// the other window changed the file meanwhile (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md` §3.5).
//
// The editor module registers how to drop a kept model; callers that must not import Monaco (the
// document transfer, which the tab strip and its tests load) go through this module.
// ====================================================================================================================

let modelDropper: ((path: string) => void) | undefined;

/**
 * Registers how the editor drops the model it keeps for a document path
 */
export function setEditorModelDropper(dropper: ((path: string) => void) | undefined): void {
  modelDropper = dropper;
}

/**
 * Drops the editor model kept for a document path, so the next editor reads the document's contents
 */
export function dropEditorModel(path: string): void {
  modelDropper?.(path);
}
