import {
  CancellationToken,
  EvaluationContext,
  createEvalContext
} from "@main/ksx/EvaluationContext";

const MAX_SCRIPT_HISTORY = 128;

/**
 * This class is responsible for managing the execution of scripts.
 */
class ScriptManager {
  private scripts: ScriptExecutionState[] = [];
  private id = 1;

  constructor (
    private execScript?: (evalContext: EvaluationContext) => Promise<void>,
    private maxScriptHistory = MAX_SCRIPT_HISTORY
  ) {}

  /**
   * Starts the execution of a script.
   * @param scriptFileName The name of the script file to run.
   * @returns The script ID if the script is started, or a negative number if the script is already running.
   */
  runScript (scriptFileName: string): number {
    // --- Check if the script is already running
    const script = this.scripts.find(
      s => s.scriptFileName === scriptFileName && !isCompleted(s.status)
    );
    if (script) {
      // --- The script is already running, nothing to do
      return -script.id;
    }

    // --- Check the number of running scripts
    const runningScripts = this.scripts.filter(
      script => !isCompleted(script.status)
    );
    if (runningScripts.length >= this.maxScriptHistory) {
      // --- Remove the oldest completed script
      const oldest = this.scripts.findIndex(script => isCompleted(script.status));
      if (oldest >= 0) {
        this.scripts.splice(oldest, 1);
      }
    }

    // --- Now, start the script
    const cancellationToken = new CancellationToken();
    const evalContext = createEvalContext({ cancellationToken });

    // --- Start the script but do not await it
    const execTask = this.execScript(evalContext);
    this.scripts.push({
      id: this.id,
      scriptFileName,
      status: "pending",
      startTime: new Date(),
      evalContext,
      execTask
    });
    return this.id++;
  }

  /**
   * Stops the execution of a running script.
   * @param scriptFileName The name of the script file to stop.
   */
  async stopScript (id: number): Promise<void> {
    // --- Check if the script is already running
    const script = this.scripts.find(s => s.id === id);
    if (script && isCompleted(script.status)) {
      // --- The script has been completed, nothing to do
      return;
    }

    // --- Stop the script
    script.evalContext?.cancellationToken?.cancel();
    try {
      await script.execTask;
      script.status = "stopped";
      script.stopTime = new Date();
    } catch (error) {
      script.status = "execError";
      script.error = error.message;
      script.endTime = new Date();
      throw error;
    }
  }

  /**
   * Awaits for the completion of a script.
   * @param scriptFileName The name of the script file to wait for.
   * @returns
   */
  async completeScript (id: number): Promise<void> {
    // --- Check if the script is already running
    const script = this.scripts.find(s => s.id === id);
    if (script && isCompleted(script.status)) {
      // --- The script has been completed, nothing to do
      return;
    }

    // --- Stop the script
    try {
      await script.execTask;
      script.status = "completed";
      script.endTime = new Date();
    } catch (error) {
      script.status = "execError";
      script.error = error.message;
      script.endTime = new Date();
      throw error;
    }
  }

  /**
   * Returns the status of all scripts.
   */
  getScriptsStatus (): ScriptRunInfo[] {
    return this.scripts.slice(0);
  }

  /**
   * Removes all completed scripts from the list.
   */
  removeCompletedScripts () {
    this.scripts = this.scripts.filter(s => !isCompleted(s.status));
  }

  /**
   * Gets the status of a script file.
   * @param scriptFileName The name of the script file to check.
   * @returns The status of the script file, or undefined if the script is not found.
   */
  getScriptFileStatus(scriptFileName: string): ScriptRunInfo | undefined {
    const reversed = this.scripts.slice().reverse();
    return reversed.find(s => s.scriptFileName === scriptFileName);
  }
}

function isCompleted (status: ScriptStatus): boolean {
  return (
    status === "stopped" ||
    status === "completed" ||
    status === "compileError" ||
    status === "execError"
  );
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
  id: number;
  scriptFileName: string;
  status: ScriptStatus;
  error?: string;
  startTime: Date;
  endTime?: Date;
  stopTime?: Date;
};

type ScriptExecutionState = ScriptRunInfo & {
  evalContext?: EvaluationContext;
  execTask?: Promise<void>;
};

export function createScriptManager (
  execScript: (evalContext: EvaluationContext) => Promise<void>
): ScriptManager {
  return new ScriptManager(execScript);
}

export const scriptManager = new ScriptManager();
