import { OutputSpecification } from "@renderer/appIde/ToolArea/abstractions";
import { buildMessagingProxy } from "./MessageProxy";
import { MessengerBase } from "./MessengerBase";
import { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import { ProjectStructure } from "@main/ksx-runner/ProjectStructure";

const NO_PROXY_ERROR = "Method should be implemented by a proxy.";

/**
 * This class defines the shape of the Ide process API that can be called from
 * the Emu and main processes. The methods are called through a JavaScript proxy.
 */
class IdeApiImpl {
  displayOutput(_toDisplay: OutputSpecification): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  scriptOutput(_id: number, _operation: any, _args?: any[]): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  showMemory(_show: boolean): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  showDisassembly(_show: boolean): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  showBasic(_show: boolean): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  executeCommand(
    _commandText: string,
    _scriptId?: number
  ): Promise<IdeCommandResult> {
    throw new Error(NO_PROXY_ERROR);
  }

  saveAllBeforeQuit(): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  getProjectStructure(): Promise<ProjectStructure> {
    throw new Error(NO_PROXY_ERROR);
  }
}

export type IdeApi = IdeApiImpl;

export function createIdeApi(messenger: MessengerBase): IdeApiImpl {
  return buildMessagingProxy(new IdeApiImpl(), messenger, "ide");
}
