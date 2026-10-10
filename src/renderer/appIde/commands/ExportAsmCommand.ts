import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";
import type { AppState } from "@common/state/AppState";
import type { SlotPaging } from "@common/annotations/bankSpace";
import type { ICustomDisassembler } from "../disassemblers/z80-disassembler/custom-disassembly";
import type { CustomDisassemblyContext } from "../disassemblers/z80-disassembler/rom-gated-disassembler";

import { bankSpaceFor } from "@common/annotations/bankSpace";
import { CT_CUSTOM_DISASSEMBLER } from "@common/machines/constants";
import { compareAssembly, dialectOf } from "@common/reverse/sourceExport";
import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  toHexa4,
  validationError,
  writeInfoMessage,
  writeSuccessMessage
} from "../services/ide-commands";
import { addressSymbolsForState } from "../annotations/useAddressSymbols";
import { machineConfigOf } from "../annotations/useMachineBankSpace";
import { getRomPartition } from "../annotations/romAnnotations";
import { customDisassemblyContextFor } from "../annotations/romDisassemblyGate";
import { buildExport, type ExportContext, type ExportScope } from "../reverse/exportRun";
import { activeSetForEditing } from "../reverse/detectionEnvironment";

type ExportAsmArgs = {
  file: string;
  from?: number;
  to?: number;
  "-bank"?: number;
  "-skip"?: string;
  "-dialect"?: string;
  "-open"?: boolean;
  "-noverify"?: boolean;
};

/** The export context for the machine running now: its bank space, names and custom decoding. */
export function exportContextFor(state: AppState, context: IdeCommandContext): ExportContext | undefined {
  const emu = state.emulatorState;
  const machineId = emu?.machineId;
  const bankSpace = bankSpaceFor(machineId, machineConfigOf(machineId, emu?.modelId, emu?.config));
  if (!bankSpace) return undefined;
  const { symbols } = addressSymbolsForState(state);
  const factory = context.service.machineService.getMachineInfo()?.machine?.toolInfo?.[CT_CUSTOM_DISASSEMBLER] as
    | ((context?: CustomDisassemblyContext) => ICustomDisassembler)
    | undefined;
  return {
    bankSpace,
    annotationPath: activeSetForEditing()?.path,
    romPartition: getRomPartition,
    projectService: context.service.projectService,
    externalNames: (slots: SlotPaging) => symbols.operandResolver(slots),
    prepareDisassembler:
      typeof factory === "function"
        ? (slots) => (disassembler) =>
            disassembler.setCustomDisassembler?.(
              factory(customDisassemblyContextFor(machineId, bankSpace, slots, (p) => getRomPartition(p)?.source))
            )
        : undefined,
    model: bankSpace.id === "next" ? "next" : undefined,
    // --- A 128K bank listed at $C000 is assembled into its bank (E-T6)
    bankDirectiveFor: ["sp128", "plus3", "scorpion"].includes(bankSpace.id)
      ? (bank, listingBase) => (listingBase === 0xc000 ? bank : undefined)
      : undefined
  };
}

/**
 * `export-asm`: export an annotated range or bank as Klive Z80 source that reassembles to the same
 * bytes (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §7.5, G7.6). After writing, the file is
 * assembled and compared with the bytes it came from (R10).
 */
export class ExportAsmCommand extends IdeCommandBase<ExportAsmArgs> {
  readonly id = "export-asm";
  readonly description = "Exports an annotated range or bank as Klive Z80 source that reassembles to the same bytes";
  readonly aliases = [];
  readonly usage = "export-asm <file> [<from> <to>] [-bank <n>] [-skip data|gap] [-dialect klive] [-open] [-noverify]";
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }],
    optional: [
      { name: "from", type: "number", minValue: 0, maxValue: 0xffff },
      { name: "to", type: "number", minValue: 0, maxValue: 0xffff }
    ],
    namedOptions: [
      { name: "-bank", type: "number" },
      { name: "-skip", type: "string" },
      { name: "-dialect", type: "string" }
    ],
    commandOptions: ["-open", "-noverify"]
  };

  async validateCommandArgs(context: IdeCommandContext, args: ExportAsmArgs): Promise<ValidationMessage[]> {
    const messages: ValidationMessage[] = [];
    const emu = context.store.getState().emulatorState;
    if (!bankSpaceFor(emu?.machineId)) messages.push(validationError("This machine's memory cannot be annotated."));
    if (args["-bank"] === undefined && (args.from === undefined || args.to === undefined)) {
      messages.push(validationError("Give a range (<from> <to>) or a bank (-bank <n>)."));
    }
    if (args.from !== undefined && args.to !== undefined && args.from > args.to) {
      messages.push(validationError("The range's start is after its end."));
    }
    const skip = args["-skip"]?.toLowerCase();
    if (skip !== undefined && skip !== "data" && skip !== "gap") messages.push(validationError("-skip: use data or gap"));
    if (!dialectOf(args["-dialect"]?.toLowerCase())) messages.push(validationError("-dialect: only klive is supported"));
    return messages;
  }

  async execute(context: IdeCommandContext, args: ExportAsmArgs): Promise<IdeCommandResult> {
    const state = context.store.getState();
    const exportContext = exportContextFor(state, context);
    if (!exportContext) return commandError("This machine's memory cannot be annotated.");
    const scope: ExportScope =
      args["-bank"] !== undefined
        ? {
            kind: "bank",
            bank: args["-bank"],
            ...(args.from !== undefined && args.to !== undefined ? { start: args.from & 0x3fff, end: args.to & 0x3fff } : {})
          }
        : { kind: "range", from: args.from!, to: args.to! };
    const where =
      scope.kind === "bank" ? `bank ${scope.bank}` : `$${toHexa4(scope.from)}-$${toHexa4(scope.to)}`;

    let result;
    try {
      result = await buildExport(context.emuApi, exportContext, scope, {
        skip: args["-skip"]?.toLowerCase() === "gap" ? "gap" : "data",
        header: [
          `Exported by Klive IDE: ${where}${state.emulatorState?.machineId ? ` on ${state.emulatorState.machineId}` : ""}`,
          ...(exportContext.annotationPath ? [`Annotations: ${exportContext.annotationPath.split(/[\\/]/).pop()}`] : [])
        ]
      });
    } catch (err) {
      return commandError(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    const dialect = dialectOf(args["-dialect"]?.toLowerCase())!;
    const text = dialect.render(result.lines);
    try {
      await context.mainApi.saveTextFile(args.file, text);
    } catch (err) {
      return commandError(`Cannot write ${args.file}: ${err instanceof Error ? err.message : String(err)}`);
    }
    writeSuccessMessage(context.output, `Exported ${where} to ${args.file}`);
    result.notes.forEach((note) => writeInfoMessage(context.output, note));

    if (!args["-noverify"]) {
      const verdict = await verifyExport(context, text, result.expected);
      writeInfoMessage(context.output, verdict);
    }
    if (args["-open"]) {
      const opened = await context.service.ideCommandsService.executeCommand(`nav "${args.file}"`);
      if (!opened.success) writeInfoMessage(context.output, "The file is not in the open project, so it was not opened.");
    }
    return commandSuccess;
  }
}

/** Assemble the export in the main process and compare it with the bytes (R10). */
export async function verifyExport(
  context: Pick<IdeCommandContext, "mainApi">,
  text: string,
  expected: { address: number; bytes: number[] }[]
): Promise<string> {
  try {
    const assembled = await context.mainApi.assembleText(text);
    const errors = assembled.errors.filter((e) => !e.isWarning);
    if (errors.length > 0) {
      return `Byte-identical: no — the export does not assemble (line ${errors[0].line}: ${errors[0].message}).`;
    }
    const verdict = compareAssembly(expected, assembled.segments);
    if (verdict.identical) return "Byte-identical: yes";
    const hex2 = (n?: number) => (n === undefined ? "--" : n.toString(16).toUpperCase().padStart(2, "0"));
    return (
      "Byte-identical: no — first differences: " +
      verdict.differences.map((d) => `$${toHexa4(d.address)} (${hex2(d.expected)} -> ${hex2(d.actual)})`).join(", ")
    );
  } catch (err) {
    return `Could not verify the export: ${err instanceof Error ? err.message : String(err)}`;
  }
}
