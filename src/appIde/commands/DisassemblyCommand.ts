import { EmuGetMemoryResponse } from "@common/messaging/main-to-emu";
import { COMMAND_RESULT_EDITOR } from "@common/state/common-ids";
import { CommandResultData } from "../abstractions/CommandResultData";
import { InteractiveCommandContext } from "../abstractions/InteractiveCommandContext";
import { InteractiveCommandResult } from "../abstractions/InteractiveCommandResult";
import {
  toHexa4,
  writeSuccessMessage,
  commandSuccess
} from "../services/interactive-commands";
import { OutputPaneBuffer } from "../ToolArea/OutputPaneBuffer";
import {
  MemorySection,
  MemorySectionType
} from "../z80-disassembler/disassembly-helper";
import { Z80Disassembler } from "../z80-disassembler/z80-disassembler";
import { CommandWithAddressRangeBase } from "./CommandWithAddressRange";

let disassemblyIndex = 1;

export class DisassemblyCommand extends CommandWithAddressRangeBase {
  readonly id = "dis";
  readonly description =
    "Disassembles the specified memory section. " +
    "Options: '-c': concise output; '-s': close with semicolon; " +
    "'-lc': terminate labels with colon";
  readonly usage = "dis <start> <end> [-c] [-s] [-lc]";
  readonly aliases = [];

  protected extraArgCount: number;

  async doExecute (
    context: InteractiveCommandContext
  ): Promise<InteractiveCommandResult> {
    const fromH = toHexa4(this.startAddress);
    const toH = toHexa4(this.endAddress);
    const buffer = await this.getDisassembly(context);
    const lines = buffer.getContents();
    const bufferText = buffer.getBufferText();
    const title = `Result of running '${context.commandtext.trim()}'`;
    context.service.documentService.openDocument(
      {
        id: `disOutput-${disassemblyIndex++}`,
        name: `Disassembly ($${fromH}-$${toH})`,
        type: COMMAND_RESULT_EDITOR,
        iconName: "disassembly-icon",
        iconFill: "--console-ansi-bright-green"
      },
      {
        title,
        lines,
        bufferText
      } as CommandResultData,
      false
    );

    writeSuccessMessage(
      context.output,
      `Disassembly of address range $${fromH} - $${toH} successfully created`
    );
    return commandSuccess;
  }

  async getDisassembly (
    context: InteractiveCommandContext
  ): Promise<OutputPaneBuffer> {
    const conciseMode = context.argTokens.some(t => t.text === "-c");
    const useSemicolons = context.argTokens.some(t => t.text === "-s");
    const useColons = context.argTokens.some(t => t.text === "-lc");

    // --- Get the memory
    const response = (await context.messenger.sendMessage({
      type: "EmuGetMemory"
    })) as EmuGetMemoryResponse;
    const memory = response.memory;

    // --- Specify memory sections to disassemble
    const memSections: MemorySection[] = [];

    // --- Use the memory segments according to the "ram" and "screen" flags
    memSections.push(
      new MemorySection(
        this.startAddress,
        this.endAddress,
        MemorySectionType.Disassemble
      )
    );

    // --- Disassemble the specified memory segments
    const disassembler = new Z80Disassembler(memSections, memory, {});
    const disassItems = (
      await disassembler.disassemble(this.startAddress, this.endAddress)
    ).outputItems;

    const buffer = new OutputPaneBuffer(0x1_0000);
    disassItems.forEach(item => {
      buffer.resetColor();
      if (!conciseMode) {
        buffer.write(`${toHexa4(item.address)} `);
        buffer.write(item.opCodes.padEnd(13, " "));
      }
      buffer.color("green");
      buffer.write(
        (item.hasLabel
          ? `L${toHexa4(item.address)}${useColons ? ":" : ""}`
          : ""
        ).padEnd(12, " ")
      );
      buffer.color("bright-cyan");
      buffer.writeLine(`${item.instruction}${useSemicolons ? ";" : ""}`);
    });
    return buffer;
  }
}
