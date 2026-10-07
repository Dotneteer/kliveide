import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";

import { BEAM_POSITION_MACHINE_IDS } from "@common/machines/constants";
import { SETTING_EMU_SHOW_BEAM_POSITION } from "@common/settings/setting-const";
import { getGlobalSetting } from "@renderer/core/RendererProvider";
import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  validationError,
  writeInfoMessage
} from "@renderer/appIde/services/ide-commands";

/** "on"/"off" to a value; undefined for anything else */
export function parseBeamSwitch(arg: string | undefined): boolean | undefined {
  const v = arg?.trim().toLowerCase();
  return v === "on" ? true : v === "off" ? false : undefined;
}

/**
 * `beam [on|off]`: shows or hides the beam position overlay on the paused emulator screen
 * (`.plans/BEAM_POSITION_OVERLAY_PLAN.md` D8) - the same setting as the View menu item and the
 * emulator toolbar button. Without an argument, says whether it is on.
 */
export class BeamCommand extends IdeCommandBase<{ state?: string }> {
  readonly id = "beam";
  readonly description =
    "Shows or hides the raster beam's position on the emulator screen while the machine is paused. " +
    "Without an argument, tells whether it is shown.";
  readonly usage = "beam [on|off]";
  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "state", type: "string" }]
  };

  async validateCommandArgs(_context: IdeCommandContext, args: { state?: string }): Promise<ValidationMessage[]> {
    if (args.state === undefined || parseBeamSwitch(args.state) !== undefined) return [];
    return [validationError(`Use 'on' or 'off', not '${args.state}'`)];
  }

  async execute(context: IdeCommandContext, args: { state?: string }): Promise<IdeCommandResult> {
    // --- No raster beam to show: the Z88's LCD, the ZX80/81, the C64
    const machineId = context.service.machineService.getMachineInfo()?.machine?.machineId;
    if (!BEAM_POSITION_MACHINE_IDS.includes(machineId)) {
      return commandError("This machine has no raster beam to show");
    }
    const value = parseBeamSwitch(args?.state);
    if (args?.state !== undefined && value === undefined) return commandError(`Use 'on' or 'off', not '${args.state}'`);
    if (value !== undefined) {
      await context.mainApi.setGlobalSettingsValue(SETTING_EMU_SHOW_BEAM_POSITION, value);
    }
    const shown = value ?? !!getGlobalSetting(context.store, SETTING_EMU_SHOW_BEAM_POSITION);
    writeInfoMessage(context.output, `Beam position: ${shown ? "shown while paused" : "hidden"}`);
    return commandSuccess;
  }
}
