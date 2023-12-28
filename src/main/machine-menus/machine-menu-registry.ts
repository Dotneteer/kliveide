import {
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_Z88
} from "../../common/machines/constants";
import { MachineMenuInfo } from "../../common/machines/info-types";
import {
  tapeMenuRenderer,
  spectrumIdeRenderer,
  diskMenuRenderer
} from "./zx-specrum-menus";
import {
  z88KeyboardLayoutRenderer,
  z88LcdRenderer,
  z88ResetRenderer,
  z88RomAndCardRenderer
} from "./z88-menus";

/**
 * Machine-specific menu information
 */
export const machineMenuRegistry: Record<string, MachineMenuInfo> = {
  [MI_SPECTRUM_48]: {
    machineItems: tapeMenuRenderer,
    ideItems: spectrumIdeRenderer
  },
  [MI_SPECTRUM_128]: {
    machineItems: tapeMenuRenderer,
    ideItems: spectrumIdeRenderer
  },
  [MI_SPECTRUM_3E]: {
    machineItems: (windowInfo, machine, model) => [
      ...tapeMenuRenderer(windowInfo, machine, model),
      ...diskMenuRenderer(windowInfo, machine, model)
    ],
    ideItems: spectrumIdeRenderer
  },
  [MI_Z88]: {
    machineItems: (windowInfo, machine, model) => [
      ...z88KeyboardLayoutRenderer(windowInfo, machine, model),
      ...z88LcdRenderer(windowInfo, machine, model),
      ...z88ResetRenderer(windowInfo, machine, model),
      ...z88RomAndCardRenderer(windowInfo, machine, model)
    ],
    helpLinks: [
      {
        label: "Cambridge Z88 User Guide",
        url: "https://cambridgez88.jira.com/wiki/spaces/UG/"
      },
      {
        label: "Cambridge Z88 Developers' Notes",
        url: "https://cambridgez88.jira.com/wiki/spaces/DN/"
      },
      {
        label: "BBC BASIC (Z80) Reference Guide for Z88",
        url: "https://docs.google.com/document/d/1ZFxKYsfNvbuTyErnH5Xtv2aKXWk1vg5TjrAxZnrLsuI"
      },
      {},
      {
        label: "Cambridge Z88 ROM && 3rd party application source code",
        url: "https://bitbucket.org/cambridge/"
      },
      {
        label: "Cambridge Z88 on Wikipedia",
        url: "https://en.wikipedia.org/wiki/Cambridge_Z88"
      },
      {
        label: "Cambridge Z88 assembler tools and utilities",
        url: "https://gitlab.com/bits4fun"
      }
    ]
  }
};
