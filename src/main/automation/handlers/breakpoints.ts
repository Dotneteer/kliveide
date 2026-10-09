import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { breakpointCommandSpec, breakpointKind } from "@common/utils/breakpoint-spec";
import type { MethodTable } from "../method-types";
import { requireSingleLine } from "../method-types";
import { runIdeCommandOrFail } from "./commands";

/*
 * `breakpoints.*` (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` §4.2). `set` and `remove` take the
 * `bp-set` / `bp-del` text, so conditions, hit counts, logpoints and partitions work exactly as they
 * do in the command prompt; `list` writes each breakpoint back as that text (`spec`).
 */

/** One breakpoint as `breakpoints.list` reports it */
export function describeBreakpoint(bp: BreakpointInfo, partitionLabels: Record<number, string>): Record<string, unknown> {
  const fromComment = bp.owner?.kind === "annotation";
  return {
    spec: breakpointCommandSpec(bp, partitionLabels ?? {}),
    kind: breakpointKind(bp),
    ...(bp.address !== undefined ? { address: bp.address } : {}),
    ...(bp.partition !== undefined ? { partition: partitionLabels?.[bp.partition] ?? bp.partition } : {}),
    ...(bp.resource ? { resource: bp.resource, line: bp.line } : {}),
    enabled: !bp.disabled,
    ...(bp.currentHits !== undefined ? { hits: bp.currentHits } : {}),
    ...(bp.condition ? { condition: bp.condition } : {}),
    ...(bp.conditionError ? { conditionError: bp.conditionError } : {}),
    ...(bp.logMessage ? { log: bp.logMessage } : {}),
    ...(bp.oneShot ? { oneShot: true } : {}),
    source: fromComment ? (bp.annotationKind ? bp.annotationKind.toLowerCase() : "logpoint-comment") : "user"
  };
}

export const breakpointMethods: MethodTable = {
  "breakpoints.list": {
    level: "read",
    queued: true,
    needsReady: true,
    handler: async (_params, ctx) => {
      const [list, labels] = await Promise.all([
        ctx.host.emu.listBreakpoints(),
        ctx.host.emu.getPartitionLabels().catch(() => ({}) as Record<number, string>)
      ]);
      return { breakpoints: (list?.breakpoints ?? []).map((bp) => describeBreakpoint(bp, labels)) };
    }
  },
  "breakpoints.set": {
    level: "control",
    queued: true,
    needsReady: true,
    handler: async (params, ctx) => {
      const spec = requireSingleLine(params, "spec");
      return await runIdeCommandOrFail(ctx, `bp-set ${spec}`);
    }
  },
  "breakpoints.remove": {
    level: "control",
    queued: true,
    needsReady: true,
    handler: async (params, ctx) => {
      const spec = requireSingleLine(params, "spec");
      return await runIdeCommandOrFail(ctx, `bp-del ${spec}`);
    }
  },
  "breakpoints.clear": {
    level: "control",
    queued: true,
    needsReady: true,
    handler: async (_params, ctx) => await runIdeCommandOrFail(ctx, "bp-ea")
  }
};
