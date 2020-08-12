import * as vscode from "vscode";
import { getActiveEditor } from "../custom-editors/editor-base";

export function refreshView(): void {
  const activeEditor = getActiveEditor();
  if (activeEditor) {
    activeEditor.refreshView();
  }
}