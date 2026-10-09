import {
  AUTOMATION_PROTOCOL_VERSION,
  type HelloResult,
  machineStateName
} from "@common/automation/protocol";
import type { AutomationHost } from "../host";
import type { MethodContext, MethodTable } from "../method-types";

/*
 * `session.*` (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` §4.2). The server itself checks the token
 * of `session.hello` before this handler runs; the handler only describes the session.
 */

/** The machine the store names, or null before one is set up */
function machineOf(host: AutomationHost): HelloResult["machine"] {
  const emu = host.getState()?.emulatorState;
  if (!emu?.machineId) return null;
  return { id: emu.machineId, ...(emu.modelId ? { model: emu.modelId } : {}) };
}

export function helloResult(ctx: Pick<MethodContext, "host" | "connection">): HelloResult {
  return {
    protocol: AUTOMATION_PROTOCOL_VERSION,
    version: ctx.host.version,
    ready: ctx.host.isReady(),
    level: ctx.connection.level,
    machine: machineOf(ctx.host)
  };
}

export const sessionMethods: MethodTable = {
  "session.hello": {
    level: "none",
    queued: false,
    needsReady: false,
    handler: async (_params, ctx) => helloResult(ctx)
  },
  "session.info": {
    level: "read",
    queued: false,
    needsReady: false,
    handler: async (_params, ctx) => {
      const state = ctx.host.getState();
      const project = state?.project;
      const machine = machineOf(ctx.host);
      let partitions: Record<string, string> | undefined;
      if (ctx.host.isReady() && machine) {
        try {
          partitions = await ctx.host.emu.getPartitionLabels();
        } catch {
          // --- A machine being rebuilt has no partitions to name yet
        }
      }
      return {
        ...helloResult(ctx),
        client: ctx.connection.client,
        machine: machine
          ? {
              ...machine,
              state: machineStateName(state?.emulatorState?.machineState),
              ...(partitions ? { partitions } : {})
            }
          : null,
        project: project?.folderPath
          ? {
              folder: project.folderPath,
              isKliveProject: !!project.isKliveProject,
              buildRoot: project.buildRoots?.[0] ?? null
            }
          : null
      };
    }
  }
};
