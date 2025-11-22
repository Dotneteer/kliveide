import { createComponentRenderer, createMetadata } from "xmlui";
import { EmuAppContextNative } from "./EmuAppContextNative";

const COMP = "EmuAppContext";

export const EmuAppContextMd = createMetadata({
  status: "stable",
  description:
    "`EmuAppContext` is an invisible component that wraps its children in an EmuAppServicesProvider. " +
    "It initializes the provider with an EmuAppServices instance containing the machineService. " +
    "This makes emulator services available to all child components via the useEmuAppServices() hook.\n\n" +
    "**Usage Example:**\n" +
    "```xmlui\n" +
    "<Component name=\"EmuApp\">\n" +
    "  <SharedAppState id=\"appState\" />\n" +
    "  <EmuAppContext>\n" +
    "    <App name=\"Klive Emulator\">\n" +
    "      <!-- Child components can access services via useEmuAppServices hook -->\n" +
    "      <EmulatorArea />\n" +
    "    </App>\n" +
    "  </EmuAppContext>\n" +
    "</Component>\n" +
    "```\n\n" +
    "The component automatically creates the EmuAppServices instance with a properly configured " +
    "MachineService and makes it available through React Context.",
  nonVisual: true,
  props: {},
  events: {},
  apis: {},
});

export const emuAppContextComponentRenderer = createComponentRenderer(
  COMP,
  EmuAppContextMd,
  ({ node, renderChild, registerComponentApi, updateState }) => {
    return (
      <EmuAppContextNative
        registerComponentApi={registerComponentApi}
        updateState={updateState}
      >
        {renderChild(node.children)}
      </EmuAppContextNative>
    );
  },
);
