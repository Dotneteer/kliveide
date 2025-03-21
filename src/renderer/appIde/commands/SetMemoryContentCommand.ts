import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
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
  readonly description =
    "Sets the specified 1, 2, 3, or 4 bytes of memory content. Options: " +
    "-b8, -b16, -b24, -b32: Number of bits; -be: Big-endian";
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
      return commandError("Only one of the -b8, -b16, -b24, -b32 options can be used");
    }

    // --- Check for big-endian option
    const bigEndian = args["-be"] ?? false;

    // --- Check the value
    const outp = context.output;
    outp.color("yellow"); 
    if (size === 8 && (args.value < 0 || args.value > 0xff)) {
      outp.writeLine(
        `Warning: Value (${args.value}) is out of range; only the last 8 bit will be used.`
      );
      args.value &= 0xff;
    } else if (size === 16 && (args.value < 0 || args.value > 0xffff)) {
      outp.writeLine(
        `Warning: Value (${args.value}) is out of range; only the last 16 bit will be used.`
      );
      args.value &= 0xffff;
    } else if (size === 24 && (args.value < 0 || args.value > 0xffffff)) {
      outp.writeLine(
        `Warning: Value (${args.value}) is out of range; only the last 24 bit will be used.`
      );
      args.value &= 0xffffff;
    } else if (size === 32 && (args.value < 0 || args.value > 0xffffffff)) {
      outp.writeLine(
        `Warning: Value (${args.value}) is out of range; only the last 32 bit will be used.`
      );
      args.value &= 0xffffffff;
    }
    outp.resetStyle();

    context.emuApi.setMemoryContent(args.address, args.value, size, bigEndian);
    context.store.dispatch(incEmuViewVersionAction(), "ide");

    writeSuccessMessage(context.output, "Memory content set");
    return commandSuccess;
  }
}
