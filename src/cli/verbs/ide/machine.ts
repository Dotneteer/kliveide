import type { MachineStateResult, WaitResult } from "@common/automation/protocol";
import { parseArgs } from "../../args";
import { EXIT_OK, usageError } from "../../exit-codes";
import { describeMachineState } from "../../format";
import type { IdeVerb } from "./context";

/*
 * `klive ide status|start|pause|stop|reset|restart|step|wait` (D12). `debug` is the project's
 * (build, inject and start in debug mode; `project.ts`); `start --debug` starts the machine as it is.
 */

export const statusVerb: IdeVerb = async (ctx) => {
  parseArgs(ctx.args, {});
  const info = await ctx.call<any>("session.info");
  if (ctx.json) {
    ctx.printJson({ ...info, connectionFile: ctx.connectionFile });
    return EXIT_OK;
  }
  ctx.io.out(
    `Klive ${info.version}: automation protocol ${info.protocol}, level ${info.level}` +
      (info.ready ? "" : " (still starting)")
  );
  if (info.machine) {
    const model = info.machine.model ? ` (${info.machine.model})` : "";
    const state = await ctx.call<MachineStateResult>("machine.state");
    ctx.io.out(`Machine: ${info.machine.id}${model}, ${describeMachineState(state)}`);
  } else {
    ctx.io.out("Machine: none yet");
  }
  if (info.project) {
    const root = info.project.buildRoot ? `, build root ${info.project.buildRoot}` : "";
    ctx.io.out(`Project: ${info.project.folder}${info.project.isKliveProject ? "" : " (not a Klive project)"}${root}`);
  } else {
    ctx.io.out("Project: none open");
  }
  ctx.io.out(`Connection: ${ctx.connectionFile}`);
  return EXIT_OK;
};

/** A verb that issues one machine command and prints the state after it */
function machineVerb(method: string): IdeVerb {
  return async (ctx) => {
    parseArgs(ctx.args, {});
    const result = await ctx.call<MachineStateResult>(method);
    if (ctx.json) ctx.printJson(result);
    else ctx.io.out(describeMachineState(result));
    return EXIT_OK;
  };
}

/** `start [--debug]`: starts the machine, in debug mode with `--debug` (stops at breakpoints) */
export const startVerb: IdeVerb = async (ctx) => {
  const { positional, options } = parseArgs(ctx.args, { flags: ["debug"] });
  if (positional.length) throw usageError("Usage: klive ide start [--debug]");
  const result = await ctx.call<MachineStateResult>(options.debug ? "machine.debug" : "machine.start");
  if (ctx.json) ctx.printJson(result);
  else ctx.io.out(describeMachineState(result));
  return EXIT_OK;
};

export const pauseVerb = machineVerb("machine.pause");
export const stopVerb = machineVerb("machine.stop");
export const resetVerb = machineVerb("machine.reset");
export const restartVerb = machineVerb("machine.restart");

export const stepVerb: IdeVerb = async (ctx) => {
  const { positional } = parseArgs(ctx.args, {});
  const kind = positional[0] ?? "into";
  if (!["into", "over", "out"].includes(kind) || positional.length > 1) {
    throw usageError("Usage: klive ide step [into|over|out]");
  }
  const result = await ctx.call<MachineStateResult>("machine.step", { kind });
  if (ctx.json) ctx.printJson(result);
  else ctx.io.out(describeMachineState(result));
  return EXIT_OK;
};

/**
 * `wait [--paused] [--stopped] [--running]`: waits until the machine reaches one of the states.
 * Without a state it waits for "paused", which a Stop also ends (T9). `--timeout` bounds the wait
 * (exit code 5 when it runs out); without it the wait is unbounded.
 */
export const waitVerb: IdeVerb = async (ctx) => {
  const { positional, options } = parseArgs(ctx.args, { flags: ["paused", "stopped", "running"] });
  if (positional.length) throw usageError("Usage: klive ide wait [--paused] [--stopped] [--running] [--timeout <s>]");
  const until = (["paused", "stopped", "running"] as const).filter((s) => options[s]);
  const result = await ctx.client.request<WaitResult>(
    "machine.wait",
    { until: until.length ? until : ["paused"], ...(ctx.timeoutMs !== undefined ? { timeoutMs: ctx.timeoutMs } : {}) },
    ctx.timeoutMs !== undefined ? ctx.timeoutMs + 5000 : undefined
  );
  if (ctx.json) ctx.printJson(result);
  else ctx.io.out(describeMachineState(result));
  return EXIT_OK;
};
