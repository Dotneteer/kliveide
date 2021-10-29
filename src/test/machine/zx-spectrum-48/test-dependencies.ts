import {
  AudioRendererFactory,
  AudioSampleRateGetter,
  AUDIO_RENDERER_FACTORY_ID,
  AUDIO_SAMPLE_RATE_GETTER_ID,
  IMachineComponentProvider,
  WaModuleLoader,
  WA_MODULE_LOADER_ID,
} from "@modules-core/abstract-vm";
import { getEngineDependencyRegistry } from "@modules-core/vm-engine-dependency-registry";
import {
  IZxSpectrumStateManager,
  ZX_SPECTRUM_STATE_MANAGER_ID,
} from "@modules/vm-zx-spectrum/ZxSpectrumCoreBase";
import { loadWaModule, SilentAudioRenderer } from "../helpers";

const machineId = "sp48";

export function createTestDependencies(): void {
  const engineDeps = getEngineDependencyRegistry();
  engineDeps.reset();
  engineDeps.registerComponentDependency(machineId, new WaLoader());
  engineDeps.registerComponentDependency(machineId, new SampleRateGetter());
  engineDeps.registerComponentDependency(machineId, new AudioFactory());
  engineDeps.registerComponentDependency(machineId, new StateManager());
}

class WaLoader implements IMachineComponentProvider, WaModuleLoader {
  readonly id = WA_MODULE_LOADER_ID;
  loadWaContents(moduleFile: string): Promise<ArrayBuffer> {
    return loadWaModule(moduleFile);
  }
}

class SampleRateGetter
  implements IMachineComponentProvider, AudioSampleRateGetter
{
  readonly id = AUDIO_SAMPLE_RATE_GETTER_ID;
  getAudioSampleRate() {
    return 48000;
  }
}

class AudioFactory implements IMachineComponentProvider, AudioRendererFactory {
  readonly id = AUDIO_RENDERER_FACTORY_ID;
  createAudioRenderer(_s: number) {
    return new SilentAudioRenderer();
  }
}

/**
 * A no-op implementation of IZxSpectrumStateManager
 */
class StateManager
  implements IMachineComponentProvider, IZxSpectrumStateManager
{
  readonly id = ZX_SPECTRUM_STATE_MANAGER_ID;
  getState(): any {}
  setTapeContents(_contents: Uint8Array): void {}
  setPanelMessage(_message: string): void {}
  selectRom(_rom: number): void {}
  selectBank(_bank: number): void {}
  setLoadMode(_isLoad: boolean): void {}
  initiateTapeLoading(): void {}
}
