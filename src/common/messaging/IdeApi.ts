import { buildMessagingProxy } from "./MessageProxy";
import { MessengerBase } from "./MessengerBase";
import { IdeCommandResult } from "../../common/abstractions/IdeCommandResult";
import { ProjectStructure } from "../../main/ksx-runner/ProjectStructure";
import { OutputSpecification } from "../../common/abstractions/OutputBuffer";

const NO_PROXY_ERROR = "Method should be implemented by a proxy.";

/**
 * Abstract base class defining the shape of the IDE process API that can be called from
 * the Emu and main processes. The methods are called through a JavaScript proxy and must
 * be implemented by a proxy handler. Do not instantiate directly.
 */
abstract class IdeApiImpl {
  /**
   * Displays output in the IDE output pane.
   * @param _toDisplay Output specification to display.
   */
  async displayOutput(_toDisplay: OutputSpecification): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Sends script output to the IDE.
   * @param _id Script ID.
   * @param _operation Buffer operation to perform.
   * @param _args Optional arguments for the operation.
   */
  async scriptOutput(_id: number, _operation: any, _args?: any[]): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Shows or hides the memory panel.
   * @param _show True to show, false to hide.
   */
  async showMemory(_show: boolean): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Shows or hides the disassembly panel.
   * @param _show True to show, false to hide.
   */
  async showDisassembly(_show: boolean): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Shows or hides the BASIC listing panel.
   * @param _show True to show, false to hide.
   */
  async showBasic(_show: boolean): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Executes a command in the IDE.
   * @param _commandText The command text to execute.
   * @param _scriptId Optional script ID for script context.
   */
  async executeCommand(
    _commandText: string,
    _scriptId?: number
  ): Promise<IdeCommandResult> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Saves all files before quitting the IDE.
   */
  async saveAllBeforeQuit(): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the current project structure.
   */
  async getProjectStructure(): Promise<ProjectStructure> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }
}

// Internal concrete subclass for proxy instantiation
class ProxyIdeApiImpl extends IdeApiImpl {}

export type IdeApi = IdeApiImpl;

export function createIdeApi(messenger: MessengerBase): IdeApiImpl {
  return buildMessagingProxy(new ProxyIdeApiImpl(), messenger, "ide");
}
