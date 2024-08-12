import { MessengerBase } from "@messaging/MessengerBase";
import { MessageBase, RequestMessage, ResponseMessage } from "@messaging/messages-core";
import { BufferOperation, OutputSpecification } from "@renderer/appIde/ToolArea/abstractions";
import { IdeExecuteCommandResponse, IdeGetProjectStructureResponse } from "./any-to-ide";

/**
 * This interface defines the API exposed by the Emulator
 */
export interface IdeApi {
  displayOutput(toDisplay: OutputSpecification): Promise<void>;
  scriptOutput(id: number, operation: BufferOperation, args?: any[]): Promise<void>;
  showMemory(show: boolean): Promise<void>;
  showDisassembly(show: boolean): Promise<void>;
  showBasic(show: boolean): Promise<void>;
  executeCommand(commandText: string, scriptId?: number): Promise<IdeExecuteCommandResponse>;
  saveAllBeforeQuit(): Promise<void>;
  getProjectStructure(): Promise<IdeGetProjectStructureResponse>;
}

class IdeApiImpl implements IdeApi {
  constructor(private readonly messenger: MessengerBase) {}

  /**
   * Displays output on the specified pane
   * @param toDisplay Output specification
   */
  async displayOutput(toDisplay: OutputSpecification): Promise<void> {
    await this.sendMessage({
      type: "IdeDisplayOutput",
      toDisplay
    });
  }

  /**
   * Sends a script output request to the IDE
   * @param id Script ID
   * @param operation Buffer operation
   * @param args Optional arguments
   */
  async scriptOutput(id: number, operation: BufferOperation, args?: any[]): Promise<void> {
    await this.sendMessage({
      type: "IdeScriptOutput",
      id,
      operation,
      args
    });
  }

  /**
   * Shows or hides the memory pane
   * @param show Show or hide
   */
  async showMemory(show: boolean): Promise<void> {
    await this.sendMessage({
      type: "IdeShowMemory",
      show
    });
  }

  /**
   * Shows or hides the disassembly pane
   * @param show Show or hide
   */
  async showDisassembly(show: boolean): Promise<void> {
    await this.sendMessage({
      type: "IdeShowDisassembly",
      show
    });
  }

  /**
   * Shows or hides the BASIC pane
   * @param show Show or hide
   */
  async showBasic(show: boolean): Promise<void> {
    await this.sendMessage({
      type: "IdeShowBasic",
      show
    });
  }

  /**
   * Executes a command in the IDE
   * @param commandText Command text
   * @param scriptId Optional script ID
   */
  async executeCommand(commandText: string, scriptId?: number): Promise<IdeExecuteCommandResponse> {
    return (await this.sendMessage(
      {
        type: "IdeExecuteCommand",
        commandText,
        scriptId
      },
      "IdeExecuteCommandResponse"
    )) as IdeExecuteCommandResponse;
  }

  /**
   * Saves all files before quitting the IDE
   */
  async saveAllBeforeQuit(): Promise<void> {
    await this.sendMessage({
      type: "IdeSaveAllBeforeQuit"
    });
  }

  /**
   * Gets the current project structure
   */
  async getProjectStructure(): Promise<IdeGetProjectStructureResponse> {
    return (await this.sendMessage(
      {
        type: "IdeGetProjectStructure"
      },
      "IdeGetProjectStructureResponse"
    )) as IdeGetProjectStructureResponse;
  }

  private async sendMessage(
    message: RequestMessage,
    msgType?: ResponseMessage["type"]
  ): Promise<MessageBase> {
    const response = await this.messenger.sendMessage(message);
    if (response.type === "ErrorResponse") {
      console.log(`Error while sending IPC message: ${response.message}`);
    } else if (msgType && response.type !== msgType) {
      console.log(`Unexpected response type for request type '${message.type}': ${response.type}`);
    }
    return response;
  }
}

export function createIdeApi(messenger: MessengerBase): IdeApi {
  return new IdeApiImpl(messenger);
}
