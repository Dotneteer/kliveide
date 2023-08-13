import { MachineControllerState } from "@abstractions/MachineControllerState";
import { ActionTypes } from "./ActionTypes";
import { SideBarPanelState } from "./AppState";
import { KliveCompilerOutput } from "../../main/compiler-integration/compiler-registry";
import { DocumentInfo } from "@abstractions/DocumentInfo";
import { ToolInfo } from "@renderer/abstractions/ToolInfo";
import { DebuggableOutput } from "@abstractions/IZ80CompilerService";

/**
 * Available action types you can use with state manangement
 */
export type Action = {
  /**
   * Action type
   */
  type: keyof ActionTypes;

  /**
   * Optional payload
   */
  payload?: Partial<Payload>;
};

/**
 * Payload properties
 */
export type Payload = {
  flag: boolean;
  id: string;
  size: number;
  nextId: string;
  nextSize: number;
  panelsState: Record<string, SideBarPanelState>;
  document: DocumentInfo;
  index: number;
  tool: ToolInfo;
  tools: ToolInfo[];
  state: MachineControllerState;
  numValue: number;
  file: string;
  text: string;
  compileResult: KliveCompilerOutput;
  failed: string
};

/**
 * Use this function to create concrete actions
 */
export type ActionCreator = (...args: any) => Action;
