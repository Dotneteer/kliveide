import type { Action } from "@common/state/Action";
import { setCursorPositionAction } from "@common/state/actions";

/** The part of a Monaco editor this reads. */
type CursorPositionSource = {
  getPosition(): { lineNumber: number; column: number } | null;
};

/**
 * Publishes the editor's current cursor position to the status bar (`ideView.cursorLine/Column`).
 *
 * The editor otherwise reports its position only from `onDidChangeCursorPosition`. The editor is
 * remounted on every tab switch, and restoring a document's position there often puts the cursor
 * exactly where Monaco already has it — so no change event fires, and the status bar went on showing
 * the line of the document switched away from. Called once the view state is restored, this makes
 * the readout follow the document being shown.
 *
 * Does nothing for an editor without a model (no position to report).
 */
export function publishEditorCursorPosition(
  editor: CursorPositionSource,
  dispatch: (action: Action) => void
): void {
  const position = editor.getPosition();
  if (!position) return;
  dispatch(setCursorPositionAction(position.lineNumber, position.column));
}
