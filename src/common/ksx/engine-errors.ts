import { EvaluationContext } from "./EvaluationContext";
import { setScriptsStatusAction } from "../state/actions";

/**
 * The abstract base class of all UI engine errors
 */
export abstract class EngineError extends Error {
  protected abstract readonly errorCategory: string;
  protected constructor (message: string) {
    super(message);
    Object.setPrototypeOf(this, EngineError.prototype);
  }
}

/**
 * Extracts information from the error object received from the backend
 */
export class GenericBackendError extends EngineError {
  readonly errorCategory = "GenericBackendError";
  errorDetails: any;
  constructor (public readonly info?: any) {
    // `The backend raised an error. (reasonCode: ${info.reasonCode}, isBusiness: ${info.isBusiness}, message: ${info.message})`
    let message = "";
    if (info?.code) {
      message += `[Error code: ${info.code}]\n`;
    }
    if (info?.details && typeof info.details === "string") {
      message += `${info.details}`;
    } else if (info?.message) {
      message += `${info.message}`;
    }
    super(message || info?.message || "Unknown error");

    this.errorDetails = info;
    // --- Set the prototype explicitly.
    Object.setPrototypeOf(this, GenericBackendError.prototype);
  }
}

/**
 * Custom exception indicating a parser error
 */
export class ScriptParseError extends EngineError {
  readonly errorCategory = "ScriptParserError";
  constructor (
    message: string,
    public readonly source: string,
    public readonly position: number
  ) {
    message = `Parser Error: ${message}`;
    super(message);
    Object.setPrototypeOf(this, ScriptParseError.prototype);
  }
}

/**
 * Custom exception signing parsing error
 */
export class StatementExecutionError extends EngineError {
  readonly errorCategory = "StatementExecutionError";
  constructor (message: string, public readonly source: string) {
    super(message);
    Object.setPrototypeOf(this, StatementExecutionError.prototype);
  }
}

/**
 * Signs that we get an unexpected type instead of a component definition
 */
export class NotAComponentDefError extends EngineError {
  readonly errorCategory = "NotAComponentError";
  constructor () {
    super(
      "Must be a component definition, cannot use dynamic children here..."
    );
    Object.setPrototypeOf(this, NotAComponentDefError.prototype);
  }
}

/**
 * We throw this error when a throw statement is executed
 */
export class ThrowStatementError extends EngineError {
  readonly errorCategory = "ThrowStatementError";
  readonly message: string;
  constructor (public readonly errorObject: any) {
    const message =
      typeof errorObject === "string"
        ? errorObject
        : errorObject?.message || "Error without message";
    super(message);
    this.message = message;
    Object.setPrototypeOf(this, ThrowStatementError.prototype);
  }
}

type ErrorInfo = {
  error: Error;
  helperMessage?: string;
  colors?: string[];
};

const appErrors: ErrorInfo[] = [];

/**
 * Get all errors collected during the last run
 */
export function getAppErrors (): ErrorInfo[] {
  return appErrors;
}

/**
 * Use this function to reset the errors raised by the execution engine
 */
export function resetErrors (): void {
  appErrors.length = 0;
}

/**
 * Use this function to report an error
 * @param error Error or string describing the error to report
 * @param errorToThrow The error to throw
 */
export function reportEngineError (
  error: Error | string,
  evalContext: EvaluationContext,
  errorToThrow?: any
): void {
  // --- Wrap a string into an error
  if (typeof error === "string") {
    error = new Error(error);
  }

  let helperMessage = "";
  let colors: string[] = [];

  // --- Error-specific helper messages
  if (error instanceof ScriptParseError) {
    let pos = error.position - 1;
    while (pos < error.source.length - 1 && error.source[pos] === " ") {
      pos++;
    }
    helperMessage += `%c${error.message}%c\n\n`;
    helperMessage += `${error.source.substring(0, pos)}%c${
      error.source[pos]
    }%c${error.source.substring(pos + 1) ?? ""}\n\n`;
    helperMessage += `%cThe error handler associated with the parsed code did not run.%c`;
    colors = [
      "color: red",
      "color: inherited",
      "color: red",
      "color: inherited",
      "color: orange",
      "color: inherited"
    ];
  } else if (error instanceof StatementExecutionError) {
    helperMessage += `%cError while executing code: ${error.message}%c\n\n${error.source}`;
    colors = ["color: red", "color: inherited"];
  } else if (error instanceof ThrowStatementError) {
    helperMessage += `A 'throw' statement executed:\n\n%c${error.message}%c\n\n${error.errorObject}`;
    colors = ["color: red", "color: inherited"];
  }

  if (helperMessage) {
    console.log(helperMessage, ...colors);
  }
  appErrors.push({ error, helperMessage, colors });

  // --- Sign the error
  if (evalContext.store && evalContext.scriptId) {
    const scripts = evalContext.store.getState()?.scripts?.slice(0);
    if (scripts) {
      const script = scripts.find(s => s.id === evalContext.scriptId);
      if (script) {
        script.error = error?.toString() ?? "Unknown error";
      }
      evalContext.store.dispatch(setScriptsStatusAction(scripts));
    }
  }

  throw errorToThrow ?? error;
}
