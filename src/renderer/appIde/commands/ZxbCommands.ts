import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";

import { commandSuccessWith, toHexa4, IdeCommandBaseNew } from "@renderer/appIde/services/ide-commands";
import {
  ZXBC_ALL,
  ZXBC_EXECUTABLE_PATH,
  ZXBC_MACHINE_CODE_ORIGIN,
  ZXBC_PYTHON_PATH
} from "@main/zxb-integration/zxb-config";

type ZxbCommandArgs = {
  zxbPath: string;
  pythonPath?: string;
  codeOrigin?: number;
};

export class ResetZxbCommand extends IdeCommandBaseNew<ZxbCommandArgs> {
  readonly id = "zxb-reset";
  readonly description =
    "Resets ZXB settings with the provided executable path and machine code origin";
  readonly usage =
    "zxb-reset <Full ZXBC executable path> [<python3 path>] [<start of machine code>]";
  readonly aliases = ["zxbr"];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "zxbPath" }],
    optional: [{ name: "pythonPath" }, { name: "codeOrigin", type: "number" }]
  };

  async execute(context: IdeCommandContext, args: ZxbCommandArgs): Promise<IdeCommandResult> {
    if (args.zxbPath) {
      await context.service.ideCommandsService.executeCommand(
        `set ${ZXBC_EXECUTABLE_PATH} "${args.zxbPath}"`
      );
      let cmdMessage = `ZX BASIC path set to ${args.zxbPath}`;
      if (args.pythonPath) {
        await context.service.ideCommandsService.executeCommand(
          `set ${ZXBC_PYTHON_PATH} "${args.pythonPath}"`
        );
        cmdMessage += `, python path to $${args.pythonPath}`;
      }
      if (args.codeOrigin) {
        await context.service.ideCommandsService.executeCommand(
          `set ${ZXBC_MACHINE_CODE_ORIGIN} "${args.codeOrigin}"`
        );
        cmdMessage += `, code origin to $${toHexa4(args.codeOrigin)}`;
      }
      return commandSuccessWith(cmdMessage);
    } else {
      await context.service.ideCommandsService.executeCommand(`set ${ZXBC_ALL}`);
      return commandSuccessWith("ZXBC settings removed");
    }
  }
}
