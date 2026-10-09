import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { writeConnectionFile } from "@main/automation/connection-file";
import type { CliIo } from "../../src/cli/io";
import { runCli } from "../../src/cli/run-cli";
import { extractGlobalOptions } from "../../src/cli/verbs/ide";
import { createFakeHost, makeTempHome, startFakeServer, type FakeHost } from "../automation/fake-host";

/*
 * `klive ide …` (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D12) in-process: the real verbs and the
 * real client against the real server on a fake Klive. Exit codes, the human output and `--json`.
 */

type Captured = { io: CliIo; out: string[]; err: string[]; bytes: Uint8Array[]; files: Record<string, Uint8Array | string> };

function captureIo(env: NodeJS.ProcessEnv, cwd = "/work"): Captured {
  const out: string[] = [];
  const err: string[] = [];
  const bytes: Uint8Array[] = [];
  const files: Record<string, Uint8Array | string> = {};
  return {
    out,
    err,
    bytes,
    files,
    io: {
      out: (t) => out.push(t),
      err: (t) => err.push(t),
      outBytes: (d) => bytes.push(d),
      writeFile: (f, d) => {
        const full = path.resolve(cwd, f);
        files[full] = d;
        return full;
      },
      env,
      cwd,
      waitForInterrupt: () => new Promise((resolve) => setTimeout(resolve, 150))
    }
  };
}

const running: Awaited<ReturnType<typeof startFakeServer>>[] = [];
afterEach(async () => {
  for (const s of running.splice(0)) await s.stop();
});

async function cli(argv: string[], host: FakeHost = createFakeHost(), level: "read" | "control" | "full" = "control") {
  const started = await startFakeServer(host, level);
  running.push(started);
  const captured = captureIo({ KLIVE_AUTOMATION_FILE: started.server.connectionFile });
  const code = await runCli(["ide", ...argv], captured.io);
  return { code, ...captured, host, server: started.server };
}

describe("klive ide: connecting", () => {
  it("exits 3 with the setting to change when no Klive has automation on", async () => {
    const temp = makeTempHome();
    try {
      const c = captureIo({ KLIVE_SETTINGS_FILE: temp.settingsFile });
      expect(await runCli(["ide", "status"], c.io)).toBe(3);
      expect(c.err[0]).toContain("Settings › General › Automation");
      expect(c.err[0]).toContain(path.join(temp.home, "run", "automation.json"));
    } finally {
      temp.dispose();
    }
  });

  it("exits 3 on a stale connection file", async () => {
    const temp = makeTempHome();
    try {
      fs.mkdirSync(temp.runDir, { recursive: true });
      writeConnectionFile(path.join(temp.runDir, "automation.json"), {
        protocol: 1,
        socket: path.join(temp.runDir, "gone.sock"),
        token: "c".repeat(64),
        pid: 2 ** 22 + 4321,
        version: "0",
        startedAt: ""
      });
      const c = captureIo({ KLIVE_SETTINGS_FILE: temp.settingsFile });
      expect(await runCli(["ide"], c.io)).toBe(3);
      expect(c.err[0]).toContain("no longer running");
    } finally {
      temp.dispose();
    }
  });

  it("prints the status by default", async () => {
    const r = await cli([]);
    expect(r.code).toBe(0);
    expect(r.out).toEqual([
      "Klive 0.64.0: automation protocol 1, level control",
      "Machine: sp128 (pal), paused at $8000",
      "Project: /home/me/projects/hello, build root code/main.kz80.asm",
      `Connection: ${r.server.connectionFile}`
    ]);
  });

  it("prints help without connecting", async () => {
    const c = captureIo({});
    expect(await runCli(["ide", "help"], c.io)).toBe(0);
    expect(c.out[0]).toContain("Usage: klive ide");
    expect(await runCli([], c.io)).toBe(0);
    expect(await runCli(["--version"], c.io)).toBe(0);
    expect(await runCli(["bogus"], c.io)).toBe(3);
    expect(await runCli(["run", "game.tap"], c.io)).toBe(3);
  });
});

describe("klive ide: verbs", () => {
  it("start, pause, step and wait print the machine state", async () => {
    const host = createFakeHost();
    expect((await cli(["start"], host)).out).toEqual(["running"]);
    expect((await cli(["pause"], host)).out).toEqual(["paused at $8000"]);
    expect((await cli(["step", "over"], host)).out).toEqual(["paused at $8001"]);
    expect((await cli(["start", "--debug"], host)).out).toEqual(["running"]);
    expect(host.machineCommands).toEqual(["start", "pause", "stepOver", "debug"]);
  });

  it("wait reports the breakpoint and exits 5 when it times out", async () => {
    const host = createFakeHost();
    host.setMachineState(MachineControllerState.Running);
    const started = await startFakeServer(host);
    running.push(started);
    const c = captureIo({ KLIVE_AUTOMATION_FILE: started.server.connectionFile });
    const waiting = runCli(["ide", "wait"], c.io);
    await new Promise((r) => setTimeout(r, 100));
    host.stopInfo = { pc: 0x8103, breakpoints: [{ address: 0x8103, kind: "exec" }] };
    host.setMachineState(MachineControllerState.Paused, 0x8103);
    expect(await waiting).toBe(0);
    expect(c.out).toEqual(["paused at $8103 (exec breakpoint)"]);

    host.setMachineState(MachineControllerState.Running);
    const timed = captureIo({ KLIVE_AUTOMATION_FILE: started.server.connectionFile });
    expect(await runCli(["ide", "wait", "--stopped", "--timeout", "0.1"], timed.io)).toBe(5);
    expect(timed.err[0]).toContain("did not reach stopped");
  });

  it("build prints gcc-format diagnostics and exits 2 on errors", async () => {
    const host = createFakeHost();
    host.commandHandlers.compile = () => ({
      success: false,
      finalMessage: "Compilation failed with 1 error.",
      value: {
        errors: [
          { file: "/p/code/main.kz80.asm", line: 3, column: 5, code: "Z0101", message: "Unknown instruction" },
          { file: "/p/code/main.kz80.asm", line: 9, message: "Unused label", warning: true }
        ]
      },
      output: []
    });
    const r = await cli(["build"], host);
    expect(r.code).toBe(2);
    expect(r.err).toEqual(["/p/code/main.kz80.asm:3:5: error: Z0101: Unknown instruction", "Compilation failed with 1 error."]);
    expect(r.out).toEqual(["/p/code/main.kz80.asm:9:1: warning: Unused label"]);
  });

  it("build exits 0 on success, and --json prints the result", async () => {
    const host = createFakeHost();
    host.commandHandlers.compile = () => ({ success: true, finalMessage: "Project file successfully compiled.", value: { errors: [] }, output: ["done"] });
    const r = await cli(["--json", "build"], host);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out.join("\n"))).toEqual({
      success: true,
      message: "Project file successfully compiled.",
      output: ["done"],
      errors: []
    });
  });

  it("export resolves the file against the working folder", async () => {
    const r = await cli(["export", "out/game.tap", "--auto-start", "--border", "2"]);
    expect(r.code).toBe(0);
    expect(r.host.commands.at(-1)!.text).toBe('expc "/work/out/game.tap" -as -b 2');
  });

  it("regs prints the Z80 registers", async () => {
    const r = await cli(["regs"]);
    expect(r.code).toBe(0);
    expect(r.out[0]).toBe("AF  $1234   BC  $5678   DE  $9ABC   HL  $DEF0");
    expect(r.out[2]).toBe("IX  $5C3A   IY  $5C3A   SP  $FF40   PC  $8000");
  });

  it("mem dumps memory by address and by partition, in hex, binary or JSON", async () => {
    const hex = await cli(["mem", "$8000", "5"]);
    expect(hex.out).toEqual(["$8000  4B 4C 49 56 45                                   |KLIVE|"]);
    const bank = await cli(["mem", "B5:$0100", "4"]);
    expect(bank.out).toEqual(["B5:$0100  DE AD BE EF                                      |....|"]);
    const offset = await cli(["mem", "$0100", "2", "--partition", "b5"]);
    expect(offset.out[0]).toContain("B5:$0100  DE AD");
    const bin = await cli(["mem", "$8000", "3", "--format", "bin", "--out", "dump.bin"]);
    expect(Array.from(bin.files["/work/dump.bin"] as Uint8Array)).toEqual([0x4b, 0x4c, 0x49]);
    const json = await cli(["--json", "mem", "$8000", "2"]);
    expect(JSON.parse(json.out.join("\n"))).toEqual({ address: 0x8000, length: 2, data: "S0w=", bytes: [0x4b, 0x4c] });
  });

  it("poke writes bytes", async () => {
    const r = await cli(["poke", "$8000", "1", "$02", "%11"]);
    expect(r.code).toBe(0);
    expect(Array.from(r.host.banks[2].subarray(0, 3))).toEqual([1, 2, 3]);
    expect(r.out).toEqual(["3 bytes written."]);
  });

  it("bp passes the IDE's own syntax through, single-dash options included", async () => {
    const host = createFakeHost();
    const set = await cli(["bp", "set", "$8000", "-if", "A", "==", "$FF"], host);
    expect(set.code).toBe(0);
    expect(host.commands.at(-1)!.text).toBe("bp-set $8000 -if A == $FF");
    host.breakpoints = [{ address: 0x8000, exec: true, currentHits: 3 }];
    expect((await cli(["bp", "list"], host)).out).toEqual(["$8000   (hits: 3)"]);
    await cli(["bp", "rm", "$8000"], host);
    expect(host.commands.at(-1)!.text).toBe("bp-del $8000");
  });

  it("screenshot writes a PNG", async () => {
    const r = await cli(["screenshot", "shot.png"]);
    expect(r.code).toBe(0);
    const png = r.files["/work/shot.png"] as Uint8Array;
    expect(Buffer.from(png).subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(r.out).toEqual(["Saved the 2x1 picture to /work/shot.png"]);
  });

  it("cmd needs the full level (exit 3), prints output, and exits 1 on failure", async () => {
    const denied = await cli(["cmd", "help"]);
    expect(denied.code).toBe(3);
    expect(denied.err[0]).toContain("set -u automation.level full");
    const host = createFakeHost();
    host.commandHandlers.bad = () => ({ success: false, finalMessage: "nope", output: ["nope"] });
    const failed = await cli(["cmd", "bad", "-x"], host, "full");
    expect(failed.code).toBe(1);
    expect(failed.out).toEqual(["nope"]);
    const exit = await cli(["cmd", "exit"], createFakeHost(), "full");
    expect(exit.code).toBe(3);
  });

  it("events streams notifications until interrupted", async () => {
    const host = createFakeHost();
    const started = await startFakeServer(host);
    running.push(started);
    const c = captureIo({ KLIVE_AUTOMATION_FILE: started.server.connectionFile });
    const streaming = runCli(["ide", "events", "machine.stateChanged"], c.io);
    await new Promise((r) => setTimeout(r, 60));
    host.setMachineState(MachineControllerState.Running);
    expect(await streaming).toBe(0);
    expect(c.out).toEqual(["machine: running"]);
  });

  it("rpc makes a raw call and prints JSON", async () => {
    const r = await cli(["rpc", "memory.read", '{"address": 32768, "length": 1}']);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out.join("\n"))).toEqual({ address: 32768, length: 1, data: "Sw==" });
    expect((await cli(["rpc", "no.such"])).code).toBe(3);
    expect((await cli(["rpc", "memory.read", "[1]"])).code).toBe(3);
  });

  it("reports usage errors with exit 3", async () => {
    expect((await cli(["mem"])).code).toBe(3);
    expect((await cli(["poke", "$8000", "300"])).code).toBe(3);
    expect((await cli(["step", "sideways"])).code).toBe(3);
    expect((await cli(["nosuchverb"])).code).toBe(3);
    expect((await cli(["wait", "--bogus"])).code).toBe(3);
  });
});

describe("klive ide: global options", () => {
  it("takes --json, --timeout, --launch and --connection from anywhere, and nothing else", () => {
    expect(extractGlobalOptions(["bp", "set", "$8000", "--json", "-if", "A", "--timeout=2"])).toEqual({
      json: true,
      launch: false,
      timeoutMs: 2000,
      rest: ["bp", "set", "$8000", "-if", "A"]
    });
    expect(extractGlobalOptions(["--launch", "--connection", "/x.json", "status"])).toMatchObject({
      launch: true,
      connection: "/x.json",
      rest: ["status"]
    });
  });
});
