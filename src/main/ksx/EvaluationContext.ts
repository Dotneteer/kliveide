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

  // --- The cancellation token to signal the cancellation of an operation
  cancellationToken?: CancellationToken;

  // --- The module resolver to use when resolving module names
  moduleResolver?: ModuleResolver;

  // --- Function to call on updating a localContext property (directly or indirectly)
  onUpdateHook?: (updateFn: () => any) => Promise<any>;
};

// Evaluation options to use with binding tree evaluation
export type EvalTreeOptions = {
  defaultToOptionalMemberAccess?: boolean;
};

/**
 * A token that signals the cancellation of an operation
 */
export class CancellationToken {
  private _cancelled = false;

  public get cancelled (): boolean {
    return this._cancelled;
  }

  public cancel (): void {
    this._cancelled = true;
  }
}

/**
 * A function that resolves a module name to the text of the module
 */
export type ModuleResolver = (moduleName: string) => Promise<string | null>;

/**
 * Creates an evaluation context with the given parts
 * @param parts Parts of the evaluation context
 * @returns New evaluation context
 */
export function createEvalContext (
  parts: Partial<EvaluationContext>
): EvaluationContext {
  return {
    ...{
      mainThread: {
        childThreads: [],
        blocks: [{ vars: {} }],
        loops: [],
        breakLabelValue: -1
      }
    },
    ...parts
  };
}
