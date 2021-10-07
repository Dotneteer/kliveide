import {
  executeCommand,
  registerCommand,
} from "@abstractions/command-registry";
import {
  dispatch,
  getDialogService,
  getState,
  getVmEngineService,
  getZ80CompilerService,
} from "@abstractions/service-helpers";
import {
  sendFromIdeToEmu,
  sendFromMainToEmu,
} from "@messaging/message-sending";
import {
  CompileFileResponse,
  SupportsCodeInjectionResponse,
} from "@messaging/message-types";
import {
  emuShowFrameInfoAction,
  emuShowKeyboardAction,
  emuShowStatusbarAction as emuShowStatusBarAction,
  emuShowToolbarAction,
} from "@state/emu-view-options-reducer";
import { ideShowAction } from "@state/show-ide-reducer";
import {
  CodeToInject,
  SpectrumModelType,
} from "../../main/z80-compiler/assembler-in-out";
import {
  IKliveCommand,
  KliveCommandContext,
} from "../../extensibility/abstractions/command-def";

/**
 * Names of core Klive commands
 */
type CoreKliveCommand =
  | "showToolbar"
  | "hideToolbar"
  | "showStatusBar"
  | "hideStatusBar"
  | "showFrameInfo"
  | "hideFrameInfo"
  | "showKeyboard"
  | "hideKeyboard"
  | "showIde"
  | "hideIde"
  | "startVm"
  | "pauseVm"
  | "stopVm"
  | "debugVm"
  | "stepIntoVm"
  | "stepOverVm"
  | "stepOutVm"
  | "compileCode"
  | "injectCodeIntoVm"
  | "injectAndStartVm"
  | "injectAndDebugVm";

/**
 * Registers common Klive commands that can be executed from any processes
 */
export function registerCommonCommands(): void {
  registerCommand(showToolbarCommand);
  registerCommand(hideToolbarCommand);
  registerCommand(showStatusBarCommand);
  registerCommand(hideStatusBarCommand);
  registerCommand(showFrameInfoCommand);
  registerCommand(hideFrameInfoCommand);
  registerCommand(showKeyboardCommand);
  registerCommand(hideKeyboardCommand);
  registerCommand(showIdeCommand);
  registerCommand(hideIdeCommand);

  registerCommand(startVmCommand);
  registerCommand(pauseVmCommand);
  registerCommand(stopVmCommand);
  registerCommand(debugVmCommand);
  registerCommand(stepIntoVmCommand);
  registerCommand(stepOverVmCommand);
  registerCommand(stepOutVmCommand);

  registerCommand(compileCodeCommand);
  registerCommand(injectCodeIntoVmCommand);
  registerCommand(injectAndStartVmCommand);
  registerCommand(injectAndDebugVmCommand);
}

/**
 * Executes the specified core Klive command
 * @param id Klive command to execute
 */
export async function executeKliveCommand(
  id: CoreKliveCommand,
  additionalContext?: any
): Promise<void> {
  await executeCommand(`klive.${id}`, additionalContext);
}

/**
 * This command shows the Emulator toolbar
 */
const showToolbarCommand: IKliveCommand = {
  commandId: "klive.showToolbar",
  execute: async () => {
    dispatch(emuShowToolbarAction(true));
  },
  queryState: async (context) => {
    context.commandInfo.enabled = !(
      context.appState?.emuViewOptions?.showStatusBar ?? false
    );
  },
};

/**
 * This command shows the Emulator toolbar
 */
const hideToolbarCommand: IKliveCommand = {
  commandId: "klive.hideToolbar",
  execute: async () => {
    dispatch(emuShowToolbarAction(false));
  },
  queryState: async (context) => {
    context.commandInfo.enabled =
      context.appState?.emuViewOptions?.showStatusBar ?? false;
  },
};

/**
 * This command shows the application status bar
 */
const showStatusBarCommand: IKliveCommand = {
  commandId: "klive.showStatusBar",
  execute: async () => {
    dispatch(emuShowStatusBarAction(true));
  },
};

/**
 * This command hides the application status bar
 */
const hideStatusBarCommand: IKliveCommand = {
  commandId: "klive.hideStatusBar",
  execute: async () => {
    dispatch(emuShowStatusBarAction(false));
  },
};

/**
 * This command shows the frame information in the Emu status bar
 */
const showFrameInfoCommand: IKliveCommand = {
  commandId: "klive.showFrameInfo",
  execute: async () => {
    dispatch(emuShowFrameInfoAction(true));
  },
};

/**
 * This command hides the frame information in the Emu status bar
 */
const hideFrameInfoCommand: IKliveCommand = {
  commandId: "klive.hideFrameInfo",
  execute: async () => {
    dispatch(emuShowFrameInfoAction(false));
  },
};

/**
 * This command shows the keyboard
 */
const showKeyboardCommand: IKliveCommand = {
  commandId: "klive.showKeyboard",
  execute: async () => {
    dispatch(emuShowKeyboardAction(true));
  },
};

/**
 * This command hides the keyboard
 */
const hideKeyboardCommand: IKliveCommand = {
  commandId: "klive.hideKeyboard",
  execute: async () => {
    dispatch(emuShowKeyboardAction(false));
  },
};

/**
 * This command shows the Ide window
 */
const showIdeCommand: IKliveCommand = {
  commandId: "klive.showIde",
  execute: async () => {
    dispatch(ideShowAction(true));
  },
};

/**
 * This command hides the Ide window
 */
const hideIdeCommand: IKliveCommand = {
  commandId: "klive.hideIde",
  execute: async () => {
    dispatch(ideShowAction(false));
  },
};

/**
 * This command starts the virtual machine
 */
const startVmCommand: IKliveCommand = {
  commandId: "klive.startVm",
  title: "Start",
  icon: "play",
  execute: async (context) => {
    switch (context.process) {
      case "main":
        await sendFromMainToEmu({ type: "StartVm" });
        break;
      case "emu":
        await getVmEngineService().start();
        break;
      case "ide":
        await sendFromIdeToEmu({ type: "StartVm" });
        break;
    }
  },
  queryState: async (context) => {
    context.commandInfo.enabled = context.executionState !== "running";
  },
};

/**
 * This command pauses the virtual machine
 */
const pauseVmCommand: IKliveCommand = {
  commandId: "klive.pauseVm",
  title: "Pause",
  icon: "pause",
  execute: async (context) => {
    switch (context.process) {
      case "main":
        await sendFromMainToEmu({ type: "PauseVm" });
        break;
      case "emu":
        await getVmEngineService().pause();
        break;
      case "ide":
        await sendFromIdeToEmu({ type: "PauseVm" });
        break;
    }
  },
  queryState: async (context) => {
    context.commandInfo.enabled = context.executionState === "running";
  },
};

/**
 * This command stops the virtual machine
 */
const stopVmCommand: IKliveCommand = {
  commandId: "klive.stopVm",
  title: "Stop",
  icon: "stop",
  execute: async (context) => {
    switch (context.process) {
      case "main":
        await sendFromMainToEmu({ type: "StopVm" });
        break;
      case "emu":
        await getVmEngineService().stop();
        break;
      case "ide":
        await sendFromIdeToEmu({ type: "StopVm" });
        break;
    }
  },
  queryState: async (context) => {
    context.commandInfo.enabled =
      context.executionState === "running" ||
      context.executionState === "paused";
  },
};

/**
 * This command stops the virtual machine
 */
const debugVmCommand: IKliveCommand = {
  commandId: "klive.debugVm",
  title: "Start with debugging",
  icon: "debug",
  execute: async (context) => {
    switch (context.process) {
      case "main":
        await sendFromMainToEmu({ type: "DebugVm" });
        break;
      case "emu":
        await getVmEngineService().startDebug();
        break;
      case "ide":
        await sendFromIdeToEmu({ type: "DebugVm" });
        break;
    }
  },
  queryState: async (context) => {
    context.commandInfo.enabled = context.executionState !== "running";
  },
};

/**
 * This command executes a step-into operation
 */
const stepIntoVmCommand: IKliveCommand = {
  commandId: "klive.stepIntoVm",
  title: "Step into code",
  icon: "step-into",
  execute: async (context) => {
    switch (context.process) {
      case "main":
        await sendFromMainToEmu({ type: "StepIntoVm" });
        break;
      case "emu":
        await getVmEngineService().stepInto();
        break;
      case "ide":
        await sendFromIdeToEmu({ type: "StepIntoVm" });
        break;
    }
  },
  queryState: async (context) => {
    context.commandInfo.enabled = context.executionState === "paused";
  },
};

/**
 * This command executes a step-over operation
 */
const stepOverVmCommand: IKliveCommand = {
  commandId: "klive.stepOverVm",
  title: "Step over code",
  icon: "step-over",
  execute: async (context) => {
    switch (context.process) {
      case "main":
        await sendFromMainToEmu({ type: "StepOverVm" });
        break;
      case "emu":
        await getVmEngineService().stepOver();
        break;
      case "ide":
        await sendFromIdeToEmu({ type: "StepOverVm" });
        break;
    }
  },
  queryState: async (context) => {
    context.commandInfo.enabled = context.executionState === "paused";
  },
};

/**
 * This command executes a step-out operation
 */
const stepOutVmCommand: IKliveCommand = {
  commandId: "klive.stepOutVm",
  title: "Step out code",
  icon: "step-out",
  execute: async (context) => {
    switch (context.process) {
      case "main":
        await sendFromMainToEmu({ type: "StepOutVm" });
        break;
      case "emu":
        await getVmEngineService().stepOut();
        break;
      case "ide":
        await sendFromIdeToEmu({ type: "StepOutVm" });
        break;
    }
  },
  queryState: async (context) => {
    context.commandInfo.enabled = context.executionState === "paused";
  },
};

/**
 * This command injects code into the virtual machine
 */
const compileCodeCommand: IKliveCommand = {
  commandId: "klive.compileCode",
  title: "Compiles the code",
  icon: "combine",
  execute: async (context) => {
    if (!context.resource) {
      return;
    }
    switch (context.process) {
      case "main":
        await getZ80CompilerService().compileFile(context.resource);
        break;
      case "emu":
        signInvalidContext(context);
        break;
      case "ide":
        await sendFromIdeToEmu<CompileFileResponse>({
          type: "CompileFile",
          filename: context.resource,
        });
        break;
    }
  },
};

/**
 * This command injects code into the virtual machine
 */
const injectCodeIntoVmCommand: IKliveCommand = {
  commandId: "klive.injectCodeIntoVm",
  title: "Injects code into the virtual machine",
  icon: "inject",
  execute: async (context) => {
    switch (context.process) {
      case "main":
      case "emu":
        signInvalidContext(context);
        break;
      case "ide":
        await executeKliveCommand("compileCode", context);
        const compilation = getState().compilation;
        if (!compilation) {
          return;
        }
        const result = compilation.result;
        if (result?.errors?.length ?? 0 > 0) {
          await getDialogService().showMessageBox(
            "Code compilation failed, no program to inject.",
            "Injecting code",
            "error"
          );
          return;
        }

        // TODO: Check compilation model before injection

        let sumCodeLength = 0;
        result.segments.forEach((s) => (sumCodeLength += s.emittedCode.length));
        if (sumCodeLength === 0) {
          await getDialogService().showMessageBox(
            "The length of the compiled code is 0, " +
              "so there is no code to inject into the virtual machine.",
            "Injecting code"
          );
          return;
        }

        if (context.executionState !== "paused") {
          await getDialogService().showMessageBox(
            "To inject the code into the virtual machine, please put it in paused state first.",
            "Injecting code"
          );
          return;
        }

        // --- Create the code to inject into the emulator
        const codeToInject: CodeToInject = {
          model: modelTypeToMachineType(result.modelType),
          entryAddress: result.entryAddress,
          subroutine:
            result.sourceType === "zxbasic" ||
            result.injectOptions["subroutine"],
          segments: result.segments.map((s) => ({
            startAddress: s.startAddress,
            bank: s.bank,
            bankOffset: s.bankOffset,
            emittedCode: s.emittedCode,
          })),
          options: result.injectOptions,
        };
        await sendFromIdeToEmu({
          type: "InjectCode",
          codeToInject,
        });

        const message = `Successfully injected ${sumCodeLength} bytes in ${
          codeToInject.segments.length
        } segment${
          codeToInject.segments.length > 1 ? "s" : ""
        } from start address $${codeToInject.segments[0].startAddress
          .toString(16)
          .padStart(4, "0")
          .toUpperCase()}`;
        await getDialogService().showMessageBox(message, "Injecting code");
        return;
    }

    function modelTypeToMachineType(model: SpectrumModelType): string {
      switch (model) {
        case SpectrumModelType.Spectrum128:
          return "128";
        case SpectrumModelType.SpectrumP3:
          return "p3";
        case SpectrumModelType.Next:
          return "next";
        default:
          return "48";
      }
    }
  },
  queryState: async (context) => {
    let enabled = false;
    if (context.process === "ide") {
      const response = await sendFromIdeToEmu<SupportsCodeInjectionResponse>({
        type: "SupportsCodeInjection",
      });
      enabled = response.supports;
    }
    context.commandInfo.enabled = enabled;
  },
};

/**
 * This command injects code into the virtual machine and starts it
 */
const injectAndStartVmCommand: IKliveCommand = {
  commandId: "klive.injectAndStartVm",
  title: "Injects code and starts",
  icon: "play",
  execute: async (context) => {
    switch (context.process) {
      case "main":
      case "emu":
        signInvalidContext(context);
        break;
      case "ide":
        console.log("Inject and start");
        break;
    }
  },
};

/**
 * This command injects code into the virtual machine and starts it
 */
const injectAndDebugVmCommand: IKliveCommand = {
  commandId: "klive.injectAndDebugVm",
  title: "Injects code and starts with debugging",
  icon: "debug",
  execute: async (context) => {
    switch (context.process) {
      case "main":
      case "emu":
        signInvalidContext(context);
        break;
      case "ide":
        console.log("Inject and debug");
        break;
    }
  },
};

/**
 * Signs the specified context as invalid for executing a command
 * @param context Invalid context
 */
function signInvalidContext(context: KliveCommandContext) {
  throw new Error(
    `'${context.commandInfo.commandId}' cannot be executed it the ${context.process} process`
  );
}
