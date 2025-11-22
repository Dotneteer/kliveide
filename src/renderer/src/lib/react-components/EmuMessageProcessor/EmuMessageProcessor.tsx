import { createComponentRenderer, createMetadata } from "xmlui";
import { EmuMessageProcessorNative } from "./EmuMessageProcessorNative";

const COMP = "EmuMessageProcessor";

export const EmuMessageProcessorMd = createMetadata({
  status: "stable",
  description:
    "`EmuMessageProcessor` is an invisible component that processes EmuApi messages " +
    "coming from the main process to the emulator renderer. It listens for API method " +
    "requests and handles them accordingly. This component should be used in the emulator " +
    "window to enable remote API calls from the main or IDE processes.\n\n" +
    "**Usage Example:**\n" +
    "```xmlui\n" +
    "<Component name=\"EmuApp\">\n" +
    "  <SharedAppState id=\"appState\" />\n" +
    "  <EmuMessageProcessor />\n" +
    "  <App name=\"Klive Emulator\" onReady=\"() => { delay(0); appState.emuLoaded(); }\">\n" +
    "    <!-- Emulator UI components -->\n" +
    "  </App>\n" +
    "</Component>\n" +
    "```\n\n" +
    "The component will log all incoming API method requests to the console and return " +
    "`undefined` for all calls. In the initial implementation, this serves as a debugging " +
    "tool to monitor API calls from the main process.",
  nonVisual: true,
  props: {},
  events: {},
  apis: {},
});

export const emuMessageProcessorComponentRenderer = createComponentRenderer(
  COMP,
  EmuMessageProcessorMd,
  ({ registerComponentApi, updateState }) => {
    return (
      <EmuMessageProcessorNative
        registerComponentApi={registerComponentApi}
        updateState={updateState}
      />
    );
  },
);
