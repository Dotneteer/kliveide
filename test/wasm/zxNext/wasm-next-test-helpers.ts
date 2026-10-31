import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { FILE_PROVIDER } from "@emu/machines/machine-props";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import {
  artifactOutput,
  buildAllZxNextWasm,
  ZXNEXT_ARTIFACTS,
  waitForZxNextWasmBuildLock
} from "../../../scripts/build-zxnext-wasm.cjs";
import { NEXT_PROFILES, IMPLICIT_NEXT_PROFILE_ID, nextModelDisplayName, type NextProfileId } from "@emu/machines/zxNext/nextProfiles";
import { FileProvider } from "./FileProvider";

let zxNextWasmBuilt = false;

export async function buildZxNextWasmArtifact(force = false): Promise<void> {
  waitForZxNextWasmBuildLock();
  if (!force && zxNextWasmBuilt && !isZxNextWasmSourceNewerThanArtifact()) return;
  if (!force && !isZxNextWasmSourceNewerThanArtifact()) {
    zxNextWasmBuilt = true;
    return;
  }
  buildAllZxNextWasm();
  zxNextWasmBuilt = true;
}

/** A profile's artifact on disk (`scripts/zxnext-artifacts.cjs`) */
export function zxNextArtifactPath(profile: NextProfileId = IMPLICIT_NEXT_PROFILE_ID): string {
  const entry = ZXNEXT_ARTIFACTS.find((a: { artifact: string }) => a.artifact === NEXT_PROFILES[profile].wasmArtifact);
  if (!entry) throw new Error(`No artifact for ${profile}.`);
  return artifactOutput(entry);
}

export async function createTestZxNextWasmMachine(profile?: NextProfileId): Promise<ZxNextWasmV2Machine> {
  await buildZxNextWasmArtifact();
  const model = profile ? { modelId: profile, displayName: nextModelDisplayName(profile), config: {} } : undefined;
  const machine = new ZxNextWasmV2Machine(
    model,
    undefined,
    undefined,
    {
      artifactName: profile ? `test-zxnext-${profile}.wasm` : "test-zxnext.wasm",
      readArtifact: async () => {
        waitForZxNextWasmBuildLock();
        return readFileSync(zxNextArtifactPath(profile));
      }
    }
  );
  machine.setMachineProperty(FILE_PROVIDER, new FileProvider());
  await machine.setup();
  return machine;
}

function isZxNextWasmSourceNewerThanArtifact(): boolean {
  const outputs = ZXNEXT_ARTIFACTS.map(artifactOutput);
  if (outputs.some((output: string) => !existsSync(output))) return true;
  const artifactTime = Math.min(...outputs.map((output: string) => statSync(output).mtimeMs));
  const sourceRoot = resolve(__dirname, "../../../src/emu/machines/zxNext/wasm/zxnext");
  return readdirSync(sourceRoot).some(entry => {
    if (!entry.endsWith(".c") && !entry.endsWith(".h")) return false;
    return statSync(resolve(sourceRoot, entry)).mtimeMs > artifactTime;
  });
}
