import { ICambridgeZ88StateManager } from "../cambridge-z88/ICambrideZ88StateMananger";
import { IAudioRenderer } from "../audio/IAudioRenderer";
import { IZxSpectrumStateManager } from "../zx-spectrum/IZxSpectrumStateManager";

// --- Key engine dependencies here
let engineDependencies: EngineDependencies;

export interface EngineDependencies {
  waModuleLoader?: (moduleFile: string) => Promise<ArrayBuffer>;
  sampleRateGetter?: () => number,
  audioRendererFactory?: (s: number) => IAudioRenderer;
  spectrumStateManager?: IZxSpectrumStateManager;
  cz88StateManager?: ICambridgeZ88StateManager;
}

export function setEngineDependencies(deps: EngineDependencies): void {
  engineDependencies = deps;
}

export function getEngineDependencies(): EngineDependencies {
  return engineDependencies;
}
