import { createMetadata, wrapComponent } from "xmlui";
import type { ComponentMetadata } from "xmlui";
import { WasmSp48DisplayReact } from "./WasmSp48DisplayReact";

const COMP = "WasmSp48Display";

export const WasmSp48DisplayMd: ComponentMetadata = createMetadata({
  status: "experimental",
  description: "Displays the WebAssembly-backed ZX Spectrum 48K skeleton.",
  props: {},
  events: {}
});

export const wasmSp48DisplayComponentRenderer = wrapComponent(
  COMP,
  WasmSp48DisplayReact,
  WasmSp48DisplayMd
);
