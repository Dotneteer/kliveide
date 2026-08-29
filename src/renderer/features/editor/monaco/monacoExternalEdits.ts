import type { RenameEdit } from "@renderer/appIde/services/z80-providers";
import type { IProjectService } from "@renderer/abstractions/IProjectService";
import type { createMainApi } from "@common/messaging/MainApi";

type MainApi = ReturnType<typeof createMainApi>;

/**
 * Applies Monaco rename edits to files outside the active editor and reloads
 * any open documents that display the changed files.
 */
export async function applyExternalRenameEdits(
  mainApi: Pick<MainApi, "readTextFile">,
  projectService: Pick<IProjectService, "getDocumentHubServiceInstances" | "saveFileContent">,
  edits: RenameEdit[]
): Promise<void> {
  const editsByFile = groupEditsByFile(edits);

  for (const [filePath, fileEdits] of editsByFile) {
    const content = await mainApi.readTextFile(filePath);
    const newContent = applyRenameEditsToText(content, fileEdits);

    await projectService.saveFileContent(filePath, newContent);
    await reloadOpenDocuments(projectService, filePath);
  }
}

/**
 * Applies Monaco rename edits to a text buffer. Monaco line and column values
 * are 1-based, so string indexes are normalized before editing.
 */
export function applyRenameEditsToText(content: string, edits: RenameEdit[]): string {
  const lines = content.split("\n");
  const sorted = [...edits].sort((a, b) =>
    b.line !== a.line ? b.line - a.line : b.startColumn - a.startColumn
  );

  for (const edit of sorted) {
    const lineIndex = edit.line - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) continue;

    const line = lines[lineIndex];
    const startIndex = Math.max(0, edit.startColumn - 1);
    const endIndex = Math.max(startIndex, edit.endColumn - 1);
    lines[lineIndex] = line.substring(0, startIndex) + edit.newText + line.substring(endIndex);
  }

  return lines.join("\n");
}

function groupEditsByFile(edits: RenameEdit[]): Map<string, RenameEdit[]> {
  const byFile = new Map<string, RenameEdit[]>();

  for (const edit of edits) {
    const fileEdits = byFile.get(edit.filePath) ?? [];
    fileEdits.push(edit);
    byFile.set(edit.filePath, fileEdits);
  }

  return byFile;
}

async function reloadOpenDocuments(
  projectService: Pick<IProjectService, "getDocumentHubServiceInstances">,
  filePath: string
): Promise<void> {
  for (const hub of projectService.getDocumentHubServiceInstances()) {
    for (const doc of hub.getOpenDocuments()) {
      if (doc.id === filePath || doc.path === filePath) {
        await hub.reloadDocument(doc.id);
      }
    }
  }
}
