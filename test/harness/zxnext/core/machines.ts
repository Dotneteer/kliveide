import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

import { AUDIO_SAMPLE_RATE, FILE_PROVIDER } from "@emu/machines/machine-props";
import { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import type { IFileProvider } from "@renderer/core/IFileProvider";

export type CoreName = "ts" | "wasm";
export const ALL_CORES: CoreName[] = ["ts", "wasm"];

/**
 * The repo root. Both entry points (vitest and the Vite-SSR runner) start in it; `__dirname` is not
 * reliable under Vite's SSR transform, which is why the frame-diff runner uses `cwd` as well.
 */
export const REPO_ROOT = findRepoRoot(process.cwd());

function findRepoRoot(start: string): string {
  let dir = start;
  while (!existsSync(join(dir, "src/emu/machines/zxNext"))) {
    const parent = resolve(dir, "..");
    if (parent === dir) throw new Error(`Run the visual tests from inside the kliveide repo (cwd: ${start}).`);
    dir = parent;
  }
  return dir;
}
const WASM_ARTIFACT = join(REPO_ROOT, "src/emu/machines/zxNext/wasm/dist/zx-spectrum-next.wasm");
const WASM_SOURCES = join(REPO_ROOT, "src/emu/machines/zxNext/wasm/zxnext");

/** Read-only ROM provider; paths are relative to `src/public`, as in the app. */
class HarnessFileProvider implements IFileProvider {
  async readTextFile(path: string, encoding?: string): Promise<string> {
    return readFileSync(this.resolvePath(path), { encoding: (encoding ?? "utf8") as BufferEncoding });
  }
  async readBinaryFile(path: string): Promise<Uint8Array> {
    return readFileSync(this.resolvePath(path));
  }
  writeTextFile(): Promise<void> {
    throw new Error("The visual test harness is read-only.");
  }
  writeBinaryFile(): Promise<void> {
    throw new Error("The visual test harness is read-only.");
  }
  private resolvePath(path: string): string {
    return isAbsolute(path) ? path : join(REPO_ROOT, "src/public", path);
  }
}

/**
 * A stale WASM artifact would make every WASM result describe old C code, silently. The runner
 * refuses rather than guesses; `npm run build:zxnext-wasm` fixes it.
 */
export function assertWasmArtifactFresh(): void {
  if (!existsSync(WASM_ARTIFACT)) {
    throw new Error(`No WASM artifact at ${WASM_ARTIFACT}. Run \`npm run build:zxnext-wasm\`.`);
  }
  const artifactTime = statSync(WASM_ARTIFACT).mtimeMs;
  const stale = readdirSync(WASM_SOURCES).filter(
    (f) => (f.endsWith(".c") || f.endsWith(".h")) && statSync(join(WASM_SOURCES, f)).mtimeMs > artifactTime
  );
  if (stale.length) {
    throw new Error(
      `The ZX Next WASM artifact is older than ${stale.join(", ")}. Run \`npm run build:zxnext-wasm\`.`
    );
  }
}

export type CreateCoreOptions = {
  /**
   * Audio sample rate for `getAudioSamples()`. Both cores read it at setup/hard reset, so it has to
   * be set before `setup()`; without it neither core produces audio samples.
   */
  audioSampleRate?: number;
  /** Hard-reset after setup, as the app's machine start does (`MachineService`). */
  hardReset?: boolean;
};

export async function createCore(core: CoreName, options: CreateCoreOptions = {}): Promise<ZxNextMachine> {
  const machine =
    core === "ts"
      ? new ZxNextMachine()
      : new ZxNextWasmV2Machine(undefined, undefined, undefined, {
          artifactName: "visual-tests.wasm",
          readArtifact: async () => readFileSync(WASM_ARTIFACT)
        });
  machine.setMachineProperty(FILE_PROVIDER, new HarnessFileProvider());
  if (options.audioSampleRate) machine.setMachineProperty(AUDIO_SAMPLE_RATE, options.audioSampleRate);
  await machine.setup();
  // --- The TypeScript core hands the audio rate to its devices only in hardReset().
  if (options.hardReset || options.audioSampleRate) machine.hardReset();
  return machine;
}

/** A NextReg's stored value without the port side effects of reading it through $243B/$253B. */
export function readNextRegDirect(machine: ZxNextMachine, reg: number): number {
  return machine instanceof ZxNextWasmV2Machine
    ? machine.wasmV2Runtime!.exports.zxnextGetNextRegisterDirect(reg)
    : machine.nextRegDevice.directGetRegValue(reg);
}

export { runDisplayedFrame } from "./frame";
