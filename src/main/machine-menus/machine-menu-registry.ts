import type { MachineMenuInfo } from "@common/machines/info-types";

import {
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_Z88,
  MI_ZX80,
  MI_ZX81,
  MI_ZXNEXT,
  MI_TIMEX
} from "@common/machines/constants";
import { zx8081TapeMenuRenderer } from "./zx8081-menus";
import {
  tapeMenuRenderer,
  spectrumIdeRenderer,
  diskMenuRenderer,
  trdosRomMenuRenderer,
  sp48RomMenuRenderer,
  spectrumSnapshotRenderer
} from "./zx-specrum-menus";
import {
  z88KeyboardLayoutRenderer,
  z88LcdRenderer,
  z88ResetRenderer,
  z88SnapshotRenderer
} from "./z88-menus";
import {
  hotkeyMenuRenderer,
  initializeZxSpectrumNext,
  sdCardMenuRenderer,
  setupZxSpectrumNext
} from "./zx-next-menus";
import { joystickMenuRenderer, mouseMenuRenderer } from "./zx-next-input-menus";
import { machineStateMenuRenderer } from "./state-menus";
import { rzxMenuRenderer } from "./rzx-menus";
import { timexDockMenuRenderer, timexJoystickMenuRenderer, timexRomMenuRenderer } from "./timex-menus";

/**
 * Machine-specific menu information
 */
export const machineMenuRegistry: Record<string, MachineMenuInfo> = {
  [MI_ZX81]: {
    machineItems: (windowInfo, machine, model) => [
      ...zx8081TapeMenuRenderer(windowInfo, machine, model),
      ...machineStateMenuRenderer(windowInfo, machine, model)
    ]
  },
  [MI_ZX80]: {
    machineItems: (windowInfo, machine, model) => [
      ...zx8081TapeMenuRenderer(windowInfo, machine, model),
      ...machineStateMenuRenderer(windowInfo, machine, model)
    ]
  },
  [MI_SPECTRUM_48]: {
    machineItems: (windowInfo, machine, model) => [
      ...tapeMenuRenderer(windowInfo, machine, model),
      ...spectrumSnapshotRenderer(windowInfo, machine, model),
      ...rzxMenuRenderer(windowInfo, machine, model),
      ...machineStateMenuRenderer(windowInfo, machine, model),
      ...sp48RomMenuRenderer(windowInfo, machine, model)
    ],
    ideItems: spectrumIdeRenderer
  },
  [MI_TIMEX]: {
    machineItems: (windowInfo, machine, model) => [
      ...tapeMenuRenderer(windowInfo, machine, model),
      ...timexDockMenuRenderer(windowInfo, machine, model),
      ...timexJoystickMenuRenderer(windowInfo, machine, model),
      ...spectrumSnapshotRenderer(windowInfo, machine, model),
      ...machineStateMenuRenderer(windowInfo, machine, model),
      ...timexRomMenuRenderer(windowInfo, machine, model)
    ],
    ideItems: spectrumIdeRenderer
  },
  [MI_SPECTRUM_128]: {
    machineItems: (windowInfo, machine, model) => [
      ...tapeMenuRenderer(windowInfo, machine, model),
      // --- The Pentagon's Beta 128 (model config `MC_DISK_SUPPORT`; none on the 128K)
      ...diskMenuRenderer(windowInfo, machine, model),
      ...trdosRomMenuRenderer(windowInfo, machine, model),
      ...spectrumSnapshotRenderer(windowInfo, machine, model),
      ...rzxMenuRenderer(windowInfo, machine, model),
      ...machineStateMenuRenderer(windowInfo, machine, model)
    ],
    ideItems: spectrumIdeRenderer
  },
  [MI_SPECTRUM_3E]: {
    machineItems: (windowInfo, machine, model) => [
      ...tapeMenuRenderer(windowInfo, machine, model),
      ...diskMenuRenderer(windowInfo, machine, model),
      ...spectrumSnapshotRenderer(windowInfo, machine, model),
      ...rzxMenuRenderer(windowInfo, machine, model),
      ...machineStateMenuRenderer(windowInfo, machine, model)
    ],
    ideItems: spectrumIdeRenderer
  },
  [MI_Z88]: {
    machineItems: (windowInfo, machine, model) => [
      ...z88KeyboardLayoutRenderer(windowInfo, machine, model),
      ...z88LcdRenderer(windowInfo, machine, model),
      ...z88SnapshotRenderer(windowInfo, machine, model),
      ...machineStateMenuRenderer(windowInfo, machine, model),
      ...z88ResetRenderer(windowInfo, machine, model)
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
        label: "Cambridge Z88 ROM source code",
        url: "https://bitbucket.org/cambridge/oz/"
      },
      {
        label: "Cambridge Z88 3rd party apps",
        url: "https://bitbucket.org/cambridge/z88/"
      },
      {
        label: "Cambridge Z88 tools and games",
        url: "https://gitlab.com/b4works"
      },
      {
        label: "Cambridge Z88 on Wikipedia",
        url: "https://en.wikipedia.org/wiki/Cambridge_Z88"
      }
    ]
  },
  [MI_ZXNEXT]: {
    machineItems: (windowInfo, machine, model) => [
      ...hotkeyMenuRenderer(windowInfo, machine, model),
      ...sdCardMenuRenderer(windowInfo, machine, model),
      ...joystickMenuRenderer(windowInfo, machine, model),
      ...mouseMenuRenderer(windowInfo, machine, model),
      ...machineStateMenuRenderer(windowInfo, machine, model)
    ],
    ideItems: spectrumIdeRenderer,
    initializer: initializeZxSpectrumNext,
    setup: setupZxSpectrumNext
  }
};
