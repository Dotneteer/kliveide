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
class EditorService {
  private _states = new Map<string, EditorState>();

  /**
   * Saves the state of the specified editor
   * @param id Editor ID
   * @param state Editor state
   */
  saveState(id: string, state: EditorState): void {
    this._states.set(id, state);
  }

  /**
   * Loads the state of the specified editor
   * @param id Editor ID
   * @returns Editor state
   */
  loadState(id: string): EditorState | undefined {
    return this._states.get(id);
  }
}

/**
 * The singleton instance of the service managing the editor
 */
export const editorService = new EditorService();
