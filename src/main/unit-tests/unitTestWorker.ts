import { parentPort, workerData } from "worker_threads";
import { readFileSync } from "fs";
import { isAbsolute, join } from "path";

import type { IFileProvider } from "@renderer/core/IFileProvider";
import type { UnitTestEvent } from "@common/unit-tests/unitTestTypes";
import type { UnitTestWorkerData } from "./unitTestWorkerTypes";
import { discoverUnitTests } from "@common/unit-tests/discovery";
import { createHeadlessMachine } from "./HeadlessMachineFactory";
import { bootModelFor, runUnitTests } from "./UnitTestRunner";

/*
 * The unit-test worker (`.plans/Z80_UNIT_TESTS_PLAN.md` D6): one machine, the tests run in sequence
 * (T10), every event posted to the main process as it happens. Cancelling terminates the worker.
 */

/** ROMs and firmware from the app's public folder; the worker reads files, never settings (T11) */
class PublicFileProvider implements IFileProvider {
  constructor(private readonly publicFolder: string) {}
  async readTextFile(path: string): Promise<string> {
    return readFileSync(this.resolve(path), "utf8");
  }
  async readBinaryFile(path: string): Promise<Uint8Array> {
    return new Uint8Array(readFileSync(this.resolve(path)));
  }
  writeTextFile(): Promise<void> {
    throw new Error("The unit-test runner does not write files.");
  }
  writeBinaryFile(): Promise<void> {
    throw new Error("The unit-test runner does not write files.");
  }
  private resolve(path: string): string {
    return isAbsolute(path) ? path : join(this.publicFolder, path);
  }
}

async function run(data: UnitTestWorkerData): Promise<void> {
  const post = (event: UnitTestEvent) => parentPort?.postMessage(event);
  try {
    const program = discoverUnitTests(data.compilation, data.machineId);
    const machine = await createHeadlessMachine({
      machineId: data.machineId,
      modelId: data.modelId,
      config: data.config,
      readArtifact: () => data.artifact,
      fileProvider: new PublicFileProvider(data.publicFolder)
    });
    await runUnitTests(
      {
        program,
        compilation: data.compilation,
        machine: machine as never,
        bootModel: bootModelFor(data.machineId, data.compilation.modelType),
        options: data.options
      },
      post
    );
  } catch (err) {
    post({ kind: "problem", message: err instanceof Error ? err.message : String(err) });
    post({ kind: "finished", summary: { total: 0, passed: 0, failed: 0, errors: 0 } });
  }
}

if (parentPort) {
  void run(workerData as UnitTestWorkerData);
}
