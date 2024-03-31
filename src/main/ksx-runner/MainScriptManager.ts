import * as path from "path";
import * as fs from "fs";
import { mainStore } from "../main-store";
import {
  CancellationToken,
  EvaluationContext,
  createEvalContext
} from "../ksx/EvaluationContext";
import { setScriptsStatusAction } from "../../common/state/actions";
import {
  ScriptExecutionState,
  ScriptRunInfo
} from "@abstractions/ScriptRunInfo";
import { isScriptCompleted } from "../../common/utils/script-utils";
import { PANE_ID_SCRIPTIMG } from "../../common/integration/constants";
import {
  getMainToIdeMessenger,
  sendFromMainToIde
} from "../../common/messaging/MainToIdeMessenger";
import { IdeDisplayOutputRequest } from "../../common/messaging/any-to-ide";
import {
  executeModule,
  isModuleErrors,
  parseKsxModule
} from "../ksx/ksx-module";
import { IScriptManager, ScriptStartInfo } from "@abstractions/IScriptManager";
import { createScriptConsole } from "./ScriptConsole";

const MAX_SCRIPT_HISTORY = 128;

/**
 * This class is responsible for managing the execution of scripts.
 */
class MainScriptManager implements IScriptManager {
  private scripts: ScriptExecutionState[] = [];
  private id = 0;

  constructor (
    private prepareScript?: (
      scriptFile: string,
      scriptId: number
    ) => Promise<ScriptStartInfo>,
    private execScript?: (
      scriptFile: string,
      scriptContents: string,
      evalContext: EvaluationContext
    ) => Promise<void>,
    private outputFn = sendScriptOutput,
    private maxScriptHistory = MAX_SCRIPT_HISTORY
  ) {
    if (!this.execScript) {
      this.execScript = this.doExecute;
    }
    if (!this.prepareScript) {
      this.prepareScript = this.doPrepare;
    }
  }

  /**
   * Starts the execution of a script.
   * @param scriptFileName The name of the script file to run.
   * @returns The script ID if the script is started, or a negative number if the script is already running.
   */
  async runScript (scriptFileName: string): Promise<ScriptStartInfo> {
    // --- Check if the script is already running
    const script = this.scripts.find(
      s => s.scriptFileName === scriptFileName && !isScriptCompleted(s.status)
    );
    if (script) {
      // --- The script is already running, nothing to do
      this.outputFn?.(`Script ${scriptFileName} is already running.`, {
        color: "yellow"
      });
      return { id: -script.id };
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

    // --- Create a new script ID
    this.id++;

    // --- Now, start the script
    this.outputFn?.(`Starting script ${scriptFileName}...`);
    const cancellationToken = new CancellationToken();
    const evalContext = createEvalContext({
      scriptId: this.id,
      store: mainStore,
      cancellationToken,
      appContext: {
        Output: createScriptConsole(mainStore, getMainToIdeMessenger(), this.id)
      }
    });

    // --- Prepare the script for execution
    const startInfo = await this.prepareScript(scriptFileName, this.id);
    const runsInEmu = startInfo.target === "emu";
    const newScript: ScriptExecutionState = {
      id: this.id,
      scriptFileName,
      status: "pending",
      startTime: new Date(),
      runsInEmu,
      evalContext
    };
    this.scripts.push(newScript);

    if (runsInEmu) {
      // --- The script should be executed in the emulator
      mainStore.dispatch(setScriptsStatusAction(this.getScriptsStatus()));
      return startInfo;
    }

    // --- The script should be executed in the main process
    // --- Start the script but do not await it
    const execTask = this.execScript(
      scriptFileName,
      startInfo.contents,
      evalContext
    );

    // --- Update the script status
    newScript.execTask = execTask;
    mainStore.dispatch(setScriptsStatusAction(this.getScriptsStatus()));
    this.outputFn?.(`Script started`, {
      color: "green"
    });

    // --- Await the script execution
    (async () => {
      try {
        await execTask;
        newScript.status = "completed";
        newScript.endTime = new Date();
        const time =
          newScript.endTime.getTime() - newScript.startTime.getTime();
        const cancelled = evalContext.cancellationToken.cancelled;
        this.outputFn?.(
          `Script ${scriptFileName} with ID ${this.id} ${
            cancelled ? "stopped" : "completed"
          } in ${time}ms.`,
          {
            color: cancelled ? "yellow" : "green"
          }
        );
      } catch (error) {
        newScript.status = "execError";
        newScript.error = error.message;
        newScript.endTime = new Date();
        const time =
          newScript.endTime.getTime() - newScript.startTime.getTime();
        this.outputFn?.(
          `Script ${scriptFileName} with ID ${this.id} failed in ${time}ms.`,
          {
            color: "red"
          }
        );
        this.outputFn?.(
          error.toString?.() ?? "Unknown error",
          {
            color: "bright-red"
          }
        );
      } finally {
        delete newScript.execTask;

        // --- Update the script status
        mainStore.dispatch(setScriptsStatusAction(this.getScriptsStatus()));
      }
    })();
    return { id: this.id };
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
    if (!script || isScriptCompleted(script.status)) {
      return false;
    }

    // --- Stop the script
    this.outputFn?.(`Stopping script ${script.scriptFileName}...`);
    script.evalContext?.cancellationToken?.cancel();
    try {
      await script.execTask;
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
      delete script.execTask;

      // --- Update the script status
      mainStore.dispatch(setScriptsStatusAction(this.getScriptsStatus()));
    }
  }

  async closeScript (script: ScriptRunInfo): Promise<void> {
    const savedScript = this.scripts.find(s => s.id === script.id);
    if (!savedScript) return;

    savedScript.status = script.status;
    savedScript.error = script.error;
    savedScript.endTime = script.endTime;
    savedScript.stopTime = script.stopTime;

    // --- Update the script status
    mainStore.dispatch(setScriptsStatusAction(this.getScriptsStatus()));
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
      runsInEmu: s.runsInEmu,
      startTime: s.startTime,
      endTime: s.endTime,
      stopTime: s.stopTime
    }));
  }

  /**
   * Prepares the script for execution
   * @param scriptFile Script file to prepare
   * @param scriptId ID of the script
   * @returns Script execution information
   */
  private async doPrepare (
    scriptFile: string,
    scriptId: number
  ): Promise<ScriptStartInfo> {
    let script: string;
    try {
      // --- Let's read the script file from the disk
      script = fs.readFileSync(scriptFile, "utf-8");
    } catch (error) {
      throw new Error(`Cannot read script file: ${error.message}`);
    }

    // --- Parse the script
    const module = await parseKsxModule(scriptFile, script, moduleName =>
      this.resolveModule(scriptFile, moduleName)
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

    // --- Check if the execution target is main
    if (module.statements.length > 0) {
      // --- Check the first statement
      const firstStmt = module.statements[0];
      if (
        firstStmt.type === "ExpressionStatement" &&
        firstStmt.expression.type === "Literal" &&
        firstStmt.expression.value === "emu"
      ) {
        // --- Sign the script should be executed in the emulator
        return { id: scriptId, target: "emu", contents: script };
      }
    }

    // --- Sign the script should be executed in the main process
    return { id: scriptId, contents: script };
  }

  private async doExecute (
    scriptFile: string,
    scriptContents: string,
    evalContext: EvaluationContext
  ): Promise<void> {
    // --- Parse the script
    const module = await parseKsxModule(
      scriptFile,
      scriptContents,
      (moduleName: string) => this.resolveModule(scriptFile, moduleName)
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
    await executeModule(module, evalContext);
  }

  // --- Resolves the script contents from the module's name
  async resolveModule (
    scriptFile: string,
    moduleName: string
  ): Promise<string | null> {
    const baseDir = path.dirname(scriptFile);
    const fileExt = path.extname(moduleName);
    if (!fileExt) {
      moduleName += ".ksx";
    }

    // --- Load the module from the disk
    const fullPath = path.join(baseDir, moduleName);
    try {
      const contents = fs.readFileSync(fullPath, "utf-8");
      return contents;
    } catch (error) {
      return null;
    }
  }
}

export function createMainScriptManager (
  prepareScript: (
    scriptFile: string,
    scriptId: number
  ) => Promise<ScriptStartInfo>,
  execScript: (
    scriptFile: string,
    scriptContents: string,
    evalContext?: EvaluationContext
  ) => Promise<void>
): MainScriptManager {
  return new MainScriptManager(prepareScript, execScript, async () => {});
}

export const mainScriptManager = new MainScriptManager();

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
