import type { MemoryReadResult, ScreenCaptureResult } from "@common/automation/protocol";
import { parseArgs, parseLocation, parseNumberIn } from "../../args";
import { EXIT_OK, usageError } from "../../exit-codes";
import { formatRegisters, hexDump } from "../../format";
import type { IdeVerb } from "./context";

/*
 * `klive ide regs|mem|poke|bp|screenshot` (D12, T8).
 */

export const regsVerb: IdeVerb = async (ctx) => {
  parseArgs(ctx.args, {});
  const regs = await ctx.call<Record<string, number | boolean>>("cpu.get");
  if (ctx.json) ctx.printJson(regs);
  else formatRegisters(regs).forEach((line) => ctx.io.out(line));
  return EXIT_OK;
};

/** A location as request parameters: `$5C00`, `B5:$0100`, or an offset with `--partition` */
function locationParams(text: string, partition: string | undefined): Record<string, unknown> {
  if (partition) {
    return { partition: partition.toUpperCase(), offset: parseNumberIn(text, "The offset", 0, 0x1ffff) };
  }
  return parseLocation(text);
}

const MEM_USAGE =
  "Usage: klive ide mem <addr | partition:offset> [<length>] [--partition <p>] [--out <file>] [--format hex|bin|json]";

export const memVerb: IdeVerb = async (ctx) => {
  const { positional, options } = parseArgs(ctx.args, { values: ["partition", "out", "format"] });
  if (positional.length < 1 || positional.length > 2) throw usageError(MEM_USAGE);
  const format = (options.format as string | undefined) ?? (ctx.json ? "json" : "hex");
  if (!["hex", "bin", "json"].includes(format)) throw usageError(MEM_USAGE);
  const length = positional[1] !== undefined ? parseNumberIn(positional[1], "The length", 1, 0x10000) : 128;
  const result = await ctx.call<MemoryReadResult>("memory.read", {
    ...locationParams(positional[0], options.partition as string | undefined),
    length
  });
  const bytes = new Uint8Array(Buffer.from(result.data, "base64"));
  const out = options.out as string | undefined;
  switch (format) {
    case "bin":
      if (out) ctx.io.writeFile(out, bytes);
      else ctx.io.outBytes(bytes);
      break;
    case "json": {
      const json = JSON.stringify({ ...result, bytes: Array.from(bytes) }, null, 2);
      if (out) ctx.io.writeFile(out, json + "\n");
      else ctx.io.out(json);
      break;
    }
    default: {
      const lines = hexDump(bytes, result.address ?? result.offset ?? 0, result.partition);
      if (out) ctx.io.writeFile(out, lines.join("\n") + "\n");
      else lines.forEach((line) => ctx.io.out(line));
    }
  }
  return EXIT_OK;
};

export const pokeVerb: IdeVerb = async (ctx) => {
  const { positional, options } = parseArgs(ctx.args, { values: ["partition"] });
  if (positional.length < 2) {
    throw usageError("Usage: klive ide poke <addr | partition:offset> <byte> [<byte>...] [--partition <p>]");
  }
  const bytes = positional.slice(1).map((b) => parseNumberIn(b, "A byte", 0, 255));
  const result = await ctx.call<Record<string, unknown>>("memory.write", {
    ...locationParams(positional[0], options.partition as string | undefined),
    data: Buffer.from(bytes).toString("base64")
  });
  if (ctx.json) ctx.printJson(result);
  else ctx.io.out(`${bytes.length} byte${bytes.length === 1 ? "" : "s"} written.`);
  return EXIT_OK;
};

const BP_USAGE =
  "Usage: klive ide bp list | bp set <bp-set arguments> | bp rm <bp-del arguments> | bp clear";

export const bpVerb: IdeVerb = async (ctx) => {
  const [sub, ...rest] = ctx.args;
  switch (sub) {
    case "list":
    case "ls":
    case undefined: {
      if (rest.length) throw usageError(BP_USAGE);
      const result = await ctx.call<{ breakpoints: Record<string, any>[] }>("breakpoints.list");
      if (ctx.json) {
        ctx.printJson(result);
      } else if (!result.breakpoints.length) {
        ctx.io.out("No breakpoints.");
      } else {
        for (const bp of result.breakpoints) {
          const notes = [
            bp.enabled === false ? "disabled" : "",
            bp.hits !== undefined ? `hits: ${bp.hits}` : "",
            bp.source && bp.source !== "user" ? `from ${bp.source}` : "",
            bp.resource ? `${bp.resource}:${bp.line}` : ""
          ].filter(Boolean);
          ctx.io.out(`${bp.spec}${notes.length ? `   (${notes.join(", ")})` : ""}`);
        }
      }
      return EXIT_OK;
    }
    case "set":
    case "rm":
    case "del": {
      // --- The rest is the IDE's own syntax, passed as it is: `bp set $8000 -if A == 1`
      if (!rest.length) throw usageError(BP_USAGE);
      const result = await ctx.call<{ message?: string; output: string[] }>(
        sub === "set" ? "breakpoints.set" : "breakpoints.remove",
        { spec: rest.join(" ") }
      );
      if (ctx.json) ctx.printJson(result);
      else result.output.forEach((line) => ctx.io.out(line));
      return EXIT_OK;
    }
    case "clear": {
      if (rest.length) throw usageError(BP_USAGE);
      const result = await ctx.call<{ output: string[] }>("breakpoints.clear");
      if (ctx.json) ctx.printJson(result);
      else result.output.forEach((line) => ctx.io.out(line));
      return EXIT_OK;
    }
    default:
      throw usageError(BP_USAGE);
  }
};

export const screenshotVerb: IdeVerb = async (ctx) => {
  const { positional } = parseArgs(ctx.args, {});
  if (positional.length !== 1) throw usageError("Usage: klive ide screenshot <file.png>");
  const result = await ctx.call<ScreenCaptureResult>("screen.capture", { format: "png" });
  const file = ctx.io.writeFile(positional[0], new Uint8Array(Buffer.from(result.data, "base64")));
  if (ctx.json) ctx.printJson({ file, width: result.width, height: result.height });
  else ctx.io.out(`Saved the ${result.width}x${result.height} picture to ${file}`);
  return EXIT_OK;
};
