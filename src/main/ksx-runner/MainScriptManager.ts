import path from "path";
import fs from "fs";

import type { ScriptStartInfo } from "@abstractions/ScriptStartInfo";
import type { ScriptRunInfo } from "@abstractions/ScriptRunInfo";
import type { KsxModule } from "@common/ksx/ksx-module";
import type { AppState } from "@common/state/AppState";

import { mainStore } from "../main-store";
import {
  CancellationToken,
  EvaluationContext,
  createEvalContext
} from "../../common/ksx/EvaluationContext";
import { setScriptsStatusAction } from "../../common/state/actions";
import { isScriptCompleted } from "../../common/utils/script-utils";
import { getMainToIdeMessenger } from "../../common/messaging/MainToIdeMessenger";
import { executeModule, isModuleErrors, parseKsxModule } from "@common/ksx/ksx-module";
import { createScriptConsole } from "./ScriptConsole";
import { concludeScript, sendScriptOutput } from "../../common/ksx/script-runner";
import { createProjectStructure } from "./ProjectStructure";
import { executeIdeCommand } from "./ide-commands";
import { createZ88dk } from "../../script-packages/z88dk/Z88DK";
import { createNotifications } from "./notifications";
import { createEmulatorApi } from "./emulator";

const MAX_SCRIPT_HISTORY = 128;

type ScriptExecutionState = ScriptRunInfo & {
  evalContext?: EvaluationContext;
  execTask?: Promise<void>;
};

/**
 * This class is responsible for managing the execution of scripts.
 */
class MainScriptManager {
  private scripts: ScriptExecutionState[] = [];
  private id = 0;
  private packages: Record<string, any> = {};

  constructor(
    private prepareScript?: (scriptFile: string, scriptId: number) => Promise<ScriptStartInfo>,
    private execScript?: (
      scriptFile: string,
      scriptContents: string,
      evalContext: EvaluationContext
    ) => Promise<void>,
    private outputFn: (text: string, options?: Record<string, any>) => Promise<void> = (
      text,
      options
    ) => sendScriptOutput(getMainToIdeMessenger(), text, options),
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
   * Allow using an app context in the script execution?
   */
  allowAppContext = true;

  /**
   * Registers a package object to be used in the script execution.
   * @param packageName Name of the package
   * @param packageObject Package object to register
   */
  registerPackage(packageName: string, packageObject: any): void {
    this.packages[packageName] = packageObject;
  }

  /**
   * Starts the execution of a script.
   * @param scriptFileName The name of the script file to run.
   * @returns The script ID if the script is started, or a negative number if the script is already running.
   */
  async runScript(scriptFileName: string): Promise<ScriptStartInfo> {
    // --- Check if the script is already running
    const script = this.scripts.find(
      (s) => s.scriptFileName === scriptFileName && !isScriptCompleted(s.status)
    );
    if (script) {
      // --- The script is already running, nothing to do
      await this.outputFn?.(`Script ${scriptFileName} is already running.`, {
        color: "yellow"
      });
      return { id: -script.id };
    }

    // --- Remove the oldest running script, if there are too many of them
    this.removeOldScript();

    // --- Create a new script ID
    this.id++;

    // --- Now, start the script
    await this.outputFn?.(`Starting script ${scriptFileName}...`);
    const cancellationToken = new CancellationToken();
    const evalContext = createEvalContext({
      scriptId: this.id,
      store: mainStore,
      cancellationToken,
      appContext: this.allowAppContext ? await this.prepareAppContext() : null
    });

    // --- Prepare the script for execution
    const startInfo = await this.prepareScript(scriptFileName, this.id);
    if (startInfo.hasParseError) {
      return startInfo;
    }

    // --- Ok, parsing successful
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
    const execTask = this.execScript(scriptFileName, startInfo.contents, evalContext);

    // --- Update the script status
    newScript.execTask = execTask;
    mainStore.dispatch(setScriptsStatusAction(this.getScriptsStatus()));

    // --- We intentionally do not await the script execution here
    this.outputFn?.(`Script started`, { color: "green" });
    concludeScript(
      mainStore,
      execTask,
      evalContext,
      () => this.getScriptsStatus(),
      newScript,
      this.outputFn,
      () => delete newScript.execTask
    );

    // --- Done.
    return { id: this.id };
  }

  async runScriptText(
    scriptText: string,
    scriptFunction: string,
    scriptFile: string,
    speciality?: string
  ): Promise<ScriptStartInfo> {
    // --- Remove the oldest running script, if there are too many of them
    this.removeOldScript();

    // --- Create a new script ID
    this.id++;

    // --- Now, start the script
    await this.outputFn?.(`Starting script ${scriptFunction}...`);
    const cancellationToken = new CancellationToken();
    const evalContext = createEvalContext({
      scriptId: this.id,
      store: mainStore,
      cancellationToken,
      appContext: await this.prepareAppContext()
    });

    // --- Parse the script
    let module: KsxModule;
    try {
      module = await this.parseScript(scriptFile, scriptText);
    } catch (err) {
      // --- The script has errors, display them
      return { id: this.id, hasParseError: true };
    }

    // --- Parse was successful, start the script
    const newScript: ScriptExecutionState = {
      id: this.id,
      scriptFileName: scriptFile,
      status: "pending",
      startTime: new Date(),
      runsInEmu: false,
      evalContext,
      specialScript: speciality,
      scriptFunction
    };
    this.scripts.push(newScript);

    // --- The script should be executed in the main process
    // --- Start the script but do not await it
    const execTask = executeModule(module, evalContext);

    // --- Update the script status
    newScript.execTask = execTask;
    mainStore.dispatch(setScriptsStatusAction(this.getScriptsStatus()));

    // --- We intentionally do not await the script execution here
    this.outputFn?.(`Script started`, { color: "green" });
    concludeScript(
      mainStore,
      execTask,
      evalContext,
      () => this.getScriptsStatus(),
      newScript,
      this.outputFn,
      () => delete newScript.execTask
    );

    // --- Done.
    return { id: this.id };
  }

  /**
   * Stops the execution of a running script.
   * @param scriptFileName The name of the script file to stop.
   */
  async stopScript(idOrFileName: number | string): Promise<boolean> {
    // --- Check if the script is already running
    let script: ScriptExecutionState;
    if (typeof idOrFileName === "number") {
      script = this.scripts.find((s) => s.id === idOrFileName);
    } else {
      const reversed = this.scripts.slice().reverse();
      script = reversed.find((s) => s.scriptFileName === idOrFileName);
    }
    if (!script || isScriptCompleted(script.status)) {
      return false;
    }

    // --- Stop the script
    await this.outputFn?.(`Stopping script ${script.scriptFileName}...`);
    script.evalContext?.cancellationToken?.cancel();
    await script.execTask;
    return true;
  }

  /**
   * Awaits for the completion of a script.
   * @param scriptFileName The name of the script file to wait for.
   * @returns
   */
  async completeScript(id: number): Promise<void> {
    // --- Check if the script is already running
    const script = this.scripts.find((s) => s.id === id);
    if (script && isScriptCompleted(script.status)) {
      // --- The script has been completed, nothing to do
      return;
    }
    await script.execTask;
  }

  async closeScript(script: ScriptRunInfo): Promise<void> {
    const savedScript = this.scripts.find((s) => s.id === script.id);
    if (!savedScript) return;

    savedScript.status = script.status;
    savedScript.error = script.error;
    savedScript.endTime = script.endTime;
    savedScript.stopTime = script.stopTime;

    // --- Update the script status
    mainStore.dispatch(setScriptsStatusAction(this.getScriptsStatus()));
  }

  /**
   * Remove the completed scripts from the list.
   */
  removeCompletedScripts(): void {
    this.scripts = this.scripts.filter((s) => !isScriptCompleted(s.status));
    mainStore.dispatch(setScriptsStatusAction(this.getScriptsStatus()));
  }

  /**
   * Returns the status of all scripts.
   */
  getScriptsStatus(): ScriptRunInfo[] {
    return this.scripts.slice(0).map((s) => ({
      id: s.id,
      scriptFileName: s.scriptFileName,
      status: s.status,
      error: s.error,
      runsInEmu: s.runsInEmu,
      startTime: s.startTime,
      endTime: s.endTime,
      stopTime: s.stopTime,
      specialScript: s.specialScript,
      scriptFunction: s.scriptFunction
    }));
  }

  /**
   * Prepares the script for execution
   * @param scriptFile Script file to prepare
   * @param scriptId ID of the script
   * @returns Script execution information
   */
  private async doPrepare(scriptFile: string, scriptId: number): Promise<ScriptStartInfo> {
    let script: string;
    try {
      // --- Let's read the script file from the disk
      script = fs.readFileSync(scriptFile, "utf-8");
    } catch (error) {
      throw new Error(`Cannot read script file: ${error.message}`);
    }

    // --- Parse the script
    let module: KsxModule;
    try {
      module = await this.parseScript(scriptFile, script);
    } catch (err) {
      // --- The script has errors, display them
      return { id: scriptId, hasParseError: true };
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

  private async doExecute(
    scriptFile: string,
    scriptContents: string,
    evalContext: EvaluationContext
  ): Promise<void> {
    const module = await this.parseScript(scriptFile, scriptContents);
    await executeModule(module, evalContext);
  }

  // --- Resolves the script contents from the module's name
  async resolveModule(scriptFile: string, moduleName: string): Promise<string | null> {
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

  // --- Resolves the package contents
  async resolvePackage(packageName: string): Promise<Record<string, any>> {
    return this.packages[packageName];
  }

  // --- Removes the oldest completed script
  private removeOldScript() {
    const runningScripts = this.scripts.filter((script) => !isScriptCompleted(script.status));
    if (runningScripts.length >= this.maxScriptHistory) {
      // --- Remove the oldest completed script
      const oldest = this.scripts.findIndex((script) => isScriptCompleted(script.status));
      if (oldest >= 0) {
        this.scripts.splice(oldest, 1);
      }
    }
  }

  private async parseScript(scriptFolder: string, script: string): Promise<KsxModule> {
    const module = await parseKsxModule(
      scriptFolder,
      script,
      (moduleName) => this.resolveModule(scriptFolder, moduleName),
      (packageName) => this.resolvePackage(packageName)
    );
    if (isModuleErrors(module)) {
      // --- The script has errors, display them
      Object.keys(module).forEach((moduleName) => {
        const errors = module[moduleName];
        errors.forEach(async (error) => {
          await this.outputFn?.(
            `${error.code}: ${error.text} (${moduleName}:${error.line}:${error.column})`,
            {
              color: "bright-red"
            }
          );
        });
      });
      throw new Error("Running script failed");
    }
    return module;
  }

  /**
   * Prepares the application context for the script execution
   */
  private async prepareAppContext(): Promise<Record<string, any>> {
    const callContext: ScriptCallContext = {
      dispatch: mainStore.dispatch,
      get state() {
        return mainStore.getState();
      },
      messenger: getMainToIdeMessenger(),
      output: createScriptConsole(getMainToIdeMessenger(), this.id)
    };
    return {
      delay: (ms: number) => new Promise((res) => setTimeout(res, ms)),
      Output: callContext.output,
      $notifications: createNotifications(callContext),
      $project: await createProjectStructure(),
      $command: (commandText: string) => executeIdeCommand(this.id, commandText),
      $emu: createEmulatorApi(callContext),
      Z88dk: createZ88dk(callContext)
    };
  }
}

export interface ScriptCallContext {
  dispatch: typeof mainStore.dispatch;
  readonly state: AppState;
  messenger: ReturnType<typeof getMainToIdeMessenger>;
  output: ReturnType<typeof createScriptConsole>;
}

export function createMainScriptManager(
  prepareScript: (scriptFile: string, scriptId: number) => Promise<ScriptStartInfo>,
  execScript: (
    scriptFile: string,
    scriptContents: string,
    evalContext?: EvaluationContext
  ) => Promise<void>
): MainScriptManager {
  const scriptManager = new MainScriptManager(prepareScript, execScript, async () => {});
  scriptManager.allowAppContext = false;
  return scriptManager;
}

/**
 * The singleton instance of the main script manager
 */
export const mainScriptManager = new MainScriptManager();

// --- Register the standard packages
mainScriptManager.registerPackage("fs", fs);
mainScriptManager.registerPackage("path", path);
