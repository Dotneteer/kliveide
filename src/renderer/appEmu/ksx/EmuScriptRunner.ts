import { MessengerBase } from "@common/messaging/MessengerBase";
import { AppState } from "@common/state/AppState";
import { setScriptsStatusAction } from "@common/state/actions";
import { Store } from "@common/state/redux-light";
import { createScriptConsole } from "@main/ksx-runner/ScriptConsole";
import {
  CancellationToken,
  EvaluationContext,
  createEvalContext
} from "@common/ksx/EvaluationContext";
import {
  executeModule,
  isModuleErrors,
  parseKsxModule
} from "@common/ksx/ksx-module";
import { sendScriptOutput } from "@common/ksx/script-runner";

type ScriptExecInfo = {
  evalContext: EvaluationContext;
  execTask: Promise<void>;
};

/**
 * This class is responsible for managing the execution of scripts.
 */
export class EmuScriptRunner {
  private runningScripts = new Map<number, ScriptExecInfo>();
  private packages: Record<string, any> = {};

  constructor (
    private readonly store: Store<AppState>,
    private readonly messenger: MessengerBase,
    private readonly outputFn: (
      text: string,
      options?: Record<string, any>
    ) => Promise<void> = (text, options) =>
      sendScriptOutput(this.messenger, text, options)
  ) {}

  /**
   * Starts the execution of a script.
   * @param scriptFileName The name of the script file to run.
   * @returns The script ID if the script is started, or a negative number if the script is already running.
   */
  async runScript (
    scriptId: number,
    scriptFile: string,
    scriptContents: string
  ): Promise<boolean> {
    // --- Check if the script is already running
    const scripts = this.store.getState().scripts;
    let script = scripts.find(s => s.id === scriptId);
    if (!script) {
      // --- The script is already running, nothing to do
      this.outputFn?.(`Script ${scriptFile} process has not been created.`, {
        color: "yellow"
      });
      return false;
    }

    // --- Now, start the script
    script = { ...script };
    const cancellationToken = new CancellationToken();
    const evalContext = createEvalContext({
      scriptId: scriptId,
      store: this.store,
      cancellationToken,
      appContext: {
        Output: createScriptConsole(this.store, this.messenger, scriptId)
      }
    });

    // --- Prepare the script for execution
    // --- Parse the script
    const module = await parseKsxModule(
      scriptFile,
      scriptContents,
      moduleName => this.resolveModule(scriptFile, moduleName),
      packageName => this.packages[packageName]
    );
    if (isModuleErrors(module)) {
      // --- The script has errors, display them
      Object.keys(module).forEach(moduleName => {
        const errors = module[moduleName];
        errors.forEach(error => {
          this.outputFn?.(
            `${error.code}: ${error.text} (${moduleName}:${error.line}:${error.column})`,
            {
              color: "bright-red"
            }
          );
        });
      });
      throw new Error("Running script failed");
    }

    // --- Execute the script
    const execTask = executeModule(module, evalContext);
    this.runningScripts.set(scriptId, {
      evalContext,
      execTask
    });

    this.outputFn?.(`Script started`, {
      color: "green"
    });

    // --- Await the script execution
    (async () => {
      try {
        await execTask;
        const cancelled = evalContext.cancellationToken.cancelled;
        script.status = cancelled ? "stopped" : "completed";
        let time = 0;
        if (cancelled) {
          script.stopTime = new Date();
          time = script.stopTime.getTime() - script.startTime.getTime();
        } else {
          script.endTime = new Date();
          time = script.endTime.getTime() - script.startTime.getTime();
        }
        this.outputFn?.(
          `Script ${script.scriptFileName} with ID ${script.id} ${script.status} in ${time}ms.`,
          {
            color: cancelled ? "yellow" : "green"
          }
        );
      } catch (error) {
        script.status = "execError";
        script.error = error.message;
        script.endTime = new Date();
        const time = script.endTime.getTime() - script.startTime.getTime();
        this.outputFn?.(
          `Script ${script.scriptFileName} with ID ${script.id} failed in ${time}ms.`,
          {
            color: "red"
          }
        );
        this.outputFn?.(error.toString?.() ?? "Unknown error", {
          color: "bright-red"
        });
      } finally {
        const scripts = this.store.getState().scripts.slice();
        let scriptIdx = scripts.findIndex(s => s.id === script.id);
        if (scriptIdx >= 0) {
          scripts[scriptIdx] = script;
        }
        this.store.dispatch(setScriptsStatusAction(scripts), "emu");

        // --- Notify the main script manager
        const response = await this.messenger.sendMessage({
          type: "MainCloseScript",
          script
        });
        if (response.type === "ErrorResponse") {
          throw new Error(response.message);
        }
      }
    })();
    return true;
  }

  /**
   * Stops the execution of a running script.
   * @param scriptFileName The name of the script file to stop.
   */
  async stopScript (scriptId: number): Promise<boolean> {
    // --- Check if the script is already running
    const scripts = this.store.getState().scripts;
    const script = scripts.find(s => s.id === scriptId);
    if (!script) {
      // --- The script is not running or has been completed, nothing to do
      this.outputFn?.(`Script ${script.scriptFileName} is not running.`, {
        color: "yellow"
      });
      return false;
    }

    // --- Stop the script
    const scriptInfo = this.runningScripts.get(scriptId);
    this.outputFn?.(`Stopping script ${script.scriptFileName}...`);
    scriptInfo?.evalContext?.cancellationToken?.cancel();
    await scriptInfo?.execTask;
  }

  // --- Resolves the script contents from the module's name
  private async resolveModule (
    scriptFile: string,
    moduleName: string
  ): Promise<string | null> {
    const response = await this.messenger.sendMessage({
      type: "MainResolveModule",
      mainFile: scriptFile,
      moduleName: moduleName
    });
    if (response.type === "MainResolveModuleResponse") {
      return response.contents;
    }
    return null;
  }
}

