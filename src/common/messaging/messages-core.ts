// ====================================================================================================================
// This file contains the abstractions the app uses with messaging.
//
// |------------------------|   |------------------------|
// |       EMU process      |   |       IDE process      |
// | |--------------------| |   | |--------------------| |
// | | EmuToMainMessenger | |   | | IdeToMainMessenger | |
// |-|--------------------|-|   |-|--------------------|-|
//       ^            ^               ^            ^
//       |            |               |            |
//       v            v               v            v
// | |--------------------|-------|--------------------| |
// | | MainToEmuMessenger |       | MainToIdeMessenger | |
// | |--------------------|       |--------------------| |
// |                     MAIN process                    |
// |-----------------------------------------------------|
// ====================================================================================================================

import {
  MainReadTextFileRequest,
  MainReadBinaryFileRequest,
  MainDisplayMessageBoxRequest,
  BinaryContentsResponse,
  TextContentsResponse,
  MainGetDirectoryContentRequest,
  MainGetDirectoryContentResponse,
  MainCreateKliveProjectRequest,
  MainCreateKliveProjectResponse,
  MainOpenFolderRequest,
  MainAddNewFileEntryRequest,
  MainGloballyExcludedProjectItemsRequest,
  MainAddGloballyExcludedProjectItemsRequest,
  MainSetGloballyExcludedProjectItemsRequest,
  MainDeleteFileEntryRequest,
  MainRenameFileEntryRequest,
  MainShowOpenFolderDialogRequest,
  MainShowOpenFolderDialogResponse,
  MainSaveTextFileRequest,
  MainSaveProjectRequest,
  MainSaveSettingsRequest,
  MainCompileFileRequest,
  MainExitAppRequest,
  MainCompileResponse,
  MainSaveBinaryFileRequest,
  MainShowOpenFileDialogResponse,
  MainShowOpenFileDialogRequest,
  MainSaveFileResponse,
  MainShowItemInFolderRequest,
  MainApplyUserSettingsRequest,
  MainApplyProjectSettingsRequest
} from "./any-to-main";
import { ForwardActionRequest } from "./forwarding";
import {
  EmuSetMachineTypeRequest,
  EmuMachineCommandRequest,
  EmuSetTapeFileRequest,
  EmuGetCpuStateRequest,
  EmuGetCpuStateResponse,
  EmuGetUlaStateRequest,
  EmuGetUlaStateResponse,
  EmuEraseAllBreakpointsRequest,
  EmuSetBreakpointRequest,
  EmuRemoveBreakpointRequest,
  EmuListBreakpointsRequest,
  EmuListBreakpointsResponse,
  EmuEnableBreakpointRequest,
  EmuGetMemoryRequest,
  EmuGetMemoryResponse,
  EmuGetSysVarsRequest,
  EmuGetSysVarsResponse,
  EmuInjectCodeRequest,
  EmuRunCodeRequest,
  EmuResolveBreakpointsRequest,
  EmuNormalizeBreakpointsRequest,
  EmuScrollBreakpointsRequest,
  EmuGetPsgStateRequest,
  EmuGetPsgStateResponse,
  EmuGetNecUpd765Request,
  EmuGetNecUpd765Response,
  EmuSetDiskFileRequest
} from "./main-to-emu";
import {
  IdeDisplayOutputRequest,
  IdeShowBasicRequest,
  IdeShowDialogRequest,
  IdeShowDisassemblyRequest,
  IdeShowMemoryRequest,
  IdeExecuteCommandRequest,
  IdeExecuteCommandResponse,
  IdeSaveAllBeforeQuitRequest
} from "./any-to-ide";

/**
 * Potential message sources
 */
export type MessageSource = "emu" | "ide" | "main";

/**
 * Available message channels
 */
export type Channel =
  | "MainToEmu"
  | "MainToEmuResponse"
  | "EmuToMain"
  | "EmuToMainResponse"
  | "MainToIde"
  | "MainToIdeResponse"
  | "IdeToMain"
  | "IdeToMainResponse";

/**
 * The common base for all message types
 */
export interface MessageBase {
  type: AnyMessage["type"];
  correlationId?: number;
  sourceId?: MessageSource;
}

/**
 * Default response for actions
 */
export interface NotReadyResponse extends MessageBase {
  type: "NotReady";
}

/**
 * Default response for actions
 */
export interface DefaultResponse extends MessageBase {
  type: "Ack";
}

/**
 * Send back error messages
 */
export interface ErrorResponse extends MessageBase {
  type: "ErrorResponse";
  message: string;
}

/**
 * Send back flagged messages
 */
export interface FlagResponse extends MessageBase {
  type: "FlagResponse";
  flag: boolean;
}

/**
 * All request messages
 */
export type RequestMessage =
  | ForwardActionRequest
  | EmuSetMachineTypeRequest
  | EmuMachineCommandRequest
  | EmuSetTapeFileRequest
  | EmuSetDiskFileRequest
  | EmuGetCpuStateRequest
  | EmuGetUlaStateRequest
  | EmuGetPsgStateRequest
  | EmuEraseAllBreakpointsRequest
  | EmuSetBreakpointRequest
  | EmuRemoveBreakpointRequest
  | EmuListBreakpointsRequest
  | EmuEnableBreakpointRequest
  | EmuGetMemoryRequest
  | EmuGetSysVarsRequest
  | EmuInjectCodeRequest
  | EmuRunCodeRequest
  | EmuResolveBreakpointsRequest
  | EmuNormalizeBreakpointsRequest
  | EmuScrollBreakpointsRequest
  | EmuGetNecUpd765Request
  | MainReadTextFileRequest
  | MainReadBinaryFileRequest
  | MainDisplayMessageBoxRequest
  | MainGetDirectoryContentRequest
  | MainOpenFolderRequest
  | MainCreateKliveProjectRequest
  | MainAddNewFileEntryRequest
  | MainGloballyExcludedProjectItemsRequest
  | MainAddGloballyExcludedProjectItemsRequest
  | MainSetGloballyExcludedProjectItemsRequest
  | MainDeleteFileEntryRequest
  | MainRenameFileEntryRequest
  | MainShowOpenFolderDialogRequest
  | MainShowOpenFileDialogRequest
  | MainSaveTextFileRequest
  | MainSaveBinaryFileRequest
  | MainSaveProjectRequest
  | MainSaveSettingsRequest
  | MainApplyUserSettingsRequest
  | MainApplyProjectSettingsRequest
  | MainCompileFileRequest
  | MainExitAppRequest
  | MainShowItemInFolderRequest
  | IdeDisplayOutputRequest
  | IdeShowMemoryRequest
  | IdeShowDisassemblyRequest
  | IdeShowBasicRequest
  | IdeShowDialogRequest
  | IdeExecuteCommandRequest
  | IdeSaveAllBeforeQuitRequest;

/**
 * All Response messages
 */
export type ResponseMessage =
  | NotReadyResponse
  | DefaultResponse
  | ErrorResponse
  | FlagResponse
  | TextContentsResponse
  | BinaryContentsResponse
  | MainGetDirectoryContentResponse
  | MainCreateKliveProjectResponse
  | MainShowOpenFolderDialogResponse
  | MainShowOpenFileDialogResponse
  | MainSaveFileResponse
  | MainCompileResponse
  | EmuGetCpuStateResponse
  | EmuGetUlaStateResponse
  | EmuGetPsgStateResponse
  | EmuListBreakpointsResponse
  | EmuGetMemoryResponse
  | EmuGetSysVarsResponse
  | EmuGetNecUpd765Response
  | IdeExecuteCommandResponse;

/**
 * All messages
 */
export type AnyMessage = RequestMessage | ResponseMessage;

/**
 * Creates the default response message (no result)
 */
export function defaultResponse (): DefaultResponse {
  return { type: "Ack" };
}

/**
 * Creates an error response
 * @param message Error message
 */
export function errorResponse (message: string): ErrorResponse {
  return {
    type: "ErrorResponse",
    message
  };
}

/**
 * Creates an error response
 * @param message Error message
 */
export function flagResponse (flag: boolean): FlagResponse {
  return {
    type: "FlagResponse",
    flag
  };
}
