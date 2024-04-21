import { AppServices } from "@renderer/abstractions/AppServices";
import {
  RequestMessage,
  ResponseMessage,
  defaultResponse
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
import { IdeScriptOutputRequest } from "@common/messaging/any-to-ide";
import { getCachedAppServices } from "../CachedServices";
import { ITreeNode, ITreeView } from "@renderer/core/tree-node";
import { ProjectNode } from "./project/project-node";
import {
  ProjectStructure,
  ProjectTreeNode
} from "@main/ksx-runner/ProjectStructure";

/**
 * Process the messages coming from the emulator to the main process
 * @param message Emulator message
 * @returns Message response
 */
export async function processMainToIdeMessages (
  message: RequestMessage,
  store: Store<AppState>,
  {
    outputPaneService,
    ideCommandsService,
    projectService,
    scriptService
  }: AppServices
): Promise<ResponseMessage> {
  const documentHubService = projectService.getActiveDocumentHubService();
  switch (message.type) {
    case "ForwardAction":
      // --- The emu sent a state change action. Replay it in the main store without formarding it
      store.dispatch(message.action, message.sourceId);
      break;

    case "IdeDisplayOutput":
      // --- Display the output message
      const buffer = outputPaneService.getOutputPaneBuffer(message.pane);
      if (!buffer) break;
      buffer.resetStyle();
      if (message.color !== undefined) buffer.color(message.color);
      if (message.backgroundColor !== undefined)
        buffer.backgroundColor(message.color);
      buffer.bold(message.bold ?? false);
      buffer.italic(message.italic ?? false);
      buffer.underline(message.underline ?? false);
      buffer.strikethru(message.strikeThru ?? false);
      if (message.writeLine) {
        buffer.writeLine(message.text, message.data, message.actionable);
      } else {
        buffer.write(message.text, message.data, message.actionable);
      }
      break;

    case "IdeShowMemory": {
      if (message.show) {
        await ideCommandsService.executeCommand("show-memory");
      } else {
        await documentHubService.closeDocument(MEMORY_PANEL_ID);
      }
      break;
    }

    case "IdeShowDisassembly": {
      if (message.show) {
        await ideCommandsService.executeCommand("show-disass");
      } else {
        await documentHubService.closeDocument(DISASSEMBLY_PANEL_ID);
      }
      break;
    }

    case "IdeShowBasic": {
      if (message.show) {
        await documentHubService.openDocument(
          {
            id: BASIC_PANEL_ID,
            name: "BASIC Listing",
            type: BASIC_EDITOR
          },
          undefined,
          false
        );
      } else {
        await documentHubService.closeDocument(BASIC_PANEL_ID);
      }
      break;
    }

    case "IdeExecuteCommand": {
      const pane = message.scriptId
        ? scriptService.getScriptOutputBuffer(message.scriptId)
        : outputPaneService.getOutputPaneBuffer(PANE_ID_BUILD);
      console.log("IdeExecuteCommand", message.commandText, pane);  
      const response = await ideCommandsService.executeCommand(
        message.commandText,
        pane
      );
      return {
        type: "IdeExecuteCommandResponse",
        success: response.success,
        finalMessage: response.finalMessage,
        value: response.value
      };
    }

    case "IdeSaveAllBeforeQuit": {
      await saveAllBeforeQuit(store, projectService);
      break;
    }

    case "IdeScriptOutput": {
      executeScriptOutput(message);
      break;
    }

    case "IdeGetProjectStructure": {
      return {
        type: "IdeGetProjectStructureResponse",
        projectStructure: convertToProjectStructure(
          store,
          projectService.getProjectTree()
        )
      };
    }
  }
  return defaultResponse();
}

export async function saveAllBeforeQuit (
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

function executeScriptOutput (message: IdeScriptOutputRequest): void {
  const scriptService = getCachedAppServices().scriptService;
  if (!scriptService) return;

  const buffer = scriptService.getScriptOutputBuffer(message.id);
  if (!buffer) return;

  switch (message.operation) {
    case "clear":
      buffer.clear();
      break;
    case "write":
      buffer.write(message.args[0], message.args[1], message.args[2]);
      break;
    case "writeLine":
      buffer.writeLine(message.args[0], message.args[1], message.args[2]);
      break;
    case "resetStyle":
      buffer.resetStyle();
      break;
    case "color":
      buffer.color(message.args[0]);
      break;
    case "backgroundColor":
      buffer.backgroundColor(message.args[0]);
      break;
    case "bold":
      buffer.bold(message.args[0]);
      break;
    case "italic":
      buffer.italic(message.args[0]);
      break;
    case "underline":
      buffer.underline(message.args[0]);
      break;
    case "strikethru":
      buffer.strikethru(message.args[0]);
      break;
    case "pushStyle":
      buffer.pushStyle();
      break;
    case "popStyle":
      buffer.popStyle();
      break;
  }
}

function convertToProjectStructure (
  store: Store<AppState>,
  tree: ITreeView<ProjectNode>
): ProjectStructure {
  const project = store.getState().project;
  const nodes = collectNodes(tree.rootNode.children);

  return {
    rootPath: project.folderPath,
    hasBuildFile: !!project.hasBuildFile,
    buildFunctions: [],
    children: nodes
  };

  function collectNodes (children: ITreeNode<ProjectNode>[]): ProjectTreeNode[] {
    if (!children) return [];

    const result: ProjectTreeNode[] = [];
    children.forEach(child => {
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
