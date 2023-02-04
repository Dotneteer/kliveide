import { COMMAND_RESULT_EDITOR } from "@state/common-ids";
import {
  InteractiveCommandContext,
  InteractiveCommandResult
} from "../abstractions";
import {
  writeSuccessMessage,
  commandSuccess,
  toHexa4
} from "../services/interactive-commands";
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
    context.service.documentService.openDocument(
      {
        id: `disOutput-${disassemblyIndex++}`,
        name: `Disassembly ($${fromH}-$${toH})`,
        type: COMMAND_RESULT_EDITOR,
        iconName: "disassembly-icon",
        iconFill: "--console-ansi-bright-green"
      },
      12345,
      false
    );

    writeSuccessMessage(context.output, `Disassembly: $${fromH} - $${toH}`);
    return commandSuccess;
  }
}
