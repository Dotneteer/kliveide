import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { Channel, RequestMessage } from "@messaging/messages-core";
import type { IFileProvider } from "@renderer/core/IFileProvider";
import type { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import type { IZ88IdeMachine } from "@emu/machines/z88/IZ88IdeMachine";

import createAppStore from "@state/store";
import { machineRegistry } from "@common/machines/machine-registry";
import { MessengerBase } from "@messaging/MessengerBase";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { AUDIO_SAMPLE_RATE, FILE_PROVIDER } from "@emu/machines/machine-props";
import { Z88Machine } from "@emu/machines/z88/Z88Machine";
import { Z88WasmV2Machine } from "@emu/machines/z88/Z88WasmV2Machine";
import { buildZ88Wasm, productionOutput, waitForZ88WasmBuildLock } from "../../../../scripts/build-z88-wasm.cjs";

/**
 * The Z88 machine the harness drives, whichever backend emulates it: only the backend-neutral
 * machine API (`IZ88Machine`) and the IDE surface (`IZ88IdeMachine`), never a device object.
 */
export type Z88HarnessMachine = IZ88Machine & IZ88IdeMachine;

/** A backend the harness can create a Z88 on */
export type Z88HarnessBackend = "typescript" | "wasm";

/**
 * The backends the dual-backend Z88 tests run on. The WASM backend joins in Step 4 of
 * `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`.
 */
export const Z88_HARNESS_BACKENDS: readonly Z88HarnessBackend[] = ["typescript"];

/** The repo root; the tests start in it, and `__dirname` is not reliable under Vite's transform. */
export const REPO_ROOT = findRepoRoot(process.cwd());

function findRepoRoot(start: string): string {
  let dir = start;
  while (!existsSync(join(dir, "src/emu/machines/z88"))) {
    const parent = resolve(dir, "..");
    if (parent === dir) throw new Error(`Run the Z88 tests from inside the kliveide repo (cwd: ${start}).`);
    dir = parent;
  }
  return dir;
}

/** Read-only file provider: relative paths are relative to `src/public`, as in the app. */
export class HarnessFileProvider implements IFileProvider {
  async readTextFile(path: string, encoding?: string): Promise<string> {
    return readFileSync(this.resolvePath(path), { encoding: (encoding ?? "utf8") as BufferEncoding });
  }
  async readBinaryFile(path: string): Promise<Uint8Array> {
    return new Uint8Array(readFileSync(this.resolvePath(path)));
  }
  writeTextFile(): Promise<void> {
    throw new Error("The Z88 test harness is read-only.");
  }
  writeBinaryFile(): Promise<void> {
    throw new Error("The Z88 test harness is read-only.");
  }
  private resolvePath(path: string): string {
    return isAbsolute(path) ? path : join(REPO_ROOT, "src/public", path);
  }
}

/**
 * Answers every request the machine sends to the main process (the Z88's setup stores the
 * keyboard layout as a global setting) with an empty result.
 */
export class ResolvingMessenger extends MessengerBase {
  readonly sent: RequestMessage[] = [];

  protected send(message: RequestMessage): void {
    this.sent.push(message);
    if (message.correlationId != null) {
      this.processResponse({
        type: "ApiMethodResponse",
        correlationId: message.correlationId,
        result: undefined
      });
    }
  }

  get requestChannel(): Channel {
    return "EmuToMain";
  }

  get responseChannel(): Channel {
    return "EmuToMainResponse";
  }
}

export type CreateHarnessZ88MachineOptions = {
  /** The backend; "typescript" by default */
  backend?: Z88HarnessBackend;
  /** The machine model id (`OZ50`, `OZ40`, ...); the first registered model by default */
  model?: string;
  /** Overrides the model's configuration (as the app's config changes do) */
  config?: MachineConfigSet;
  /**
   * "model": set up the machine the way the app does (load the model's ROM and cards, then hard
   * reset). "blank": skip the setup - slot 0 holds a blank 512K ROM card, so nothing runs until a
   * test loads code. "blank" by default.
   */
  rom?: "model" | "blank";
  /** The audio sample rate; without it the beeper produces no samples */
  audioSampleRate?: number;
};

/** Finds a registered Z88 model */
export function z88Model(modelId?: string): MachineModel {
  const models = machineRegistry.find((m) => m.machineId === "z88").models;
  const model = modelId === undefined ? models[0] : models.find((m) => m.modelId === modelId);
  if (!model) {
    throw new Error(`Unknown Z88 model '${modelId}'. Known: ${models.map((m) => m.modelId).join(", ")}`);
  }
  return model;
}

/**
 * Creates a Z88 on the requested backend, wired the way `MachineService` wires a machine: file
 * provider, audio sample rate, and (for `rom: "model"`) setup followed by a hard reset. A
 * `DebugSupport` is attached, because the step-into and breakpoint paths need one.
 */
export async function createHarnessZ88Machine(options: CreateHarnessZ88MachineOptions = {}): Promise<Z88HarnessMachine> {
  const backend = options.backend ?? "typescript";
  const model = z88Model(options.model);
  const config = options.config ?? model.config;

  let machine: Z88HarnessMachine;
  switch (backend) {
    case "typescript":
      machine = new Z88Machine(model, config, new ResolvingMessenger());
      break;
    case "wasm":
      machine = new Z88WasmV2Machine(model, config, new ResolvingMessenger(), {
        artifactName: "z88-harness.wasm",
        readArtifact: async () => z88WasmArtifactBytes()
      });
      break;
    default:
      throw new Error(`Unknown Z88 backend '${backend}'.`);
  }

  machine.setMachineProperty(FILE_PROVIDER, new HarnessFileProvider());
  if (options.audioSampleRate !== undefined) {
    machine.setMachineProperty(AUDIO_SAMPLE_RATE, options.audioSampleRate);
  }
  if ((options.rom ?? "blank") === "model") {
    await machine.setup();
    await machine.hardReset();
  } else if (machine instanceof Z88WasmV2Machine) {
    // --- A blank WASM machine still needs its core; it gets no ROM (slot 0 stays empty)
    await machine.loadBlankCore();
  } else {
    // --- The constructor has reset the machine; apply the sample rate the reset reads
    machine.reset();
  }
  machine.executionContext.debugSupport = new DebugSupport(createAppStore("emu"));
  return machine;
}

let wasmArtifactBuilt = false;

/**
 * The bytes of the current Z88 WASM artifact. The first call in a test worker builds it from the C
 * sources (under the build lock, so parallel workers do not race); later calls reuse that build.
 */
export function z88WasmArtifactBytes(): Uint8Array<ArrayBuffer> {
  if (!wasmArtifactBuilt) {
    buildZ88Wasm();
    wasmArtifactBuilt = true;
  }
  waitForZ88WasmBuildLock();
  return new Uint8Array(readFileSync(productionOutput));
}
