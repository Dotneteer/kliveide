import type * as monacoEditor from "monaco-editor";

type PasteTarget = Pick<monacoEditor.editor.ICodeEditor, "trigger">;

/**
 * Inserts clipboard text into the editor as one paste operation.
 *
 * Klive handles Ctrl/Cmd+V itself (Electron's native paste does not reach Monaco), so it must
 * hand the text to Monaco's `paste` handler. It must NOT use the `type` handler with a
 * `"keyboard"` source: Monaco then replays the text character by character through the typing
 * interceptors (auto-indent on every newline, auto-closing pairs), producing one model edit -
 * and one content-change event - per character. For a few hundred KB of source that meant
 * hundreds of thousands of change events, each copying the whole document and calling the
 * main process, until the renderer ran out of memory (issue #1361).
 *
 * Line endings need no preprocessing: Monaco normalizes an edit's EOLs to the model's own.
 */
export function pasteTextIntoEditor(editor: PasteTarget, text: string): void {
  if (!text) return;
  editor.trigger("keyboard", "paste", {
    text,
    pasteOnNewLine: false,
    multicursorText: null,
    mode: null
  });
}
