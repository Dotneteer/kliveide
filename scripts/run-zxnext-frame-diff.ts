import {
  compareZxNextFrameTraces,
  formatZxNextFrameTraceDifference,
  readTraceHeader,
  readTraceRecord,
  ZxNextFrameTraceRecorder
} from "@emu/machines/zxNext/diagnostics/ZxNextFrameTrace";
import { readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FILE_PROVIDER } from "@emu/machines/machine-props";
import { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import type { IFileProvider } from "@renderer/core/IFileProvider";

type RunnerOptions = {
  frames: number;
  model: string;
  stopPc?: number;
  fixturePath?: string;
  verbose: boolean;
};

type FrameDiffFixture = {
  registers?: Record<string, string | number | boolean>;
  memoryPatches?: Array<{
    address: string | number;
    bytes: string | number[];
  }>;
  keyEvents?: Array<{
    frame: number;
    key: string | number;
    down: boolean;
  }>;
};

type FrameDiffMachine = ZxNextMachine | ZxNextWasmV2Machine;
type RunnerStorageCommand =
  | { command: "sd-read" | "sd-read-card1"; sector: number }
  | { command: "sd-write" | "sd-write-card1"; sector: number; data: Uint8Array };

const SD_SECTOR_SIZE = 512;

export async function runZxNextFrameDiffCli(args: string[]): Promise<void> {
  const options = parseArgs(args);
  const { oracle, wasm } = await createZxNextFrameDiffHarness();
  const fixture = options.fixturePath ? loadFixture(options.fixturePath) : undefined;
  if (fixture) applyStartupFixture(fixture, oracle, wasm);
  wasm.executionContext.debugStepMode = DebugStepMode.StopAtBreakpoint;
  const wasmRuntime = wasm.wasmV2Runtime;
  if (!wasmRuntime) throw new Error("ZX Spectrum Next WASM runtime was not initialized.");

  const oracleTrace = new ZxNextFrameTraceRecorder(oracle);
  const storage = new RunnerStorage();
  const targetFrameCount = oracle.frames + options.frames;

  while (oracle.frames < targetFrameCount) {
    const frameCount = oracle.frames;
    if (fixture) applyFrameFixture(fixture, frameCount, oracle, wasm);

    oracleTrace.beginFrame(frameCount);
    oracle.traceInstructionExecuted = pcBefore => oracleTrace.recordInstruction(pcBefore);
    const oracleTermination = oracle.executeMachineFrame();
    oracle.traceInstructionExecuted = undefined;
    oracleTrace.endFrame();

    wasmRuntime.exports.zxnextTraceClear(wasm.frames);
    wasmRuntime.exports.zxnextTraceSetEnabled(1);
    const wasmTermination = wasm.executeMachineFrame();
    wasmRuntime.exports.zxnextTraceFinishFrame();
    wasmRuntime.exports.zxnextTraceSetEnabled(0);

    const diff = compareZxNextFrameTraces(oracleTrace.bytes, wasmRuntime.frameTrace, frameCount);
    if (diff.kind !== "match") {
      console.log(formatZxNextFrameTraceDifference(diff));
      console.log(formatRecentNextRegPortHistory(oracleTrace.bytes, wasmRuntime.frameTrace, diff.instructionIndex));
      console.log(formatRecentPortHistory(oracleTrace.bytes, wasmRuntime.frameTrace, diff.instructionIndex));
      console.log(`TypeScript termination=${oracleTermination} WASM termination=${wasmTermination}`);
      process.exitCode = 1;
      return;
    }

    const header = readTraceHeader(oracleTrace.bytes);
    if (options.verbose) {
      console.log(`frameCount=${frameCount} matched records=${header.count}`);
    }

    if (options.stopPc !== undefined && traceContainsPc(oracleTrace.bytes, header.count, options.stopPc)) {
      console.log(`Stopped after matching frameCount=${frameCount}: observed PC ${hex16(options.stopPc)}.`);
      return;
    }

    const pendingCommand = getMatchingFrameCommand(oracle.getFrameCommand(), wasm.getFrameCommand());
    if (pendingCommand) {
      processRunnerStorageCommand(pendingCommand, storage, oracle, wasm, wasmRuntime);
      continue;
    }
    if (oracle.getFrameCommand() || wasm.getFrameCommand()) {
      console.log(`Frame command mismatch at frameCount=${frameCount}: TypeScript=${formatFrameCommand(oracle.getFrameCommand())} WASM=${formatFrameCommand(wasm.getFrameCommand())}`);
      process.exitCode = 1;
      return;
    }
  }

  console.log(`No differences found after ${options.frames} frame(s). Current frame count: ${oracle.frames}.`);
}

class RunnerStorage {
  private readonly sectors = new Map<string, Uint8Array>();

  read(card: number, sector: number): Uint8Array {
    return this.sectors.get(this.key(card, sector))?.slice() ?? new Uint8Array(SD_SECTOR_SIZE);
  }

  write(card: number, sector: number, data: Uint8Array): void {
    const sectorData = new Uint8Array(SD_SECTOR_SIZE);
    sectorData.set(data.slice(0, SD_SECTOR_SIZE));
    this.sectors.set(this.key(card, sector), sectorData);
  }

  private key(card: number, sector: number): string {
    return `${card}:${sector >>> 0}`;
  }
}

async function createZxNextFrameDiffHarness(): Promise<{
  oracle: ZxNextMachine;
  wasm: ZxNextWasmV2Machine;
}> {
  const oracle = new ZxNextMachine();
  oracle.setMachineProperty(FILE_PROVIDER, new RunnerFileProvider());
  await oracle.setup();
  const wasm = new ZxNextWasmV2Machine(
    undefined,
    undefined,
    undefined,
    {
      artifactName: "zxnext-frame-diff-runner.wasm",
      readArtifact: async () => readFileSync(resolve(process.cwd(), "src/emu/machines/zxNext/wasm/dist/zx-spectrum-next.wasm"))
    }
  );
  wasm.setMachineProperty(FILE_PROVIDER, new RunnerFileProvider());
  await wasm.setup();
  return { oracle, wasm };
}

class RunnerFileProvider implements IFileProvider {
  async readTextFile(inputPath: string, encoding?: string): Promise<string> {
    return readFileSync(this.resolvePath(inputPath), {
      encoding: (encoding ?? "utf8") as BufferEncoding
    });
  }

  async readBinaryFile(inputPath: string): Promise<Uint8Array> {
    return readFileSync(this.resolvePath(inputPath));
  }

  writeTextFile(): Promise<void> {
    throw new Error("The ZX Next frame diff runner is read-only.");
  }

  writeBinaryFile(): Promise<void> {
    throw new Error("The ZX Next frame diff runner is read-only.");
  }

  private resolvePath(inputPath: string): string {
    if (isAbsolute(inputPath)) return inputPath;
    return join(process.cwd(), "src/public", inputPath);
  }
}

function parseArgs(args: string[]): RunnerOptions {
  const options: RunnerOptions = {
    frames: 1000,
    model: "zxnext",
    verbose: false
  };

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    switch (arg) {
      case "--frames":
        options.frames = parsePositiveInt(requireValue(args, ++index, arg), arg);
        break;
      case "--model":
        options.model = requireValue(args, ++index, arg);
        break;
      case "--stop-pc":
        options.stopPc = parseAddress(requireValue(args, ++index, arg), arg);
        break;
      case "--fixture":
        options.fixturePath = requireValue(args, ++index, arg);
        break;
      case "--verbose":
        options.verbose = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.model !== "zxnext") {
    throw new Error(`Unsupported model '${options.model}'. The experimental runner currently supports 'zxnext'.`);
  }

  return options;
}

function requireValue(args: string[], index: number, name: string): string {
  const value = args[index];
  if (value == null || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}.`);
  }
  return value;
}

function parsePositiveInt(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function parseAddress(value: string, name: string): number {
  const parsed = value.startsWith("0x")
    ? Number.parseInt(value.slice(2), 16)
    : Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 0xffff) {
    throw new Error(`${name} must be a 16-bit address.`);
  }
  return parsed;
}

function traceContainsPc(trace: Uint8Array, count: number, pc: number): boolean {
  for (let index = 0; index < count; index++) {
    const record = readTraceRecord(trace, index);
    if (record.pcBefore === pc || record.pcAfter === pc) return true;
  }
  return false;
}

function formatRecentNextRegPortHistory(
  typescriptTrace: Uint8Array,
  wasmTrace: Uint8Array,
  instructionIndex: number | undefined
): string {
  if (instructionIndex === undefined) return "Recent NextReg port history: unavailable.";
  const start = Math.max(0, instructionIndex - 80);
  const lines = ["Recent NextReg port history:"];
  for (let index = start; index <= instructionIndex; index++) {
    const ts = readTraceRecord(typescriptTrace, index);
    const wasm = readTraceRecord(wasmTrace, index);
    if (!isNextRegPortAccess(ts) && !isNextRegPortAccess(wasm)) continue;
    lines.push(
      `  index=${index} ` +
      `TS pc=${hex16(ts.pcBefore)} port=${hex16(ts.lastPortAddress)} value=${hex8(ts.lastPortValue)} flags=${hex8(ts.lastPortFlags)} nextReg=${hex8(ts.nextRegIndex)} ` +
      `WASM pc=${hex16(wasm.pcBefore)} port=${hex16(wasm.lastPortAddress)} value=${hex8(wasm.lastPortValue)} flags=${hex8(wasm.lastPortFlags)} nextReg=${hex8(wasm.nextRegIndex)}`
    );
  }
  if (lines.length === 1) lines.push("  none in the preceding 80 instructions.");
  return lines.join("\n");
}

function isNextRegPortAccess(record: ReturnType<typeof readTraceRecord>): boolean {
  return record.lastPortAddress === 0x243b || record.lastPortAddress === 0x253b;
}

function formatRecentPortHistory(
  typescriptTrace: Uint8Array,
  wasmTrace: Uint8Array,
  instructionIndex: number | undefined
): string {
  if (instructionIndex === undefined) return "Recent port history: unavailable.";
  const start = Math.max(0, instructionIndex - 80);
  const lines = ["Recent port history:"];
  for (let index = start; index <= instructionIndex; index++) {
    const ts = readTraceRecord(typescriptTrace, index);
    const wasm = readTraceRecord(wasmTrace, index);
    if ((ts.lastPortFlags & 0x01) === 0 && (wasm.lastPortFlags & 0x01) === 0) continue;
    lines.push(
      `  index=${index} ` +
      `TS pc=${hex16(ts.pcBefore)} port=${hex16(ts.lastPortAddress)} value=${hex8(ts.lastPortValue)} flags=${hex8(ts.lastPortFlags)} ` +
      `WASM pc=${hex16(wasm.pcBefore)} port=${hex16(wasm.lastPortAddress)} value=${hex8(wasm.lastPortValue)} flags=${hex8(wasm.lastPortFlags)}`
    );
  }
  if (lines.length === 1) lines.push("  none in the preceding 80 instructions.");
  return lines.join("\n");
}

function formatFrameCommand(command: unknown): string {
  if (command == null) return "none";
  if (typeof command !== "object") return String(command);
  const maybeCommand = command as { command?: unknown; sector?: unknown };
  if (typeof maybeCommand.command !== "string") return "object";
  return typeof maybeCommand.sector === "number"
    ? `${maybeCommand.command}:${maybeCommand.sector}`
    : maybeCommand.command;
}

function getMatchingFrameCommand(left: unknown, right: unknown): RunnerStorageCommand | undefined {
  if (left == null && right == null) return undefined;
  if (!isRunnerStorageCommand(left) || !isRunnerStorageCommand(right)) return undefined;
  if (left.command !== right.command || left.sector !== right.sector) return undefined;
  if ("data" in left || "data" in right) {
    if (!("data" in left) || !("data" in right) || !equalBytes(left.data, right.data)) return undefined;
  }
  return left;
}

function isRunnerStorageCommand(command: unknown): command is RunnerStorageCommand {
  if (command == null || typeof command !== "object") return false;
  const candidate = command as { command?: unknown; sector?: unknown; data?: unknown };
  if (
    candidate.command !== "sd-read" &&
    candidate.command !== "sd-read-card1" &&
    candidate.command !== "sd-write" &&
    candidate.command !== "sd-write-card1"
  ) {
    return false;
  }
  if (typeof candidate.sector !== "number") return false;
  if (candidate.command === "sd-read" || candidate.command === "sd-read-card1") return true;
  return candidate.data instanceof Uint8Array;
}

function processRunnerStorageCommand(
  command: RunnerStorageCommand,
  storage: RunnerStorage,
  oracle: ZxNextMachine,
  wasm: ZxNextWasmV2Machine,
  wasmRuntime: NonNullable<ZxNextWasmV2Machine["wasmV2Runtime"]>
): void {
  switch (command.command) {
    case "sd-read":
    case "sd-read-card1": {
      const card = command.command === "sd-read-card1" ? 1 : 0;
      const sectorData = storage.read(card, command.sector);
      if (card === 1) {
        oracle.sdCardDevice.setCard1ReadResponse(sectorData);
      } else {
        oracle.sdCardDevice.setReadResponse(sectorData);
      }
      const ptr = wasmRuntime.exports.zxnextGetSdWriteBufferPtr();
      new Uint8Array(wasmRuntime.memoryBuffer).set(sectorData, ptr);
      wasmRuntime.exports.zxnextSetSdReadResponse(card, ptr, sectorData.length);
      break;
    }
    case "sd-write":
    case "sd-write-card1": {
      const card = command.command === "sd-write-card1" ? 1 : 0;
      storage.write(card, command.sector, command.data);
      if (card === 1) {
        oracle.sdCardDevice.setCard1WriteResponse();
      } else {
        oracle.sdCardDevice.setWriteResponse();
      }
      wasmRuntime.exports.zxnextSetSdWriteResponse(card, 1);
      break;
    }
  }
  wasmRuntime.exports.zxnextClearSdHostCommand();
  oracle.setFrameCommand(null);
  wasm.setFrameCommand(null);
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index++) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function printHelp(): void {
  console.log([
    "ZX Spectrum Next TypeScript/WASM frame diff runner",
    "",
    "Usage:",
    "  npm run diff:zxnext-machine -- --model zxnext",
    "  npm run diff:zxnext-machine -- --frames 500 --stop-pc 0x1234 --verbose",
    "",
    "Options:",
    "  --frames <count>   Maximum frames to compare. Defaults to 1000.",
    "  --model zxnext     Machine model. Only zxnext is supported initially.",
    "  --stop-pc <addr>   Stop after a matching frame that observes the address.",
    "  --fixture <file>   JSON startup/input fixture for both machines.",
    "  --verbose          Print a one-line summary for each matching frame."
  ].join("\n"));
}

function hex16(value: number): string {
  return `$${(value & 0xffff).toString(16).padStart(4, "0")}`;
}

function hex8(value: number): string {
  return `$${(value & 0xff).toString(16).padStart(2, "0")}`;
}

function loadFixture(fixturePath: string): FrameDiffFixture {
  const fullPath = resolve(process.cwd(), fixturePath);
  const parsed = JSON.parse(readFileSync(fullPath, "utf8")) as FrameDiffFixture;
  if (parsed.registers != null && typeof parsed.registers !== "object") {
    throw new Error(`Fixture '${fixturePath}' has invalid registers.`);
  }
  if (parsed.memoryPatches != null && !Array.isArray(parsed.memoryPatches)) {
    throw new Error(`Fixture '${fixturePath}' has invalid memoryPatches.`);
  }
  if (parsed.keyEvents != null && !Array.isArray(parsed.keyEvents)) {
    throw new Error(`Fixture '${fixturePath}' has invalid keyEvents.`);
  }
  return parsed;
}

function applyStartupFixture(fixture: FrameDiffFixture, oracle: ZxNextMachine, wasm: ZxNextWasmV2Machine): void {
  if (fixture.registers) {
    for (const [name, value] of Object.entries(fixture.registers)) {
      setRegister(oracle, name, value);
      setRegister(wasm, name, value);
    }
  }
  for (const patch of fixture.memoryPatches ?? []) {
    const address = parseNumberValue(patch.address, "memory patch address") & 0xffff;
    const bytes = parseByteArray(patch.bytes, "memory patch bytes");
    for (let offset = 0; offset < bytes.length; offset++) {
      oracle.doWriteMemory((address + offset) & 0xffff, bytes[offset]);
      wasm.doWriteMemory((address + offset) & 0xffff, bytes[offset]);
    }
  }
}

function applyFrameFixture(
  fixture: FrameDiffFixture,
  frameCount: number,
  oracle: ZxNextMachine,
  wasm: ZxNextWasmV2Machine
): void {
  for (const event of fixture.keyEvents ?? []) {
    if (event.frame !== frameCount) continue;
    const key = parseNumberValue(event.key, "key") & 0xff;
    oracle.setKeyStatus(key, event.down);
    wasm.setKeyStatus(key, event.down);
  }
}

function setRegister(machine: FrameDiffMachine, name: string, value: string | number | boolean): void {
  switch (name) {
    case "af":
    case "bc":
    case "de":
    case "hl":
    case "af_":
    case "bc_":
    case "de_":
    case "hl_":
    case "ix":
    case "iy":
    case "ir":
    case "wz":
    case "pc":
    case "sp":
      machine[name] = parseNumberValue(value, name) & 0xffff;
      return;
    case "iff1":
    case "iff2":
      machine[name] = Boolean(value);
      return;
    case "interruptMode":
      machine.interruptMode = parseNumberValue(value, name) & 0x03;
      return;
    default:
      throw new Error(`Unsupported fixture register '${name}'.`);
  }
}

function parseByteArray(value: string | number[], name: string): number[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => parseByteValue(item, `${name}[${index}]`));
  }
  return value
    .replace(/^0x/i, "")
    .replace(/[^0-9a-f]/gi, "")
    .match(/.{1,2}/g)
    ?.map((byte, index) => parseByteValue(Number.parseInt(byte, 16), `${name}[${index}]`)) ?? [];
}

function parseByteValue(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new Error(`${name} must be a byte.`);
  }
  return value;
}

function parseNumberValue(value: string | number | boolean, name: string): number {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") {
    if (!Number.isInteger(value)) throw new Error(`${name} must be an integer.`);
    return value;
  }
  const trimmed = value.trim();
  const parsed = /^[$]/.test(trimmed)
    ? Number.parseInt(trimmed.slice(1), 16)
    : /^0x/i.test(trimmed)
      ? Number.parseInt(trimmed.slice(2), 16)
      : Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer.`);
  return parsed;
}
