import { EvaluationContext } from "@main/ksx/EvaluationContext";

const MAX_RUNNING_SCRIPTS = 5;

/**
 * This class is responsible for managing the execution of scripts.
 */
class ScriptManager {
  private scripts = new Map<string, ScriptExecutionState>();

  /**
   * Starts the execution of a script.
   * @param scriptFileName The name of the script file to run.
   */
  runScript (scriptFileName: string): string | undefined {
    // ...
    return undefined;
  }

  /**
   * Stops the execution of a running script.
   * @param scriptFileName The name of the script file to stop.
   */
  stopScript (scriptFileName: string) {
    // ...
  }

  /**
   * Returns the status of all scripts.
   */
  getScriptsStatus (): ScriptRunInfo[] {
    return Array.from(this.scripts.entries()).map(
      ([scriptFileName, script]) => ({
        scriptFileName,
        status: script.status,
        error: script.error,
        startTime: script.startTime,
        endTime: script.endTime,
        stopTime: script.stopTime
      })
    );
  }

  /**
   * Removes all completed scripts from the list.
   */
  removeCompletedScripts () {
    const completed = Array.from(this.scripts.values()).filter(
      script =>
        script.status !== "completed" &&
        script.status !== "compileError" &&
        script.status !== "execError"
    );
    this.scripts = new Map(
      completed.map(script => [script.scriptFileName, script])
    );
  }
}

export type ScriptStatus =
  | "pending"
  | "compiled"
  | "compileError"
  | "execError"
  | "running"
  | "stopped"
  | "completed";

export type ScriptRunInfo = {
  scriptFileName: string;
  status: ScriptStatus;
  error?: string;
  startTime: Date;
  endTime: Date;
  stopTime: Date;
};

type ScriptExecutionState = ScriptRunInfo & {
  evalContext?: EvaluationContext;
  execTask?: Promise<void>;
};

export const scriptManager = new ScriptManager();
