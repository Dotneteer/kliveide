import { LogicalThread } from "./LogicalThread";

// This type represents the context in which binding expressions and statements should be evaluated
export type EvaluationContext = {
  // --- Container scope
  localContext?: any;

  // --- Application context scope
  appContext?: any;

  // --- The main execution thread;
  mainThread?: LogicalThread;

  // --- Evaluation options
  options?: EvalTreeOptions;

  // --- Start time of the synchronous statement processing
  startTick?: number;

  // --- The values of event arguments to process in an ArrowExpressionStatement
  eventArgs?: any[];

  // --- Function to call on updating a localContext property (directly or indirectly)
  onUpdateHook?: (updateFn: () => any) => Promise<any>;
};

// Evaluation options to use with binding tree evaluation
export type EvalTreeOptions = {
  defaultToOptionalMemberAccess?: boolean;
};
