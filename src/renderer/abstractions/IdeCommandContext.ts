import { AppServices } from "@renderer/abstractions/AppServices";
import { MessengerBase } from "@messaging/MessengerBase";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import { Token } from "@appIde/services/command-parser";
import { IOutputBuffer } from "@appIde/ToolArea/abstractions";

/**
 * Describes the execution context of a command
 */
export type IdeCommandContext = {
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
