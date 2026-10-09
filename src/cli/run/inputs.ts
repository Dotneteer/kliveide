import fs from "fs";
import path from "path";

import type { CodeToInject } from "@common/abstractions/CodeToInject";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { MachineConfigSet } from "@common/machines/info-types";
import type { ConditionSymbols } from "@common/utils/breakpoint-condition/condition-types";
import type { HeadlessMachine } from "@common/headless/HeadlessMachineFactory";
import type { MachineStatePorts } from "@renderer/appEmu/machines/machineStateFile";
import { MI_SPECTRUM_48, MI_ZX80, MI_ZX81, MI_ZXNEXT } from "@common/machines/constants";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { integerSymbolsOfOutput } from "@common/utils/breakpoint-condition/integer-symbols";
import { playInjectionFlow, type FrameMachine } from "@common/headless/frameRunner";
import { loadNexDirect } from "@common/headless/nexLoad";
import { tapeBlocksOf } from "@common/headless/tapeBlocks";
import { FAST_LOAD } from "@emu/machines/machine-props";
import { parseZxProgramFile, ZX80_FILE_EXTENSIONS, ZX81_FILE_EXTENSIONS } from "@emu/machines/zx8081/ZxPFile";
import { bootModelFor } from "@main/unit-tests/UnitTestRunner";
import { loadSpectrumSnapshot } from "@renderer/appEmu/machines/spectrumSnapshotLoad";
import { loadMachineStateFile } from "@renderer/appEmu/machines/machineStateFile";
import { loadNexFileContents } from "@renderer/appIde/DocumentPanels/Next/nexFileLoader";
import { compileProject } from "../compile";
import { CliError, EXIT_BUILD_ERRORS, usageError } from "../exit-codes";
import { gccDiagnostic } from "../format";
import { createCliMachine, romOverrides } from "../headless";
import type { CliIo } from "../io";
import { loadProject } from "../project";
import { machineOf, parseMachineOption } from "../verbs/test";

/*
 * What `klive run` starts (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D15): a project's build, injected
 * as the IDE's `run` does it, or a file - a tape, a snapshot, a Klive state, a NEX file or a ZX80/81
 * program. The loads are the IDE's own where they do not need the emulator window: the snapshot and
 * state loaders (`spectrumSnapshotLoad.ts`, `machineStateFile.ts`) run against a headless controller,
 * and tapes play through the machine's own tape-load flow.
 */

export type RunInputOptions = {
  machine?: string;
  roms?: string[];
  sjasmplus?: string;
  useIdeSettings?: boolean;
};

/** A machine ready to run, and what the run reports about how it got there */
export type LoadedInput = {
  machine: HeadlessMachine;
  machineId: string;
  modelId?: string;
  config?: MachineConfigSet;
  /** What was started, for the report */
  description: string;
  /** Things the user should know (a snapshot's warnings, what a direct NEX load leaves out) */
  notes: string[];
  /** The build's symbols, for labels in `--bp`/`--until-pc` */
  symbols?: ConditionSymbols;
};

/** The file kinds `klive run` starts, by extension */
export type InputKind = "project" | "tape" | "snapshot" | "state" | "nex" | "zxprogram";

/** The kind of input a path is: a folder is a project */
export function inputKindOf(file: string, isFolder: boolean): InputKind | undefined {
  if (isFolder) return "project";
  const lower = file.toLowerCase();
  if (/\.(tap|tzx)$/.test(lower)) return "tape";
  if (/\.(sna|z80|szx)$/.test(lower)) return "snapshot";
  if (lower.endsWith(".kls")) return "state";
  if (lower.endsWith(".nex")) return "nex";
  if ([...ZX81_FILE_EXTENSIONS, ...ZX80_FILE_EXTENSIONS].some((ext) => lower.endsWith(ext))) return "zxprogram";
  return undefined;
}

/**
 * Loads the input and brings the machine to where the program starts
 * @throws CliError: 2 for build errors, 3 for an input that cannot run, 4 for a missing core
 */
export async function loadRunInput(target: string, options: RunInputOptions, io: CliIo): Promise<LoadedInput> {
  const full = path.resolve(io.cwd, target);
  if (!fs.existsSync(full)) throw usageError(`${full} does not exist.`);
  const kind = inputKindOf(full, fs.statSync(full).isDirectory());
  if (!kind) {
    throw usageError(
      `klive run starts a project folder or a .tap, .tzx, .sna, .z80, .szx, .kls, .nex, .p, .81, .o or .80 file: '${target}'.`
    );
  }
  if (kind === "project") return await loadProjectInput(full, options, io);

  const bytes = new Uint8Array(fs.readFileSync(full));
  const name = path.basename(full);
  const machineOption = options.machine ? parseMachineOption(options.machine) : undefined;
  const roms = romOverrides(options.roms, {}, io.cwd, io.cwd);
  const create = (machineId: string, modelId?: string, config?: MachineConfigSet) =>
    createCliMachine({ machineId, modelId, config, romOverrides: roms, baseDir: __dirname, env: io.env });

  switch (kind) {
    case "tape": {
      const tape = tapeBlocksOf(bytes);
      if ("error" in tape) throw usageError(`${name} is not a tape file: ${tape.error}.`);
      const machineId = machineOption?.machineId ?? MI_SPECTRUM_48;
      const machine = await create(machineId, machineOption?.modelId);
      if (machineId === MI_ZX80 || machineId === MI_ZX81) throw usageError(`${name} is a Spectrum tape; the ${machineId} loads .p/.o files.`);
      machine.setMachineProperty(FAST_LOAD, true);
      machine.setMachineProperty(MEDIA_TAPE, tape.blocks);
      playTapeLoad(machine, name);
      return { machine, machineId, modelId: machineOption?.modelId, description: `${name} (tape)`, notes: [] };
    }

    case "zxprogram": {
      const program = parseZxProgramFile(bytes, name);
      if (!program) throw usageError(`${name} is not a ZX80/ZX81 program file.`);
      const machineId = machineOption?.machineId ?? (program.isZx81 ? MI_ZX81 : MI_ZX80);
      if (machineId !== (program.isZx81 ? MI_ZX81 : MI_ZX80)) {
        throw usageError(`${name} is a ${program.isZx81 ? "ZX81" : "ZX80"} program; it does not run on --machine ${machineId}.`);
      }
      const machine = await create(machineId, machineOption?.modelId);
      machine.setMachineProperty(FAST_LOAD, true);
      machine.setMachineProperty(MEDIA_TAPE, program);
      playTapeLoad(machine, name);
      return { machine, machineId, modelId: machineOption?.modelId, description: `${name} (${machineId.toUpperCase()} program)`, notes: [] };
    }

    case "nex": {
      const machineId = machineOption?.machineId ?? MI_ZXNEXT;
      if (machineId !== MI_ZXNEXT) throw usageError(`${name} is a ZX Spectrum Next program; it runs on --machine zxnext.`);
      const nex = loadNexFileContents(bytes);
      if (!nex.fileInfo) throw usageError(`${name} is not a NEX file: ${nex.error}.`);
      const machine = await create(machineId, machineOption?.modelId);
      const result = loadNexDirect(machine as never, nex.fileInfo, { skipLoadingScreens: true });
      return {
        machine,
        machineId,
        modelId: machineOption?.modelId,
        description: `${name} (NEX, started directly)`,
        notes: [
          "The NEX file was started without NextZXOS (the IDE's nex-run boots it and types .nexload): " +
            result.differencesFromNexload.join("; ") +
            "."
        ]
      };
    }

    case "snapshot":
    case "state": {
      const ports = new HeadlessPorts(create);
      if (machineOption) await ports.setMachineType(machineOption.machineId, machineOption.modelId, {});
      try {
        const result =
          kind === "snapshot"
            ? await loadSpectrumSnapshot(ports, name, bytes, "run", { keepModel: !!machineOption })
            : await loadMachineStateFile(ports, name, bytes, "run");
        if ("needsConfirmation" in result && result.needsConfirmation) throw usageError(result.needsConfirmation);
        return {
          machine: ports.machine!,
          machineId: ports.state.machineId!,
          modelId: ports.state.modelId,
          config: ports.state.config,
          description: `${name} (${kind === "snapshot" ? "snapshot" : "Klive state"} on ${result.machineName})`,
          notes: result.warnings
        };
      } catch (err) {
        if (err instanceof CliError) throw err;
        throw usageError(`${name} cannot be loaded: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}

/** Builds the project and injects its code as the IDE's `run` does */
async function loadProjectInput(folder: string, options: RunInputOptions, io: CliIo): Promise<LoadedInput> {
  const project = loadProject(folder, io.cwd);
  const machine = machineOf({ ...project, unitTests: {} }, options.machine);
  if (!machine.machineId) throw usageError("The project names no machine; pass --machine <id>.");
  if (machine.machineId === MI_ZX80 || machine.machineId === MI_ZX81) {
    throw usageError(`Code built in Klive cannot be injected into the ${machine.machineId.toUpperCase()}; run a .p or .o file instead.`);
  }
  const roms = romOverrides(options.roms, project.roms, project.folder, io.cwd);
  const build = await compileProject(
    project,
    { sjasmplus: options.sjasmplus, useIdeSettings: !!options.useIdeSettings, machineId: machine.machineId, modelId: machine.modelId },
    io.env,
    io.cwd
  );
  for (const d of build.diagnostics) io.err(gccDiagnostic(d));
  if (build.failed) {
    const errors = build.diagnostics.filter((d) => !d.warning).length;
    throw new CliError(`Build failed: ${errors} error${errors === 1 ? "" : "s"}.`, EXIT_BUILD_ERRORS);
  }
  const output = build.output as {
    segments?: { startAddress: number; bank?: number; bankOffset?: number; emittedCode: number[] }[];
    entryAddress?: number;
    modelType?: number;
    injectOptions?: Record<string, boolean>;
  };
  const segments = (output.segments ?? []).filter((s) => s.emittedCode?.length);
  if (!segments.length) throw usageError("The build emits no code to run.");

  const headless = await createCliMachine({
    machineId: machine.machineId,
    modelId: machine.modelId,
    config: machine.config,
    romOverrides: roms,
    baseDir: __dirname,
    env: io.env
  });
  const model = bootModelFor(machine.machineId, output.modelType);
  const code: CodeToInject = {
    model,
    entryAddress: output.entryAddress,
    subroutine: output.injectOptions?.["subroutine"],
    segments: segments.map((s) => ({ startAddress: s.startAddress, bank: s.bank, bankOffset: s.bankOffset ?? 0, emittedCode: s.emittedCode })),
    options: output.injectOptions ?? {}
  };
  const notes: string[] = [];
  const m = headless as unknown as FrameMachine;
  if (machine.machineId === MI_ZXNEXT) {
    // --- The IDE exports a .nex and lets NextZXOS load it; without an SD card the code goes straight in
    m.pc = headless.injectCodeToRun(code);
    notes.push("The ZX Spectrum Next build was injected into a reset machine (the IDE's run boots NextZXOS and loads it as a .nex file).");
  } else {
    try {
      playInjectionFlow(m, await headless.getCodeInjectionFlow(model), { code });
    } catch (err) {
      throw usageError(`The machine did not reach the point where code is injected: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return {
    machine: headless,
    machineId: machine.machineId,
    modelId: machine.modelId,
    config: machine.config,
    description: `${project.name} (${build.file ? path.relative(project.folder, build.file).replace(/\\/g, "/") : "build"})`,
    notes,
    symbols: integerSymbolsOfOutput(build.output)
  };
}

/** Plays the machine's tape-load flow: LOAD "" (or the 128K's Tape Loader), with the tape inserted */
function playTapeLoad(machine: HeadlessMachine, name: string): void {
  const flow = (machine as { getTapeLoadFlow?: () => CodeInjectionFlow }).getTapeLoadFlow?.();
  if (!flow) throw usageError(`This machine cannot start loading ${name} by itself.`);
  try {
    playInjectionFlow(machine as unknown as FrameMachine, flow);
  } catch (err) {
    throw usageError(`The machine did not start loading ${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * The emulator's services, headless: the snapshot and state loaders rebuild the machine through
 * `setMachineType` and restore it through a controller that only runs the restore
 */
class HeadlessPorts implements MachineStatePorts {
  machine?: HeadlessMachine;
  state: { machineId?: string; modelId?: string; config?: MachineConfigSet } = {};

  constructor(
    private readonly create: (machineId: string, modelId?: string, config?: MachineConfigSet) => Promise<HeadlessMachine>
  ) {}

  getMachineController(): any {
    if (!this.machine) return undefined;
    return {
      machine: this.machine,
      debugSupport: undefined,
      restoreState: async (apply: () => void) => apply(),
      start: async () => {},
      startDebug: async () => {}
    };
  }

  getEmulatorState() {
    return this.state;
  }

  getMediaFiles(): Record<string, string | undefined> {
    return {};
  }

  async setMachineType(machineId: string, modelId: string | undefined, config: MachineConfigSet): Promise<boolean> {
    this.machine = await this.create(machineId, modelId, config);
    this.state = { machineId, modelId, config };
    return true;
  }

  async setTape(_fileName: string, contents: Uint8Array): Promise<void> {
    const tape = tapeBlocksOf(contents);
    if ("error" in tape) throw new Error(`the embedded tape cannot be read (${tape.error})`);
    this.machine?.setMachineProperty(MEDIA_TAPE, tape.blocks);
  }

  async setDisk(): Promise<void> {
    throw new Error("the command line does not attach disk images");
  }
}
