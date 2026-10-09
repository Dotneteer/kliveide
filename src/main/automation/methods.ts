import { AUTOMATION_EVENTS, AUTOMATION_METHODS, levelAllows } from "@common/automation/protocol";
import type { MethodTable } from "./method-types";
import { sessionMethods } from "./handlers/session";
import { machineMethods } from "./handlers/machine";
import { cpuMethods } from "./handlers/cpu";
import { memoryMethods } from "./handlers/memory";
import { breakpointMethods } from "./handlers/breakpoints";
import { projectMethods } from "./handlers/project";
import { ideMethods } from "./handlers/ide";

/*
 * The method table (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D7, D8): every method of protocol 1,
 * the level it needs, whether it runs in the queue, and its handler. One table, so the level of
 * every method is visible in one place - and `test/automation/methods.test.ts` checks that it lists
 * exactly `AUTOMATION_METHODS`, so no method can exist without a level.
 */
export const AUTOMATION_METHOD_TABLE: MethodTable = {
  ...sessionMethods,
  "session.capabilities": {
    level: "read",
    queued: false,
    needsReady: false,
    handler: async (_params, ctx) => ({
      methods: AUTOMATION_METHODS.map((name) => {
        const level = AUTOMATION_METHOD_TABLE[name].level;
        return {
          name,
          level,
          allowed: level === "none" || levelAllows(ctx.connection.level, level)
        };
      }),
      events: [...AUTOMATION_EVENTS]
    })
  },
  ...machineMethods,
  ...cpuMethods,
  ...memoryMethods,
  ...breakpointMethods,
  ...projectMethods,
  ...ideMethods
};
