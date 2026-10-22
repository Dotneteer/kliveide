import type { IOutputBuffer } from "@renderer/appIde/ToolArea/abstractions";
import { isDataPragma, splitInstructionNames } from "@renderer/controls/data/DisassemblyText";
import { addressSymbolsForState } from "@renderer/appIde/annotations/useAddressSymbols";
import { COMMAND_RESULT_EDITOR } from "@state/common-ids";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import {
  toHexa4,
  writeSuccessMessage,
  commandSuccess,
  IdeCommandBase,
  toHexa2,
  toDecimal5,
  toDecimal3
} from "../services/ide-commands";
import { OutputPaneBuffer } from "../ToolArea/OutputPaneBuffer";
import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { MemorySection } from "../disassemblers/common-types";
import { Z80Disassembler } from "../disassemblers/z80-disassembler/z80-disassembler";
import { MemorySectionType } from "@abstractions/MemorySection";
import { t } from "@common/i18n/i18n";

let disassemblyIndex = 1;

type DisassemblyCommandArgs = {
  startAddress: number;
  endAddress: number;
  "-d": boolean;
  "-c": boolean;
  "-lc": boolean;
};

export class DisassemblyCommand extends IdeCommandBase<DisassemblyCommandArgs> {
  readonly id = "dis";
  get description() {
    return t("commands.dis.description");
  }
  readonly usage = "dis <start> <end> [-d] [-c] [-lc]";
  readonly aliases = [];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [
      { name: "startAddress", type: "number" },
      { name: "endAddress", type: "number" }
    ],
    commandOptions: ["-d", "-c", "-lc"]
  };

  async execute(
    context: IdeCommandContext,
    args: DisassemblyCommandArgs
  ): Promise<IdeCommandResult> {
    const fromH = toHexa4(args.startAddress);
    const toH = toHexa4(args.endAddress);
    const buffer = await this.getDisassembly(context, args);
    const title = t("commands.common.resultTitle", { command: context.commandtext.trim() });
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    await documentHubService.openDocument(
      {
        id: `disOutput-${disassemblyIndex++}`,
        name: t("commands.dis.documentName", { from: fromH, to: toH }),
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

    writeSuccessMessage(context.output, t("commands.dis.created", { from: fromH, to: toH }));
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

    // --- Names from the shared resolver: build symbols, the active annotations, the ROM's labels,
    // --- under the paging this very read reported (§4.4 of the reverse-engineering plan)
    const slots = getMemoryResponse.slotPartitions;
    const { symbols } = addressSymbolsForState(context.store.getState());

    // --- Disassemble the specified memory segments
    const decimalMode = args["-d"];
    const disassembler = new Z80Disassembler(memSections, memory, partitions, {
      allowExtendedSet: true,
      decimalMode,
      operandLabelResolver: symbols.operandResolver(slots)
    });
    const disassItems = (await disassembler.disassemble(args.startAddress, args.endAddress))
      .outputItems;

    const buffer = new OutputPaneBuffer(0x1_0000);
    // --- The disassembly colour set, as every listing shows it (`--color-disassembly-*`)
    disassItems.forEach((item) => {
      buffer.resetStyle();
      if (!args["-c"]) {
        buffer.color("disasm-address");
        buffer.write((decimalMode ? toDecimal5(item.address) : toHexa4(item.address)) + " ");
        buffer.color("disasm-opcodes");
        buffer.write(
          item.opCodes
            .map((oc) => (decimalMode ? toDecimal3(oc) : toHexa2(oc)))
            .join(" ")
            .padEnd(decimalMode ? 17 : 13, " ")
        );
      }
      buffer.color("disasm-label");
      buffer.bold(true);
      const name = symbols.labelAt(item.address, slots)?.name;
      const label = name
        ? name
        : item.hasLabel
          ? `L${decimalMode ? toDecimal5(item.address) : toHexa4(item.address)}`
          : "";
      buffer.write((label && args["-lc"] ? `${label}:` : label).padEnd(12, " "));
      writeInstructionSpans(
        buffer,
        item.instruction,
        (item.operandCandidates ?? []).map((operand) => operand.resolvedText).filter((name): name is string => !!name)
      );
      buffer.resetStyle();
      buffer.writeLine();
    });
    return buffer;
  }
}

/**
 * Writes an instruction in the disassembly colours: bold, in the directive hue for data and the
 * instruction hue otherwise, each substituted name in the operand hue (`splitInstructionNames`).
 */
export function writeInstructionSpans(buffer: IOutputBuffer, instruction: string, names: readonly string[]): void {
  const role = isDataPragma(instruction) ? "disasm-directive" : "disasm-instruction";
  buffer.bold(true);
  for (const part of splitInstructionNames(instruction, names)) {
    if (typeof part === "string") {
      buffer.color(role);
      buffer.write(part);
    } else {
      buffer.color("disasm-operand");
      buffer.bold(false);
      buffer.write(part.label);
      buffer.bold(true);
    }
  }
}
