import { AppServices } from "@renderer/abstractions/AppServices";
import {
  RequestMessage,
  ResponseMessage,
  defaultResponse,
  errorResponse
} from "@messaging/messages-core";
import { AppState } from "@state/AppState";
import {
  BASIC_PANEL_ID,
  BASIC_EDITOR,
  MEMORY_PANEL_ID,
  DISASSEMBLY_PANEL_ID
} from "@state/common-ids";
import { Store } from "@state/redux-light";
import { dimMenuAction } from "@common/state/actions";
import { IProjectService } from "@renderer/abstractions/IProjectService";
import { PANE_ID_BUILD } from "@common/integration/constants";
import { ProjectStructure, ProjectTreeNode } from "@main/ksx-runner/ProjectStructure";
import { CompositeOutputBuffer } from "./ToolArea/CompositeOutputBuffer";
import { ITreeView, ITreeNode } from "@abstractions/ITreeNode";
import { ProjectNode } from "@abstractions/ProjectNode";
import { IOutputPaneService } from "@renderer/abstractions/IOutputPaneService";
import { IScriptService } from "@renderer/abstractions/IScriptService";
import { IIdeCommandService } from "@renderer/abstractions/IIdeCommandService";
import { BufferOperation, OutputSpecification } from "./ToolArea/abstractions";

class IdeMessageProcessor {
  /**
   * Constructs the IdeMessageProcessor.
   * @param store Redux store for app state.
   * @param outputPaneService Service for output pane operations.
   * @param ideCommandsService Service for IDE command execution.
   * @param projectService Service for project operations.
   * @param scriptService Service for script output operations.
   */
  constructor(
    private readonly store: Store<AppState>,
    private readonly outputPaneService: IOutputPaneService,
    private readonly ideCommandsService: IIdeCommandService,
    private readonly projectService: IProjectService,
    private readonly scriptService: IScriptService
  ) {}

  /**
   * Displays output in the IDE output pane.
   * @param toDisplay Output specification to display.
   */
  displayOutput(toDisplay: OutputSpecification) {
    const buffer = this.outputPaneService.getOutputPaneBuffer(toDisplay.pane);
    if (!buffer) return;
    buffer.resetStyle();
    if (toDisplay.foreground !== undefined) buffer.color(toDisplay.foreground);
    if (toDisplay.background !== undefined) buffer.backgroundColor(toDisplay.background);
    buffer.bold(toDisplay.isBold ?? false);
    buffer.italic(toDisplay.isItalic ?? false);
    buffer.underline(toDisplay.isUnderline ?? false);
    buffer.strikethru(toDisplay.isStrikeThru ?? false);
    if (toDisplay.writeLine) {
      buffer.writeLine(toDisplay.text, toDisplay.data, toDisplay.actionable);
    } else {
      buffer.write(toDisplay.text, toDisplay.data, toDisplay.actionable);
    }
  }

  /**
   * Sends script output to the IDE.
   * @param id Script ID.
   * @param operation Buffer operation to perform.
   * @param args Optional arguments for the operation.
   */
  scriptOutput(id: number, operation: any, args?: any[]) {
    executeScriptOutput(this.scriptService, id, operation, args);
  }

  /**
   * Shows or hides the memory panel.
   * @param show True to show, false to hide.
   */
  showMemory(show: boolean) {
    if (show) {
      this.ideCommandsService.executeCommand("show-memory");
    } else {
      this.projectService.getActiveDocumentHubService().closeDocument(MEMORY_PANEL_ID);
    }
  }

  /**
   * Shows or hides the disassembly panel.
   * @param show True to show, false to hide.
   */
  showDisassembly(show: boolean) {
    if (show) {
      this.ideCommandsService.executeCommand("show-disass");
    } else {
      this.projectService.getActiveDocumentHubService().closeDocument(DISASSEMBLY_PANEL_ID);
    }
  }

  /**
   * Shows or hides the BASIC listing panel.
   * @param show True to show, false to hide.
   */
  showBasic(show: boolean) {
    if (show) {
      this.projectService.getActiveDocumentHubService().openDocument(
        {
          id: BASIC_PANEL_ID,
          name: "BASIC Listing",
          type: BASIC_EDITOR
        },
        undefined,
        false
      );
    } else {
      this.projectService.getActiveDocumentHubService().closeDocument(BASIC_PANEL_ID);
    }
  }

  /**
   * Executes a command in the IDE.
   * @param commandText The command text to execute.
   * @param scriptId Optional script ID for script context.
   */
  async executeCommand(commandText: string, scriptId?: number) {
    const buildOutput = this.outputPaneService.getOutputPaneBuffer(PANE_ID_BUILD);
    const scriptOutput = scriptId
      ? this.scriptService.getScriptOutputBuffer(scriptId)
      : undefined;
    const buffers = [buildOutput];
    if (scriptOutput) {
      buffers.push(scriptOutput);
    }
    return await this.ideCommandsService.executeCommand(
      commandText,
      new CompositeOutputBuffer(buffers)
    );
  }

  /**
   * Saves all files before quitting the IDE.
   */
  saveAllBeforeQuit() {
    saveAllBeforeQuit(this.store, this.projectService);
  }

  /**
   * Gets the current project structure.
   */
  getProjectStructure() {
    return convertToProjectStructure(this.store, this.projectService.getProjectTree());
  }
}

/**
 * Process the messages coming from the emulator to the main process
 * @param message Emulator message
 * @returns Message response
 */
export async function processMainToIdeMessages(
  message: RequestMessage,
  store: Store<AppState>,
  { outputPaneService, ideCommandsService, projectService, scriptService }: AppServices
): Promise<ResponseMessage> {
  const ideMessageProcessor = new IdeMessageProcessor(
    store,
    outputPaneService,
    ideCommandsService,
    projectService,
    scriptService
  );

  switch (message.type) {
    case "ForwardAction":
      // --- The emu sent a state change action. Replay it in the main store without formarding it
      store.dispatch(message.action, message.sourceId);
      break;

    case "ApiMethodRequest":
      // --- We accept only methods defined in the MainMessageProcessor
      const processingMethod = ideMessageProcessor[message.method];
      if (typeof processingMethod === "function") {
        try {
          // --- Call the method with the given arguments. We do not call the
          // --- function through the mainMessageProcessor instance, so we need
          // --- to pass it as the "this" parameter.
          return {
            type: "ApiMethodResponse",
            result: await (processingMethod as Function).call(ideMessageProcessor, ...message.args)
          };
        } catch (err) {
          // --- Report the error
          console.error(`Error processing message (${message.method}): ${err}`);
          return errorResponse(err.toString());
        }
      }
      return errorResponse(`Unknown method ${message.method}`);
  }
  return defaultResponse();
}

export async function saveAllBeforeQuit(
  store: Store<AppState>,
  projectService: IProjectService
): Promise<void> {
  let wasDimmed = store.getState().dimMenu;
  store.dispatch(dimMenuAction(true));
  try {
    await projectService.performAllDelayedSavesNow();
  } finally {
    store.dispatch(dimMenuAction(wasDimmed));
  }
}

function executeScriptOutput(
  scriptService: IScriptService,
  id: number,
  operation: BufferOperation,
  args?: any[]
): void {
  if (!scriptService) return;

  const buffer = scriptService.getScriptOutputBuffer(id);
  if (!buffer) return;

  switch (operation) {
    case "clear":
      buffer.clear();
      break;
    case "write":
      buffer.write(args[0]?.toString(), args[1], args[2]);
      break;
    case "writeLine":
      buffer.writeLine(args[0]?.toString(), args[1], args[2]);
      break;
    case "resetStyle":
      buffer.resetStyle();
      break;
    case "color":
      buffer.color(args[0]);
      break;
    case "backgroundColor":
      buffer.backgroundColor(args[0]);
      break;
    case "bold":
      buffer.bold(args[0]);
      break;
    case "italic":
      buffer.italic(args[0]);
      break;
    case "underline":
      buffer.underline(args[0]);
      break;
    case "strikethru":
      buffer.strikethru(args[0]);
      break;
    case "pushStyle":
      buffer.pushStyle();
      break;
    case "popStyle":
      buffer.popStyle();
      break;
  }
}

function convertToProjectStructure(
  store: Store<AppState>,
  tree: ITreeView<ProjectNode>
): ProjectStructure {
  const project = store.getState().project;
  const nodes = collectNodes(tree.rootNode.children);

  return {
    rootPath: project.folderPath,
    hasBuildFile: !!project.hasBuildFile,
    buildRoot: project.buildRoots.length > 0 ? project.buildRoots[0] : undefined,
    buildFunctions: [],
    children: nodes
  };

  function collectNodes(children: ITreeNode<ProjectNode>[]): ProjectTreeNode[] {
    if (!children) return [];

    const result: ProjectTreeNode[] = [];
    children.forEach((child) => {
      const nodeChildren = collectNodes(child.children);
      result.push({
        depth: child.depth,
        name: child.data.name,
        fullPath: child.data.fullPath,
        projectPath: child.data.projectPath,
        isFolder: child.data.isFolder,
        isReadonly: child.data.isReadOnly,
        isBinary: child.data.isBinary,
        canBeBuildRoot: child.data.canBeBuildRoot,
        children: nodeChildren.length > 0 ? nodeChildren : []
      });
    });
    return result;
  }
}
