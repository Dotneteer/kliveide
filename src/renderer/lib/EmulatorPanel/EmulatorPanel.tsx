import { createMetadata, wrapComponent } from "xmlui";
import type { ComponentMetadata } from "xmlui";
import { EmulatorPanelReact } from "./EmulatorPanelReact";

const COMP = "EmulatorPanel";

export const EmulatorPanelMd: ComponentMetadata = createMetadata({
  status: "experimental",
  description: "Displays the current emulator machine panel.",
  props: {},
  events: {}
});

export const emulatorPanelComponentRenderer = wrapComponent(
  COMP,
  EmulatorPanelReact,
  EmulatorPanelMd
);
