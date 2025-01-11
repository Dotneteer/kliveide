import type { AppServices } from "@renderer/abstractions/AppServices";
import type { MessengerBase } from "@messaging/MessengerBase";
import type { AppState } from "@state/AppState";
import type { Store } from "@state/redux-light";
import type { Token } from "@appIde/services/command-parser";
import type { IOutputBuffer } from "@appIde/ToolArea/abstractions";
import type { MessageSource } from "@messaging/messages-core";
import type { MachineInfo } from "@common/machines/info-types";
import { EmuApi } from "@common/messaging/EmuApi";
import { MainApi } from "@common/messaging/MainApi";

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
   * Information about the current machine
   */
  machineInfo: MachineInfo;

  /**
   * The command service instance
   */
  service: AppServices;

  /**
   * The messenger to access the main process
   */
  messenger: MessengerBase;

  /**
   * Redux message source Id
   */
  messageSource: MessageSource;

  /**
   * Emulator API
   */
  emuApi: EmuApi;

  /**
   * Alternative main API
   */
  mainApi: MainApi;
};
