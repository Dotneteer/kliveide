import { helloComponentRenderer } from "./Hello/Hello";
import { sharedAppStateComponentRenderer } from "./SharedAppState/SharedAppState";
import { toolbarButtonComponentRenderer } from "./Toolbar/ToolbarButton";
import { toolbarSeparatorComponentRenderer } from "./Toolbar/ToolbarSeparator";
import { wasmBitmapDisplayComponentRenderer } from "./WasmBitmapDisplay/WasmBitmapDisplay";

export default {
  namespace: "XMLUIExtensions",
  components: [
    helloComponentRenderer,
    sharedAppStateComponentRenderer,
    toolbarButtonComponentRenderer,
    toolbarSeparatorComponentRenderer,
    wasmBitmapDisplayComponentRenderer,
  ]
};
