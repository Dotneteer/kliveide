import { parseSeconds } from "../../args";
import {
  CliError,
  EXIT_INTERNAL,
  EXIT_OK,
  EXIT_USAGE,
  exitCodeOfRpcError,
  usageError
} from "../../exit-codes";
import type { CliIo } from "../../io";
import { AutomationClient, ConnectionError, RpcError, findConnection } from "../../rpc/client";
import { launchKlive } from "../../rpc/launch";
import { lookUpConnection } from "@main/automation/connection-file";
import type { IdeVerb, IdeVerbContext } from "./context";
import {
  pauseVerb,
  resetVerb,
  restartVerb,
  startVerb,
  statusVerb,
  stepVerb,
  stopVerb,
  waitVerb
} from "./machine";
import { buildProjectVerb, debugProjectVerb, exportVerb, injectVerb, runVerb } from "./project";
import { bpVerb, memVerb, pokeVerb, regsVerb, screenshotVerb } from "./state";
import { cmdVerb, eventsVerb, rpcVerb } from "./raw";

/*
 * `klive ide <verb>` (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D1, D12): the verbs that drive a
 * running Klive through its automation server. With no verb it prints the connection status.
 */

const VERBS: Record<string, IdeVerb> = {
  status: statusVerb,
  start: startVerb,
  pause: pauseVerb,
  stop: stopVerb,
  reset: resetVerb,
  restart: restartVerb,
  step: stepVerb,
  wait: waitVerb,
  build: buildProjectVerb,
  run: runVerb,
  debug: debugProjectVerb,
  inject: injectVerb,
  export: exportVerb,
  regs: regsVerb,
  mem: memVerb,
  poke: pokeVerb,
  bp: bpVerb,
  screenshot: screenshotVerb,
  cmd: cmdVerb,
  events: eventsVerb,
  rpc: rpcVerb
};

export const IDE_HELP = `Usage: klive ide [<global options>] <verb> [<arguments>]

Drives a running Klive through its automation server (Settings › General › Automation).

Machine:
  status                       Connection, machine and project (the default verb)
  start [--debug]              Start the machine (--debug: stop at breakpoints)
  pause | stop | reset | restart
  step [into|over|out]         Step the paused machine
  wait [--paused] [--stopped] [--running]
                               Wait for a state (default: paused, which Stop also ends);
                               with --timeout, exit code 5 when it runs out
Project:
  build                        Compile the build root (errors in file:line:col format; exit 2)
  run | debug | inject         Build and run, debug or inject the code
  export <file> [--format tap|tzx|hex|nex] [--name n] [--auto-start] [--add-pause]
         [--add-clear] [--single-block] [--border 0-7] [--address a] [--screen file]
State:
  regs                         CPU registers
  mem <addr|B5:$0100> [<len>] [--partition p] [--out file] [--format hex|bin|json]
  poke <addr|B5:$0100> <byte>...
  bp list | bp set <bp-set args> | bp rm <bp-del args> | bp clear
  screenshot <file.png>        The emulated picture
Anything else:
  cmd "<ide command>"          Run an IDE command (needs the 'full' level)
  events [<event>...]          Stream notifications until Ctrl+C
  rpc <method> ['<json>']      A raw JSON-RPC call

Global options:
  --json                       Machine-readable output
  --timeout <s>                The request's timeout (for wait: how long to wait)
  --launch                     Start Klive (--automation --noide) when none answers
  --connection <file>          The connection file (default: beside the settings file)

Exit codes: 0 ok, 1 the command failed, 2 build errors, 3 usage / no Klive / automation off /
level too low, 4 internal or protocol error, 5 wait timed out.`;

type GlobalOptions = {
  json: boolean;
  launch: boolean;
  timeoutMs?: number;
  connection?: string;
  rest: string[];
};

/**
 * Takes the global options out of the arguments, wherever they are. Only these exact `--` words
 * are taken: single-dash words belong to the IDE's own syntax (`bp set $8000 -if A == 1`).
 */
export function extractGlobalOptions(argv: string[]): GlobalOptions {
  const result: GlobalOptions = { json: false, launch: false, rest: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [name, inline] = arg.startsWith("--") ? [arg.split("=")[0], arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : undefined] : [arg, undefined];
    const value = () => {
      if (inline !== undefined) return inline;
      if (i + 1 >= argv.length) throw usageError(`${name} needs a value.`);
      return argv[++i];
    };
    switch (name) {
      case "--json":
        result.json = true;
        break;
      case "--launch":
        result.launch = true;
        break;
      case "--timeout":
        result.timeoutMs = parseSeconds(value());
        break;
      case "--connection":
        result.connection = value();
        break;
      default:
        result.rest.push(arg);
    }
  }
  return result;
}

/** Connects to the running Klive, launching one with `--launch` when none answers */
async function connect(io: CliIo, options: GlobalOptions): Promise<{ client: AutomationClient; file: string }> {
  const env = options.connection ? { ...io.env, KLIVE_AUTOMATION_FILE: options.connection } : io.env;
  const found = findConnection(env);
  const file = found.file;
  let lookup = found.lookup;
  if (lookup.status !== "live" && options.launch) {
    await launchKlive(file, env);
    lookup = lookUpConnection(file);
  }
  if (lookup.status === "missing") {
    throw new CliError(
      `No running Klive has automation on (no connection file at ${file}). Start Klive and turn on ` +
        "Settings › General › Automation (or type 'set -u automation.enabled 1' in its command " +
        "prompt), or add --launch.",
      EXIT_USAGE
    );
  }
  if (lookup.status === "stale") {
    throw new CliError(
      `The connection file ${file} was left by a Klive that is no longer running (pid ${lookup.info.pid}). ` +
        "Start Klive again, or add --launch.",
      EXIT_USAGE
    );
  }
  const client = new AutomationClient(lookup.info);
  try {
    await client.connect({ client: "klive-cli" });
  } catch (err) {
    client.close();
    if (err instanceof RpcError) throw err;
    throw new CliError(`${(err as Error).message} (connection file: ${file})`, EXIT_USAGE);
  }
  return { client, file };
}

/** Runs `klive ide …`; returns the exit code */
export async function runIde(argv: string[], io: CliIo): Promise<number> {
  let client: AutomationClient | undefined;
  try {
    const options = extractGlobalOptions(argv);
    const [verbName = "status", ...args] = options.rest;
    if (verbName === "help" || verbName === "--help" || verbName === "-h") {
      io.out(IDE_HELP);
      return EXIT_OK;
    }
    const verb = VERBS[verbName];
    if (!verb) throw usageError(`Unknown verb '${verbName}'. Run 'klive ide help' for the list.`);
    const connected = await connect(io, options);
    client = connected.client;
    const activeClient = client;
    const ctx: IdeVerbContext = {
      client: activeClient,
      io,
      json: options.json,
      timeoutMs: options.timeoutMs,
      connectionFile: connected.file,
      args,
      call: (method, params) =>
        activeClient.request(
          method,
          options.timeoutMs !== undefined ? { ...(params ?? {}), timeoutMs: options.timeoutMs } : params,
          options.timeoutMs !== undefined ? options.timeoutMs + 5000 : undefined
        ),
      printJson: (value) => io.out(JSON.stringify(value, null, 2))
    };
    return await verb(ctx);
  } catch (err) {
    if (err instanceof CliError) {
      io.err(err.message);
      return err.exitCode;
    }
    if (err instanceof RpcError) {
      io.err(err.message);
      const output = err.error.data?.output;
      if (Array.isArray(output)) output.forEach((line) => io.err(String(line)));
      return exitCodeOfRpcError(err.error, err.method);
    }
    if (err instanceof ConnectionError) {
      io.err(err.message);
      return EXIT_INTERNAL;
    }
    io.err(`Internal error: ${(err as Error)?.stack ?? err}`);
    return EXIT_INTERNAL;
  } finally {
    client?.close();
  }
}
