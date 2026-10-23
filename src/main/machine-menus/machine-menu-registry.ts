import type { MachineMenuInfo, MachineMenuRenderer } from "@common/machines/info-types";

import {
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_Z88,
  MI_ZX80,
  MI_ZX81,
  MI_ZXNEXT,
  MI_TIMEX,
  MI_SCORPION,
  MI_HT1080Z
} from "@common/machines/constants";
import { zx8081TapeMenuRenderer } from "./zx8081-menus";
import { tapeMenuRenderer, spectrumIdeRenderer, diskMenuRenderer, ulaHardwareRenderer } from "./zx-specrum-menus";
import { z88ResetRenderer } from "./z88-menus";
import { ht1080zHardwareRenderer, ht1080zTapeMenuRenderer } from "./ht1080z-menus";
import {
  hotkeyMenuRenderer,
  initializeZxSpectrumNext,
  nextDebugMenuRenderer,
  nextViewsMenuRenderer,
  sdCardMenuRenderer,
  setupZxSpectrumNext
} from "./zx-next-menus";
import { joystickMenuRenderer, mouseMenuRenderer } from "./zx-next-input-menus";
import { rzxMenuRenderer } from "./rzx-menus";
import { timexDockMenuRenderer, timexJoystickMenuRenderer } from "./timex-menus";

/** Renders the items of several renderers, one after the other */
function combine(...renderers: MachineMenuRenderer[]): MachineMenuRenderer {
  return (windowInfo, machine, model, config) =>
    renderers.flatMap((r) => r(windowInfo, machine, model, config));
}

/**
 * Machine-specific menu information (`.plans/MENU_REDESIGN_PLAN.md`): where each machine's own
 * items appear in the menu. Machine options that are set once (ROM files, the Z88's keyboard layout
 * and LCD) are in Settings › Machine, not here.
 */
export const machineMenuRegistry: Record<string, MachineMenuInfo> = {
  // --- The BASIC Listing view lists ZX81 and ZX80 programs in their own formats too
  [MI_ZX81]: {
    devices: { program: zx8081TapeMenuRenderer },
    viewItems: spectrumIdeRenderer
  },
  [MI_ZX80]: {
    devices: { program: zx8081TapeMenuRenderer },
    viewItems: spectrumIdeRenderer
  },
  [MI_HT1080Z]: {
    devices: { tape: ht1080zTapeMenuRenderer },
    hardwareItems: ht1080zHardwareRenderer,
    // --- The BASIC Listing view lists Level II BASIC programs (`.plans/HT1080Z_PLAN.md` §11)
    viewItems: spectrumIdeRenderer
  },
  [MI_SPECTRUM_48]: {
    devices: { tape: tapeMenuRenderer },
    hardwareItems: ulaHardwareRenderer,
    viewItems: spectrumIdeRenderer,
    recordItems: rzxMenuRenderer
  },
  [MI_TIMEX]: {
    devices: {
      tape: tapeMenuRenderer,
      cartridge: timexDockMenuRenderer,
      input: timexJoystickMenuRenderer
    },
    viewItems: spectrumIdeRenderer
  },
  [MI_SPECTRUM_128]: {
    devices: {
      tape: tapeMenuRenderer,
      // --- The Pentagon's Beta 128 (model config `MC_DISK_SUPPORT`; none on the 128K)
      disks: diskMenuRenderer
    },
    hardwareItems: ulaHardwareRenderer,
    viewItems: spectrumIdeRenderer,
    recordItems: rzxMenuRenderer
  },
  [MI_SCORPION]: {
    devices: { tape: tapeMenuRenderer, disks: diskMenuRenderer },
    viewItems: spectrumIdeRenderer
  },
  [MI_SPECTRUM_3E]: {
    devices: { tape: tapeMenuRenderer, disks: diskMenuRenderer },
    viewItems: spectrumIdeRenderer,
    recordItems: rzxMenuRenderer
  },
  [MI_Z88]: {
    hardwareItems: z88ResetRenderer,
    helpLinks: [
      {
        labelKey: "menu.help.z88.userGuide",
        url: "https://cambridgez88.jira.com/wiki/spaces/UG/"
      },
      {
        labelKey: "menu.help.z88.developersNotes",
        url: "https://cambridgez88.jira.com/wiki/spaces/DN/"
      },
      {
        labelKey: "menu.help.z88.bbcBasicGuide",
        url: "https://docs.google.com/document/d/1ZFxKYsfNvbuTyErnH5Xtv2aKXWk1vg5TjrAxZnrLsuI"
      },
      {},
      {
        labelKey: "menu.help.z88.romSource",
        url: "https://bitbucket.org/cambridge/oz/"
      },
      {
        labelKey: "menu.help.z88.thirdPartyApps",
        url: "https://bitbucket.org/cambridge/z88/"
      },
      {
        labelKey: "menu.help.z88.toolsAndGames",
        url: "https://gitlab.com/b4works"
      },
      {
        labelKey: "menu.help.z88.wikipedia",
        url: "https://en.wikipedia.org/wiki/Cambridge_Z88"
      }
    ]
  },
  [MI_ZXNEXT]: {
    devices: {
      sdCard: sdCardMenuRenderer,
      input: combine(joystickMenuRenderer, mouseMenuRenderer)
    },
    hardwareItems: hotkeyMenuRenderer,
    viewItems: combine(spectrumIdeRenderer, nextViewsMenuRenderer),
    debugItems: nextDebugMenuRenderer,
    initializer: initializeZxSpectrumNext,
    setup: setupZxSpectrumNext
  }
};
