import { BufferOperation, OutputColor } from "@appIde/ToolArea/abstractions";
import { MessageBase } from "./messages-core";

/**
 * You can sens an output pane message with these request to the IDE
 */
export interface IdeDisplayOutputRequest extends MessageBase {
  type: "IdeDisplayOutput";
  pane: string;
  text: string;
  color?: OutputColor;
  backgroundColor?: OutputColor;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikeThru?: boolean;
  data?: unknown;
  actionable?: boolean;
  writeLine?: boolean;
}

export interface IdeScriptOutputRequest extends MessageBase {
  type: "IdeScriptOutput";
  id: number;
  operation: BufferOperation;
  args?: any[];
}


export interface IdeShowMemoryRequest extends MessageBase {
  type: "IdeShowMemory";
  show: boolean;
}

export interface IdeShowBankedMemoryRequest extends MessageBase {
  type: "IdeShowBankedMemory";
  show: boolean;
}

export interface IdeShowDisassemblyRequest extends MessageBase {
  type: "IdeShowDisassembly";
  show: boolean;
}

export interface IdeShowBasicRequest extends MessageBase {
  type: "IdeShowBasic";
  show: boolean;
}

export interface IdeShowDialogRequest extends MessageBase {
  type: "IdeShowDialog";
  dialogId?: number;
}

export interface IdeExecuteCommandRequest extends MessageBase {
  type: "IdeExecuteCommand";
  commandText: string;
}

export interface IdeExecuteCommandResponse extends MessageBase {
  type: "IdeExecuteCommandResponse";
  success: boolean;
  finalMessage?: string;
}

export interface IdeSaveAllBeforeQuitRequest extends MessageBase {
  type: "IdeSaveAllBeforeQuit";
}
