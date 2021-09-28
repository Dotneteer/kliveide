import * as monacoEditor from "monaco-editor/esm/vs/editor/editor.api";

/**
 * Represents the state of the editor
 */
export type EditorState = {
  text: string;
  viewState: monacoEditor.editor.ICodeEditorViewState;
};

/**
 * This class implements the services we use with a code editor
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
