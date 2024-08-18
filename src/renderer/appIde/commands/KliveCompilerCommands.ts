import type { BinarySegment, CompilerOutput } from "@abstractions/CompilerInfo";
import type { MainCompileResponse, MainSaveFileResponse } from "@messaging/any-to-main";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type {
  InjectableOutput,
  KliveCompilerOutput
} from "@main/compiler-integration/compiler-registry";
import type { CodeToInject } from "@abstractions/CodeToInject";
import type { TapeDataBlock } from "@common/structs/TapeDataBlock";

import { getFileTypeEntry } from "@renderer/appIde/project/project-node";
import {
  IdeCommandBaseNew,
  commandError,
  commandSuccess,
  commandSuccessWith,
  toHexa2,
  toHexa4
} from "@renderer/appIde/services/ide-commands";
import { isInjectableCompilerOutput } from "@main/compiler-integration/compiler-registry";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { SpectrumModelType } from "@abstractions/CompilerInfo";
import { BinaryReader } from "@utils/BinaryReader";
import { TapReader } from "@emu/machines/tape/TapReader";
import { TzxReader } from "@emu/machines/tape/TzxReader";
import { SpectrumTapeHeader } from "@emu/machines/tape/SpectrumTapeHeader";
import { BinaryWriter } from "@utils/BinaryWriter";
import { TzxHeader } from "@emu/machines/tape/TzxHeader";
import { TzxStandardSpeedBlock } from "@emu/machines/tape/TzxStandardSpeedBlock";
import {
  endCompileAction,
  incBreakpointsVersionAction,
  incInjectionVersionAction,
  startCompileAction
} from "@common/state/actions";
import { refreshSourceCodeBreakpoints } from "@common/utils/breakpoints";
import { outputNavigateAction } from "@common/utils/output-utils";

const EXPORT_FILE_FOLDER = "KliveExports";

type CodeInjectionType = "inject" | "run" | "debug";

export class KliveCompileCommand extends IdeCommandBaseNew {
  readonly id = "klive.compile";
  readonly description = "Compiles the current project with the Klive Z80 Compiler";
  readonly usage = "klive.compile";
  readonly aliases = ["kl.co"];
  readonly noInteractiveUsage = true;

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const compileResult = await compileCode(context);
    return compileResult.message
      ? commandError(compileResult.message)
      : commandSuccessWith(`Project file successfully compiled.`);
  }
}

export class KliveInjectCodeCommand extends IdeCommandBaseNew {
  readonly id = "klive.inject";
  readonly description =
    "Injects the current project code into the machine (using the Klive Z80 Compiler)";
  readonly usage = "klive.inject";
  readonly aliases = ["kl.inj"];
  readonly noInteractiveUsage = true;

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    return await injectCode(context, "inject");
  }
}

export class KliveRunCodeCommand extends IdeCommandBaseNew {
  readonly id = "klive.run";
  readonly description =
    "Runs the current project's code in the virtual machine (using the Klive Z80 Compiler)";
  readonly usage = "klive.run";
  readonly aliases = ["kl.r"];
  readonly noInteractiveUsage = true;

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const result = await injectCode(context, "run");
    return result;
  }
}

export class KliveDebugCodeCommand extends IdeCommandBaseNew {
  readonly id = "klive.debug";
  readonly description =
    "Runs the current project's code in the virtual machine with debugging (using the Klive Z80 Compiler)";
  readonly usage = "klive.debug";
  readonly aliases = ["kl.rd"];
  readonly noInteractiveUsage = true;

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
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

export class ExportCodeCommand extends IdeCommandBaseNew<ExportCommandArgs> {
  readonly id = "expc";
  readonly description = "Export the code of the current project";
  readonly usage =
    "expc filename [-n name] [-f format] [-as] [-p] [-c] [-b border] [-sb] [-addr address] [-scr screenfile]";

  async execute(context: IdeCommandContext, args: ExportCommandArgs): Promise<IdeCommandResult> {
    // --- Compile before export
    const { message, result } = await compileCode(context);
    const errorNo = result?.errors?.length ?? 0;
    if (message) {
      if (!result) {
        return commandError(message);
      }
      if (errorNo > 0) {
        const message = "Code compilation failed, no program to export.";
        await context.mainApi.displayMessageBox("error", "Exporting code", message);
        return commandError(message);
      }
    }

    if (!isInjectableCompilerOutput(result)) {
      return commandError("Compiled code is not injectable.");
    }

    return this.exportCompiledCode(context, result, args);
  }

  async exportCompiledCode(
    context: IdeCommandContext,
    output: KliveCompilerOutput,
    args: ExportCommandArgs
  ): Promise<IdeCommandResult> {
    if (args["-f"] == "hex") {
      return await saveIntelHexFile(context, args.filename, output);
    }

    // --- Check for screen file error
    let scrContent: Uint8Array;
    const screenFile = args["-scr"];
    if (screenFile) {
      // --- Check the validity of the screen file
      const scrContent = (await context.service.projectService.readFileContent(
        screenFile,
        true
      )) as Uint8Array;
      context.service.projectService.forgetFile(screenFile);
      if (!isScreenFile(scrContent)) {
        return commandError(`File '${screenFile}' is not a valid screen file`);
      }
    }

    // --- Step #6: Create code segments
    const codeBlocks = createTapeBlocks(output as InjectableOutput);
    let screenBlocks: Uint8Array[] | undefined;
    if (screenFile) {
      const blocks = readTapeData(scrContent);
      if (blocks) {
        screenBlocks = [blocks[0].data, blocks[1].data];
      }
    }

    // --- Step #7: Create Auto Start header block, if required
    const blocksToSave: Uint8Array[] = [];
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
    }

    // --- Step #8: Save all the blocks
    if (screenBlocks) {
      blocksToSave.push(...screenBlocks);
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

    function isScreenFile(contents: Uint8Array): boolean {
      // --- Try to read a .TZX file
      const dataBlocks = readTapeData(contents);
      if (!dataBlocks) {
        return false;
      }

      // --- Block lenghts should be 19 and 6914
      var header = dataBlocks[0].data;
      if (header.length !== 19 || dataBlocks[1].data.length != 6914) {
        // --- Problem with block length
        return false;
      }

      // --- Test header bytes
      return (
        header[0] === 0x00 &&
        header[1] == 0x03 && // --- Code header
        header[12] == 0x00 &&
        header[13] == 0x1b && // --- Length: 0x1B00
        header[14] == 0x00 &&
        header[15] == 0x40 && // --- Address: 0x4000
        header[16] == 0x00 &&
        header[17] == 0x80
      ); // --- Param2: 0x8000
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
      if (filename) {
        const response = await context.mainApi.saveTextFile(
          filename,
          hexOut,
          `home:${EXPORT_FILE_FOLDER}`
        );
        if (response.type === "ErrorResponse") {
          return commandError(response.message);
        }
        return commandSuccessWith(
          `Code successfully exported to '${(response as MainSaveFileResponse).path}'`
        );
      }
      return commandError("Filename not specified");

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
      writeNumber(codeLine, args["-addr"]);

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

    // --- Auto start block for ZX Spectrum 48
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
      writeNumber(codeLine, args["-addr"]);
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
          const response = await context.mainApi.saveBinaryFile(
            args.filename,
            writer.buffer,
            `home:${EXPORT_FILE_FOLDER}`
          );
          if (response.type === "ErrorResponse") {
            return commandError(response.message);
          }
          return commandSuccessWith(
            `Code successfully exported to '${(response as MainSaveFileResponse).path}'`
          );
        }

        return commandSuccess;
      } catch (err) {
        return commandError(err.toString());
      }
    }
  }
}

// --- Gets the model code according to machine type
function modelTypeToMachineType(model: SpectrumModelType): string | null {
  switch (model) {
    case SpectrumModelType.Spectrum48:
      return "sp48";
    case SpectrumModelType.Spectrum128:
      return "sp128";
    case SpectrumModelType.SpectrumP3:
      return "spp3e";
    case SpectrumModelType.Next:
      return "next";
    default:
      return null;
  }
}

// --- Compile the current project's code
async function compileCode(
  context: IdeCommandContext
): Promise<{ result?: KliveCompilerOutput; message?: string }> {
  // --- Shortcuts
  const out = context.output;

  // --- Check if we have a build root to compile
  const state = context.store.getState();
  if (!state.project?.isKliveProject) {
    return { message: "No Klive project loaded." };
  }
  const buildRoot = state.project.buildRoots?.[0];
  if (!buildRoot) {
    return { message: "No build root selected in the current Klive project." };
  }
  const fullPath = `${state.project.folderPath}/${buildRoot}`;
  const language = getFileTypeEntry(fullPath, context.store)?.subType;

  // --- Compile the build root
  out.color("bright-blue");
  out.write("Start compiling ");
  outputNavigateAction(context.output, buildRoot);
  out.writeLine();
  out.resetStyle();

  context.store.dispatch(startCompileAction(fullPath));
  let result: KliveCompilerOutput;
  let response: MainCompileResponse;
  try {
    response = await context.mainApi.compileFile(fullPath, language);
    if (response.type === "MainCompileFileResponse") {
      result = response.result;
    }
  } finally {
    context.store.dispatch(endCompileAction(result));
    await refreshSourceCodeBreakpoints(context.store, context.messenger);
    context.store.dispatch(incBreakpointsVersionAction());
  }

  // --- Display optional trace output
  const traceOutput = result?.traceOutput;
  if (traceOutput?.length > 0) {
    out.resetStyle();
    traceOutput.forEach((msg) => out.writeLine(msg));
  }

  // --- Collect errors
  const errorCount = result?.errors?.filter((m) => !m.isWarning).length ?? 0;

  if (response.failed) {
    if (!result || errorCount === 0) {
      // --- Some unexpected error with the compilation
      return { message: response.failed };
    }
  }

  // --- Display the errors
  if ((result.errors?.length ?? 0) > 0) {
    for (let i = 0; i < result.errors.length; i++) {
      const err = result.errors[i];
      out.color(err.isWarning ? "yellow" : "bright-red");
      out.bold(true);
      out.write(`${err.errorCode}: ${err.message}`);
      out.write(" - ");
      out.bold(false);
      out.color("bright-cyan");
      outputNavigateAction(context.output, err.filename, err.line, err.startColumn);
      out.writeLine();
      out.resetStyle();
    }
  }

  // --- Done.
  return errorCount > 0
    ? {
        result,
        message: `Compilation failed with ${errorCount} error${errorCount > 1 ? "s" : ""}.`
      }
    : { result };
}

async function injectCode(
  context: IdeCommandContext,
  operationType: CodeInjectionType
): Promise<IdeCommandResult> {
  const { message, result } = await compileCode(context);
  const errorNo = result?.errors?.length ?? 0;
  if (message) {
    if (!result) {
      return commandError(message);
    }
    if (errorNo > 0) {
      const returnMessage = "Code compilation failed, no program to inject.";
      await context.mainApi.displayMessageBox("error", "Injecting code", returnMessage);
      return commandError(returnMessage);
    }
  }

  if (!isInjectableCompilerOutput(result)) {
    return commandError("Compiled code is not injectable.");
  }

  let sumCodeLength = 0;
  result.segments.forEach((s) => (sumCodeLength += s.emittedCode.length));
  if (sumCodeLength === 0) {
    return commandSuccessWith("Code length is 0, no code injected");
  }

  if (operationType === "inject") {
    if (context.store.getState().emulatorState?.machineState !== MachineControllerState.Paused) {
      return commandError("Machine must be in paused state.");
    }
  }

  // --- Create the code to inject into the emulator
  const codeToInject: CodeToInject = {
    model: modelTypeToMachineType(result.modelType),
    entryAddress: result.entryAddress,
    subroutine: result.injectOptions["subroutine"],
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

  switch (operationType) {
    case "inject":
      await context.emuApi.injectCodeCommand(codeToInject);
      returnMessage = `Successfully injected ${sumCodeLength} bytes in ${
        codeToInject.segments.length
      } segment${
        codeToInject.segments.length > 1 ? "s" : ""
      } from start address $${codeToInject.segments[0].startAddress
        .toString(16)
        .padStart(4, "0")
        .toUpperCase()}`;
      break;

    case "run": {
      await context.emuApi.runCodeCommand(codeToInject, false);
      returnMessage = `Code injected and started.`;
      break;
    }

    case "debug": {
      await context.emuApi.runCodeCommand(codeToInject, true);
      returnMessage = `Code injected and started in debug mode.`;
      break;
    }
  }

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
