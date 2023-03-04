import { IMachineService } from "@/appEmu/abstrations/IMachineService";
import { IOutputBuffer, OutputContentLine } from "@/appIde/ToolArea/abstractions";
import { IUiService } from "@/core/UiServices";
import { IZ80Machine } from "@/emu/abstractions/IZ80Machine";
import { ILiteEvent } from "@/emu/utils/lite-event";
import { MessengerBase } from "@messaging/MessengerBase";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import { ReactElement } from "react";
import { OutputPaneInfo } from "./abstractions/OutputPaneInfo";
import { Token } from "./services/command-parser";
import { IDocumentService } from "./services/DocumentService";

/**
 * This type stores information about a particular emulated machine
 */
export type MachineInfo = {
  /**
   * The ID of the machine
   */
  machineId: string;

  /**
   * The friendly name of the machine to display
   */
  displayName: string;

  /**
   * Creates the emulate machine instance
   * @returns The emulated machine instance
   */
  factory: () => IZ80Machine;
};

/**
 * This interface defines the functions managing the output panes within the IDE
 */
export interface IOutputPaneService {
  /**
   * Retrieve the registered output panes
   */
  getRegisteredOutputPanes(): OutputPaneInfo[];

  /**
   * Gets an output buffer for the specified pane
   * @param id ID of the output pane
   */
  getOutputPaneBuffer(id: string): IOutputBuffer;
}

/**
 * This class represents information about commands
 */
export type InteractiveCommandInfo = {
  /**
   * The unique identifier of the command
   */
  readonly id: string;

  /**
   * Concise explanation of the command
   */
  readonly description: string;

  /**
   * Command aliases;
   */
  readonly aliases?: string[];

  /**
   * Represents the usage of a command
   */
  readonly usage: string | string[];

  /**
   * Executes the command within the specified context
   */
  execute: (
    context: InteractiveCommandContext
  ) => Promise<InteractiveCommandResult>;

  /**
   * Retrieves the usage message
   * @returns
   */
  usageMessage: () => ValidationMessage[];
};

/**
 * Describes the execution context of a command
 */
export type InteractiveCommandContext = {
  /**
   * The text of the interactive command
   */
  commandtext: string;

  /**
   * The set of tokens used as command arguments
   */
  argTokens: Token[];

  /**
   * The buffer to send output messages
   */
  output: IOutputBuffer;

  /**
   * The store managing the state
   */
  store: Store<AppState>;

  /**
   * The command service instance
   */
  service: AppServices;

  /**
   * The messenger to access the main process
   */
  messenger: MessengerBase;
};

/**
 * Describes the result of a command
 */
export type InteractiveCommandResult = {
  /**
   * Indicates if the command execution was successful
   */
  success: boolean;

  /**
   * Final message of the command to display
   */
  finalMessage?: string;
};

/**
 * Available type of trace messages
 */
export enum ValidationMessageType {
  Info,
  Warning,
  Error
}

/**
 * Describes a trace message
 */
export type ValidationMessage = {
  type: ValidationMessageType;
  message: string;
};

/**
 * This interface defines the functions managing the interactive commands within the IDE
 */
export interface IInteractiveCommandService {
  /**
   * Gets the output buffer of the interactive commands
   */
  getBuffer(): IOutputBuffer;

  /**
   * Registers a command
   * @param command Command to register
   */
  registerCommand(command: InteractiveCommandInfo): void;

  /**
   * Retrieves all registered commands
   */
  getRegisteredCommands(): InteractiveCommandInfo[];

  /**
   * Gets the information about the command with the specified ID
   * @param id Command identifier
   * @returns Command information, if found; otherwise, undefined
   */
  getCommandInfo(id: string): InteractiveCommandInfo | undefined;

  /**
   * Gets the information about the command with the specified ID or alias
   * @param idOrAlias
   * @returns Command information, if found; otherwise, undefined
   */
  getCommandByIdOrAlias(idOrAlias: string): InteractiveCommandInfo | undefined;

  /**
   * Gets the command with the specified index from the command history
   * @param index Command index
   */
  getCommandFromHistory(index: number): string;

  /**
   * Gets the length of the command history
   */
  getCommandHistoryLength(): number;

  /**
   * Clears the command history
   */
  clearHistory(): void;

  /**
   * Executes the specified command line
   * @param command Command to execute
   */
  executeCommand(
    command: string,
    buffer: IOutputBuffer
  ): Promise<InteractiveCommandResult>;

  /**
   * Displays the specified trace messages
   * @param messages Trace messages to display
   * @param context Context to display the messages in
   */
  displayTraceMessages(
    messages: ValidationMessage[],
    context: InteractiveCommandContext
  ): void;
}

/**
 * Represents the information about a tool and its renderer
 */
export type DocumentRendererInfo = {
  /**
   * The ID of the document renderer
   */
  id: string;

  /**
   * Renderer function to display the tool
   */
  renderer: PanelRenderer;

  /**
   * The accompanying icon
   */
  icon?: string;

  /**
   * The icon's fill color
   */
  iconFill?: string;
};

export type IProjectService = {
  readonly projectOpened: ILiteEvent<void>;
  readonly projectClosed: ILiteEvent<void>;
}


/**
 * This type defines the services the IDE provides
 */
export type AppServices = {
  uiService: IUiService
  documentService: IDocumentService;
  machineService: IMachineService;
  outputPaneService: IOutputPaneService;
  interactiveCommandsService: IInteractiveCommandService;
  projectService: IProjectService;
};

/**
 * Represents the data passed to a command result documents
 */
export type CommandResultData = {
  title: string;
  lines: OutputContentLine[];
  bufferText: string;
}

/**
 * Represents a function that can render a particular panel
 */
export type PanelRenderer = (...props: any[]) => ReactElement
