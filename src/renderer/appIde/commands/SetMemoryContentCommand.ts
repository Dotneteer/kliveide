import { t } from "@common/i18n/i18n";
import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { takeOverBeforeEdit } from "./reverseDebugFork";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import { writeSuccessMessage, commandSuccess, IdeCommandBase, commandError } from "../services/ide-commands";
import { incEmuViewVersionAction } from "@common/state/actions";

type SetMemoryContentCommandArgs = {
  address: number;
  value: number;
  "-b8"?: boolean;
  "-b16"?: boolean;
  "-b24"?: boolean;
  "-b32"?: boolean;
  "-be"?: boolean;
};

export class SetMemoryContentCommand extends IdeCommandBase<SetMemoryContentCommandArgs> {
  readonly id = "setmem";
  get description() {
    return t("commands.memory.description");
  }
  readonly usage = "setmem <address> <value> [-b8] [-b16] [-b24] [-b32] [-be]";
  readonly aliases = ["sm"];
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [
      { name: "address", type: "number", minValue: 0, maxValue: 0xffff },
      { name: "value", type: "number" }
    ],
    commandOptions: ["-b8", "-b16", "-b24", "-b32", "-be"]
  };

  async execute(
    context: IdeCommandContext,
    args: SetMemoryContentCommandArgs
  ): Promise<IdeCommandResult> {
    // --- Check for options
    let size = 8;
    let optionCount = 0;
    if (args["-b8"]) {
      size = 8;
      optionCount++;
    }
    if (args["-b16"]) {
      size = 16;
      optionCount++;
    }
    if (args["-b24"]) {
      size = 24;
      optionCount++;
    }
    if (args["-b32"]) {
      size = 32;
      optionCount++;
    }
    if (optionCount > 1) {
      return commandError(t("commands.memory.oneSize"));
    }

    // --- Check for big-endian option
    const bigEndian = args["-be"] ?? false;

    // --- Check the value
    const outp = context.output;
    outp.color("yellow"); 
    if (size === 8 && (args.value < 0 || args.value > 0xff)) {
      outp.writeLine(t("commands.memory.outOfRange", { value: String(args.value), bits: "8" }));
      args.value &= 0xff;
    } else if (size === 16 && (args.value < 0 || args.value > 0xffff)) {
      outp.writeLine(t("commands.memory.outOfRange", { value: String(args.value), bits: "16" }));
      args.value &= 0xffff;
    } else if (size === 24 && (args.value < 0 || args.value > 0xffffff)) {
      outp.writeLine(t("commands.memory.outOfRange", { value: String(args.value), bits: "24" }));
      args.value &= 0xffffff;
    } else if (size === 32 && (args.value < 0 || args.value > 0xffffffff)) {
      outp.writeLine(t("commands.memory.outOfRange", { value: String(args.value), bits: "32" }));
      args.value &= 0xffffffff;
    }
    outp.resetStyle();

    // --- An edit in the past changes the past: take over there first, after asking (REVERSE_DEBUGGING_PLAN D12)
    if (!(await takeOverBeforeEdit(context, { kind: "editMemory" }))) {
      writeSuccessMessage(context.output, t("commands.memory.canceled"));
      return commandSuccess;
    }
    await context.emuApi.setMemoryContent(args.address, args.value, size, bigEndian);
    context.store.dispatch(incEmuViewVersionAction(), "ide");

    writeSuccessMessage(context.output, t("commands.memory.set"));
    return commandSuccess;
  }
}
