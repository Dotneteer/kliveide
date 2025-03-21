import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import {
  writeSuccessMessage,
  commandSuccess,
  IdeCommandBase,
  toBin16,
  commandError,
  toHexa2,
  toHexa4,
  toBin8,
} from "../services/ide-commands";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { incEmuViewVersionAction } from "@common/state/actions";

type SetZ80RegisterCommandArgs = {
  register: string;
  value: number;
};

const registerInfo = [
  { name: "A", size: 8 },
  { name: "F", size: 8 },
  { name: "B", size: 8 },
  { name: "C", size: 8 },
  { name: "D", size: 8 },
  { name: "E", size: 8 },
  { name: "H", size: 8 },
  { name: "L", size: 8 },
  { name: "AF", size: 16 },
  { name: "BC", size: 16 },
  { name: "DE", size: 16 },
  { name: "HL", size: 16 },
  { name: "AF'", size: 16 },
  { name: "BC'", size: 16 },
  { name: "DE'", size: 16 },
  { name: "HL'", size: 16 },
  { name: "IX", size: 16 },
  { name: "IY", size: 16 },
  { name: "SP", size: 16 },
  { name: "PC", size: 16 },
  { name: "I", size: 8 },
  { name: "R", size: 8 },
  { name: "XL", size: 8 },
  { name: "XH", size: 8 },
  { name: "YL", size: 8 },
  { name: "YH", size: 8 },
  { name: "WZ", size: 16 }
];

export class SetZ80RegisterCommand extends IdeCommandBase<SetZ80RegisterCommandArgs> {
  readonly id = "setz80reg";
  readonly description = "Sets the value of the specified Z80 register";
  readonly usage = "setz80reg <register> <value>";
  readonly aliases = ["sr"];
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [
      { name: "register", type: "string" },
      { name: "value", type: "number" }
    ]
  };

  async execute(
    context: IdeCommandContext,
    args: SetZ80RegisterCommandArgs
  ): Promise<IdeCommandResult> {
    // --- Check if the machine is paused
    const machineState = context.store.getState().emulatorState.machineState;
    if (machineState !== MachineControllerState.Paused) {
      return commandError("The machine must be paused to set Z80 registers.");
    }

    // --- Use a valid register name
    const regInfo = registerInfo.find((ri) => ri.name === args.register.toUpperCase());
    if (!regInfo) {
      return commandError(`Invalid register name: ${args.register}`);
    }

    // --- Check the value
    const outp = context.output;
    outp.color("yellow"); 
    if (regInfo.size === 8 && (args.value < 0 || args.value > 0xff)) {
      outp.writeLine(
        `Warning: Value (${args.value}) for ${regInfo.name} is out of range; only the last 8 bit will be used.`
      );
      args.value &= 0xff;
    } else if (regInfo.size === 16 && (args.value < 0 || args.value > 0xffff)) {
      outp.writeLine(
        `Warning: Value (${args.value}) for ${regInfo.name} is out of range; only the last 16 bit will be used.`
      );
      args.value &= 0xffff;
    }
    outp.resetStyle();

    await context.emuApi.setRegisterValue(args.register, args.value);
    context.store.dispatch(incEmuViewVersionAction(), "ide");

    writeSuccessMessage(
      context.output,
      `Z80 ${regInfo.name} register value is set to ${args.value} ` +
        `($${regInfo.size === 8 ? toHexa2(args.value) : toHexa4(args.value)}, ` +
        `${regInfo.size === 8 ? toBin8(args.value) : toBin16(args.value)})`
    );
    return commandSuccess;
  }
}
