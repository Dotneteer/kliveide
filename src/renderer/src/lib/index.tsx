import { sharedAppStateComponentRenderer } from "./react-components/SharedAppState/SharedAppState";
import { emuMessageProcessorComponentRenderer } from "./react-components/EmuMessageProcessor/EmuMessageProcessor";
import { emuAppContextComponentRenderer } from "./react-components/EmuAppContext/EmuAppContext";

export default {
  namespace: "XMLUIExtensions",
  components: [
    sharedAppStateComponentRenderer,
    emuMessageProcessorComponentRenderer,
    emuAppContextComponentRenderer,
  ],
};
