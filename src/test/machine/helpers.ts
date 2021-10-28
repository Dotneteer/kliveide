import * as path from "path";
import * as fs from "fs";
import { IAudioRenderer } from "@modules-core/audio/IAudioRenderer";
import { ICambridgeZ88StateManager } from "@modules/vm-z88/CambridgeZ88Core";
import { IZxSpectrumStateManager } from "@modules/vm-zx-spectrum/ZxSpectrumCoreBase";

/**
 * Provides a way to test a Z88 virtual machine in Node
 */
export class SilentAudioRenderer implements IAudioRenderer {
  async initializeAudio(): Promise<void> {}
  storeSamples(_samples: number[]): void {}
  suspend(): void {}
  resume(): void {}
  async closeAudio(): Promise<void> {}
}

/**
 * A no-op implementation of state manager
 */
export class DefaultCambridgeZ88StateManager
  implements ICambridgeZ88StateManager {
  getState(): any {}
}

export async function loadWaModule(
  moduleFileName: string
): Promise<ArrayBuffer> {
  const moduleFile = path.join(__dirname, "../../../build", moduleFileName);
  const contents = fs.readFileSync(moduleFile);
  return contents;
}
