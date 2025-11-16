import { sharedAppStateComponentRenderer } from "./react-components/SharedAppState/SharedAppState";
import { emuMessageProcessorComponentRenderer } from "./react-components/EmuMessageProcessor/EmuMessageProcessor";
import { emuAppContextComponentRenderer } from "./react-components/EmuAppContext/EmuAppContext";
import { machineInfoComponentRenderer } from "./react-components/MachineInfo/MachineInfo";

export default {
  namespace: "XMLUIExtensions",
  components: [
    sharedAppStateComponentRenderer,
    emuMessageProcessorComponentRenderer,
    emuAppContextComponentRenderer,
    machineInfoComponentRenderer,
  ],
};
