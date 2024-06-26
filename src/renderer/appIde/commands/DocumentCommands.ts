import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  getNumericTokenValue,
  validationError,
  writeSuccessMessage
} from "../services/ide-commands";
import { ValidationMessage } from "../../abstractions/ValidationMessage";
import { EditorApi } from "../DocumentPanels/MonacoEditor";

export class NavigateToDocumentCommand extends IdeCommandBase {
  readonly id = "nav";
  readonly description = "Navigates to the specified document";
  readonly usage = "nav projeFile [line] [column]";

  private filename: string | undefined;
  private lineNo?: number;
  private columnNo?: number;

  prepareCommand(): void {
    this.lineNo = this.columnNo = undefined;
  }

  /**
   * Validates the input arguments
   * @param _args Arguments to validate
   * @returns A list of issues
   */
  async validateArgs(context: IdeCommandContext): Promise<ValidationMessage | ValidationMessage[]> {
    const args = context.argTokens;
    if (args.length < 1 || args.length > 3) {
      return validationError("This command expects 1 to 3 arguments");
    }
    this.filename = args[0].text;
    if (args.length > 1) {
      const { value, messages } = getNumericTokenValue(args[1]);
      if (value === null) {
        return messages;
      }
      this.lineNo = value;
    }
    if (args.length > 2) {
      const { value, messages } = getNumericTokenValue(args[2]);
      if (value === null) {
        return messages;
      }
      this.columnNo = value;
    }
    return [];
  }

  async doExecute(context: IdeCommandContext): Promise<IdeCommandResult> {
    // --- Check if a project node exists
    const projState = context.store.getState()?.project;
    if (!projState?.folderPath) {
      return commandError("No project is open.");
    }

    // --- Get the project node
    const projNode = context.service.projectService.getNodeForFile(this.filename);
    if (!projNode) {
      return commandError(`File '${this.filename}' not found in the project.`);
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
      if (this.lineNo != undefined) {
        const api = docService.getDocumentApi(openDoc.id);
        if (api) {
          const apiEndpoint = (api as EditorApi)?.setPosition;
          if (typeof apiEndpoint === "function") {
            apiEndpoint(this.lineNo, Math.max((this.columnNo ?? 0) - 1, 0));
          }
        }
      }
    }

    // --- Done.
    writeSuccessMessage(
      context.output,
      `Navigate to ${this.filename}${
        this.lineNo != undefined || this.columnNo != undefined
          ? ` (${this.lineNo}:${this.columnNo})`
          : ""
      } `
    );
    return commandSuccess;
  }
}
