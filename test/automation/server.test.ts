import fs from "fs";
import net from "net";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { readConnectionFile } from "@main/automation/connection-file";
import { AutomationClient, RpcError } from "../../src/cli/rpc/client";
import { createFakeHost, startFakeServer, type FakeHost } from "./fake-host";

/*
 * The automation server end to end, in-process (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` §6, Phase
 * 3 and 4): the real server and the real client over a real socket, against a fake Klive.
 */

type Started = Awaited<ReturnType<typeof startFakeServer>>;

const running: Started[] = [];
const clients: AutomationClient[] = [];

afterEach(async () => {
  clients.splice(0).forEach((c) => c.close());
  for (const s of running.splice(0)) await s.stop();
});

async function start(host: FakeHost = createFakeHost(), level: "read" | "control" | "full" = "control", extra = {}) {
  const started = await startFakeServer(host, level, extra);
  running.push(started);
  return { ...started, host };
}

async function connect(started: Started, name = "test") {
  const client = new AutomationClient(started.server.connectionInfo!);
  clients.push(client);
  await client.connect({ client: name });
  return client;
}

/** Sends raw lines and collects the answers until the server closes the connection */
function raw(socketPath: string, lines: string[]): Promise<{ answers: any[]; closed: boolean }> {
  return new Promise((resolve) => {
    const socket = net.connect(socketPath);
    let data = "";
    socket.on("connect", () => socket.write(lines.map((l) => l + "\n").join("")));
    socket.on("data", (chunk) => (data += chunk.toString()));
    const done = (closed: boolean) =>
      resolve({
        answers: data.split("\n").filter(Boolean).map((l) => JSON.parse(l)),
        closed
      });
    socket.on("close", () => done(true));
    setTimeout(() => {
      socket.destroy();
      done(false);
    }, 1500);
  });
}

async function rpcError(promise: Promise<unknown>): Promise<RpcError> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof RpcError) return err;
    throw err;
  }
  throw new Error("Expected an RPC error");
}

describe("automation server: connection and authentication (D5)", () => {
  it("publishes a connection file and deletes it when it stops", async () => {
    const s = await start();
    const info = readConnectionFile(s.server.connectionFile)!;
    expect(info.pid).toBe(process.pid);
    expect(info.protocol).toBe(1);
    expect(info.token).toMatch(/^[0-9a-f]{64}$/);
    expect(info.socket).toBe(s.server.connectionInfo!.socket);
    await s.server.stop();
    expect(fs.existsSync(s.server.connectionFile)).toBe(false);
  });

  it("answers hello with the protocol, the level and the machine", async () => {
    const s = await start();
    const client = await connect(s);
    expect(client.hello).toEqual({
      protocol: 1,
      version: "0.64.0",
      ready: true,
      level: "control",
      machine: { id: "sp128", model: "pal" }
    });
    expect(s.server.clientCount).toBe(1);
  });

  it("rejects a wrong token and closes the connection", async () => {
    const s = await start();
    const { answers, closed } = await raw(s.server.connectionInfo!.socket, [
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "session.hello", params: { token: "f".repeat(64) } }),
      JSON.stringify({ jsonrpc: "2.0", id: 2, method: "machine.state" })
    ]);
    expect(closed).toBe(true);
    expect(answers).toHaveLength(1);
    expect(answers[0].error.data.kind).toBe("unauthorized");
    // --- The log says what happened, and never prints a token
    expect(s.log.join("\n")).toContain("refused: a wrong or missing token");
    expect(s.log.join("\n")).not.toMatch(/[0-9a-f]{64}/);
  });

  it("rejects any other first request", async () => {
    const s = await start();
    const { answers, closed } = await raw(s.server.connectionInfo!.socket, [
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "memory.read", params: { address: 0 } })
    ]);
    expect(closed).toBe(true);
    expect(answers[0].error.data.kind).toBe("unauthorized");
  });

  it("answers a line that is not JSON with a parse error", async () => {
    const s = await start();
    const { answers } = await raw(s.server.connectionInfo!.socket, ["{nope"]);
    expect(answers[0].error.code).toBe(-32700);
  });

  it("disconnects every client on request (D13)", async () => {
    const s = await start();
    const a = await connect(s, "a");
    await connect(s, "b");
    const closed = new Promise<void>((resolve) => a.onClose(resolve));
    expect(s.server.disconnectAll()).toBe(2);
    await closed;
    expect(s.server.clientCount).toBe(0);
  });

  it.skipIf(process.platform === "win32")("listens under a 150-character home (T3)", async () => {
    const host = createFakeHost();
    const started = await startFakeServer(host, "control");
    running.push(started);
    const deep = path.join(started.temp.home, "d".repeat(150));
    const { AutomationServer } = await import("@main/automation/AutomationServer");
    const server = new AutomationServer({ host, runDir: path.join(deep, "run"), homeKey: deep, level: "control" });
    const info = await server.start();
    try {
      expect(info.socket.startsWith(deep)).toBe(false);
      const client = new AutomationClient(info);
      clients.push(client);
      await client.connect();
      expect(await client.request("machine.state")).toEqual({ state: "paused", pc: 0x8000 });
    } finally {
      await server.stop();
    }
  });
});

describe("automation server: levels (D7)", () => {
  it("refuses a method above the connection's level, naming the setting", async () => {
    const s = await start(createFakeHost(), "read");
    const client = await connect(s);
    expect(await client.request("machine.state")).toEqual({ state: "paused", pc: 0x8000 });
    const err = await rpcError(client.request("machine.start"));
    expect(err.error.data).toMatchObject({ kind: "level-too-low", required: "control", granted: "read" });
    expect(err.message).toContain("set -u automation.level control");
    expect(s.host.machineCommands).toEqual([]);
  });

  it("applies a level change to open connections at once", async () => {
    const s = await start(createFakeHost(), "control");
    const client = await connect(s);
    const denied = await rpcError(client.request("ide.command", { text: "help" }));
    expect(denied.error.data?.kind).toBe("level-too-low");
    s.server.setLevel("full");
    expect(await client.request("ide.command", { text: "help" })).toMatchObject({ success: true });
  });

  it("lists what the connection may call", async () => {
    const s = await start();
    const client = await connect(s);
    const caps = await client.request<any>("session.capabilities");
    expect(caps.methods.find((m: any) => m.name === "ide.command")).toEqual({ name: "ide.command", level: "full", allowed: false });
    expect(caps.methods.find((m: any) => m.name === "memory.write").allowed).toBe(true);
    expect(caps.events).toContain("machine.breakpointHit");
  });
});

describe("automation server: machine, CPU and memory", () => {
  it("runs machine commands and reports the state after them", async () => {
    const s = await start();
    const client = await connect(s);
    expect(await client.request("machine.start")).toEqual({ state: "running" });
    expect(await client.request("machine.pause")).toEqual({ state: "paused", pc: 0x8000 });
    expect(await client.request("machine.step", { kind: "over" })).toEqual({ state: "paused", pc: 0x8001 });
    expect(s.host.machineCommands).toEqual(["start", "pause", "stepOver"]);
  });

  it("reports the emulator's refusal as a failed command", async () => {
    const s = await start();
    const client = await connect(s);
    const err = await rpcError(client.request("machine.pause"));
    expect(err.error.data?.kind).toBe("command-failed");
    expect(err.message).toBe("The machine is not running");
  });

  it("reads registers without the access traces, with the 8-bit halves", async () => {
    const s = await start();
    const client = await connect(s);
    const regs = await client.request<any>("cpu.get");
    expect(regs).toMatchObject({ af: 0x1234, a: 0x12, f: 0x34, h: 0xde, l: 0xf0, i: 0x3f, r: 0x05, tacts: 69888 });
    expect(regs.lastMemoryReads).toBeUndefined();
    expect(await client.request<any>("cpu.set", { register: "hl", value: "$1234" })).toMatchObject({ hl: 0x1234 });
    const err = await rpcError(client.request("cpu.set", { register: "a", value: 300 }));
    expect(err.error.code).toBe(-32602);
  });

  it("reads memory through the CPU's view and by partition (T8)", async () => {
    const s = await start();
    const client = await connect(s);
    const view = await client.request<any>("memory.read", { address: 0x8000, length: 5 });
    expect(view).toEqual({ address: 0x8000, length: 5, data: Buffer.from("KLIVE").toString("base64") });
    // --- B5 is at $4000 in the CPU's view, but it is read by label wherever it is
    const bank = await client.request<any>("memory.read", { partition: "b5", offset: 0x100, length: 4 });
    expect(bank).toEqual({ partition: "B5", offset: 0x100, length: 4, data: Buffer.from([0xde, 0xad, 0xbe, 0xef]).toString("base64") });
    const rom = await client.request<any>("memory.read", { partition: "R1", offset: 0, length: 1 });
    expect(Buffer.from(rom.data, "base64")[0]).toBe(0xf1);
  });

  it("refuses reads outside memory and unknown partitions", async () => {
    const s = await start();
    const client = await connect(s);
    expect((await rpcError(client.request("memory.read", { address: 0xfff0, length: 32 }))).error.code).toBe(-32602);
    const unknown = await rpcError(client.request("memory.read", { partition: "B9", offset: 0 }));
    expect(unknown.message).toContain("Its partitions: B0, B1, B2");
    expect((await rpcError(client.request("memory.read", { address: 0, partition: "B0" }))).error.code).toBe(-32602);
    expect((await rpcError(client.request("memory.read", { address: 0, length: 0x10001 }))).error.code).toBe(-32602);
  });

  it("writes memory by address and by partition", async () => {
    const s = await start();
    const client = await connect(s);
    expect(await client.request("memory.write", { address: 0x8000, data: [1, 2, 3] })).toEqual({ address: 0x8000, written: 3 });
    expect(Array.from(s.host.banks[2].subarray(0, 3))).toEqual([1, 2, 3]);
    await client.request("memory.write", { partition: "B7", offset: 0x10, data: Buffer.from([9, 8]).toString("base64") });
    expect(Array.from(s.host.banks[7].subarray(0x10, 0x12))).toEqual([9, 8]);
    expect((await rpcError(client.request("memory.write", { address: 0, data: "!!" }))).error.code).toBe(-32602);
  });
});

describe("automation server: breakpoints", () => {
  it("passes bp-set and bp-del text through, conditions included", async () => {
    const s = await start();
    s.host.commandHandlers["bp-set"] = (text) => ({ success: true, output: [`Breakpoint ${text.slice(7)} set`] });
    const client = await connect(s);
    const result = await client.request<any>("breakpoints.set", { spec: "$8000 -if A == $FF && !ZF" });
    expect(result).toEqual({ success: true, output: ["Breakpoint $8000 -if A == $FF && !ZF set"] });
    await client.request("breakpoints.remove", { spec: "$8000" });
    await client.request("breakpoints.clear");
    expect(s.host.commands.map((c) => c.text)).toEqual(["bp-set $8000 -if A == $FF && !ZF", "bp-del $8000", "bp-ea"]);
    expect(s.host.commands.every((c) => c.automation)).toBe(true);
  });

  it("refuses a spec that would smuggle a second line", async () => {
    const s = await start();
    const client = await connect(s);
    const err = await rpcError(client.request("breakpoints.set", { spec: "$8000\nexit" }));
    expect(err.error.code).toBe(-32602);
    expect(s.host.commands).toEqual([]);
  });

  it("reports a failed bp-set with its output", async () => {
    const s = await start();
    s.host.commandHandlers["bp-set"] = () => ({ success: false, finalMessage: "Condition error at column 3", output: ["Condition error at column 3", "  A =="] });
    const client = await connect(s);
    const err = await rpcError(client.request("breakpoints.set", { spec: "$8000 -if A ==" }));
    expect(err.error.data).toMatchObject({ kind: "command-failed", output: ["Condition error at column 3", "  A =="] });
  });

  it("lists breakpoints as bp-set text with partition labels", async () => {
    const s = await start();
    s.host.breakpoints = [
      { address: 0x8000, exec: true, condition: "A == 1", currentHits: 2 },
      { address: 0x0100, partition: 5, exec: true, disabled: true },
      { address: 0x9000, memoryWrite: true, length: 4 }
    ];
    const client = await connect(s);
    const { breakpoints } = await client.request<any>("breakpoints.list");
    expect(breakpoints).toEqual([
      { spec: "$8000 -if A == 1", kind: "exec", address: 0x8000, enabled: true, hits: 2, condition: "A == 1", source: "user" },
      { spec: "B5:$0100", kind: "exec", address: 0x100, partition: "B5", enabled: false, source: "user" },
      { spec: "$9000 -w -len 4", kind: "write", address: 0x9000, enabled: true, source: "user" }
    ]);
  });
});

describe("automation server: waits and events (D11, T9)", () => {
  it("resolves a wait on a breakpoint stop, with the breakpoint", async () => {
    const s = await start();
    s.host.setMachineState(MachineControllerState.Running);
    const client = await connect(s);
    const waiting = client.request<any>("machine.wait", { until: "paused" });
    await new Promise((r) => setTimeout(r, 50));
    s.host.stopInfo = { pc: 0x8103, breakpoints: [{ address: 0x8103, kind: "exec" }] };
    s.host.setMachineState(MachineControllerState.Paused, 0x8103);
    expect(await waiting).toEqual({ state: "paused", pc: 0x8103, breakpoint: { address: 0x8103, kind: "exec" } });
  });

  it("resolves a wait for paused when someone presses Stop (T9)", async () => {
    const s = await start();
    s.host.setMachineState(MachineControllerState.Running);
    const client = await connect(s);
    const waiting = client.request<any>("machine.wait", { until: "paused" });
    s.host.setMachineState(MachineControllerState.Stopped, 0x1234);
    expect(await waiting).toEqual({ state: "stopped", pc: 0x1234 });
  });

  it("answers at once when the machine is already there", async () => {
    const s = await start();
    const client = await connect(s);
    expect(await client.request("machine.wait", { until: ["stopped", "paused"] })).toEqual({ state: "paused", pc: 0x8000 });
  });

  it("times a wait out with its own timeout", async () => {
    const s = await start();
    s.host.setMachineState(MachineControllerState.Running);
    const client = await connect(s);
    const err = await rpcError(client.request("machine.wait", { until: "stopped", timeoutMs: 100 }));
    expect(err.error.data?.kind).toBe("timeout");
    expect(err.message).toContain("it is running");
  });

  it("is not stuck behind a long queued request (D14)", async () => {
    const s = await start();
    let release!: () => void;
    s.host.commandHandlers.compile = () =>
      new Promise((resolve) => (release = () => resolve({ success: true, output: [], value: { errors: [] } })));
    s.host.setMachineState(MachineControllerState.Running);
    const client = await connect(s);
    const build = client.request("project.build");
    const waiting = client.request<any>("machine.wait", { until: "paused" });
    await new Promise((r) => setTimeout(r, 50));
    s.host.setMachineState(MachineControllerState.Paused, 0x8000);
    expect((await waiting).state).toBe("paused");
    release();
    await build;
  });

  it("sends subscribed notifications only", async () => {
    const s = await start();
    s.host.stopInfo = { pc: 0x8000, breakpoints: [{ address: 0x8000, kind: "exec" }] };
    const watcher = await connect(s, "watcher");
    const quiet = await connect(s, "quiet");
    const seen: any[] = [];
    const unseen: any[] = [];
    watcher.onNotification((n) => seen.push(n));
    quiet.onNotification((n) => unseen.push(n));
    expect(await watcher.request("events.subscribe")).toEqual({
      events: ["machine.stateChanged", "machine.breakpointHit", "project.built"]
    });
    s.host.setMachineState(MachineControllerState.Running);
    s.host.setMachineState(MachineControllerState.Paused, 0x8000);
    s.server.publishOutput("emu", "not subscribed");
    await new Promise((r) => setTimeout(r, 100));
    expect(seen.map((n) => [n.method, n.params])).toEqual([
      ["machine.stateChanged", { state: "running" }],
      ["machine.stateChanged", { state: "paused", pc: 0x8000 }],
      ["machine.breakpointHit", { address: 0x8000, kind: "exec" }]
    ]);
    expect(unseen).toEqual([]);
    await watcher.request("events.subscribe", { events: ["ide.output"] });
    s.server.publishOutput("emu", "[1] Machine started");
    await new Promise((r) => setTimeout(r, 50));
    expect(seen.at(-1)).toEqual({ jsonrpc: "2.0", method: "ide.output", params: { pane: "emu", text: "[1] Machine started" } });
    const err = await rpcError(watcher.request("events.subscribe", { events: ["nope"] }));
    expect(err.error.code).toBe(-32602);
  });
});

describe("automation server: the queue and readiness (D14, T2, T5)", () => {
  it("runs queued requests one at a time, in arrival order, across clients", async () => {
    const s = await start(createFakeHost(), "full");
    const order: string[] = [];
    let active = 0;
    s.host.commandHandlers.work = async (text) => {
      active++;
      expect(active).toBe(1);
      order.push(`start ${text}`);
      await new Promise((r) => setTimeout(r, 20));
      order.push(`end ${text}`);
      active--;
      return { success: true, output: [] };
    };
    const a = await connect(s, "a");
    const b = await connect(s, "b");
    // --- Arrival order is the order the server reads them: a little apart, so it is this one
    const tick = () => new Promise((r) => setTimeout(r, 5));
    const first = a.request("ide.command", { text: "work 1" });
    await tick();
    const second = b.request("ide.command", { text: "work 2" });
    await tick();
    const third = a.request("ide.command", { text: "work 3" });
    await Promise.all([first, second, third]);
    expect(order).toEqual(["start work 1", "end work 1", "start work 2", "end work 2", "start work 3", "end work 3"]);
  });

  it("releases the queue when a request times out, and logs the late result (T5)", async () => {
    const s = await start(createFakeHost(), "full");
    let finish!: () => void;
    s.host.commandHandlers.slow = () => new Promise((resolve) => (finish = () => resolve({ success: true, output: [] })));
    const client = await connect(s);
    const err = await rpcError(client.request("ide.command", { text: "slow", timeoutMs: 100 }));
    expect(err.error.data?.kind).toBe("timeout");
    // --- The next request runs although the slow command has not finished
    expect(await client.request("ide.command", { text: "quick" })).toMatchObject({ success: true, output: ["ran: quick"] });
    finish();
    await new Promise((r) => setTimeout(r, 20));
    expect(s.log.join("\n")).toContain("ide.command: finished after its timeout; the result was discarded.");
  });

  it("holds requests until the IDE is ready, and says so in hello (T2)", async () => {
    const host = createFakeHost({ ready: false });
    const s = await start(host);
    const client = await connect(s);
    expect(client.hello?.ready).toBe(false);
    // --- Not waiting for readiness: answered at once
    expect(await client.request("machine.state")).toEqual({ state: "paused", pc: 0x8000 });
    const regs = client.request<any>("cpu.get");
    await new Promise((r) => setTimeout(r, 50));
    host.setReady(true);
    expect((await regs).pc).toBe(0x8000);
  });

  it("gives up waiting for readiness at the request's timeout", async () => {
    const s = await start(createFakeHost({ ready: false }));
    const client = await connect(s);
    const err = await rpcError(client.request("cpu.get", { timeoutMs: 100 }));
    expect(err.error.data?.kind).toBe("not-ready");
  });
});

describe("automation server: project and IDE methods (D9, D10, T5)", () => {
  it("returns a build's structured errors, and announces the build", async () => {
    const s = await start();
    s.host.commandHandlers.compile = () => ({
      success: false,
      finalMessage: "Compilation failed with 1 error.",
      value: { errors: [{ file: "code/main.kz80.asm", line: 3, column: 5, code: "Z0101", message: "Unknown instruction" }, { file: "code/main.kz80.asm", line: 9, message: "Unused", warning: true }] },
      output: ["Start compiling code/main.kz80.asm", "Z0101: Unknown instruction - code/main.kz80.asm:3:5"]
    });
    const client = await connect(s);
    const built: any[] = [];
    client.onNotification((n) => built.push(n.params));
    await client.request("events.subscribe", { events: ["project.built"] });
    const result = await client.request<any>("project.build");
    expect(result).toEqual({
      success: false,
      message: "Compilation failed with 1 error.",
      output: ["Start compiling code/main.kz80.asm", "Z0101: Unknown instruction - code/main.kz80.asm:3:5"],
      errors: [
        { file: "code/main.kz80.asm", line: 3, column: 5, code: "Z0101", message: "Unknown instruction" },
        { file: "code/main.kz80.asm", line: 9, message: "Unused", warning: true }
      ]
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(built).toEqual([{ success: false, errorCount: 1 }]);
  });

  it("builds the export command from its parameters, quoting the file", async () => {
    const s = await start();
    const client = await connect(s);
    await client.request("project.export", { file: '/tmp/my "game".tap', format: "tap", name: "GAME", autoStart: true, border: 1 });
    expect(s.host.commands.at(-1)!.text).toBe('expc "/tmp/my \\"game\\".tap" -f tap -n "GAME" -as -b 1');
  });

  it("needs an open Klive project", async () => {
    const host = createFakeHost();
    host.state = { ...host.state, project: {} };
    const s = await start(host);
    const client = await connect(s);
    expect((await rpcError(client.request("project.build"))).error.data?.kind).toBe("no-project");
  });

  it("refuses the commands that would deadlock an unattended run (T5)", async () => {
    const s = await start(createFakeHost(), "full");
    const client = await connect(s);
    for (const text of ["exit", "settings", "display-dialog 1"]) {
      const err = await rpcError(client.request("ide.command", { text }));
      expect(err.error.data?.kind, text).toBe("command-denied");
    }
  });

  it("returns a command's output and its failure without a protocol error", async () => {
    const s = await start(createFakeHost(), "full");
    s.host.commandHandlers.nope = () => ({ success: false, finalMessage: "Unknown command 'nope'.", output: ["Unknown command 'nope'."] });
    const client = await connect(s);
    expect(await client.request("ide.command", { text: "nope" })).toEqual({
      success: false,
      message: "Unknown command 'nope'.",
      output: ["Unknown command 'nope'."]
    });
  });

  it("captures the emulated picture as a PNG", async () => {
    const s = await start();
    const client = await connect(s);
    const shot = await client.request<any>("screen.capture");
    expect(shot).toMatchObject({ format: "png", width: 2, height: 1 });
    const png = Buffer.from(shot.data, "base64");
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(2);
    expect(png.readUInt32BE(20)).toBe(1);
  });

  it("describes the project", async () => {
    const s = await start();
    const client = await connect(s);
    expect(await client.request("project.info")).toEqual({
      folder: "/home/me/projects/hello",
      isKliveProject: true,
      buildRoot: "code/main.kz80.asm",
      hasBuildFile: false,
      files: ["code/main.kz80.asm"]
    });
  });

  it("logs each call with its arguments summarised and payloads never printed (D13, T11)", async () => {
    const s = await start();
    const client = await connect(s, "my-script");
    await client.request("memory.write", { address: 0x8000, data: Buffer.alloc(16, 0x41).toString("base64") });
    const line = s.log.find((l) => l.includes("memory.write"))!;
    expect(line).toMatch(/^\[my-script\] memory\.write\(address: 32768, data: <16 bytes>\) → ok \(\d+ ms\)$/);
    expect(s.log.join("\n")).toContain("[my-script] connected (level: control).");
  });
});
