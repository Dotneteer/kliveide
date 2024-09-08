import { COMMAND_RESULT_EDITOR } from "@state/common-ids";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import {
  toHexa4,
  writeSuccessMessage,
  commandSuccess,
  IdeCommandBaseNew
} from "../services/ide-commands";
import { OutputPaneBuffer } from "../ToolArea/OutputPaneBuffer";
import { MemorySection, MemorySectionType } from "../z80-disassembler/disassembly-helper";
import { Z80Disassembler } from "../z80-disassembler/z80-disassembler";
import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";

let disassemblyIndex = 1;

type DisassemblyCommandArgs = {
  startAddress: number;
  endAddress: number;
  "-c": boolean;
  "-lc": boolean;
};

export class DisassemblyCommand extends IdeCommandBaseNew<DisassemblyCommandArgs> {
  readonly id = "dis";
  readonly description =
    "Disassembles the specified memory section. " +
    "Options: '-c': concise output; '-lc': terminate labels with semicolon";
  readonly usage = "dis <start> <end> [-c] [-lc]";
  readonly aliases = [];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [
      { name: "startAddress", type: "number" },
      { name: "endAddress", type: "number" }
    ],
    commandOptions: ["-c", "-lc"]
  };

  async execute(
    context: IdeCommandContext,
    args: DisassemblyCommandArgs
  ): Promise<IdeCommandResult> {
    const fromH = toHexa4(args.startAddress);
    const toH = toHexa4(args.endAddress);
    const buffer = await this.getDisassembly(context, args);
    const title = `Result of running '${context.commandtext.trim()}'`;
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    await documentHubService.openDocument(
      {
        id: `disOutput-${disassemblyIndex++}`,
        name: `Disassembly ($${fromH}-$${toH})`,
        type: COMMAND_RESULT_EDITOR,
        iconName: "disassembly-icon",
        iconFill: "--console-ansi-bright-green",
        contents: {
          title,
          buffer
        } as any
      },
      false
    );

    writeSuccessMessage(
      context.output,
      `Disassembly of address range $${fromH} - $${toH} successfully created`
    );
    return commandSuccess;
  }

  async getDisassembly(
    context: IdeCommandContext,
    args: DisassemblyCommandArgs
  ): Promise<OutputPaneBuffer> {
    // --- Get the memory
    const getMemoryResponse = await context.emuApi.getMemoryContents();

    const memory = getMemoryResponse.memory;
    const partitions = getMemoryResponse.partitionLabels;

    // --- Specify memory sections to disassemble
    const memSections: MemorySection[] = [];

    // --- Use the memory segments according to the "ram" and "screen" flags
    memSections.push(
      new MemorySection(args.startAddress, args.endAddress, MemorySectionType.Disassemble)
    );

    // --- Disassemble the specified memory segments
    const disassembler = new Z80Disassembler(memSections, memory, partitions, {
      allowExtendedSet: true
    });
    const disassItems = (await disassembler.disassemble(args.startAddress, args.endAddress))
      .outputItems;

    const buffer = new OutputPaneBuffer(0x1_0000);
    disassItems.forEach((item) => {
      buffer.resetStyle();
      if (!args["-c"]) {
        buffer.write(`${toHexa4(item.address)} `);
        buffer.write(item.opCodes.padEnd(13, " "));
      }
      buffer.color("green");
      buffer.write(
        (item.hasLabel ? `L${toHexa4(item.address)}${args["-lc"] ? ":" : ""}` : "").padEnd(12, " ")
      );
      buffer.color("bright-cyan");
      buffer.writeLine(item.instruction);
    });
    return buffer;
  }
}
