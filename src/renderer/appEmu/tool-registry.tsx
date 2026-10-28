import {
  MI_HT1080Z,
  MI_TVC,
  MI_SCORPION,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_TIMEX,
  MI_Z88,
  MI_ZXNEXT
} from "@common/machines/constants";
import { SETTING_EMU_SHOW_MEDIA_INFO, SETTING_EMU_SHOW_NEXT_LAYERS } from "@common/settings/setting-const";
import { ReactNode } from "react";
import { Z88ToolArea } from "./machines/Z88ToolArea";
import { SpectrumMediaToolArea } from "./machines/SpectrumMediaToolArea";
import { NextLayersToolArea } from "./machines/NextLayersToolArea";
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
  spectrumMediaTool(MI_TIMEX),
  spectrumMediaTool(MI_SCORPION),
  // --- The HT-1080Z's tape: the same strip, with no disk drives (`.plans/HT1080Z_PLAN.md` §11)
  spectrumMediaTool(MI_HT1080Z),
  // --- The Videoton TVC's tape (`.plans/VIDEOTON_TVC_PLAN.md` §9)
  spectrumMediaTool(MI_TVC),
  // --- The ZX Spectrum Next's Layers strip (`.plans/LAYER_COMPOSITION_PLAN.md` §4.5); off by default (Q3)
  {
    machineId: MI_ZXNEXT,
    toolFactory: (machine: IAnyMachine) => <NextLayersToolArea machine={machine} />,
    visibilitySetting: SETTING_EMU_SHOW_NEXT_LAYERS
  }
];
