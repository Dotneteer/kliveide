export type CodeInjectionFlow = CodeInjectionStep[];

export type CodeInjectionStep =
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

  /**
   * Opts this step into checkpointing under the given key.
   *
   * Reaching an execution point means single-stepping the machine there, which for a cold boot is by
   * far the most expensive thing an injection flow does. When this is set and the machine supports
   * checkpoints, the first run captures the state it arrives at, and later runs restore it instead of
   * repeating the journey. A machine without checkpoint support just runs the step normally.
   */
  checkpoint?: string;
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
