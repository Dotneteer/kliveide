import * as path from "path";
import * as fs from "fs";

import { IAudioRenderer } from "../../src/renderer/machines/IAudioRenderer";
import { ICambridgeZ88StateManager } from "../../src/renderer/machines/cz88/ICambrideZ88StateMananger";
import { IZxSpectrumStateManager } from "../../src/renderer/machines/spectrum/IZxSpectrumStateManager";

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

/**
 * A no-op implementation of IZxSpectrumStateManager
 */
export class DefaultZxSpectrumStateManager implements IZxSpectrumStateManager {
  getState(): any {}
  setTapeContents(_contents: Uint8Array): void {}
  setPanelMessage(_message: string): void {}
  selectRom(_rom: number): void {}
  selectBank(_bank: number): void {}
  setLoadMode(_isLoad: boolean): void {}
  initiateTapeLoading(): void {}
}

export async function loadWaModule(
  moduleFileName: string
): Promise<ArrayBuffer> {
  const moduleFile = path.join(__dirname, "../../build", moduleFileName);
  const contents = fs.readFileSync(moduleFile);
  return contents;
}
