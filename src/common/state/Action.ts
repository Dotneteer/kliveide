import { MachineControllerState } from "@abstractions/MachineControllerState";
import { ActionTypes } from "./ActionTypes";
import { SideBarPanelState } from "./AppState";
import { DocumentInfo } from "@abstractions/DocumentInfo";
import { ToolInfo } from "@renderer/abstractions/ToolInfo";
import { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import type { UnitTestEvent } from "@common/unit-tests/unitTestTypes";

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
  files: string[];
  text: string;
  compileResult: KliveCompilerOutput;
  failed: string;
  value: any;
  watch: any;
  watches: any[];
  symbol: string;
  /** When a build ended (`END_COMPILE`) */
  endedAt: number;
  /** Unit tests (`.plans/Z80_UNIT_TESTS_PLAN.md` §4.3) */
  ids: string[];
  startedAt: number;
  finishedAt: number;
  problem: string;
  event: UnitTestEvent;
};

/**
 * Use this function to create concrete actions
 */
export type ActionCreator = (...args: any) => Action;
