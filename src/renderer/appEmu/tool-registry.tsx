import { MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_SPECTRUM_48, MI_TIMEX, MI_Z88 } from "@common/machines/constants";
import { SETTING_EMU_SHOW_MEDIA_INFO } from "@common/settings/setting-const";
import { ReactNode } from "react";
import { Z88ToolArea } from "./machines/Z88ToolArea";
import { SpectrumMediaToolArea } from "./machines/SpectrumMediaToolArea";
import { IAnyMachine } from "@renderer/abstractions/IAnyMachine";

export type EmuToolInfo = {
  machineId: string;
  toolFactory: (machine: IAnyMachine) => ReactNode;
  /**
   * A boolean global setting that switches the strip on and off. A strip without one is always
   * shown (the Z88's slot cards).
   */
  visibilitySetting?: string;
};

const spectrumMediaTool = (machineId: string): EmuToolInfo => ({
  machineId,
  toolFactory: () => <SpectrumMediaToolArea />,
  visibilitySetting: SETTING_EMU_SHOW_MEDIA_INFO
});

// --- Registry of machine-specific tools
export const machineEmuToolRegistry: EmuToolInfo[] = [
  {
    machineId: MI_Z88,
    toolFactory: (_machine: IAnyMachine) => {
      return <Z88ToolArea />;
    }
  },
  spectrumMediaTool(MI_SPECTRUM_48),
  spectrumMediaTool(MI_SPECTRUM_128),
  spectrumMediaTool(MI_SPECTRUM_3E),
  spectrumMediaTool(MI_TIMEX)
];
