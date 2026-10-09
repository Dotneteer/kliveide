import { AUTOMATION_MAX_MEMORY_BYTES } from "@common/automation/protocol";
import { bytesFromJson, bytesToBase64 } from "../encode";
import { automationError, invalidParams } from "../errors";
import type { MethodContext, MethodTable } from "../method-types";
import { optionalInt, requireInt } from "../method-types";

/*
 * `memory.read` and `memory.write` (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` §4.2, T8).
 *
 * "Read memory at $C000" is ambiguous on a 128K or the Next, so a request names either an
 * `address` (the CPU's current view: what is paged in now) or a `partition` and an `offset` (one
 * ROM page or RAM bank by the IDE's labels - `R0`, `B5`, the Next's 8K pages - whatever is paged
 * in). At most 64 KB per call.
 */

type Target = { address: number } | { partition: number; label: string; offset: number };

/** Resolves a partition given as a label ("B5") or an index */
async function resolvePartition(ctx: MethodContext, value: unknown): Promise<{ partition: number; label: string }> {
  const labels = await ctx.host.emu.getPartitionLabels();
  if (typeof value === "number" && Number.isInteger(value)) {
    const label = labels?.[value];
    if (label === undefined) throw invalidParams(`This machine has no partition ${value}.`);
    return { partition: value, label };
  }
  if (typeof value === "string" && value.trim()) {
    const text = value.trim().toUpperCase();
    const partition = await ctx.host.emu.parsePartitionLabel(text);
    if (partition === undefined || partition === null) {
      const known = Object.values(labels ?? {});
      throw invalidParams(
        `This machine has no partition '${value}'.` + (known.length ? ` Its partitions: ${known.join(", ")}.` : "")
      );
    }
    return { partition, label: labels?.[partition] ?? text };
  }
  throw invalidParams("'partition' must be a label (such as \"B5\") or an index.");
}

async function targetOf(params: Record<string, unknown>, ctx: MethodContext): Promise<Target> {
  const hasAddress = params.address !== undefined && params.address !== null;
  const hasPartition = params.partition !== undefined && params.partition !== null;
  if (hasAddress === hasPartition) {
    throw invalidParams("Give either 'address', or 'partition' and 'offset'.");
  }
  if (hasAddress) return { address: requireInt(params, "address", 0, 0xffff) };
  const { partition, label } = await resolvePartition(ctx, params.partition);
  return { partition, label, offset: optionalInt(params, "offset", 0, 0x1ffff) ?? 0 };
}

function requireMachine(ctx: MethodContext): void {
  if (!ctx.host.getState()?.emulatorState?.machineId) {
    throw automationError("no-machine", "No machine is set up yet.");
  }
}

export const memoryMethods: MethodTable = {
  "memory.read": {
    level: "read",
    queued: true,
    needsReady: true,
    handler: async (params, ctx) => {
      requireMachine(ctx);
      const target = await targetOf(params, ctx);
      const length = optionalInt(params, "length", 1, AUTOMATION_MAX_MEMORY_BYTES) ?? 256;
      if ("address" in target) {
        if (target.address + length > 0x10000) {
          throw invalidParams(`$${target.address.toString(16)} + ${length} bytes runs past $FFFF.`);
        }
        const info = await ctx.host.emu.getMemoryContents();
        const bytes = info.memory.slice(target.address, target.address + length);
        return { address: target.address, length: bytes.length, data: bytesToBase64(bytes) };
      }
      const info = await ctx.host.emu.getMemoryContents(target.partition);
      if (target.offset + length > info.memory.length) {
        throw invalidParams(
          `Partition ${target.label} holds ${info.memory.length} bytes; ` +
            `offset ${target.offset} + ${length} bytes runs past its end.`
        );
      }
      const bytes = info.memory.slice(target.offset, target.offset + length);
      return {
        partition: target.label,
        offset: target.offset,
        length: bytes.length,
        data: bytesToBase64(bytes)
      };
    }
  },
  "memory.write": {
    level: "control",
    queued: true,
    needsReady: true,
    handler: async (params, ctx) => {
      requireMachine(ctx);
      const target = await targetOf(params, ctx);
      const bytes = bytesFromJson(params.data);
      if (!bytes) throw invalidParams("'data' must be base64 text or an array of byte values.");
      if (!bytes.length) throw invalidParams("'data' holds no bytes.");
      if (bytes.length > AUTOMATION_MAX_MEMORY_BYTES) {
        throw invalidParams(`At most ${AUTOMATION_MAX_MEMORY_BYTES} bytes can be written in one call.`);
      }
      if ("address" in target) {
        if (target.address + bytes.length > 0x10000) {
          throw invalidParams(`$${target.address.toString(16)} + ${bytes.length} bytes runs past $FFFF.`);
        }
        await ctx.host.emu.setMemoryBytes(target.address, bytes);
        return { address: target.address, written: bytes.length };
      }
      await ctx.host.emu.setMemoryBytes(target.offset, bytes, target.partition);
      return { partition: target.label, offset: target.offset, written: bytes.length };
    }
  }
};
