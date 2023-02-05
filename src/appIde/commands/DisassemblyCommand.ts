import { EmuGetMemoryResponse } from "@messaging/main-to-emu";
import { COMMAND_RESULT_EDITOR } from "@state/common-ids";
import {
  CommandResultData,
  InteractiveCommandContext,
  InteractiveCommandResult
} from "../abstractions";
import {
  writeSuccessMessage,
  commandSuccess,
  toHexa4
} from "../services/interactive-commands";
import { OutputContentLine } from "../ToolArea/abstractions";
import { OutputPaneBuffer } from "../ToolArea/OutputPaneBuffer";
import {
  DisassemblyOutput,
  MemorySection,
  MemorySectionType
} from "../z80-disassembler/disassembly-helper";
import { Z80Disassembler } from "../z80-disassembler/z80-disassembler";
import { CommandWithAddressRangeBase } from "./CommandWithAddressRange";

let disassemblyIndex = 1;

export class DisassemblyCommand extends CommandWithAddressRangeBase {
  readonly id = "dis";
  readonly description = "Disassembles the specified memory section";
  readonly usage = "dis <start> <end>";
  readonly aliases = [];

  protected extraArgCount = 0;

  async doExecute (
    context: InteractiveCommandContext
  ): Promise<InteractiveCommandResult> {
    const fromH = toHexa4(this.startAddress);
    const toH = toHexa4(this.endAddress);
    const lines = await this.getDisassembly(context);
    const title = `Result of running '${context.commandtext.trim()}'`
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
        lines
      } as CommandResultData,
      false
    );

    writeSuccessMessage(
      context.output,
      `Disassembly: $${fromH} - $${toH}: ${lines.length}`
    );
    return commandSuccess;
  }

  async getDisassembly (
    context: InteractiveCommandContext
  ): Promise<OutputContentLine[]> {
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
    const disassembler = new Z80Disassembler(memSections, memory, {
      noLabelPrefix: true
    });
    const disassItems = (await disassembler.disassemble(this.startAddress, this.endAddress)).outputItems;

    const buffer = new OutputPaneBuffer(0x1_0000);
    disassItems.forEach(item => {
      buffer.resetColor();
      buffer.write(`${toHexa4(item.address)} `);
      buffer.write(item.opCodes.padEnd(13, " "));
      buffer.color("green");
      buffer.write((item.hasLabel ? `L${toHexa4(item.address)}:` : "").padEnd(12, " ") );
      buffer.color("bright-cyan");
      buffer.writeLine(item.instruction);
    });
    console.log(buffer.getContents());
    return buffer.getContents();
  }
}
