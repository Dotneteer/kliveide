import { SpectrumKeyCode } from "@renderer/abstractions/SpectrumKeyCode";

export type CodeInjectionFlow = CodeInjectionStep[];

export type CodeInjectionStep =
  | ReachExecPointStep
  | InjectStep
  | SetReturnStep
  | QueueKeyStep
  | StartStep;

export interface CodeInjectionStepBase {
  type: CodeInjectionStep["type"];
  message?: string;
}

export interface ReachExecPointStep extends CodeInjectionStepBase {
  type: "ReachExecPoint";
  rom: number;
  execPoint: number;
}

export interface InjectStep extends CodeInjectionStepBase {
  type: "Inject";
}

export interface SetReturnStep extends CodeInjectionStepBase {
  type: "SetReturn";
  returnPoint: number;
}

export interface QueueKeyStep extends CodeInjectionStepBase {
  type: "QueueKey";
  primary: SpectrumKeyCode;
  secondary?: SpectrumKeyCode;
  wait?: number;
}

export interface StartStep extends CodeInjectionStepBase {
  type: "Start";
}
