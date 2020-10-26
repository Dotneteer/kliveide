import { getActiveEditor, postRefreshViewMessage } from "../custom-editors/editor-base";

/**
 * Sends a refresh request for the active editor view
 * @param panel 
 */
export function refreshViewCommand(): void {
  const activeEditor = getActiveEditor();
  if (activeEditor) {
    postRefreshViewMessage(activeEditor);
  }
}