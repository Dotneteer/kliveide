import type {
  BinarySegment,
  CompilerOutput,
  InjectableOutput,
  KliveCompilerOutput
} from "@abstractions/CompilerInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { CodeToInject, UnitTestDebugInfo } from "@abstractions/CodeToInject";
import { TapeDataBlock } from "@common/structs/TapeDataBlock";

import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  commandSuccessWith,
  toHexa2,
  toHexa4
} from "@renderer/appIde/services/ide-commands";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { BinaryReader } from "@utils/BinaryReader";
import { TapReader } from "@emu/machines/tape/TapReader";
import { TzxReader } from "@emu/machines/tape/TzxReader";
import { SpectrumTapeHeader } from "@emu/machines/tape/SpectrumTapeHeader";
import { BinaryWriter } from "@utils/BinaryWriter";
import { TzxHeader } from "@emu/machines/tape/TzxHeader";
import { TzxStandardSpeedBlock } from "@emu/machines/tape/TzxStandardSpeedBlock";
import {
  incInjectionVersionAction,
  setProjectDebuggingAction
} from "@common/state/actions";
import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { hasSourceLevelDebug, isInjectableCompilerOutput } from "@renderer/appIde/utils/compiler-utils";
import { nexFileNameOf, sdCardNexName } from "@renderer/appIde/utils/nex-file-name";
import { createSourceDebugSidecar, sidecarProgramOf, sourceDebugSidecarPath } from "@common/utils/source-debug-sidecar";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { machineRegistry } from "@common/machines/machine-registry";
import { MF_INJECT_SUPPORT, MI_Z88, MI_ZX80, MI_ZX81, MI_HT1080Z, MI_ZXNEXT } from "@common/machines/constants";
import {
  zx8081ExportFile,
  zx8081ExportFormatOf,
  zx8081InjectionProblem
} from "@renderer/appIde/utils/zx8081-code";
import { NexFileWriter } from "@main/z80-compiler/nex-file-writer";
import type { IOutputBuffer } from "@renderer/appIde/ToolArea/abstractions";
import {
  buildDiagnosticsValue,
  compileCode,
  modelTypeToMachineType
} from "@renderer/appIde/utils/compile-code";
import { t } from "@common/i18n/i18n";
import {
  describeHt1080zPlacementProblem,
  isHt1080zPlacementProblem,
  placeHt1080zCode
} from "@common/ht1080z/codePlacement";
import { resolveHt1080zHardware } from "@emu/machines/ht1080z/ht1080zMachineInfo";
import { ht1080zExportFile, ht1080zExportFormatOf, ht1080zFormatProblem } from "../utils/ht1080z-code";

const EXPORT_FILE_FOLDER = "KliveExports";

export type CodeInjectionType = "inject" | "run" | "debug";

export class KliveBuildCommand extends IdeCommandBase {
  readonly id = "klive.build";
  get description() {
    return t("commands.compile.build.description");
  }
  readonly usage = "klive.build";
  readonly aliases = ["kl.b"];
  //readonly noInteractiveUsage = true;

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const compileResult = await compileCode(context);
    if (compileResult.message) {
      return commandError(compileResult.message);
    }

    return commandSuccessWith(t("commands.compile.compiled"));
  }
}

export class KliveCompileCommand extends IdeCommandBase {
  readonly id = "klive.compile";
  get description() {
    return t("commands.compile.compile.description");
  }
  readonly usage = "klive.compile";
  readonly aliases = ["kl.co"];
  readonly noInteractiveUsage = true;

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const compileResult = await compileCode(context);
    return compileResult.message
      ? commandError(compileResult.message)
      : commandSuccessWith(t("commands.compile.compiled"));
  }
}

export class KliveInjectCodeCommand extends IdeCommandBase {
  readonly id = "klive.inject";
  get description() {
    return t("commands.compile.inject.description");
  }
  readonly usage = "klive.inject";
  readonly aliases = ["kl.inj"];
  readonly noInteractiveUsage = true;

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    return await injectCode(context, "inject");
  }
}

export class KliveRunCodeCommand extends IdeCommandBase {
  readonly id = "klive.run";
  get description() {
    return t("commands.compile.run.description");
  }
  readonly usage = "klive.run";
  readonly aliases = ["kl.r"];
  readonly noInteractiveUsage = true;

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    context.store.dispatch(setProjectDebuggingAction(false), "ide");
    const result = await injectCode(context, "run");
    return result;
  }
}

export class KliveDebugCodeCommand extends IdeCommandBase {
  readonly id = "klive.debug";
  get description() {
    return t("commands.compile.debug.description");
  }
  readonly usage = "klive.debug";
  readonly aliases = ["kl.rd"];
  readonly noInteractiveUsage = true;

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    context.store.dispatch(setProjectDebuggingAction(true), "ide");
    return await injectCode(context, "debug");
  }
}

type ExportCommandArgs = {
  filename: string;
  "-n"?: string;
  "-f"?: string;
  "-as"?: boolean;
  "-p"?: boolean;
  "-c"?: boolean;
  "-b"?: number;
  "-sb"?: boolean;
  "-addr"?: number;
  "-scr"?: string;
};

export class ExportCodeCommand extends IdeCommandBase<ExportCommandArgs> {
  readonly id = "expc";
  get description() {
    return t("commands.compile.export.description");
  }
  readonly usage =
    "expc filename [-n name] [-f tap|tzx|hex|nex|p|o|cmd|cas|dsk|epr] [-as] [-p] [-c] [-b border] [-sb] [-addr address] [-scr screenfile]";

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "filename" }],
    commandOptions: ["-as", "-p", "-c", "-sb"],
    namedOptions: [
      { name: "-n" },
      { name: "-f" },
      { name: "-as" },
      { name: "-b", type: "number", minValue: 0, maxValue: 7 },
      { name: "-addr", type: "number", minValue: 16384, maxValue: 65535 },
      { name: "-scr", type: "string" }
    ]
  };

  readonly requiresProject = true;

  async execute(context: IdeCommandContext, args: ExportCommandArgs): Promise<IdeCommandResult> {
    // --- Compile before export
    const { message, result } = await compileCode(context);
    const errorNo = result?.errors?.length ?? 0;
    if (message) {
      if (!result) {
        return commandError(message);
      }
      if (errorNo > 0) {
        await context.service.ideCommandsService.executeCommand("outp build");
        return commandError(t("commands.compile.failedWithErrors"), buildDiagnosticsValue(result));
      }
    }

    if (!isInjectableCompilerOutput(result)) {
      return commandError(t("commands.compile.notInjectable"));
    }

    return this.exportCompiledCode(context, result, args);
  }

  async exportCompiledCode(
    context: IdeCommandContext,
    output: KliveCompilerOutput,
    args: ExportCommandArgs
  ): Promise<IdeCommandResult> {
    // --- A C build (z88dk) exports the native file appmake wrote instead of rebuilding it
    // --- (`.plans/Z88DK_INTEGRATION_PLAN.md` §7); `.nex` takes the NEX path below, which uses it too
    const z88dkExport = await exportZ88dkArtefact(context, output, args);
    if (z88dkExport) return z88dkExport;

    const emulatorState = context.store.getState().emulatorState;

    // --- HT-1080Z code exports as a .cmd load module or a .cas SYSTEM tape (`HT1080Z_CODE_INJECTION_PLAN.md` D6)
    const htFormat = ht1080zExportFormatOf((output as CompilerOutput).modelType, emulatorState?.machineId);
    if (htFormat) {
      const htRequested = args["-f"] ?? htFormat;
      const problem = ht1080zFormatProblem(htRequested);
      if (problem) return commandError(problem);
      if (htRequested === "cmd" || htRequested === "cas") {
        const file = ht1080zExportFile(
          htRequested,
          output as CompilerOutput,
          emulatorState?.machineId,
          emulatorState?.config,
          args["-n"] ?? args.filename
        );
        if ("error" in file) return commandError(file.error);
        try {
          const filePath = await context.mainApi.saveBinaryFile(args.filename, file.data, `kliveHome:${EXPORT_FILE_FOLDER}`);
          return commandSuccessWith(t("commands.compile.exported", { file: filePath }), { file: filePath });
        } catch (err) {
          return commandError(err.toString());
        }
      }
    }

    // --- A ZX80/ZX81 program exports as the machine's own program file (`ZX8081_CODE_INJECTION_PLAN.md` D8)
    const zxFormat = zx8081ExportFormatOf(
      (output as CompilerOutput).modelType,
      emulatorState?.machineId,
      emulatorState?.config
    );
    const format = args["-f"] ?? zxFormat;
    if (format === "p" || format === "o") {
      const file = zx8081ExportFile(
        format,
        output as CompilerOutput,
        emulatorState?.machineId,
        emulatorState?.config,
        !!args["-as"]
      );
      if ("error" in file) return commandError(file.error);
      try {
        const filePath = await context.mainApi.saveBinaryFile(
          args.filename,
          file.data,
          `kliveHome:${EXPORT_FILE_FOLDER}`
        );
        return commandSuccessWith(t("commands.compile.exported", { file: filePath }), { file: filePath });
      } catch (err) {
        return commandError(err.toString());
      }
    }
    if (zxFormat && format !== "hex") {
      return commandError(
        t("commands.compile.zx8081Format", { machine: zxFormat === "p" ? "ZX81" : "ZX80", format: zxFormat })
      );
    }

    // --- Check if this is a NEX file export (based on explicit format or .savenex pragma)
    // --- Respect explicit format choice: only use NEX if format is "nex" or if no format is specified and nexConfig exists
    if (args["-f"] === "nex" || ((output as CompilerOutput).nexConfig && !args["-f"])) {
      return await this.exportNexFile(context, output, args);
    }

    if (args["-f"] == "hex") {
      return await saveIntelHexFile(context, args.filename, output);
    }

    // --- Check for screen file error
    let scrContent: Uint8Array;
    const screenFile = args["-scr"];
    let screenFileType = 0;
    if (screenFile) {
      // --- Check the validity of the screen file
      scrContent = (await context.service.projectService.readFileContent(
        screenFile,
        true
      )) as Uint8Array;
      context.service.projectService.forgetFile(screenFile);
      screenFileType = checkScreenFileType(scrContent);
      if (!screenFileType) {
        return commandError(t("commands.compile.invalidScreenFile", { file: screenFile }));
      }
    }

    // --- Step #6: Create code segments
    const codeBlocks = createTapeBlocks(output as InjectableOutput);
    let screenBlocks: Uint8Array[] | undefined;
    if (screenFile) {
      switch (screenFileType) {
        case 1:
          screenBlocks = createScreenDataBlocks(screenFile, scrContent);
          break;
        case 2:
          screenBlocks = createScreenDataBlocks(screenFile, scrContent.slice(128));
          break;
        case 3:
          const blocks = readTapeData(scrContent);
          if (blocks) {
            screenBlocks = [blocks[0].data, blocks[1].data];
          }
          break;
      }
    }

    // --- Step #7: Create Auto Start header block, if required
    const blocksToSave: Uint8Array[] = [];

    // --- A compiler that writes its own tape (a banked Boriel BASIC program, whose loader must page
    // --- the banks as its runtime expects) hands over the tape's bytes: they are saved as they are
    const prebuiltTape = (output as { prebuiltTape?: number[] }).prebuiltTape;
    if (prebuiltTape) {
      const blocks = readTapeData(new Uint8Array(prebuiltTape));
      if (!blocks) return commandError(t("commands.compile.prebuiltTapeUnreadable"));
      const ignored = ["-as", "-n", "-b", "-scr", "-c", "-p", "-sb", "-addr"].filter((o) => {
        const value = (args as Record<string, unknown>)[o];
        return value !== undefined && value !== false;
      });
      if (ignored.length) {
        context.output.color("yellow");
        context.output.writeLine(
          t("commands.compile.prebuiltTapeIgnored", { options: ignored.join(", "), count: ignored.length })
        );
        context.output.resetStyle();
      }
      blocksToSave.push(...blocks.map((b) => b.data));
      return await saveDataBlocks();
    }
    let address = args["-addr"];
    if (address === undefined) {
      address =
        (output as CompilerOutput).exportEntryAddress ??
        (output as CompilerOutput).entryAddress ??
        (output as CompilerOutput).segments[0].startAddress;
    }

    if (args["-as"]) {
      const autoStartBlocks = createAutoStartBlock(output as CompilerOutput);
      blocksToSave.push(...autoStartBlocks);

      // --- Step #8: Save all the blocks
      if (screenBlocks) {
        blocksToSave.push(...screenBlocks);
      }
    }

    blocksToSave.push(...codeBlocks);
    return await saveDataBlocks();

    // --- Reads tape data from the specified contents
    function readTapeData(contents: Uint8Array): TapeDataBlock[] | null {
      let dataBlocks: TapeDataBlock[] = [];
      try {
        const reader = new BinaryReader(contents);
        const tzxReader = new TzxReader(reader);
        let result = tzxReader.readContent();
        if (result) {
          reader.seek(0);
          const tapReader = new TapReader(reader);
          result = tapReader.readContent();
          if (result) {
            // --- Not a TZX or a TAP file
            return null;
          } else {
            dataBlocks = tapReader.dataBlocks;
          }
        } else {
          dataBlocks = tzxReader.dataBlocks.map((b) => b.getDataBlock()).filter((b) => b);
        }
        return dataBlocks;
      } catch {
        return null;
      }
    }

    function checkScreenFileType(contents: Uint8Array): number {
      // --- Check for 6912 bytes
      if (contents.length === 6912) {
        // --- Standard screen file
        return 1;
      }

      if (contents.length === 7040) {
        return 2;
      }

      // --- Try to read a .TZX file
      const dataBlocks = readTapeData(contents);
      if (!dataBlocks) {
        return 0;
      }

      // --- Block lengths should be 19 and 6914
      var header = dataBlocks[0].data;
      if (header.length !== 19 || dataBlocks[1].data.length != 6914) {
        // --- Problem with block length
        return 0;
      }

      // --- Test header bytes
      return header[0] === 0x00 &&
        header[1] == 0x03 && // --- Code header
        header[12] == 0x00 &&
        header[13] == 0x1b && // --- Length: 0x1B00
        header[14] == 0x00 &&
        header[15] == 0x40 // --- Address: 0x4000
        ? 3
        : 0;
    }

    function createScreenDataBlocks(filename: string, contents: Uint8Array): Uint8Array[] {
      // --- Create a ZX Spectrum Tape header
      const segments = filename.split("/");
      const header = new Uint8Array(19);
      header[0] = 0x00; // --- Header ID
      header[1] = 0x03; // --- Code block

      // --- Copy the first (up to 10) characters of the filename into the tape header
      const name = segments[segments.length - 1].slice(0, 10).padEnd(10, " ");
      for (let i = 0; i < 10; i++) {
        header[2 + i] = name.charCodeAt(i);
      }
      header[12] = 0x00; // --- Length LSB
      header[13] = 0x1b; // --- Length MSB
      header[14] = 0x00; // --- Param1 LSB
      header[15] = 0x40; // --- Param1 MSB
      header[16] = 0x00; // --- Param2 LSB
      header[17] = 0x80; // --- Param2 MSB
      setTapeCheckSum(header);

      // --- Create a new Uint8Array starting with 0xff and followed by the contents
      const screenData = new Uint8Array(contents.length + 2);
      screenData[0] = 0xff;
      screenData.set(contents, 1);
      setTapeCheckSum(screenData);

      return [header, screenData];
    }

    // --- Create tap blocks
    function createTapeBlocks(output: InjectableOutput): Uint8Array[] {
      var result: Uint8Array[] = [];
      if (output.segments.map((s) => s.emittedCode.length).reduce((a, b) => a + b, 0) === 0) {
        // --- No code to return
        return null;
      }

      if (args["-sb"]) {
        // --- Merge all blocks together
        const startAddr = Math.min(...output.segments.map((s) => s.startAddress));
        const endAddr = Math.max(
          ...output.segments
            .filter((s) => s.bank == undefined)
            .map((s) => s.startAddress + s.emittedCode.length - 1)
        );

        // --- Normal code segments
        const mergedSegment = new Uint8Array(endAddr - startAddr + 3);
        for (const segment of output.segments.filter((s) => s.bank == undefined)) {
          for (let i = 0; i < segment.emittedCode.length; i++) {
            mergedSegment[segment.startAddress - startAddr + 1 + i] = segment.emittedCode[i];
          }
        }

        // --- The first byte of the merged segment is 0xFF (Data block)
        mergedSegment[0] = 0xff;
        setTapeCheckSum(mergedSegment);

        // --- Create the single header
        var singleHeader = new SpectrumTapeHeader();
        singleHeader.type = 3; // --- Code block
        singleHeader.name = args["-n"];
        singleHeader.dataLength = mergedSegment.length - 2;
        singleHeader.parameter1 = startAddr;
        singleHeader.parameter2 = 0x8000;
        // --- Create the two tape blocks (header + data)
        result.push(singleHeader.headerBytes);
        result.push(mergedSegment);
      } else {
        // --- Create separate block for each segment
        let segmentIdx = 0;

        // --- Normal code segments
        for (const segment of output.segments.filter((s) => s.bank == null)) {
          segmentIdx++;
          const startAddr = segment.startAddress;
          const endAddr = segment.startAddress + segment.emittedCode.length - 1;

          const codeSegment = new Uint8Array(endAddr - startAddr + 3);
          for (let i = 0; i < segment.emittedCode.length; i++) {
            codeSegment[i + 1] = segment.emittedCode[i];
          }

          // --- The first byte of the code segment is 0xFF (Data block)
          codeSegment[0] = 0xff;
          setTapeCheckSum(codeSegment);

          // --- Create the single header
          const header = new SpectrumTapeHeader();
          (header.type = 3), // --- Code block
            (header.name = `${segmentIdx}_${args["-n"]}`),
            (header.dataLength = (codeSegment.length - 2) & 0xffff),
            (header.parameter1 = startAddr),
            (header.parameter2 = 0x8000);

          // --- Create the two tape blocks (header + data)
          result.push(header.headerBytes);
          result.push(codeSegment);
        }
      }

      // --- Create blocks for the banks
      const segments = output.segments.filter((s) => s.bank != null);
      segments.sort((a, b) => a.bank - b.bank);
      for (const bankSegment of segments) {
        const startAddr = (0xc000 + bankSegment.bankOffset) & 0xffff;
        const endAddr = startAddr + bankSegment.emittedCode.length - 1;

        const codeSegment = new Uint8Array(endAddr - startAddr + 3);
        for (let i = 0; i < bankSegment.emittedCode.length; i++) {
          codeSegment[i + 1] = bankSegment.emittedCode[i];
        }

        // --- The first byte of the code segment is 0xFF (Data block)
        codeSegment[0] = 0xff;
        setTapeCheckSum(codeSegment);

        // --- Create the single header
        const header = new SpectrumTapeHeader();
        header.type = 3; // --- Code block
        header.name = `bank${bankSegment.bank}.code`;
        header.dataLength = (codeSegment.length - 2) & 0xffff;
        header.parameter1 = startAddr;
        header.parameter2 = 0x8000;

        // --- Create the two tape blocks (header + data)
        result.push(header.headerBytes);
        result.push(codeSegment);
      }

      // --- Done
      return result;
    }

    // --- Sets the checksum byte for a tape block
    function setTapeCheckSum(bytes: Uint8Array): void {
      let chk = 0x00;
      for (let i = 0; i < bytes.length - 1; i++) {
        chk ^= bytes[i];
      }

      bytes[bytes.length - 1] = chk & 0xff;
    }

    // --- Saves an Intel HEX file
    async function saveIntelHexFile(
      context: IdeCommandContext,
      filename: string,
      output: KliveCompilerOutput
    ): Promise<IdeCommandResult> {
      const rowLen = 0x10;
      let hexOut = "";

      for (const segment of (output as InjectableOutput).segments) {
        var offset = 0;
        while (offset + rowLen < segment.emittedCode.length) {
          // --- Write an entire data row
          writeDataRecord(segment, offset, rowLen);
          offset += rowLen;
        }

        // --- Write the left of the data row
        var leftBytes = segment.emittedCode.length - offset;
        writeDataRecord(segment, offset, leftBytes);
      }

      // --- Write End-Of-File record
      hexOut += ":00000001FF";

      // --- Save the data to a file
      try {
        const path = await context.mainApi.saveTextFile(
          filename,
          hexOut,
          `kliveHome:${EXPORT_FILE_FOLDER}`
        );
        return commandSuccessWith(t("commands.compile.exported", { file: path }), { file: path });
      } catch (err) {
        return commandError(err.toString());
      }

      // --- Write out a single data record
      function writeDataRecord(segment: BinarySegment, offset: number, bytesCount: number): void {
        if (bytesCount === 0) return;
        var addr = ((segment.xorgValue ?? segment.startAddress) + offset) & 0xffff;
        hexOut += `:${toHexa2(bytesCount)}${toHexa4(addr)}00`; // --- Data record header
        let checksum = bytesCount + (addr >> 8) + (addr & 0xff);
        for (var i = offset; i < offset + bytesCount; i++) {
          var data = segment.emittedCode[i];
          checksum += data;
          hexOut += `${toHexa2(data)}`;
        }
        const chk = (256 - (checksum & 0xff)) & 0xff;
        hexOut += `${toHexa2(chk)}\r\n`;
      }
    }

    // --- Creates blocks with autostart functionality
    function createAutoStartBlock(output: CompilerOutput): Uint8Array[] {
      const clearAddr = args["-c"]
        ? Math.min(...(output as InjectableOutput).segments.map((s) => s.startAddress))
        : null;
      return output.modelType == SpectrumModelType.Spectrum48 ||
        output.segments.filter((s) => s.bank != undefined).length === 0
        ? // --- No banks to emit, use the ZX Spectrum 48 auto-loader format
          createSpectrum48StartBlock(output, clearAddr)
        : // --- There are banks to emit, use the ZX Spectrum 128 auto-loader format
          createSpectrum128StartBlock(output, clearAddr);
    }

    // --- Auto start block for ZX Spectrum 48
    function createSpectrum48StartBlock(output: CompilerOutput, clearAddr?: number): Uint8Array[] {
      const result: Uint8Array[] = [];

      // --- Step #1: Create the code line for auto start
      const codeLine: number[] = [];
      if (clearAddr !== undefined && clearAddr >= 0x6000) {
        // --- Add clear statement
        codeLine.push(CLEAR_TKN);
        writeNumber(codeLine, clearAddr - 1);
        codeLine.push(COLON);
      }

      // --- Add optional border color
      if (args["-b"] != null) {
        codeLine.push(BORDER_TKN);
        writeNumber(codeLine, args["-b"] & 0x07);
        codeLine.push(COLON);
      }

      // --- Add optional screen loader, LET o = PEEK 23739 : LOAD "" SCREEN$ : POKE 23739,111
      if (args["-scr"]) {
        codeLine.push(LET_TKN);
        writeString(codeLine, "o=");
        codeLine.push(PEEK_TKN);
        writeNumber(codeLine, 23739);
        codeLine.push(COLON);
        codeLine.push(LOAD_TKN);
        codeLine.push(DQUOTE);
        codeLine.push(DQUOTE);
        codeLine.push(SCREEN_TKN);
        codeLine.push(COLON);
        codeLine.push(POKE_TKN);
        writeNumber(codeLine, 23739);
        codeLine.push(COMMA);
        writeNumber(codeLine, 111);
        codeLine.push(COLON);
      }

      // --- Add 'LOAD "" CODE' for each block
      if (args["-sb"]) {
        codeLine.push(LOAD_TKN);
        codeLine.push(DQUOTE);
        codeLine.push(DQUOTE);
        codeLine.push(CODE_TKN);
        codeLine.push(COLON);
      } else {
        for (var i = 0; i < output.segments.length; i++) {
          codeLine.push(LOAD_TKN);
          codeLine.push(DQUOTE);
          codeLine.push(DQUOTE);
          codeLine.push(CODE_TKN);
          codeLine.push(COLON);
        }
      }

      // --- Add 'PAUSE 0'
      if (args["-p"]) {
        codeLine.push(PAUSE_TKN);
        writeNumber(codeLine, 0);
        codeLine.push(COLON);
      }

      // --- Some SCREEN$ related poking
      if (args["-scr"]) {
        codeLine.push(POKE_TKN);
        writeNumber(codeLine, 23739);
        writeString(codeLine, ",o:");
      }

      // --- Add 'RANDOMIZE USR address'
      codeLine.push(RAND_TKN);
      codeLine.push(USR_TKN);
      writeNumber(codeLine, address);

      // --- Complete the line
      codeLine.push(NEW_LINE);

      // --- Step #2: Now, complete the data block
      // --- Allocate extra 6 bytes: 1 byte - header, 2 byte - line number
      // --- 2 byte - line length, 1 byte - checksum
      const dataBlock = new Uint8Array(codeLine.length + 6);
      for (let i = 0; i < codeLine.length; i++) dataBlock[i + 5] = codeLine[i];
      dataBlock[0] = 0xff;
      // --- Set line number to 10. Line number uses MSB/LSB order
      dataBlock[1] = 0x00;
      dataBlock[2] = 10;
      // --- Set line length
      dataBlock[3] = codeLine.length & 0xff;
      dataBlock[4] = (codeLine.length >> 8) & 0xff;
      setTapeCheckSum(dataBlock);

      // --- Step #3: Create the header
      const header = new SpectrumTapeHeader();
      // --- Program block
      header.type = 0;
      header.name = args["-n"];
      header.dataLength = (dataBlock.length - 2) & 0xffff;
      // --- Auto-start at Line 10
      header.parameter1 = 10;
      // --- Variable area offset
      header.parameter2 = (dataBlock.length - 2) & 0xffff;

      // --- Step #4: Retrieve the auto start header and data block for save
      result.push(header.headerBytes);
      result.push(dataBlock);
      return result;
    }

    // --- Auto start block for ZX Spectrum 128
    function createSpectrum128StartBlock(output: CompilerOutput, clearAddr?: number): Uint8Array[] {
      const result: Uint8Array[] = [];

      // --- We keep the code lines here
      var lines: number[][] = [];

      // --- Create placeholder for the paging code (line 10)
      var codeLine: number[] = [];
      codeLine.push(REM_TKN);
      writeString(codeLine, "012345678901234567890");
      codeLine.push(NEW_LINE);
      lines.push(codeLine);

      // --- Create code for CLEAR/PEEK program address (line 20)
      codeLine = [];
      if (clearAddr !== undefined && clearAddr >= 0x6000) {
        // --- Add clear statement
        codeLine.push(CLEAR_TKN);
        writeNumber(codeLine, (clearAddr - 1) & 0xffff);
        codeLine.push(COLON);
      }

      // --- Add "LET c=(PEEK 23635 + 256*PEEK 23636)+5
      codeLine.push(LET_TKN);
      writeString(codeLine, "c=(");
      codeLine.push(PEEK_TKN);
      writeNumber(codeLine, 23635);
      writeString(codeLine, "+");
      writeNumber(codeLine, 256);
      writeString(codeLine, "*");
      codeLine.push(PEEK_TKN);
      writeNumber(codeLine, 23636);
      writeString(codeLine, ")+");
      writeNumber(codeLine, 5);
      codeLine.push(NEW_LINE);
      lines.push(codeLine);

      // --- Setup the machine code
      codeLine = [];
      codeLine.push(FOR_TKN);
      writeString(codeLine, "i=");
      writeNumber(codeLine, 0);
      codeLine.push(TO_TKN);
      writeNumber(codeLine, 20);
      codeLine.push(COLON);
      codeLine.push(READ_TKN);
      writeString(codeLine, "d:");
      codeLine.push(POKE_TKN);
      writeString(codeLine, "c+i,d:");
      codeLine.push(NEXT_TKN);
      writeString(codeLine, "i");
      codeLine.push(NEW_LINE);
      lines.push(codeLine);

      // --- Create code for BORDER/SCREEN and loading normal code blocks (line 30)
      codeLine = [];
      if (args["-b"] !== undefined) {
        codeLine.push(BORDER_TKN);
        writeNumber(codeLine, args["-b"] & 0xff);
        codeLine.push(COLON);
      }

      // --- Add optional screen loader, LET o = PEEK 23739:LOAD "" SCREEN$ : POKE 23739,111
      if (args["-scr"]) {
        codeLine.push(LET_TKN);
        writeString(codeLine, "o=");
        codeLine.push(PEEK_TKN);
        writeNumber(codeLine, 23739);
        codeLine.push(COLON);
        codeLine.push(LOAD_TKN);
        codeLine.push(DQUOTE);
        codeLine.push(DQUOTE);
        codeLine.push(SCREEN_TKN);
        codeLine.push(COLON);
        codeLine.push(POKE_TKN);
        writeNumber(codeLine, 23739);
        codeLine.push(COMMA);
        writeNumber(codeLine, 111);
        codeLine.push(COLON);
      }

      // --- Add 'LOAD "" CODE' for each block
      codeLine.push(LOAD_TKN);
      codeLine.push(DQUOTE);
      codeLine.push(DQUOTE);
      codeLine.push(CODE_TKN);

      codeLine.push(NEW_LINE);
      lines.push(codeLine);

      // --- Code for reading banks
      codeLine = [];
      codeLine.push(READ_TKN);
      writeString(codeLine, "b");
      codeLine.push(NEW_LINE);
      lines.push(codeLine);

      // --- "IF b = 8 THEN GO TO 80";
      codeLine = [];
      codeLine.push(IF_TKN);
      writeString(codeLine, "b=");
      writeNumber(codeLine, 8);
      codeLine.push(THEN_TKN);
      codeLine.push(GOTO_TKN);
      writeNumber(codeLine, 80);
      codeLine.push(NEW_LINE);
      lines.push(codeLine);

      // --- "POKE 23608,b: RANDOMIZE USR c: LOAD "" CODE: GO TO 50"
      codeLine = [];
      codeLine.push(POKE_TKN);
      writeNumber(codeLine, 23608);
      writeString(codeLine, ",b:");
      codeLine.push(RAND_TKN);
      codeLine.push(USR_TKN);
      writeString(codeLine, "c:");
      codeLine.push(LOAD_TKN);
      codeLine.push(DQUOTE);
      codeLine.push(DQUOTE);
      codeLine.push(CODE_TKN);
      codeLine.push(COLON);
      codeLine.push(GOTO_TKN);
      writeNumber(codeLine, 50);
      codeLine.push(NEW_LINE);
      lines.push(codeLine);

      // --- Finishing
      codeLine = [];

      // --- PAUSE and START
      if (args["-p"]) {
        codeLine.push(PAUSE_TKN);
        writeNumber(codeLine, 0);
        codeLine.push(COLON);
      }
      if (args["-scr"]) {
        codeLine.push(POKE_TKN);
        writeNumber(codeLine, 23739);
        writeString(codeLine, ",o:");
      }

      // --- Add 'RANDOMIZE USR address: STOP'
      codeLine.push(RAND_TKN);
      codeLine.push(USR_TKN);
      writeNumber(codeLine, address);
      codeLine.push(COLON);
      codeLine.push(STOP_TKN);
      codeLine.push(NEW_LINE);
      lines.push(codeLine);

      // --- Add data lines with the machine code subroutine
      /*
            di                  243
            ld a, ($5b5c)       58,92,91
            and $f8              240, 248
            ld b, a             71
  
            ld a, ($5c38)       58,56,92
            or b                176
  
            ld ($5b5c),a        50,92,91
  
            ld bc, ($7ffd)      1,253,127
            out (c), a          237,121
            ei                  251
            ret                 201
        */
      codeLine = [];
      writeDataStatement(
        codeLine,
        [
          243, 58, 92, 91, 230, 248, 71, 58, 56, 92, 176, 50, 92, 91, 1, 253, 127, 237, 121, 251,
          201
        ]
      );
      lines.push(codeLine);

      // --- Add data lines with used banks and terminating 8
      codeLine = [];
      const banks = output.segments.filter((s) => s.bank != null).map((s) => s.bank);
      banks.sort((a, b) => a - b);
      banks.push(8);
      writeDataStatement(codeLine, banks);
      lines.push(codeLine);

      // --- All code lines are set up, create the file blocks
      const dataBlock = createDataBlockForCodeLines(lines);
      const header = new SpectrumTapeHeader();
      // --- Program block
      header.type = 0;
      header.name = args["-n"];
      header.dataLength = (dataBlock.length - 2) & 0xffff;
      // --- Auto-start at Line 10
      header.parameter1 = 10;
      // --- Variable area offset
      header.parameter2 = (dataBlock.length - 2) & 0xffff;

      // --- Step #4: Retrieve the auto start header and data block for save
      result.push(header.headerBytes);
      result.push(dataBlock);
      return result;
    }

    function writeNumber(codeArray: number[], num: number) {
      // --- Number in string form
      for (const ch of num.toString()) codeArray.push(ch.charCodeAt(0));
      codeArray.push(NUMB_SIGN);
      // --- Five bytes as the short form of an integer
      codeArray.push(0x00);
      codeArray.push(0x00);
      codeArray.push(num);
      codeArray.push(num >> 8);
      codeArray.push(0x00);
    }

    function writeString(codeArray: number[], str: string) {
      for (const ch of str) codeArray.push(ch.charCodeAt(0));
    }

    function writeDataStatement(codeLine: number[], data: number[]) {
      codeLine.push(DATA_TKN);
      let comma = false;
      for (const item of data) {
        if (comma) {
          writeString(codeLine, ",");
        }
        writeNumber(codeLine, item);
        comma = true;
      }
      codeLine.push(NEW_LINE);
    }

    function createDataBlockForCodeLines(lines: number[][]): Uint8Array {
      const length = lines.map((cl) => cl.length + 4).reduce((a, b) => a + b, 0) + 2;
      const dataBlock: Uint8Array = new Uint8Array(length);
      dataBlock[0] = 0xff;
      let index = 1;
      let lineNo = 10;
      for (const line of lines) {
        // --- Line number in MSB/LSB format
        dataBlock[index++] = (lineNo >> 8) & 0xff;
        dataBlock[index++] = lineNo & 0xff;

        // --- Set line length in LSB/MSB format
        dataBlock[index++] = line.length & 0xff;
        dataBlock[index++] = (line.length >> 8) & 0xff;

        // --- Copy the code line
        for (let i = 0; i < line.length; i++) {
          dataBlock[i + index] = line[i];
        }

        // --- Move to the next line
        index += line.length;
        lineNo += 10;
      }
      setTapeCheckSum(dataBlock);
      return dataBlock;
    }

    // --- Save the collected data blocks
    async function saveDataBlocks(): Promise<IdeCommandResult> {
      const writer = new BinaryWriter();
      try {
        // --- Save data blocks
        if (args["-f"] === "tzx") {
          const header = new TzxHeader();
          header.writeTo(writer);
          for (const block of blocksToSave) {
            const tzxBlock = new TzxStandardSpeedBlock();
            tzxBlock.data = block;
            tzxBlock.dataLength = block.length & 0xffff;
            tzxBlock.writeTo(writer);
          }
        } else {
          for (const block of blocksToSave) {
            writer.writeUint16(block.length & 0xffff);
            writer.writeBytes(block);
          }
        }

        // --- Save the data to a file
        if (args.filename) {
          try {
            const filePath = await context.mainApi.saveBinaryFile(
              args.filename,
              writer.buffer,
              `kliveHome:${EXPORT_FILE_FOLDER}`
            );
            return commandSuccessWith(t("commands.compile.exported", { file: filePath }), { file: filePath });
          } catch (err) {
            return commandError(err.toString());
          }
        }
        return commandSuccess;
      } catch (err) {
        return commandError(err.toString());
      }
    }
  }

  /**
   * Export code as NEX file for ZX Spectrum Next
   */
  async exportNexFile(
    context: IdeCommandContext,
    output: KliveCompilerOutput,
    args: ExportCommandArgs
  ): Promise<IdeCommandResult> {
    try {
      // --- Cast to CompilerOutput since we need to access NEX-specific properties
      const compiledOutput = output as CompilerOutput;

      // --- Ensure we're targeting Next model
      if (compiledOutput.modelType !== SpectrumModelType.Next) {
        return commandError(t("commands.compile.nexNeedsModel"));
      }

      // --- Ensure we have NEX configuration
      if (!compiledOutput.nexConfig) {
        return commandError(t("commands.compile.nexNeedsSavenex"));
      }

      // --- Determine output filename
      const filename = args.filename || compiledOutput.nexConfig.filename;
      if (!filename) {
        return commandError(t("commands.compile.nexNeedsFilename"));
      }

      // --- Get the base directory for resolving relative paths
      const state = context.store.getState();
      const projectRoot = state.project?.folderPath;
      if (!projectRoot) {
        return commandError(t("commands.compile.noProject"));
      }

      // --- A compiler that writes its own NEX (Boriel BASIC's zxbc) hands over the file's bytes
      const prebuiltNex = (output as { prebuiltNex?: number[] }).prebuiltNex;
      if (prebuiltNex) {
        const prebuiltPath = await context.mainApi.saveBinaryFile(
          filename,
          new Uint8Array(prebuiltNex),
          `kliveHome:${EXPORT_FILE_FOLDER}`
        );
        await context.mainApi.copyToSdCard(
          prebuiltPath,
          "_klive/" + sdCardNexName(compiledOutput.nexConfig.filename, prebuiltPath)
        );
        // --- The same debug sidecar Klive BASIC's NEX gets, so `nex-run -d` debugs it at source level
        if (hasSourceLevelDebug(output)) {
          const sidecarFile = await context.mainApi.saveTextFile(
            sourceDebugSidecarPath(prebuiltPath),
            createSourceDebugSidecar(new Uint8Array(prebuiltNex), output.sourceLevelDebug, sidecarProgramOf(output))
          );
          return commandSuccessWith(
            t("commands.compile.prebuiltNexWithSidecar", {
              file: prebuiltPath,
              bytes: prebuiltNex.length,
              sidecar: sidecarFile
            })
          );
        }
        return commandSuccessWith(
          t("commands.compile.prebuiltNex", { file: prebuiltPath, bytes: prebuiltNex.length })
        );
      }

      // --- Generate NEX file data. Problems the writer works around (code it drops or may
      // --- truncate) still produce a file, so they are shown as warnings rather than failing.
      const nexWarnings: string[] = [];
      const nexData = await NexFileWriter.fromAssemblerOutput(
        compiledOutput as any,
        projectRoot,
        async (filename) => await context.mainApi.readBinaryFile(filename),
        (message) => nexWarnings.push(message)
      );
      writeNexWarnings(context.output, nexWarnings);

      // --- Save the NEX file
      const filePath = await context.mainApi.saveBinaryFile(
        filename,
        nexData,
        `kliveHome:${EXPORT_FILE_FOLDER}`
      );

      await context.mainApi.copyToSdCard(
        filePath,
        "_klive/" + sdCardNexName(compiledOutput.nexConfig.filename, filePath)
      );

      // --- Source-level debug info (Klive BASIC, plan §8.5) goes beside the NEX, so `nex-run` can
      // --- debug the file at source level without a rebuild
      let sidecarPath: string | undefined;
      if (hasSourceLevelDebug(output)) {
        sidecarPath = await context.mainApi.saveTextFile(
          sourceDebugSidecarPath(filePath),
          createSourceDebugSidecar(nexData, output.sourceLevelDebug, sidecarProgramOf(output))
        );
      }

      // --- Build summary message
      const bankCount = compiledOutput.segments.filter(
        (s) => s.bank !== undefined && s.bank !== null
      ).length;
      const hasScreens =
        compiledOutput.nexConfig.screens && compiledOutput.nexConfig.screens.length > 0;
      const hasPalette = compiledOutput.nexConfig.paletteFile !== undefined;
      const hasCopper = compiledOutput.nexConfig.copperFile !== undefined;

      // --- One line per fact; the RAM, bank and entry values are invariant figures
      const lines = [
        t("commands.compile.nex.exported", { file: filePath }),
        t("commands.compile.nex.size", { bytes: nexData.length }),
        t("commands.compile.nex.ram", { size: compiledOutput.nexConfig.ramSize }),
        t("commands.compile.nex.banks", { count: bankCount }),
        t("commands.compile.nex.entry", {
          address: `0x${(compiledOutput.nexConfig.entryAddr ?? compiledOutput.entryAddress ?? 0).toString(16).toUpperCase()}`
        })
      ];
      if (hasScreens) lines.push(t("commands.compile.nex.loadingScreen"));
      if (hasPalette) lines.push(t("commands.compile.nex.palette"));
      if (hasCopper) lines.push(t("commands.compile.nex.copper"));
      if (compiledOutput.nexConfig.loadingBar.enabled) lines.push(t("commands.compile.nex.loadingBar"));
      if (sidecarPath) lines.push(t("commands.compile.nex.sidecar", { file: sidecarPath }));
      if (nexWarnings.length > 0) lines.push(t("commands.compile.nex.warnings", { count: nexWarnings.length }));
      const summary = lines.join("\n  ");

      return commandSuccessWith(summary, { file: filePath });
    } catch (err) {
      return commandError(t("commands.compile.nexFailed", { error: err.toString() }));
    }
  }
}

/**
 * Writes the NEX writer's warnings to the build output, styled and marked like the assembler's
 * own warnings.
 *
 * They go to the output rather than into the command's result text because `run` and `debug`
 * export the NEX too and discard that result: written here, the user sees them on every path.
 */
/** The project's build root is a C file (z88dk builds it). */
function isCBuildRoot(context: IdeCommandContext): boolean {
  const roots = context.store.getState().project?.buildRoots ?? [];
  return roots.some((root: string) => /\.c$/i.test(root));
}

/**
 * The native file a z88dk build wrote for the requested format (`tap`, `p`, `o`, `dsk`, `epr`),
 * copied to the export file; undefined when the build is not a z88dk one, or has no such file and
 * Klive's own exporter should make it (`tap`, `tzx`, `hex`, `nex`, `p`, `o`).
 */
async function exportZ88dkArtefact(
  context: IdeCommandContext,
  output: KliveCompilerOutput,
  args: ExportCommandArgs
): Promise<IdeCommandResult | undefined> {
  const artefacts = (output as { z88dkArtefacts?: Record<string, string> }).z88dkArtefacts;
  if (!artefacts) return undefined;
  const requested = (args["-f"] ?? defaultZ88dkExportFormat(artefacts, args.filename) ?? "").toLowerCase();
  const key = ({ tap: "tap", p: "P", o: "O", dsk: "dsk", epr: "epr" } as Record<string, string>)[requested];
  const source = key ? artefacts[key] : undefined;
  if (!source) {
    if (requested === "dsk" || requested === "epr") {
      return commandError(
        t("commands.compile.z88dkNoArtefact", { format: requested, available: Object.keys(artefacts).join(", ") || "-" })
      );
    }
    return undefined;
  }
  const ignored = ["-as", "-n", "-b", "-scr", "-c", "-p", "-sb", "-addr"].filter((o) => {
    const value = (args as Record<string, unknown>)[o];
    return value !== undefined && value !== false;
  });
  if (ignored.length) {
    context.output.color("yellow");
    context.output.writeLine(t("commands.compile.z88dkOptionsIgnored", { options: ignored.join(", "), count: ignored.length }));
    context.output.resetStyle();
  }
  try {
    const bytes = await context.mainApi.readBinaryFile(source);
    const filePath = await context.mainApi.saveBinaryFile(args.filename, bytes, `kliveHome:${EXPORT_FILE_FOLDER}`);
    return commandSuccessWith(t("commands.compile.z88dkExported", { file: filePath, bytes: bytes.length }), { file: filePath });
  } catch (err) {
    return commandError(String(err));
  }
}

/** With no `-f`: the export file's extension, else the one native file the build has (a +3's `.dsk`). */
function defaultZ88dkExportFormat(artefacts: Record<string, string>, filename: string): string | undefined {
  const ext = /\.([A-Za-z0-9]+)$/.exec(filename ?? "")?.[1]?.toLowerCase();
  if (ext && ["tap", "tzx", "hex", "nex", "p", "o", "dsk", "epr"].includes(ext)) return ext;
  const own = Object.keys(artefacts);
  return own.length === 1 ? own[0].toLowerCase() : undefined;
}

export function writeNexWarnings(out: IOutputBuffer, warnings: readonly string[]): void {
  for (const warning of warnings) {
    out.severity("warning");
    out.color("yellow");
    out.bold(true);
    out.write(`${t("commands.compile.nexWarningPrefix")} `);
    out.bold(false);
    out.write(warning);
    out.writeLine();
    out.resetStyle();
  }
}

/**
 * Compiles the build root and injects the result into the machine.
 *
 * ## Why this is exported, and why it lives here
 *
 * There were two of these, one per compiler command file, and unlike the two `compileCode`s they
 * had genuinely diverged — seven user-visible differences, both copies reachable from live UI:
 * `ExecutionControls` drives `run`/`debug`, while the document toolbar reaches `klive.inject` and
 * friends through build.ksx. They were merged onto *this* behaviour, so `run` and `debug` now also
 * export a NEX file for ZX Next builds, lock the compiled source list while debugging, and pass the
 * exported path to `runCodeCommand`; they no longer raise a modal for a successful injection or for
 * zero-length output, the command result already says both.
 *
 * It stays in this module rather than moving to `utils/` beside `compileCode` because the NEX step
 * calls `ExportCodeCommand.exportCompiledCode`, which is defined below and is far too entangled to
 * follow it. `CompilerCommand.ts` importing from here is one-directional; the reverse import does
 * not exist.
 *
 * One difference was deliberately left unresolved: the paused-machine check below fires only for
 * ZX Next, where the other copy required a paused machine before any injection. That is a safety
 * rule, not a style choice, and it is being revisited separately.
 */
export async function injectCode(
  context: IdeCommandContext,
  operationType: CodeInjectionType,
  unitTestOf?: (result: KliveCompilerOutput) => UnitTestDebugInfo | string
): Promise<IdeCommandResult> {
  /*
   * Refused before compiling, not after: there is nothing to do with the output on a machine that
   * cannot take injected code, so building it first only wastes the user's time.
   *
   * The document header hides the Inject button for these machines, but the button is not the only
   * way in — `inject` is a command, reachable from the prompt and from a script — so the rule lives
   * here as well as in the UI. Run and debug deliver the code by whatever route the machine does
   * support: for the Next that is the exported `.nex` file below. A machine with no such route (the
   * Cambridge Z88, whose memory OZ owns) refuses them too, rather than "running" code it never
   * delivered.
   */
  {
    const machineId = context.store.getState().emulatorState?.machineId;
    const machine = machineRegistry.find((mi) => mi.machineId === machineId);
    // --- The Z88 runs a C program (z88dk) as a card application: Run and Debug go on to build it
    const z88CardRoute = machineId === MI_Z88 && operationType !== "inject" && isCBuildRoot(context);
    if (machine && machine.features?.[MF_INJECT_SUPPORT] === false && !z88CardRoute) {
      if (operationType === "inject") {
        return commandError(
          machine.machineId === MI_ZXNEXT
            ? t("commands.compile.noInjectUseRun", { machine: machine.displayName })
            : t("commands.compile.noInject", { machine: machine.displayName })
        );
      }
      if (machine.machineId !== MI_ZXNEXT) {
        return commandError(t("commands.compile.noRoute", { machine: machine.displayName }));
      }
    }
  }

  // --- A debug run builds with the debug profile (plan §8.6): code the debugger can follow exactly
  const { message, result } = await compileCode(context, operationType === "debug" ? "debug" : "build");
  const errorNo = result?.errors?.length ?? 0;
  if (message) {
    if (!result) {
      return commandError(message);
    }
    if (errorNo > 0) {
      await context.service.ideCommandsService.executeCommand("outp build");
      return commandError(t("commands.compile.failedNoInjection"), buildDiagnosticsValue(result));
    }
  }

  if (!isInjectableCompilerOutput(result)) {
    return commandError(t("commands.compile.notInjectable"));
  }

  // --- Handle ZX Spectrum Next: export NEX file instead of code injection
  const compiledOutput = result as CompilerOutput;
  let additionalInfo: any = null;
  const isZxNext = compiledOutput.modelType === SpectrumModelType.Next;

  // --- Debug one unit test (`.plans/Z80_UNIT_TESTS_PLAN.md` D12): the test and its labels
  let unitTest: UnitTestDebugInfo | undefined;
  if (unitTestOf) {
    const resolved = unitTestOf(result);
    if (typeof resolved === "string") return commandError(resolved);
    if (isZxNext) {
      return commandError(t("commands.compile.unitTestOnNext"));
    }
    unitTest = resolved;
  }
  if (isZxNext && compiledOutput.nexConfig) {
    // --- Export NEX file for Next model. Without `.savenex file` the name comes from the project
    // --- folder; the exported file, its SD card copy and the file the run loads share it
    const nexName = nexFileNameOf(compiledOutput.nexConfig.filename, context.store.getState().project?.folderPath);
    const exportCmd = new ExportCodeCommand();
    const args: ExportCommandArgs = {
      filename: nexName
    };

    // --- Stop the machine before exporting
    await context.emuApi.issueMachineCommand("stop");
    await exportCmd.exportCompiledCode(context, result, args);
    additionalInfo = "_klive/" + nexName;
  }

  // --- A C build for the Z88 is a card application: into the slot, soft reset, □ + its key (§7)
  const z88Card = (result as { z88Card?: { file: string; sizeKb: number; appKey: string } }).z88Card;
  if (context.store.getState().emulatorState?.machineId === MI_Z88) {
    if (!z88Card) return commandError(t("commands.compile.noRoute", { machine: "Cambridge Z88" }));
    if (operationType === "debug") {
      context.service.projectService.setLockedFiles((result.sourceFileList ?? []).map((f) => f.filename));
    }
    try {
      await context.emuApi.setSourceDebugInfo(hasSourceLevelDebug(result) ? result.sourceLevelDebug : undefined);
    } catch {
      // --- An emulator without source stepping keeps instruction stepping
    }
    await context.emuApi.startZ88Application(z88Card.file, z88Card.sizeKb, z88Card.appKey, operationType === "debug");
    context.output.writeLine(t("commands.compile.z88CardStarted", { file: z88Card.file, key: z88Card.appKey }));
    context.store.dispatch(incInjectionVersionAction());
    return commandSuccessWith(
      operationType === "debug" ? t("commands.compile.startedDebug") : t("commands.compile.started")
    );
  }

  // --- A C build for the ZX80/ZX81 (z88dk, `.plans/Z88DK_INTEGRATION_PLAN.md` §5.2) brings its own
  // --- program file: Run and Debug load it as `tape-load -r`/`-d` does, Inject has nothing to place
  const programFile = (result as { programFile?: string }).programFile;
  if (programFile) {
    const machineId = context.store.getState().emulatorState?.machineId;
    const machine = machineRegistry.find((mi) => mi.machineId === machineId)?.displayName ?? machineId ?? "";
    if (operationType === "inject") return commandError(t("commands.compile.programFileNoInject", { machine }));
    let bytes: Uint8Array;
    try {
      bytes = await context.mainApi.readBinaryFile(programFile);
    } catch (err) {
      return commandError(t("commands.tapeLoad.readFailed", { file: programFile, error: String(err) }));
    }
    const insertError = await context.mainApi.setTapeFile(programFile);
    if (insertError) return commandError(insertError);
    if (operationType === "debug") {
      context.service.projectService.setLockedFiles((result.sourceFileList ?? []).map((f) => f.filename));
    }
    try {
      await context.emuApi.setSourceDebugInfo(hasSourceLevelDebug(result) ? result.sourceLevelDebug : undefined);
    } catch {
      // --- An emulator without source stepping keeps instruction stepping
    }
    await context.emuApi.startTapeLoad(operationType === "debug");
    context.output.writeLine(t("commands.compile.programFileLoaded", { file: programFile, bytes: bytes.length, machine }));
    context.store.dispatch(incInjectionVersionAction());
    return commandSuccessWith(
      operationType === "debug" ? t("commands.compile.startedDebug") : t("commands.compile.started")
    );
  }

  let sumCodeLength = 0;
  result.segments.forEach((s) => (sumCodeLength += s.emittedCode.length));
  if (sumCodeLength === 0) {
    return commandSuccessWith(t("commands.compile.emptyCode"));
  }

  // --- The ZX80/ZX81 put the code in a 1 REM line: refuse here what the machine could not lay out
  const emulatorState = context.store.getState().emulatorState;
  const isZx8081 = emulatorState?.machineId === MI_ZX80 || emulatorState?.machineId === MI_ZX81;
  const zx8081Problem = zx8081InjectionProblem(
    emulatorState?.machineId,
    emulatorState?.config,
    result.segments,
    result.entryAddress,
    !!unitTest
  );
  if (zx8081Problem) return commandError(zx8081Problem);

  // --- The HT-1080Z takes code in RAM it can protect from BASIC (`.plans/HT1080Z_CODE_INJECTION_PLAN.md` D2)
  const isHt1080z = emulatorState?.machineId === MI_HT1080Z;
  // --- Another machine's code (a Spectrum build from sjasmplus or Klive BASIC) gets the machine's
  // --- model-mismatch refusal instead
  if (isHt1080z && (result.modelType === undefined || result.modelType === SpectrumModelType.HT1080Z)) {
    const placement = placeHt1080zCode(
      result.segments,
      result.entryAddress,
      resolveHt1080zHardware(emulatorState?.config).ramKb
    );
    if (isHt1080zPlacementProblem(placement)) return commandError(describeHt1080zPlacementProblem(placement));
  }

  if (isZxNext && operationType === "inject") {
    if (context.store.getState().emulatorState?.machineState !== MachineControllerState.Paused) {
      return commandError(t("commands.compile.mustBePaused"));
    }
  }

  // --- Collect files affected by project debugging
  // --- A compiler without the classic tables has no sourceFileList (plan §1.1 of the Boriel plan)
  const sourceFiles = result.sourceFileList ?? [];
  if (operationType === "debug") {
    context.service.projectService.setLockedFiles(sourceFiles.map((f) => f.filename));
  }

  // --- Create the code to inject into the emulator
  const codeToInject: CodeToInject = {
    model: modelTypeToMachineType(result.modelType),
    entryAddress: result.entryAddress,
    // --- A unit test returns to its wrapper, not to BASIC
    subroutine: unitTest ? false : result.injectOptions["subroutine"],
    ...(unitTest ? { unitTest } : {}),
    segments: result.segments.map((s) => ({
      startAddress: s.startAddress,
      bank: s.bank,
      bankOffset: s.bankOffset ?? 0,
      emittedCode: s.emittedCode
    })),
    options: result.injectOptions
  };

  const dispatch = context.store.dispatch;
  let returnMessage = "";

  // --- Source-level debug info (plan §10.2) goes to the emulator before a debug run starts, so its
  // --- error stop and statement tracking (§10.10) are armed from the first instruction, and again
  // --- after the injection, which may have replaced the machine controller; a program without it
  // --- clears the previous one's
  const sendSourceDebugInfo = async () => {
    try {
      await context.emuApi.setSourceDebugInfo(hasSourceLevelDebug(result) ? result.sourceLevelDebug : undefined);
    } catch {
      // --- An emulator without source stepping keeps instruction stepping
    }
  };
  if (operationType === "debug") await sendSourceDebugInfo();

  switch (operationType) {
    case "inject":
      await context.emuApi.injectCodeCommand(codeToInject);
      {
        const injected = {
          bytes: sumCodeLength,
          segments: codeToInject.segments.length,
          address: `$${codeToInject.segments[0].startAddress.toString(16).padStart(4, "0").toUpperCase()}`
        };
        returnMessage = isZx8081
          ? t("commands.compile.injectedRem", injected)
          : isHt1080z
            ? t("commands.compile.injectedHt1080z", injected)
            : t("commands.compile.injected", injected);
      }
      break;

    case "run": {
      await context.emuApi.runCodeCommand(codeToInject, additionalInfo, false, false);
      returnMessage = t("commands.compile.started");
      break;
    }

    case "debug": {
      // --- Check if we have debug information
      if (sourceFiles.length === 0) {
        const out = context.output;
        out.color("yellow");
        out.writeLine(t("commands.compile.noDebugInfo"));
        out.resetStyle();
        await context.emuApi.runCodeCommand(codeToInject, additionalInfo, false, false);
        // --- "$W:" is a marker the command service reads (a warning), not text
        returnMessage = `$W:${t("commands.compile.startedNoDebug")}`;
        break;
      }
      await context.emuApi.runCodeCommand(codeToInject, additionalInfo, true, true);
      returnMessage = t("commands.compile.startedDebug");
      break;
    }
  }

  await sendSourceDebugInfo();

  // --- Injection done
  dispatch(incInjectionVersionAction());
  return commandSuccessWith(returnMessage);
}

const CLEAR_TKN = 0xfd;
const CODE_TKN = 0xaf;
const DATA_TKN = 0xe4;
const FOR_TKN = 0xeb;
const IF_TKN = 0xfa;
const GOTO_TKN = 0xec;
const LET_TKN = 0xf1;
const LOAD_TKN = 0xef;
const NEXT_TKN = 0xf3;
const PEEK_TKN = 0xbe;
const POKE_TKN = 0xf4;
const READ_TKN = 0xe3;
const REM_TKN = 0xea;
const THEN_TKN = 0xcb;
const TO_TKN = 0xcc;
const SCREEN_TKN = 0xaa;
const DQUOTE = 0x22;
const STOP_TKN = 0xe2;
const COLON = 0x3a;
const COMMA = 0x2c;
const RAND_TKN = 0xf9;
const USR_TKN = 0xc0;
const NUMB_SIGN = 0x0e;
const NEW_LINE = 0x0d;
const PAUSE_TKN = 0xf2;
const BORDER_TKN = 0xe7;
