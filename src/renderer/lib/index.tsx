import { emuKeyboardComponentRenderer } from "./EmuKeyboard/EmuKeyboard";
import { emuMachineCommandsComponentRenderer } from "./EmuMachineCommands/EmuMachineCommands";
import { helloComponentRenderer } from "./Hello/Hello";
import { sharedAppStateComponentRenderer } from "./SharedAppState/SharedAppState";
import { toolbarButtonComponentRenderer } from "./Toolbar/ToolbarButton";
import { toolbarSeparatorComponentRenderer } from "./Toolbar/ToolbarSeparator";
import { wasmBitmapDisplayComponentRenderer } from "./WasmBitmapDisplay/WasmBitmapDisplay";
import { wasmSp48DisplayComponentRenderer } from "./WasmSp48Display/WasmSp48Display";

export default {
  namespace: "XMLUIExtensions",
  components: [
    emuKeyboardComponentRenderer,
    emuMachineCommandsComponentRenderer,
    helloComponentRenderer,
    sharedAppStateComponentRenderer,
    toolbarButtonComponentRenderer,
    toolbarSeparatorComponentRenderer,
    wasmBitmapDisplayComponentRenderer,
    wasmSp48DisplayComponentRenderer,
  ]
};
