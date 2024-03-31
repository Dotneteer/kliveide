import { IdeDisplayOutputRequest } from "@common/messaging/any-to-ide";
import { PANE_ID_SCRIPTIMG } from "@common/integration/constants";
import { MessengerBase } from "@common/messaging/MessengerBase";
import { sendFromMainToIde } from "@common/messaging/MainToIdeMessenger";
import { AppState } from "@common/state/AppState";
import { setScriptsStatusAction } from "@common/state/actions";
import { Store } from "@common/state/redux-light";
import { isScriptCompleted } from "@common/utils/script-utils";
import { createScriptConsole } from "@main/ksx-runner/ScriptConsole";
import {
  CancellationToken,
  EvaluationContext,
  createEvalContext
} from "@main/ksx/EvaluationContext";
import {
  executeModule,
  isModuleErrors,
  parseKsxModule
} from "@main/ksx/ksx-module";
import { ScriptRunInfo } from "@abstractions/ScriptRunInfo";

type ScriptExecInfo = {
  evalContext: EvaluationContext;
  execTask: Promise<void>;
};

/**
 * This class is responsible for managing the execution of scripts.
 */
export class EmuScriptRunner {
  private runningScripts = new Map<number, ScriptExecInfo>();

  constructor (
    private readonly store: Store<AppState>,
    private readonly messenger: MessengerBase,
    private readonly outputFn = sendScriptOutput
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
    if (script) {
      // --- The script is already running, nothing to do
      this.outputFn?.(`Script ${scriptFile} is already running.`, {
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
        Output: createScriptConsole(this.store, scriptId)
      }
    });

    // --- Prepare the script for execution
    // --- Parse the script
    const module = await parseKsxModule(
      scriptFile,
      scriptContents,
      moduleName => this.resolveModule(scriptFile, moduleName)
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
        script.status = "completed";
        script.endTime = new Date();
        const time = script.endTime.getTime() - script.startTime.getTime();
        this.outputFn?.(
          `Script ${scriptFile} with ID ${scriptId} completed in ${time}ms.`,
          {
            color: "green"
          }
        );
      } catch (error) {
        script.status = "execError";
        script.error = error.message;
        script.endTime = new Date();
        const time = script.endTime.getTime() - script.startTime.getTime();
        this.outputFn?.(
          `Script ${scriptFile} with ID ${scriptId} failed in ${time}ms.`,
          {
            color: "red"
          }
        );
      } finally {
        this.updateScriptsStatus(script);
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
    if (!script || isScriptCompleted(script.status)) {
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
    try {
      await scriptInfo?.execTask;
      script.status = "stopped";
      script.stopTime = new Date();
      const time = script.stopTime.getTime() - script.startTime.getTime();
      this.outputFn?.(`Script successfully stopped after ${time}ms.`, {
        color: "green"
      });
      return true;
    } catch (error) {
      script.status = "execError";
      script.error = error.message;
      script.endTime = new Date();
      const time = script.endTime.getTime() - script.startTime.getTime();
      this.outputFn?.(
        `Script raised an error when stopped after ${time}ms. Error: ${error.toString?.()}`,
        {
          color: "brightRed"
        }
      );
      throw error;
    } finally {
      this.runningScripts.delete(scriptId);
      this.updateScriptsStatus(script);
    }
  }

  /**
   * Awaits for the completion of a script.
   * @param scriptFileName The name of the script file to wait for.
   * @returns
   */
  async completeScript (id: number): Promise<void> {
    // --- Check if the script is already running
    const scripts = this.store.getState().scripts;
    const script = scripts.find(s => s.id === id);
    if (script && isScriptCompleted(script.status)) {
      // --- The script has been completed, nothing to do
      return;
    }

    // --- Stop the script
    const scriptInfo = this.runningScripts.get(id);
    try {
      await scriptInfo?.execTask;
      script.status = "completed";
      script.endTime = new Date();
      const time = script.endTime.getTime() - script.startTime.getTime();
      this.outputFn?.(
        `Script ${script.scriptFileName} with ID ${script.id} completed in ${time}ms.`,
        {
          color: "green"
        }
      );
    } catch (error) {
      script.status = "execError";
      script.error = error.message;
      script.endTime = new Date();
      const time = script.endTime.getTime() - script.startTime.getTime();
      this.outputFn?.(
        `Script ${script.scriptFileName} with ID ${
          script.id
        } failed: ${error.toString?.()} in ${time}ms.`,
        {
          color: "bright-red"
        }
      );
      throw error;
    } finally {
      this.runningScripts.delete(id);
      this.updateScriptsStatus(script);
    }
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

  private updateScriptsStatus (script: ScriptRunInfo): void {
    const scripts = this.store.getState().scripts.slice();
    let scriptIdx = scripts.findIndex(s => s.id === script.id);
    if (scriptIdx >= 0) {
      scripts[scriptIdx] = script;
    }
    this.store.dispatch(setScriptsStatusAction(scripts));
  }
}

/**
 * Sends the output of a script to the IDE
 * @param text Text to send
 * @param options Additional options
 */
async function sendScriptOutput (
  text: string,
  options?: Record<string, any>
): Promise<void> {
  const message: IdeDisplayOutputRequest = {
    type: "IdeDisplayOutput",
    pane: PANE_ID_SCRIPTIMG,
    text,
    color: "cyan",
    writeLine: true,
    ...options
  };
  await sendFromMainToIde(message);
}
