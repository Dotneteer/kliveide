import { OutputSpecification } from "@renderer/appIde/ToolArea/abstractions";
import { buildMessagingProxy } from "./MessageProxy";
import { MessengerBase } from "./MessengerBase";
import { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import { ProjectStructure } from "@main/ksx-runner/ProjectStructure";

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
   * Displays several output spans in one round trip.
   *
   * Every call on this API is an awaited, correlated request with its own timeout entry, so the
   * cost of console output was dominated by the *number* of messages rather than their size: one
   * per span, and the style re-sent in full with each. Emitting a run of spans as one message is
   * the difference between two round trips per emulator log line and one.
   *
   * @param _toDisplay Output specifications, applied in order.
   */
  async displayOutputBatch(_toDisplay: OutputSpecification[]): Promise<void> {
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
   * Sends a run of script-output operations in one round trip.
   *
   * Script output carries *stateful* style, so a single coloured line is `pushStyle`, `resetStyle`,
   * `color`, `write`, `write`, `writeLine`, `popStyle` — seven serial awaited round trips for one
   * line of text. As one message it is one.
   *
   * @param _id Script ID.
   * @param _operations Buffer operations, applied in order.
   */
  async scriptOutputBatch(
    _id: number,
    _operations: { operation: any; args?: any[] }[]
  ): Promise<void> {
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
   * Displays a registered IDE dialog.
   * @param _dialogId Numeric dialog ID.
   * @param _dialogData Optional dialog payload.
   */
  async displayDialog(_dialogId: number, _dialogData?: any): Promise<unknown | undefined> {
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

/**
 * IDE-process methods whose duration is genuinely unbounded, and which therefore opt out of the
 * default request timeout.
 */
const UNBOUNDED_IDE_METHODS = [
  // --- Blocks until the user responds
  "displayDialog",
  // --- Runs an arbitrary IDE command, which may itself build or run a project
  "executeCommand",
  // --- Saves every dirty document on the quit path
  "saveAllBeforeQuit"
] as const;

export function createIdeApi(messenger: MessengerBase): IdeApiImpl {
  return buildMessagingProxy(new ProxyIdeApiImpl(), messenger, "ide", {
    unboundedMethods: UNBOUNDED_IDE_METHODS
  });
}
