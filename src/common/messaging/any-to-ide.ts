import { BufferOperation, OutputColor } from "@appIde/ToolArea/abstractions";
import { MessageBase } from "./messages-core";
import { ProjectStructure } from "@main/ksx-runner/ProjectStructure";

// --- Ask the IDE to display an output in the specified pane
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

// --- Ask the IDE to display a message in the scripts output
export interface IdeScriptOutputRequest extends MessageBase {
  type: "IdeScriptOutput";
  id: number;
  operation: BufferOperation;
  args?: any[];
}

// --- Ask the IDE to open the Machine Memory display
export interface IdeShowMemoryRequest extends MessageBase {
  type: "IdeShowMemory";
  show: boolean;
}

// --- Ask the IDE to open the Disassembly display
export interface IdeShowDisassemblyRequest extends MessageBase {
  type: "IdeShowDisassembly";
  show: boolean;
}

// --- Ask the IDE to open the BASIC listing display
export interface IdeShowBasicRequest extends MessageBase {
  type: "IdeShowBasic";
  show: boolean;
}

// --- Ask the IDE to show a particular dialog
export interface IdeShowDialogRequest extends MessageBase {
  type: "IdeShowDialog";
  dialogId?: number;
}

// --- Ask the IDE to execute a command
export interface IdeExecuteCommandRequest extends MessageBase {
  type: "IdeExecuteCommand";
  commandText: string;
}

// --- Ask the IDE to save all files before quitting
export interface IdeSaveAllBeforeQuitRequest extends MessageBase {
  type: "IdeSaveAllBeforeQuit";
}

// --- Ask the IDE to get the current project structure
export interface IdeGetProjectStructureRequest extends MessageBase {
  type: "IdeGetProjectStructure";
}

// --- Reteurns the result of the command execution
export interface IdeExecuteCommandResponse extends MessageBase {
  type: "IdeExecuteCommandResponse";
  success: boolean;
  finalMessage?: string;
  value?: any;
}

// --- The response with the current project structure
export interface IdeGetProjectStructureResponse extends MessageBase {
  type: "IdeGetProjectStructureResponse";
  projectStructure: ProjectStructure;
}

