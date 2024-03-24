import { mainStore } from "../../main/main-store";
import {
  CancellationToken,
  EvaluationContext,
  createEvalContext
} from "../../main/ksx/EvaluationContext";
import { setScriptsStatusAction } from "../../common/state/actions";
import { ScriptRunInfo } from "@abstractions/ScriptRunInfo";
import { isScriptCompleted } from "../../common/utils/script-utils";

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
  ) {
    if (!this.execScript) {
      this.execScript = this.doExecute;
    }
  }

  /**
   * Starts the execution of a script.
   * @param scriptFileName The name of the script file to run.
   * @returns The script ID if the script is started, or a negative number if the script is already running.
   */
  runScript (scriptFileName: string): number {
    // --- Check if the script is already running
    const script = this.scripts.find(
      s => s.scriptFileName === scriptFileName && !isScriptCompleted(s.status)
    );
    if (script) {
      // --- The script is already running, nothing to do
      return -script.id;
    }

    // --- Check the number of running scripts
    const runningScripts = this.scripts.filter(
      script => !isScriptCompleted(script.status)
    );
    if (runningScripts.length >= this.maxScriptHistory) {
      // --- Remove the oldest completed script
      const oldest = this.scripts.findIndex(script =>
        isScriptCompleted(script.status)
      );
      if (oldest >= 0) {
        this.scripts.splice(oldest, 1);
      }
    }

    // --- Now, start the script
    const cancellationToken = new CancellationToken();
    const evalContext = createEvalContext({ cancellationToken });

    // --- Start the script but do not await it
    const execTask = this.execScript(evalContext);
    const newScript: ScriptExecutionState = {
      id: this.id,
      scriptFileName,
      status: "pending",
      startTime: new Date(),
      evalContext,
      execTask
    };
    this.scripts.push(newScript);

    // --- Update the script status
    mainStore.dispatch(setScriptsStatusAction(this.getScriptsStatus()));

    // --- Await the script execution
    (async () => {
      try {
        await execTask;
        newScript.status = "completed";
        newScript.endTime = new Date();
      } catch (error) {
        newScript.status = "execError";
        newScript.error = error.message;
        newScript.endTime = new Date();
      } finally {
        delete newScript.execTask;

        // --- Update the script status
        mainStore.dispatch(setScriptsStatusAction(this.getScriptsStatus()));
      }
    })();
    return this.id++;
  }

  /**
   * Stops the execution of a running script.
   * @param scriptFileName The name of the script file to stop.
   */
  async stopScript (idOrFileName: number | string): Promise<boolean> {
    // --- Check if the script is already running
    let script: ScriptExecutionState;
    if (typeof idOrFileName === "number") {
      script = this.scripts.find(s => s.id === idOrFileName);
    } else {
      const reversed = this.scripts.slice().reverse();
      script = reversed.find(s => s.scriptFileName === idOrFileName);
    }
    if (!script) {
      // --- The script is not running, nothing to do
      return false;
    }

    if (script && isScriptCompleted(script.status)) {
      // --- The script has been completed, nothing to do
      return false;
    }

    if (!script.execTask) {
      // --- The script is not running, nothing to do
      return false;
    }

    // --- Stop the script
    script.evalContext?.cancellationToken?.cancel();
    try {
      await script.execTask;
      script.status = "stopped";
      script.stopTime = new Date();
      return true;
    } catch (error) {
      script.status = "execError";
      script.error = error.message;
      script.endTime = new Date();
      throw error;
    } finally {
      delete script.execTask;

      // --- Update the script status
      mainStore.dispatch(setScriptsStatusAction(this.getScriptsStatus()));
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
    if (script && isScriptCompleted(script.status)) {
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
    } finally {
      delete script.execTask;

      // --- Update the script status
      mainStore.dispatch(setScriptsStatusAction(this.getScriptsStatus()));
    }
  }

  /**
   * Returns the status of all scripts.
   */
  getScriptsStatus (): ScriptRunInfo[] {
    return this.scripts.slice(0).map(s => ({
      id: s.id,
      scriptFileName: s.scriptFileName,
      status: s.status,
      error: s.error,
      startTime: s.startTime,
      endTime: s.endTime,
      stopTime: s.stopTime
    }));
  }

  /**
   * Removes all completed scripts from the list.
   */
  removeCompletedScripts () {
    this.scripts = this.scripts.filter(s => !isScriptCompleted(s.status));
  }

  /**
   * Gets the status of a script file.
   * @param scriptFileName The name of the script file to check.
   * @returns The status of the script file, or undefined if the script is not found.
   */
  getScriptFileStatus (scriptFileName: string): ScriptRunInfo | undefined {
    const reversed = this.scripts.slice().reverse();
    return reversed.find(s => s.scriptFileName === scriptFileName);
  }

  private async doExecute (evalContext: EvaluationContext) {
    for (let i = 0; i < 50; i++) {
      if (evalContext?.cancellationToken?.cancelled) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

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
