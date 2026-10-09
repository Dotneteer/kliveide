import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import {
  automationRunDir,
  connectionFilePath,
  isProcessAlive,
  lookUpConnection,
  readConnectionFile,
  removeConnectionFile,
  writeConnectionFile
} from "@main/automation/connection-file";
import { resolveConnectionFile } from "../../src/cli/rpc/client";
import { makeTempHome } from "./fake-host";

/*
 * The connection file (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D5, T6).
 */

const TOKEN = "a".repeat(64);

function info(pid = process.pid, token = TOKEN) {
  return { protocol: 1, socket: "/tmp/x.sock", token, pid, version: "0.64.0", startedAt: "2026-10-09T00:00:00.000Z" };
}

describe("automation connection file", () => {
  const homes: ReturnType<typeof makeTempHome>[] = [];
  const temp = () => {
    const t = makeTempHome();
    homes.push(t);
    return t;
  };
  afterEach(() => homes.splice(0).forEach((h) => h.dispose()));

  it("lives in run/ beside the settings file, so KLIVE_SETTINGS_FILE isolates it (T6)", () => {
    expect(automationRunDir("/home/me/Klive/klive.settings")).toBe(path.join("/home/me/Klive", "run"));
    expect(connectionFilePath("/x/run")).toBe(path.join("/x/run", "automation.json"));
  });

  it("the client resolves the same file the server writes", () => {
    const env = { KLIVE_SETTINGS_FILE: "/tmp/test-home/klive.settings" };
    expect(resolveConnectionFile(env, "/home/me")).toBe(path.join("/tmp/test-home", "run", "automation.json"));
    expect(resolveConnectionFile({}, "/home/me")).toBe(path.join("/home/me", "Klive", "run", "automation.json"));
    expect(resolveConnectionFile({ KLIVE_AUTOMATION_FILE: "/elsewhere/a.json" }, "/home/me")).toBe(
      path.resolve("/elsewhere/a.json")
    );
  });

  it.skipIf(process.platform === "win32")("is 0600 in a 0700 folder", () => {
    const t = temp();
    const file = connectionFilePath(t.runDir);
    writeConnectionFile(file, info());
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(fs.statSync(t.runDir).mode & 0o777).toBe(0o700);
    // --- No temporary file is left behind by the atomic write
    expect(fs.readdirSync(t.runDir)).toEqual(["automation.json"]);
  });

  it("reads back what was written, and rejects what is not a connection file", () => {
    const t = temp();
    const file = connectionFilePath(t.runDir);
    writeConnectionFile(file, info());
    expect(readConnectionFile(file)).toEqual(info());
    fs.writeFileSync(file, JSON.stringify({ ...info(), token: "short" }));
    expect(readConnectionFile(file)).toBeUndefined();
    fs.writeFileSync(file, "not json");
    expect(readConnectionFile(file)).toBeUndefined();
    expect(readConnectionFile(path.join(t.runDir, "missing.json"))).toBeUndefined();
  });

  it("recognises a stale file by its dead pid", () => {
    const t = temp();
    const file = connectionFilePath(t.runDir);
    expect(lookUpConnection(file).status).toBe("missing");
    writeConnectionFile(file, info());
    expect(lookUpConnection(file).status).toBe("live");
    writeConnectionFile(file, info(2 ** 22 + 12345));
    expect(lookUpConnection(file, () => false).status).toBe("stale");
    expect(isProcessAlive(process.pid)).toBe(true);
    expect(isProcessAlive(-1)).toBe(false);
  });

  it("deletes only its own file: a file another instance wrote since is kept", () => {
    const t = temp();
    const file = connectionFilePath(t.runDir);
    writeConnectionFile(file, info(process.pid, "b".repeat(64)));
    expect(removeConnectionFile(file, TOKEN)).toBe(false);
    expect(fs.existsSync(file)).toBe(true);
    expect(removeConnectionFile(file, "b".repeat(64))).toBe(true);
    expect(fs.existsSync(file)).toBe(false);
  });
});
