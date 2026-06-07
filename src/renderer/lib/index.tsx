import { helloComponentRenderer } from "./Hello/Hello";
import { sharedAppStateComponentRenderer } from "./SharedAppState/SharedAppState";
import { wasmBitmapDisplayComponentRenderer } from "./WasmBitmapDisplay/WasmBitmapDisplay";

export default {
  namespace: "XMLUIExtensions",
  components: [
    helloComponentRenderer,
    sharedAppStateComponentRenderer,
    wasmBitmapDisplayComponentRenderer,
  ]
};
