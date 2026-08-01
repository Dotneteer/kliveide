import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  writeSuccessMessage
} from "../services/ide-commands";
import { EditorApi } from "@renderer/features/editor/monaco/MonacoEditor";
import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { getDocumentAreaCommandTarget } from "@renderer/features/documents/documentAreaCommandTarget";
import { type DocumentAreaGridApi } from "@renderer/features/documents/DocumentAreaGrid";

type NavigateToDocumentCommandArgs = {
  filename: string;
  lineNo?: number;
  columnNo?: number;
};

export class NavigateToDocumentCommand extends IdeCommandBase<NavigateToDocumentCommandArgs> {
  readonly id = "nav";
  readonly description = "Navigates to the specified document";
  readonly usage = "nav projeFile [line] [column]";

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "filename", type: "string" }],
    optional: [
      { name: "lineNo", type: "number" },
      { name: "columnNo", type: "number" }
    ]
  };

  async execute(
    context: IdeCommandContext,
    args: NavigateToDocumentCommandArgs
  ): Promise<IdeCommandResult> {
    // --- Check if a project node exists
    const projState = context.store.getState()?.project;
    if (!projState?.folderPath) {
      return commandError("No project is open.");
    }

    // --- Get the project node
    const projNode = context.service.projectService.getNodeForFile(args.filename);
    if (!projNode) {
      return commandError(`File '${args.filename}' not found in the project.`);
    }

    // --- Is the document open?
    const nodeData = projNode.data;
    const docService = context.service.projectService.getActiveDocumentHubService();
    const doc = docService.getDocument(projNode.data.fullPath);
    if (doc) {
      // --- Activate the open document
      await docService.setActiveDocument(doc.id);
    } else {
      const newDoc = await context.service.projectService.getDocumentForProjectNode(nodeData);
      // TODO: Allow the currently active document to save itself before opening the new one

      // --- Open it
      await docService.openDocument(newDoc, undefined, false);
    }

    // --- The document should be open
    const openDoc = await docService.waitOpen(projNode.data.fullPath, true);
    if (openDoc) {
      // --- Delay 50 ms to allow the editor to be ready
      await new Promise((resolve) => setTimeout(resolve, 50));
      // --- Navigate to the specified position (if requested)
      if (args.lineNo != undefined) {
        const api = docService.getDocumentApi(openDoc.id);
        if (api) {
          const apiEndpoint = (api as EditorApi)?.setPosition;
          if (typeof apiEndpoint === "function") {
            apiEndpoint(args.lineNo, Math.max((args.columnNo ?? 0) - 1, 0));
          }
        }
      }
    }

    // --- Done.
    writeSuccessMessage(
      context.output,
      `Navigate to ${args.filename}${
        args.lineNo != undefined || args.columnNo != undefined
          ? ` (${args.lineNo}:${args.columnNo})`
          : ""
      } `
    );
    return commandSuccess;
  }
}

abstract class DocumentAreaCommandBase extends IdeCommandBase {
  protected getTarget(): DocumentAreaGridApi | undefined {
    return getDocumentAreaCommandTarget();
  }

  protected noTargetError(): IdeCommandResult {
    return commandError("No document area is active.");
  }
}

export class SplitEditorRightCommand extends DocumentAreaCommandBase {
  readonly id = "doc-split-right";
  readonly description = "Document: Split Right";
  readonly usage = "doc-split-right";

  async execute(): Promise<IdeCommandResult> {
    const target = this.getTarget();
    if (!target) return this.noTargetError();
    await target.splitActiveArea("horizontal");
    return commandSuccess;
  }
}

export class SplitEditorDownCommand extends DocumentAreaCommandBase {
  readonly id = "doc-split-down";
  readonly description = "Document: Split Down";
  readonly usage = "doc-split-down";

  async execute(): Promise<IdeCommandResult> {
    const target = this.getTarget();
    if (!target) return this.noTargetError();
    await target.splitActiveArea("vertical");
    return commandSuccess;
  }
}

export class MoveEditorToNextAreaCommand extends DocumentAreaCommandBase {
  readonly id = "doc-move-next-area";
  readonly description = "Document: Move Editor To Next Area";
  readonly usage = "doc-move-next-area";

  async execute(): Promise<IdeCommandResult> {
    const target = this.getTarget();
    if (!target) return this.noTargetError();
    await target.moveActiveDocumentToNextArea();
    return commandSuccess;
  }
}

export class MoveEditorToPreviousAreaCommand extends DocumentAreaCommandBase {
  readonly id = "doc-move-previous-area";
  readonly description = "Document: Move Editor To Previous Area";
  readonly usage = "doc-move-previous-area";

  async execute(): Promise<IdeCommandResult> {
    const target = this.getTarget();
    if (!target) return this.noTargetError();
    await target.moveActiveDocumentToPreviousArea();
    return commandSuccess;
  }
}

export class CloseEditorAreaCommand extends DocumentAreaCommandBase {
  readonly id = "doc-close-area";
  readonly description = "Document: Close Editor Area";
  readonly usage = "doc-close-area";

  async execute(): Promise<IdeCommandResult> {
    const target = this.getTarget();
    if (!target) return this.noTargetError();
    await target.closeActiveArea();
    return commandSuccess;
  }
}

export class CloseEditorsInOtherAreasCommand extends DocumentAreaCommandBase {
  readonly id = "doc-close-other-areas";
  readonly description = "Document: Close Editors In Other Areas";
  readonly usage = "doc-close-other-areas";

  async execute(): Promise<IdeCommandResult> {
    const target = this.getTarget();
    if (!target) return this.noTargetError();
    await target.closeOtherAreas();
    return commandSuccess;
  }
}
