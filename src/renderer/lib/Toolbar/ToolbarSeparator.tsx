import { createMetadata, wrapComponent } from "xmlui";
import type { ComponentMetadata } from "xmlui";
import { ToolbarSeparatorReact } from "./ToolbarSeparatorReact";

const COMP = "ToolbarSeparator";

export const ToolbarSeparatorMd: ComponentMetadata = createMetadata({
  status: "experimental",
  description: "Displays a Klive toolbar separator.",
  props: {},
  events: {}
});

export const toolbarSeparatorComponentRenderer = wrapComponent(
  COMP,
  ToolbarSeparatorReact,
  ToolbarSeparatorMd
);
