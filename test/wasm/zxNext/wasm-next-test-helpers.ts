import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { FILE_PROVIDER } from "@emu/machines/machine-props";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import {
  buildZxNextWasm,
  productionOutput,
  waitForZxNextWasmBuildLock
} from "../../../scripts/build-zxnext-wasm.cjs";
import { FileProvider } from "./FileProvider";

let zxNextWasmBuilt = false;

export async function buildZxNextWasmArtifact(force = false): Promise<void> {
  waitForZxNextWasmBuildLock();
  if (!force && zxNextWasmBuilt && !isZxNextWasmSourceNewerThanArtifact()) return;
  if (!force && !isZxNextWasmSourceNewerThanArtifact()) {
    zxNextWasmBuilt = true;
    return;
  }
  buildZxNextWasm();
  zxNextWasmBuilt = true;
}

export async function createTestZxNextWasmMachine(): Promise<ZxNextWasmV2Machine> {
  await buildZxNextWasmArtifact();
  const machine = new ZxNextWasmV2Machine(
    undefined,
    undefined,
    undefined,
    {
      artifactName: "test-zxnext.wasm",
      readArtifact: async () => {
        waitForZxNextWasmBuildLock();
        return readFileSync(productionOutput);
      }
    }
  );
  machine.setMachineProperty(FILE_PROVIDER, new FileProvider());
  await machine.setup();
  return machine;
}

function isZxNextWasmSourceNewerThanArtifact(): boolean {
  if (!existsSync(productionOutput)) return true;
  const artifactTime = statSync(productionOutput).mtimeMs;
  const sourceRoot = resolve(__dirname, "../../../src/emu/machines/zxNext/wasm/zxnext");
  return readdirSync(sourceRoot).some(entry => {
    if (!entry.endsWith(".c") && !entry.endsWith(".h")) return false;
    return statSync(resolve(sourceRoot, entry)).mtimeMs > artifactTime;
  });
}
