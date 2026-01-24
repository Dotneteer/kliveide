export type CodeInjectionFlow = CodeInjectionStep[];

type CodeInjectionStep =
  | ReachExecPointStep
  | InjectStep
  | SetReturnStep
  | QueueKeyStep
  | StartStep
  | KeepPcStep
  | WaitStep;

interface CodeInjectionStepBase {
  type: CodeInjectionStep["type"];
  message?: string;
}

interface ReachExecPointStep extends CodeInjectionStepBase {
  type: "ReachExecPoint";
  rom: number;
  execPoint: number;
}

interface InjectStep extends CodeInjectionStepBase {
  type: "Inject";
}

interface SetReturnStep extends CodeInjectionStepBase {
  type: "SetReturn";
  returnPoint: number;
}

interface QueueKeyStep extends CodeInjectionStepBase {
  type: "QueueKey";
  primary: number;
  secondary?: number;
  ternary?: number;
  wait?: number;
}

interface StartStep extends CodeInjectionStepBase {
  type: "Start";
}

interface KeepPcStep extends CodeInjectionStepBase {
  type: "KeepPc";
}

interface WaitStep extends CodeInjectionStepBase {
  type: "Wait";
  duration: number;
}
