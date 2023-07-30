import "_public/style.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { IpcRendereApi } from "../exposed-apis";

import { registerThemes } from "@components/register-themes";
import { EmuApp } from "./EmuApp";
import {
  DIALOG_SERVICE,
  MODAL_DIALOG_SERVICE,
  registerService,
  STORE_SERVICE,
  THEME_SERVICE,
  VM_CONTROLLER_SERVICE,
} from "@core/service-registry";
import { dispatch, getState, getStore } from "@core/service-registry";
import { KliveStore } from "@state/KliveStore";
import { applyMiddleware, combineReducers, createStore } from "redux";
import { getInitialAppState } from "@state/AppState";
import { appReducers } from "@state/app-reducers";
import { ForwardActionRequest } from "@core/messaging/message-types";
import { RendererToMainStateForwarder } from "@components/RendererToMainStateForwarder";
import { KliveAction } from "@state/state-core";
import { ThemeService } from "@themes/theme-service";
import { ModalDialogService } from "@services/modal-service";
import { registerSite } from "@abstractions/process-site";
import { registerCommonCommands } from "@abstractions/common-commands";
import { startCommandStatusQuery } from "@abstractions/command-registry";
import { DialogService } from "@services/dialog-service";
import {
  AudioRendererFactory,
  AudioSampleRateGetter,
  AUDIO_RENDERER_FACTORY_ID,
  AUDIO_SAMPLE_RATE_GETTER_ID,
  IMachineComponentProvider,
  WaModuleLoader,
  WA_MODULE_LOADER_ID,
} from "@modules-core/abstract-vm";
import { AudioRenderer } from "@modules-core/audio/AudioRenderer";
import { getEngineDependencyRegistry } from "@modules-core/vm-engine-dependency-registry";
import { ZxSpectrumStateManager } from "@modules/vm-zx-spectrum/ZxSpectrumStateManager";
import { CambridgeZ88StateManager } from "@modules/vm-z88/CambridgeZ88BaseStateManager";
import { getVmEngineService } from "@modules-core/vm-engine-service";

// ============================================================================
// Classes to handle engine dependencies
class WaLoader implements IMachineComponentProvider, WaModuleLoader {
  readonly id = WA_MODULE_LOADER_ID;
  loadWaContents = async (moduleFile: string) => {
    const response = await fetch("./wasm/" + moduleFile);
    return await response.arrayBuffer();
  };
}

class SampleRateGetter
  implements IMachineComponentProvider, AudioSampleRateGetter
{
  readonly id = AUDIO_SAMPLE_RATE_GETTER_ID;
  getAudioSampleRate() {
    try { 
      var ctx = new AudioContext();
      return ctx.sampleRate;
    }
    finally {
      // The specification doesn't go into a lot of detail about things like how many
      // audio contexts a user agent should support, or minimum or maximum latency
      // requirements (if any), so these details can vary from browser to browser.
      // More details: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext
      ctx?.close().catch(console.error);
    }
  }
}

class AudioFactory implements IMachineComponentProvider, AudioRendererFactory {
  readonly id = AUDIO_RENDERER_FACTORY_ID;
  createAudioRenderer(s: number) {
    return new AudioRenderer(s);
  }
}

// ------------------------------------------------------------------------------
// Initialize the forwarder that sends application state changes to the main
// process to keep the same state in each process

// --- Electron APIs exposed for the renderer process
const ipcRenderer = globalThis.window
  ? ((window as any).ipcRenderer as IpcRendereApi)
  : null;

// --- This instance forwards renderer actions to the main process
const forwarder = new RendererToMainStateForwarder("emu");

// Indicates if we're in forwarding mode
let isForwarding = false;

// --- This middleware function forwards the action originated in the main process
// --- to the renderer processes of browser windows.
const forwardToMainMiddleware = () => (next: any) => (action: KliveAction) => {
  if (!isForwarding) {
    forwarder.forwardAction(action);
  }
  return next(action);
};

// ------------------------------------------------------------------------------
// --- Sign we are in the emulator renderer process

registerSite("emu");
registerCommonCommands();

// ------------------------------------------------------------------------------
// --- Register the main services

// --- Application state store (redux)
registerService(
  STORE_SERVICE,
  new KliveStore(
    createStore(
      combineReducers(appReducers),
      getInitialAppState(),
      applyMiddleware(forwardToMainMiddleware)
    )
  )
);

// --- Register additional services
registerService(THEME_SERVICE, new ThemeService());
registerService(MODAL_DIALOG_SERVICE, new ModalDialogService());
registerService(DIALOG_SERVICE, new DialogService());
registerService(VM_CONTROLLER_SERVICE, getVmEngineService());

// --- Prepare the themes used in this app
registerThemes(getState().isWindows ?? false);

// --- Set up the virual machine engine service with the
const deps = getEngineDependencyRegistry();

deps.registerComponentDependency("sp48", new ZxSpectrumStateManager());
deps.registerComponentDependency("sp48", new WaLoader());
deps.registerComponentDependency("sp48", new SampleRateGetter());
deps.registerComponentDependency("sp48", new AudioFactory());

deps.registerComponentDependency("sp128", new ZxSpectrumStateManager());
deps.registerComponentDependency("sp128", new WaLoader());
deps.registerComponentDependency("sp128", new SampleRateGetter());
deps.registerComponentDependency("sp128", new AudioFactory());

deps.registerComponentDependency("spP3e", new ZxSpectrumStateManager());
deps.registerComponentDependency("spP3e", new WaLoader());
deps.registerComponentDependency("spP3e", new SampleRateGetter());
deps.registerComponentDependency("spP3e", new AudioFactory());

deps.registerComponentDependency("cz88", new CambridgeZ88StateManager());
deps.registerComponentDependency("cz88", new WaLoader());
deps.registerComponentDependency("cz88", new SampleRateGetter());
deps.registerComponentDependency("cz88", new AudioFactory());

// --- Start the listener that processes state changes coming
// --- from the main process

ipcRenderer?.on("RendererStateRequest", (_ev, msg: ForwardActionRequest) => {
  isForwarding = true;
  try {
    dispatch(msg.action);
  } finally {
    isForwarding = false;
  }
});

// --- Start idle command status refresh
startCommandStatusQuery();

// --- Render the main component of the emulator window
ReactDOM.render(
  <Provider store={getStore().store}>
    <EmuApp></EmuApp>
  </Provider>,
  document.getElementById("app")
);
