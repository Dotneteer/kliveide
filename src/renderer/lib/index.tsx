import { emuKeyboardComponentRenderer } from "./EmuKeyboard/EmuKeyboard";
import { emuMachineCommandsComponentRenderer } from "./EmuMachineCommands/EmuMachineCommands";
import { emulatorPanelComponentRenderer } from "./EmulatorPanel/EmulatorPanel";
import { helloComponentRenderer } from "./Hello/Hello";
import { persistedSettingOnReleaseComponentRenderer } from "./PersistedSettingOnRelease/PersistedSettingOnRelease";
import { sharedAppStateComponentRenderer } from "./SharedAppState/SharedAppState";
import { toolbarButtonComponentRenderer } from "./Toolbar/ToolbarButton";
import { toolbarSeparatorComponentRenderer } from "./Toolbar/ToolbarSeparator";
import { wasmBitmapDisplayComponentRenderer } from "./WasmBitmapDisplay/WasmBitmapDisplay";

export default {
  namespace: "XMLUIExtensions",
  components: [
    emuKeyboardComponentRenderer,
    emuMachineCommandsComponentRenderer,
    emulatorPanelComponentRenderer,
    helloComponentRenderer,
    persistedSettingOnReleaseComponentRenderer,
    sharedAppStateComponentRenderer,
    toolbarButtonComponentRenderer,
    toolbarSeparatorComponentRenderer,
    wasmBitmapDisplayComponentRenderer,
  ]
};
