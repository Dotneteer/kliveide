import { MachineControllerState } from "@abstractions/MachineControllerState";
import { ActionTypes } from "./ActionTypes";
import { SideBarPanelState } from "./AppState";
import { DocumentState } from "@abstractions/DocumentState";
import { ToolState } from "@/renderer/abstractions/ToolState";
import { KliveCompilerOutput } from "../../electron/compiler-integration/compiler-registry";

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
  document: DocumentState;
  index: number;
  tool: ToolState;
  tools: ToolState[];
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
