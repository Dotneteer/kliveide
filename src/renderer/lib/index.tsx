import { emuKeyboardComponentRenderer } from "./EmuKeyboard/EmuKeyboard";
import { emuMachineCommandsComponentRenderer } from "./EmuMachineCommands/EmuMachineCommands";
import { emulatorPanelComponentRenderer } from "./EmulatorPanel/EmulatorPanel";
import { helloComponentRenderer } from "./Hello/Hello";
import { persistedSettingOnReleaseComponentRenderer } from "./PersistedSettingOnRelease/PersistedSettingOnRelease";
import { sharedAppStateComponentRenderer } from "./SharedAppState/SharedAppState";
import { sideBarPanelItemComponentRenderer } from "./SideBarPanels/SideBarPanelItem";
import { sideBarPanelStackComponentRenderer } from "./SideBarPanels/SideBarPanelStack";
import { splitterSizeGuardComponentRenderer } from "./SplitterSizeGuard/SplitterSizeGuard";
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
    sideBarPanelItemComponentRenderer,
    sideBarPanelStackComponentRenderer,
    splitterSizeGuardComponentRenderer,
    toolbarButtonComponentRenderer,
    toolbarSeparatorComponentRenderer,
    wasmBitmapDisplayComponentRenderer,
  ]
};
