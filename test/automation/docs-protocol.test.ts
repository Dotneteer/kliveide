import { spawn, spawnSync } from "child_process";
import fs from "fs";
import net from "net";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createFakeHost, startFakeServer } from "./fake-host";

/*
 * The protocol test (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D17, §6): every request/response
 * example in `docs/content/working-with-ide/automation.mdx` is replayed against a real server, and
 * the page's Node and Python clients run against it, so the documentation cannot drift from the
 * protocol. The examples run in order on one connection, as a reader would type them.
 */

const DOC = path.join(__dirname, "../../docs/content/working-with-ide/automation.mdx");
const text = fs.readFileSync(DOC, "utf8");

/** The request/response pairs of the page's `text` blocks made of `-->` and `<--` lines */
function examples(): { request: string; response: string }[] {
  const pairs: { request: string; response: string }[] = [];
  for (const block of text.matchAll(/```text\n([\s\S]*?)```/g)) {
    const lines = block[1].split("\n").filter((l) => l.trim());
    if (!lines.length || !lines.every((l) => l.startsWith("--> ") || l.startsWith("<-- "))) continue;
    for (let i = 0; i < lines.length; i += 2) {
      expect(lines[i].startsWith("--> ") && lines[i + 1]?.startsWith("<-- "), lines[i]).toBe(true);
      pairs.push({ request: lines[i].slice(4), response: lines[i + 1].slice(4) });
    }
  }
  return pairs;
}

/** A fenced block by its file name */
function codeBlock(fileName: string): string {
  const match = text.match(new RegExp("```\\w+ filename=\"" + fileName.replace(".", "\\.") + "\"\\n([\\s\\S]*?)```"));
  if (!match) throw new Error(`No ${fileName} block in automation.mdx`);
  return match[1];
}

describe("automation.mdx", () => {
  let started: Awaited<ReturnType<typeof startFakeServer>>;

  beforeAll(async () => {
    const host = createFakeHost();
    host.commandHandlers["bp-set"] = (command) => ({
      success: true,
      output: [`Breakpoint at address ${command.slice(7, 12)} set${command.slice(12)}`]
    });
    host.commandHandlers.compile = () => ({
      success: false,
      finalMessage: "Compilation failed with 1 error.",
      value: {
        errors: [{ file: "code/main.kz80.asm", line: 4, column: 7, code: "Z0605", message: "Identifier 'nosuch' is not defined yet." }]
      },
      output: [
        "Start compiling code/main.kz80.asm",
        "Z0605: Identifier 'nosuch' is not defined yet. - code/main.kz80.asm:4:7"
      ]
    });
    started = await startFakeServer(host, "control");
  });

  afterAll(async () => {
    await started.stop();
  });

  it("has protocol examples", () => {
    expect(examples().length).toBeGreaterThanOrEqual(9);
  });

  it("answers every documented request with the documented response", async () => {
    const info = started.server.connectionInfo!;
    const socket = net.connect(info.socket);
    await new Promise((resolve) => socket.once("connect", resolve));
    let buffer = "";
    const lines: string[] = [];
    const waiters: ((line: string) => void)[] = [];
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        const waiter = waiters.shift();
        if (waiter) waiter(line);
        else lines.push(line);
      }
    });
    const nextLine = () =>
      lines.length ? Promise.resolve(lines.shift()!) : new Promise<string>((resolve) => waiters.push(resolve));
    try {
      for (const { request, response } of examples()) {
        socket.write(request.replace('"<token>"', JSON.stringify(info.token)) + "\n");
        const answer = JSON.parse(await nextLine());
        expect(answer, request).toEqual(JSON.parse(response));
      }
    } finally {
      socket.destroy();
    }
  });

  it("documents every method in the method table", async () => {
    const { AUTOMATION_METHODS } = await import("@common/automation/protocol");
    for (const method of AUTOMATION_METHODS) {
      const [group, name] = method.split(".");
      const listed = text.includes(`\`${method}\``) || new RegExp(`\`${group}\\.[^\`]*\`[^|]*\`\\.${name}\``).test(text);
      expect(listed, method).toBe(true);
    }
  });

  const env = () => ({ ...process.env, KLIVE_SETTINGS_FILE: started.temp.settingsFile });

  /** Runs a client without blocking: the server answering it lives in this process */
  const run = (command: string, args: string[]) =>
    new Promise<{ stdout: string; stderr: string }>((resolve) => {
      const child = spawn(command, args, { env: env() });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => (stdout += d));
      child.stderr.on("data", (d) => (stderr += d));
      const timer = setTimeout(() => child.kill(), 20_000);
      child.on("exit", () => {
        clearTimeout(timer);
        resolve({ stdout, stderr });
      });
    });

  it("runs the Node client", async () => {
    const file = path.join(started.temp.home, "klive-client.mjs");
    fs.writeFileSync(file, codeBlock("klive-client.mjs"));
    const result = await run(process.execPath, [file]);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("PC=$8000 A=18\nKLIVE\n");
  });

  const python = spawnSync("python3", ["--version"], { encoding: "utf8" });
  it.skipIf(process.platform === "win32" || python.status !== 0)("runs the Python client", async () => {
    const file = path.join(started.temp.home, "klive_client.py");
    fs.writeFileSync(file, codeBlock("klive_client.py"));
    const result = await run("python3", ["-I", file]);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("PC=$8000 A=18\nKLIVE\n");
  });
});
