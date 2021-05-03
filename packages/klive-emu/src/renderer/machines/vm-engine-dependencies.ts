import { ICambridgeZ88StateManager } from "./cz88/ICambrideZ88StateMananger";
import { IAudioRenderer } from "./IAudioRenderer";
import { IZxSpectrumStateManager } from "./spectrum/IZxSpectrumStateManager";

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
