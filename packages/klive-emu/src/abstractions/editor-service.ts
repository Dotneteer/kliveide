import * as monacoEditor from "monaco-editor/esm/vs/editor/editor.api";

/**
 * Represents the state of the editor
 */
export type EditorState = {
  text: string;
  viewState: monacoEditor.editor.ICodeEditorViewState;
};

/**
 * IEditorService takes care of saving and restoring the state of the opened
 * code editors
 */
export interface IEditorService {
  /**
   * Saves the state of the specified editor
   * @param id Editor ID
   * @param state Editor state
   */
  saveState(id: string, state: EditorState): void;

  /**
   * Loads the state of the specified editor
   * @param id Editor ID
   * @returns Editor state
   */
  loadState(id: string): EditorState | undefined;

  /**
   * Deletes the state of the specified editor
   * @param id
   */
  clearState(id: string): void;
}