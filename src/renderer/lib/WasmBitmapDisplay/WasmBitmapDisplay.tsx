import { createMetadata, wrapComponent } from "xmlui";
import type { ComponentMetadata } from "xmlui";
import { WasmBitmapDisplayReact } from "./WasmBitmapDisplayReact";

const COMP = "WasmBitmapDisplay";

export const WasmBitmapDisplayMd: ComponentMetadata = createMetadata({
  status: "experimental",
  description: "Displays the WebAssembly-generated emulator bitmap proof of concept.",
  props: {},
  events: {}
});

export const wasmBitmapDisplayComponentRenderer = wrapComponent(
  COMP,
  WasmBitmapDisplayReact,
  WasmBitmapDisplayMd
);
