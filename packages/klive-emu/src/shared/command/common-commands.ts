import {
  executeCommand,
  registerCommand,
} from "@abstractions/command-registry";
import { dispatch, getVmEngineService } from "@abstractions/service-helpers";
import {
  sendFromIdeToEmu,
  sendFromMainToEmu,
} from "@messaging/message-sending";
import {
  emuShowFrameInfoAction,
  emuShowKeyboardAction,
  emuShowStatusbarAction as emuShowStatusBarAction,
  emuShowToolbarAction,
} from "@state/emu-view-options-reducer";
import { ideShowAction } from "@state/show-ide-reducer";
import { IKliveCommand } from "../../extensibility/abstractions/command-def";

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
  | "startVm";

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
}

/**
 * Executes the specified core Klive command
 * @param id Klive command to execute
 */
export async function executeKliveCommand(id: CoreKliveCommand): Promise<void> {
  await executeCommand(`klive.${id}`);
}

/**
 * This command shows the Emulator toolbar
 */
const showToolbarCommand: IKliveCommand = {
  id: "klive.showToolbar",
  execute: async () => {
    dispatch(emuShowToolbarAction(true));
  },
};

/**
 * This command shows the Emulator toolbar
 */
const hideToolbarCommand: IKliveCommand = {
  id: "klive.hideToolbar",
  execute: async () => {
    dispatch(emuShowToolbarAction(false));
  },
};

/**
 * This command shows the application status bar
 */
const showStatusBarCommand: IKliveCommand = {
  id: "klive.showStatusBar",
  execute: async () => {
    dispatch(emuShowStatusBarAction(true));
  },
};

/**
 * This command hides the application status bar
 */
const hideStatusBarCommand: IKliveCommand = {
  id: "klive.hideStatusBar",
  execute: async () => {
    dispatch(emuShowStatusBarAction(false));
  },
};

/**
 * This command shows the frame information in the Emu status bar
 */
const showFrameInfoCommand: IKliveCommand = {
  id: "klive.showFrameInfo",
  execute: async () => {
    dispatch(emuShowFrameInfoAction(true));
  },
};

/**
 * This command hides the frame information in the Emu status bar
 */
const hideFrameInfoCommand: IKliveCommand = {
  id: "klive.hideFrameInfo",
  execute: async () => {
    dispatch(emuShowFrameInfoAction(false));
  },
};

/**
 * This command shows the keyboard
 */
const showKeyboardCommand: IKliveCommand = {
  id: "klive.showKeyboard",
  execute: async () => {
    dispatch(emuShowKeyboardAction(true));
  },
};

/**
 * This command hides the keyboard
 */
const hideKeyboardCommand: IKliveCommand = {
  id: "klive.hideKeyboard",
  execute: async () => {
    dispatch(emuShowKeyboardAction(false));
  },
};

/**
 * This command shows the Ide window
 */
const showIdeCommand: IKliveCommand = {
  id: "klive.showIde",
  execute: async () => {
    dispatch(ideShowAction(true));
  },
};

/**
 * This command hides the Ide window
 */
const hideIdeCommand: IKliveCommand = {
  id: "klive.hideIde",
  execute: async () => {
    dispatch(ideShowAction(false));
  },
};

/**
 * This command hides the Ide window
 */
const startVmCommand: IKliveCommand = {
  id: "klive.startVm",
  execute: async (context) => {
    switch (context.process) {
      case "main":
        await sendFromMainToEmu({ type: "StartVm" });
        break;
      case "emu":
        await getVmEngineService().start();
        break;
      case "ide":
        console.log("Starting");
        await sendFromIdeToEmu({ type: "StartVm" });
        break;
    }
  },
};
