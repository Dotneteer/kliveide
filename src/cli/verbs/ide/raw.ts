import type { CommandRunResult, JsonRpcNotification } from "@common/automation/protocol";
import { AUTOMATION_EVENTS } from "@common/automation/protocol";
import { EXIT_FAILED, EXIT_OK, usageError } from "../../exit-codes";
import { describeMachineState, hex4 } from "../../format";
import type { IdeVerb } from "./context";

/*
 * `klive ide cmd|events|rpc` (D9, D11, D12).
 */

/** `cmd "<ide command>"`: any IDE command (the `full` level); its output, and exit 1 on failure */
export const cmdVerb: IdeVerb = async (ctx) => {
  if (!ctx.args.length) throw usageError('Usage: klive ide cmd "<ide command>"');
  const result = await ctx.call<CommandRunResult>("ide.command", { text: ctx.args.join(" ") });
  if (ctx.json) ctx.printJson(result);
  else result.output.forEach((line) => ctx.io.out(line));
  return result.success ? EXIT_OK : EXIT_FAILED;
};

/** One notification as a line */
export function describeNotification(n: JsonRpcNotification): string {
  const p = (n.params ?? {}) as Record<string, any>;
  switch (n.method) {
    case "machine.stateChanged":
      return `machine: ${describeMachineState(p as { state: string; pc?: number })}`;
    case "machine.breakpointHit":
      return `breakpoint: ${p.kind} at ${hex4(p.address ?? 0)}`;
    case "project.built":
      return `build: ${p.success ? "succeeded" : "failed"}${p.errorCount ? ` (${p.errorCount} error${p.errorCount === 1 ? "" : "s"})` : ""}`;
    case "ide.output":
      return `[${p.pane}] ${p.text}`;
    default:
      return `${n.method} ${JSON.stringify(p)}`;
  }
}

/** `events [<event>...]`: streams notifications until Ctrl+C or until Klive closes */
export const eventsVerb: IdeVerb = async (ctx) => {
  const names = ctx.args;
  for (const name of names) {
    if (!(AUTOMATION_EVENTS as readonly string[]).includes(name)) {
      throw usageError(`Unknown event '${name}'. Events: ${AUTOMATION_EVENTS.join(", ")}.`);
    }
  }
  ctx.client.onNotification((n) => {
    if (ctx.json) ctx.io.out(JSON.stringify(n));
    else ctx.io.out(describeNotification(n));
  });
  const subscribed = await ctx.call<{ events: string[] }>("events.subscribe", names.length ? { events: names } : {});
  if (!ctx.json) ctx.io.err(`Listening to ${subscribed.events.join(", ")}. Press Ctrl+C to stop.`);
  await Promise.race([
    ctx.io.waitForInterrupt(),
    new Promise<void>((resolve) => ctx.client.onClose(() => resolve()))
  ]);
  return EXIT_OK;
};

/** `rpc <method> [<json params>]`: a raw call; prints the result as JSON */
export const rpcVerb: IdeVerb = async (ctx) => {
  const [method, ...rest] = ctx.args;
  if (!method) throw usageError("Usage: klive ide rpc <method> ['<json params>']");
  let params: Record<string, unknown> | undefined;
  if (rest.length) {
    try {
      params = JSON.parse(rest.join(" "));
    } catch {
      throw usageError("The parameters must be one JSON object.");
    }
    if (!params || typeof params !== "object" || Array.isArray(params)) {
      throw usageError("The parameters must be one JSON object.");
    }
  }
  ctx.printJson(await ctx.call(method, params));
  return EXIT_OK;
};
