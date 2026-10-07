import { beforeEach, describe, expect, it } from "vitest";

import { BeamCommand, parseBeamSwitch } from "@renderer/appIde/commands/BeamCommands";
import { createMockContext } from "./test-helpers/mock-context";

// --- BEAM_POSITION_OVERLAY_PLAN D8: `beam [on|off]` is the View menu's "Show the Beam Position"

describe("beam", () => {
  let context: any;
  beforeEach(() => {
    context = createMockContext();
  });

  it("switches the setting on and off", async () => {
    expect((await new BeamCommand().execute(context, { state: "off" })).success).toBe(true);
    expect(context.mainApi.setGlobalSettingsValue).toHaveBeenCalledWith("emuViewOptions.showBeamPosition", false);
    await new BeamCommand().execute(context, { state: "ON" });
    expect(context.mainApi.setGlobalSettingsValue).toHaveBeenLastCalledWith("emuViewOptions.showBeamPosition", true);
    expect(context.output.writeLine).toHaveBeenCalledWith("Beam position: shown while paused");
  });

  it("without an argument only tells the state (on by default)", async () => {
    await new BeamCommand().execute(context, {});
    expect(context.mainApi.setGlobalSettingsValue).not.toHaveBeenCalled();
    expect(context.output.writeLine).toHaveBeenCalledWith("Beam position: shown while paused");
  });

  it("validates its argument", async () => {
    const cmd = new BeamCommand();
    expect(await cmd.validateCommandArgs(context, {})).toEqual([]);
    expect(await cmd.validateCommandArgs(context, { state: "off" })).toEqual([]);
    expect(await cmd.validateCommandArgs(context, { state: "maybe" })).toHaveLength(1);
    expect(parseBeamSwitch(" Off ")).toBe(false);
    expect(parseBeamSwitch("x")).toBeUndefined();
  });
});
