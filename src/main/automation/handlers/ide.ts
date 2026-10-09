import { encodePng } from "@common/imaging/png";
import { AUTOMATION_EVENTS, type AutomationEvent } from "@common/automation/protocol";
import { automationError, invalidParams } from "../errors";
import type { MethodTable } from "../method-types";
import { optionalString, requireSingleLine } from "../method-types";
import { commandRunResult, runIdeCommand } from "./commands";

/*
 * `screen.capture`, `ide.command` and `events.*` (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` §4.2,
 * D9, D11, Q7).
 */

/** The notifications a subscription without a list gets: everything but the noisy output (D11) */
const DEFAULT_EVENTS: AutomationEvent[] = AUTOMATION_EVENTS.filter((e) => e !== "ide.output");

function eventList(value: unknown): AutomationEvent[] {
  if (value === undefined || value === null) return DEFAULT_EVENTS;
  if (!Array.isArray(value)) throw invalidParams("'events' must be an array of event names.");
  for (const name of value) {
    if (!(AUTOMATION_EVENTS as readonly unknown[]).includes(name)) {
      throw invalidParams(`Unknown event ${JSON.stringify(name)}. Events: ${AUTOMATION_EVENTS.join(", ")}.`);
    }
  }
  return value as AutomationEvent[];
}

export const ideMethods: MethodTable = {
  "screen.capture": {
    level: "read",
    queued: true,
    needsReady: true,
    handler: async (params, ctx) => {
      const format = optionalString(params, "format") ?? "png";
      if (format !== "png") throw invalidParams("'format' must be \"png\".");
      if (!ctx.host.getState()?.emulatorState?.machineId) {
        throw automationError("no-machine", "No machine is set up yet.");
      }
      // --- The emulated picture only (Q7): what the machine drew, not the IDE window
      const image = await ctx.host.emu.getScreenImage();
      if (!image?.width || !image?.height) {
        throw automationError("no-machine", "The machine has no picture yet.");
      }
      const png = encodePng(image.pixels, image.width, image.height);
      return { format: "png", width: image.width, height: image.height, data: png.toString("base64") };
    }
  },
  "ide.command": {
    level: "full",
    queued: true,
    needsReady: true,
    handler: async (params, ctx) => {
      const text = requireSingleLine(params, "text");
      return commandRunResult(await runIdeCommand(ctx, text));
    }
  },
  "events.subscribe": {
    level: "read",
    queued: false,
    needsReady: false,
    handler: async (params, ctx) => {
      for (const event of eventList(params.events)) ctx.connection.subscriptions.add(event);
      return { events: [...ctx.connection.subscriptions] };
    }
  },
  "events.unsubscribe": {
    level: "read",
    queued: false,
    needsReady: false,
    handler: async (params, ctx) => {
      const events = params.events === undefined ? [...ctx.connection.subscriptions] : eventList(params.events);
      for (const event of events) ctx.connection.subscriptions.delete(event);
      return { events: [...ctx.connection.subscriptions] };
    }
  }
};
