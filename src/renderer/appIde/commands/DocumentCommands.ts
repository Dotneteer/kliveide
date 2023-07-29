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
import { Token } from "../services/command-parser";
import { BinaryContentsResponse, TextContentsResponse } from "@/common/messaging/any-to-main";
import { incDocumentActivationVersionAction } from "@/common/state/actions";

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
  async validateArgs (
    args: Token[]
  ): Promise<ValidationMessage | ValidationMessage[]> {
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

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    // --- Check if a project node exists
    const projState = context.store.getState()?.project;
    if (!projState?.folderPath) {
      return commandError("No project is open.");
    }

    // --- Get the project node
    const projNode = context.service.projectService.getNodeForFile(
      this.filename
    );
    if (!projNode) {
      return commandError(`File '${this.filename}' not found in the project.`);
    }

    // --- Is the document open?
    const nodeData = projNode.data;
    const docService = context.service.documentService;
    const doc = docService.getDocument(projNode.data.fullPath);
    if (doc) {
      // --- Activate the open document
      docService.setActiveDocument(doc.id);
    } else {
      // --- Load the document
      const docContent: any = {};
      if (nodeData.isBinary) {
        const response = (await context.messenger.sendMessage({
          type: "MainReadBinaryFile",
          path: nodeData.fullPath
        })) as BinaryContentsResponse;
        docContent.value = response.contents;
      } else {
        const response = (await context.messenger.sendMessage({
          type: "MainReadTextFile",
          path: nodeData.fullPath
        })) as TextContentsResponse;
        docContent.value = response.contents;
      }

      docService.openDocument(
        {
          id: nodeData.fullPath,
          name: nodeData.name,
          path: nodeData.fullPath,
          type: nodeData.editor,
          language: nodeData.subType,
          iconName: nodeData.icon,
          isReadOnly: nodeData.isReadOnly,
          node: projNode,
          viewVersion: 0
        },
        docContent,
        !nodeData.openPermanent
      );
    }

    // --- The document should be open
    const openDoc = await docService.waitOpen(projNode.data.fullPath, true);
    if (openDoc) {
      // --- Navigate to the specified position (if requested)
      if (this.lineNo != undefined) {
        const api = docService.getDocumentApi(openDoc.id);
        if (api) {
          const apiEndpoint = api?.setPosition;
          if (typeof apiEndpoint === "function") {
            apiEndpoint(this.lineNo, this.columnNo ?? 0);
          }
        }
      }
      context.store.dispatch(incDocumentActivationVersionAction());
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
