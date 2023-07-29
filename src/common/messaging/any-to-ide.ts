import { OutputColor } from "@appIde/ToolArea/abstractions";
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

export interface IdeShowMemoryRequest extends MessageBase {
  type: "IdeShowMemory";
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
