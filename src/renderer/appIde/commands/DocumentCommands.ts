import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import {
  IdeCommandBaseNew,
  commandError,
  commandSuccess,
  writeSuccessMessage
} from "../services/ide-commands";
import { EditorApi } from "../DocumentPanels/MonacoEditor";
import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";

type NavigateToDocumentCommandArgs = {
  filename: string;
  lineNo?: number;
  columnNo?: number;
};

export class NavigateToDocumentCommand extends IdeCommandBaseNew<NavigateToDocumentCommandArgs> {
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
      await docService.openDocument(newDoc);
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
