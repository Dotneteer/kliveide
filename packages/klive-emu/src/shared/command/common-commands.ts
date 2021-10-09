import {
  dispatch,
  getCodeRunnerService,
  getZ80CompilerService,
} from "@core/service-registry";
import {
  executeCommand,
  registerCommand,
} from "@abstractions/command-registry";
import {
  sendFromIdeToEmu,
} from "@core/messaging/message-sending";
import {
  CompileFileResponse,
  SupportsCodeInjectionResponse,
} from "@core/messaging/message-types";
import {
  emuShowFrameInfoAction,
  emuShowKeyboardAction,
  emuShowStatusbarAction as emuShowStatusBarAction,
  emuShowToolbarAction,
} from "@state/emu-view-options-reducer";
import { ideShowAction } from "@state/show-ide-reducer";
import {
  IKliveCommand,
  KliveCommandContext,
} from "@core/abstractions/command-def";

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
        await getCodeRunnerService().manageCodeInjection(
          context.resource,
          "inject"
        );
    }
  },
  queryState: async (context) => await queryInjectionCommandState(context),
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
        await getCodeRunnerService().manageCodeInjection(
          context.resource,
          "run"
        );
    }
  },
  queryState: async (context) => await queryInjectionCommandState(context),
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
        await getCodeRunnerService().manageCodeInjection(
          context.resource,
          "debug"
        );
    }
  },
  queryState: async (context) => await queryInjectionCommandState(context),
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

/**
 * Queries the state of a code injection related command
 * @param context
 */
async function queryInjectionCommandState(
  context: KliveCommandContext
): Promise<void> {
  let enabled = false;
  if (context.process === "ide") {
    const response = await sendFromIdeToEmu<SupportsCodeInjectionResponse>({
      type: "SupportsCodeInjection",
    });
    enabled = response.supports;
  }
  context.commandInfo.enabled = enabled;
}
