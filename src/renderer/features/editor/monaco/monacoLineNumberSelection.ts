import type * as monacoEditor from "monaco-editor";

type EditorSelection = monacoEditor.ISelection & monacoEditor.IRange;

/**
 * Monaco selects a line-number click as [line, 1 -> line + 1, 1], which leaves
 * the active cursor on the following line. Reverse that single-line selection
 * so the current-line highlight remains on the clicked line number.
 */
export function getNormalizedLineNumberSelection(
  selection: EditorSelection | null,
  clickedLineNumber: number,
  lineCount: number
): monacoEditor.ISelection | null {
  if (!selection || clickedLineNumber < 1 || clickedLineNumber >= lineCount) {
    return null;
  }

  const isClickedLineSelection =
    selection.startLineNumber === clickedLineNumber &&
    selection.startColumn === 1 &&
    selection.endLineNumber === clickedLineNumber + 1 &&
    selection.endColumn === 1;

  const isForwardSelection =
    selection.selectionStartLineNumber === clickedLineNumber &&
    selection.selectionStartColumn === 1 &&
    selection.positionLineNumber === clickedLineNumber + 1 &&
    selection.positionColumn === 1;

  if (!isClickedLineSelection || !isForwardSelection) {
    return null;
  }

  return {
    selectionStartLineNumber: clickedLineNumber + 1,
    selectionStartColumn: 1,
    positionLineNumber: clickedLineNumber,
    positionColumn: 1
  };
}
