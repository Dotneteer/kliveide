import fs from "fs";

import type { BinarySegment, DebuggableOutput, IKliveCompiler, KliveCompilerOutput } from "@abstractions/CompilerInfo";
import type { ErrorFilterDescriptor } from "@main/cli-integration/CliRunner";

import { createSettingsReader } from "@common/utils/SettingsReader";
import path from "path";
import {
  PASTA80_DEP,
  PASTA80_INSTALL_FOLDER,
  PASTA80_KEEP_TEMP_FILES,
  PASTA80_OPT,
  PASTA80_OVR,
  PASTA80_RELEASE,
} from "./pasta80-config";
import { AppState } from "@common/state/AppState";
import { CliRunner } from "@main/cli-integration/CliRunner";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { mainStore } from "@main/main-store";
import {
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_ZXNEXT
} from "@common/machines/constants";

/**
 * Wraps the pasta80 Pascal compiler
 */
export class Pasta80Compiler implements IKliveCompiler {
  private state: AppState;

  readonly id = "Pasta80Compiler";

  readonly language = "pasta80";

  readonly providesKliveOutput = true;

  setAppState(state: AppState): void {
    this.state = state;
  }

  async compileFile(filename: string): Promise<KliveCompilerOutput> {
    const settingsReader = createSettingsReader(this.state);
    try {
      const installFolder = settingsReader.readSetting(PASTA80_INSTALL_FOLDER)?.toString();
      if (!installFolder || installFolder.trim() === "") {
        throw new Error("pasta80 installation folder is not set, cannot start the compiler.");
      }
      const execPath = path.join(installFolder, "pasta");

      // --- Set the target according to the current machine's type
      const emulatorState = mainStore.getState()?.emulatorState;
      const machineId = emulatorState?.machineId;

      // --- pasta80 generates code at $8000; ZX Spectrum 16K only has RAM up to $7FFF
      if (machineId === MI_SPECTRUM_48 && emulatorState?.config?.memSize === 16) {
        return {
          errors: [
            {
              errorCode: "Error",
              filename,
              line: 1,
              startPosition: 0,
              endPosition: 0,
              startColumn: 0,
              endColumn: 0,
              message:
                "pasta80 compiles code starting at $8000, which is outside the 16K ZX Spectrum memory range. Switch to a 48K model.",
              isWarning: false
            }
          ]
        };
      }

      const target = machineIdToTarget(machineId);
      const opt = !!settingsReader.readBooleanSetting(PASTA80_OPT);
      const dep = !!settingsReader.readBooleanSetting(PASTA80_DEP);
      const ovr = !!settingsReader.readBooleanSetting(PASTA80_OVR);
      const release = !!settingsReader.readBooleanSetting(PASTA80_RELEASE);

      // --- Build command-line arguments
      const args: string[] = [];
      args.push(`--${target}`);
      args.push("--bin");
      if (opt) args.push("--opt");
      if (dep) args.push("--dep");
      if (ovr || target === "zx128") args.push("--ovr");
      if (release) args.push("--release");
      if (!release) args.push("--klive");
      args.push(filename);

      const runner = new CliRunner();
      runner.setErrorFilter(this.getErrorFilterDescription());
      console.log(`Pasta80Compiler: Executing command: ${execPath} ${args.join(" ")}`);
      const result = await runner.execute(execPath, args, { shell: true });

      // --- pasta80 writes the binary next to the source with a .bin extension
      const stem = filename.replace(/\.pas$/i, "");
      const outFilename = stem + ".bin";
      const brkFilename = stem + ".brk";
      const z80Filename = stem + ".z80";
      const sldFilename = stem + ".sld";

      if (result.failed || result.errors?.length > 0) {
        removeTempFiles();
        // --- If the runner set `failed` but produced no structured errors (e.g. the
        // --- assembler backend was not found), synthesize an error entry so the
        // --- consumer (which only checks `errors`) always sees a non-empty list.
        if (result.failed && !(result.errors?.length > 0)) {
          const message = (result.stderr?.trim() || result.failed).split("\n").pop() ?? result.failed;
          return {
            ...result,
            errors: [
              {
                errorCode: "Error",
                filename,
                line: 1,
                startPosition: 0,
                endPosition: 0,
                startColumn: 0,
                endColumn: 0,
                message,
                isWarning: false
              }
            ]
          };
        }
        // --- pasta80 does not include the filename in its error lines; fill it in here
        return {
          ...result,
          errors: (result.errors ?? []).map((e) => ({
            ...e,
            filename: e.filename || filename
          }))
        };
      }
      if (!fs.existsSync(outFilename)) {
        // pasta80 reported success but produced no binary — treat as a failure
        return {
          traceOutput: result.traceOutput,
          errors: [
            {
              errorCode: "Error",
              filename,
              line: 1,
              startPosition: 0,
              endPosition: 0,
              startColumn: 0,
              endColumn: 0,
              message: "pasta80 did not produce an output binary. Check the compiler output for details.",
              isWarning: false
            }
          ]
        };
      }
      const machineCode = new Uint8Array(fs.readFileSync(outFilename));

      const startAddress = targetOrigin(target);
      const segment: BinarySegment = {
        emittedCode: Array.from(machineCode),
        startAddress
      };

      // --- Parse the .sld file produced by --klive for a proper source map,
      // --- falling back to a minimal entry when the file is absent or unparseable.
      let sourceFileList: { filename: string; includes: any[] }[];
      let sourceMap: Record<number, { fileIndex: number; line: number }>;
      let listFileItems: { address: number; fileIndex: number; lineNumber: number }[];

      if (fs.existsSync(sldFilename)) {
        try {
          const sldContent = fs.readFileSync(sldFilename, "utf-8");
          const sld = JSON.parse(sldContent) as {
            files: string[];
            statements: { address: number; file: number; line: number; column: number }[];
          };
          sourceFileList = sld.files.map((f) => ({ filename: f, includes: [] }));
          sourceMap = {};
          listFileItems = [];
          for (const stmt of sld.statements) {
            sourceMap[stmt.address] = { fileIndex: stmt.file, line: stmt.line };
            listFileItems.push({ address: stmt.address, fileIndex: stmt.file, lineNumber: stmt.line });
          }
        } catch {
          sourceFileList = [{ filename, includes: [] }];
          sourceMap = { [startAddress]: { fileIndex: 0, line: 1 } };
          listFileItems = [{ address: startAddress, fileIndex: 0, lineNumber: 1 }];
        }
      } else {
        sourceFileList = [{ filename, includes: [] }];
        sourceMap = { [startAddress]: { fileIndex: 0, line: 1 } };
        listFileItems = [{ address: startAddress, fileIndex: 0, lineNumber: 1 }];
      }

      removeTempFiles();

      return {
        traceOutput: result.traceOutput,
        errors: [],
        injectOptions: { subroutine: true },
        segments: [segment],
        modelType: SpectrumModelType.Spectrum48,
        sourceFileList,
        sourceMap,
        listFileItems
      } as DebuggableOutput;

      function removeTempFiles() {
        try {
          const keepTempFiles = settingsReader.readBooleanSetting(PASTA80_KEEP_TEMP_FILES);
          if (!keepTempFiles) {
            fs.unlinkSync(outFilename);
            fs.unlinkSync(brkFilename);
            fs.unlinkSync(z80Filename);
            // if (fs.existsSync(sldFilename)) fs.unlinkSync(sldFilename);
          }
        } catch {
          // intentionally ignored
        }
      }
    } catch (err: any) {
      // --- Return unexpected exceptions as a structured error result so the
      // --- worker can safely serialise the response (raw throws corrupt over MessagePort)
      return {
        errors: [
          {
            errorCode: "Error",
            filename,
            line: 1,
            startPosition: 0,
            endPosition: 0,
            startColumn: 0,
            endColumn: 0,
            message: err?.message ?? String(err),
            isWarning: false
          }
        ]
      };
    }
  }

  async lineCanHaveBreakpoint(_line: string): Promise<boolean> {
    return false;
  }

  getErrorFilterDescription(): ErrorFilterDescriptor {
    // pasta80 error format: *** Error at <line>,<col>: <message>
    // Warnings use the same format with "Warning" instead of "Error"
    return {
      regex: /^\*\*\* (Error|Warning) at (\d+),(\d+):\s+(.*)$/,
      warningFilterIndex: 1,
      warningText: "Warning",
      lineFilterIndex: 2,
      columnFilterIndex: 3,
      messageFilterIndex: 4
    };
  }
}

function machineIdToTarget(machineId: string | undefined): Pasta80Target {
  switch (machineId) {
    case MI_SPECTRUM_128:
    case MI_SPECTRUM_3E:
      return "zx128";
    case MI_ZXNEXT:
      return "zxnext";
    case MI_SPECTRUM_48:
    default:
      return "zx48";
  }
}

type Pasta80Target = "cpm" | "zx48" | "zx128" | "zxnext" | "agon";

function targetOrigin(target: Pasta80Target): number {
  switch (target) {
    case "zx48":
    case "zx128":
    case "zxnext":
      return 0x8000;
    case "agon":
      return 0x0000;
    case "cpm":
    default:
      return 0x0100;
  }
}
