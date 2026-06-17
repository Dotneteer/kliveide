import { emuKeyboardComponentRenderer } from "./EmuKeyboard/EmuKeyboard";
import { emuMachineCommandsComponentRenderer } from "./EmuMachineCommands/EmuMachineCommands";
import { emulatorPanelComponentRenderer } from "./EmulatorPanel/EmulatorPanel";
import { helloComponentRenderer } from "./Hello/Hello";
import { panelDragSourceComponentRenderer } from "./PanelDragDrop/PanelDragSource";
import { panelDropTargetComponentRenderer } from "./PanelDragDrop/PanelDropTarget";
import { panelRuntimeComponentRenderer } from "./PanelRuntime/PanelRuntime";
import { persistedSettingOnReleaseComponentRenderer } from "./PersistedSettingOnRelease/PersistedSettingOnRelease";
import { sharedAppStateComponentRenderer } from "./SharedAppState/SharedAppState";
import { sideBarPanelItemComponentRenderer } from "./SideBarPanels/SideBarPanelItem";
import { sideBarPanelStackComponentRenderer } from "./SideBarPanels/SideBarPanelStack";
import { splitterSizeGuardComponentRenderer } from "./SplitterSizeGuard/SplitterSizeGuard";
import { toolbarButtonComponentRenderer } from "./Toolbar/ToolbarButton";
import { toolbarSeparatorComponentRenderer } from "./Toolbar/ToolbarSeparator";
import { wasmBitmapDisplayComponentRenderer } from "./WasmBitmapDisplay/WasmBitmapDisplay";
import { z80CpuPanelComponentRenderer } from "./Z80CpuPanel/Z80CpuPanel";

export default {
  namespace: "XMLUIExtensions",
  components: [
    emuKeyboardComponentRenderer,
    emuMachineCommandsComponentRenderer,
    emulatorPanelComponentRenderer,
    helloComponentRenderer,
    panelDragSourceComponentRenderer,
    panelDropTargetComponentRenderer,
    panelRuntimeComponentRenderer,
    persistedSettingOnReleaseComponentRenderer,
    sharedAppStateComponentRenderer,
    sideBarPanelItemComponentRenderer,
    sideBarPanelStackComponentRenderer,
    splitterSizeGuardComponentRenderer,
    toolbarButtonComponentRenderer,
    toolbarSeparatorComponentRenderer,
    wasmBitmapDisplayComponentRenderer,
    z80CpuPanelComponentRenderer,
  ]
};
