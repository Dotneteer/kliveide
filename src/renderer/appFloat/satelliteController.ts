// ====================================================================================================================
// What a floating document window answers to the main process (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md` §3.3,
// the `float` class of `ide-api-routing.ts`). `FloatApp` installs it once its document hub exists; the IDE
// window never has one, and the IPC processor answers these calls there with an error.
// ====================================================================================================================

import type { FloatingDocumentReveal } from "@messaging/floating-documents";

export type SatelliteController = {
  /** Moves the view of the window's document to a position */
  reveal(reveal: FloatingDocumentReveal): Promise<void>;
  /** The file of the window's document was renamed */
  renamed(oldId: string, newId: string): Promise<void>;
  /** The OS asked to close the window: the Close button's path */
  requestClose(): Promise<boolean>;
};

let controller: SatelliteController | undefined;

export function setSatelliteController(value: SatelliteController | undefined): void {
  controller = value;
}

export function getSatelliteController(): SatelliteController | undefined {
  return controller;
}
