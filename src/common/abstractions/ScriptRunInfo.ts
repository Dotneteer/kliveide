import { EvaluationContext } from "../../main/ksx/EvaluationContext";
import { ScriptStartInfo } from "./IScriptManager";

export type ScriptStatus =
  | "pending"
  | "compiled"
  | "compileError"
  | "execError"
  | "running"
  | "stopped"
  | "completed";

export type ScriptRunInfo = {
  id: number;
  scriptFileName: string;
  status: ScriptStatus;
  runsInEmu: boolean;
  error?: string;
  startTime: Date;
  endTime?: Date;
  stopTime?: Date;
};

export type ScriptExecutionState = ScriptRunInfo & {
  evalContext?: EvaluationContext;
  execTask?: Promise<void>;
};
