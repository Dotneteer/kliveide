import type * as monacoEditor from "monaco-editor";

export type MonacoUserOptions = {
  enableAutoComplete: boolean;
  insertSpaces: boolean;
  renderWhitespaces: "none" | "boundary" | "selection" | "trailing" | "all";
  tabSize: number;
  detectIndentation: boolean;
  enableSelectionHighlight: boolean;
  enableOccurrencesHighlight: boolean;
  quickSuggestionDelay: number;
};

/**
 * Applies user-controlled editor options to an already mounted Monaco editor.
 */
export function applyMonacoUserOptions(
  editor: monacoEditor.editor.IStandaloneCodeEditor | null,
  options: MonacoUserOptions
): void {
  editor?.updateOptions({
    quickSuggestions: options.enableAutoComplete,
    suggestOnTriggerCharacters: options.enableAutoComplete,
    insertSpaces: options.insertSpaces,
    renderWhitespace: options.renderWhitespaces,
    tabSize: options.tabSize,
    detectIndentation: options.detectIndentation,
    selectionHighlight: options.enableSelectionHighlight,
    // --- A string enum since Monaco 0.45, not a boolean. Monaco's option validator silently
    // --- substitutes the default for an unrecognised value, so `true` AND `false` both resolved to
    // --- "singleFile" and the user's setting did nothing in either direction.
    occurrencesHighlight: options.enableOccurrencesHighlight ? "singleFile" : "off",
    quickSuggestionsDelay: options.quickSuggestionDelay
  });
}
