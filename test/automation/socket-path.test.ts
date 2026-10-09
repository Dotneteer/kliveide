import { describe, expect, it } from "vitest";

import { chooseSocketPath, fitsSocketPath, socketPathLimit } from "@main/automation/socket-path";

/*
 * Where the server listens (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D6, T3).
 */

const LONG_HOME = "/Users/" + "x".repeat(150);

describe("automation socket path", () => {
  it("knows sun_path's size: 104 bytes on macOS, 108 on Linux", () => {
    expect(socketPathLimit("darwin")).toBe(104);
    expect(socketPathLimit("linux")).toBe(108);
    expect(fitsSocketPath("/" + "a".repeat(102), "darwin")).toBe(true);
    expect(fitsSocketPath("/" + "a".repeat(103), "darwin")).toBe(false);
    expect(fitsSocketPath("/" + "a".repeat(106), "linux")).toBe(true);
    expect(fitsSocketPath("/" + "a".repeat(107), "linux")).toBe(false);
  });

  it("uses the private run folder when the path fits", () => {
    const choice = chooseSocketPath({ platform: "linux", runDir: "/home/me/Klive/run", homeKey: "/home/me/Klive", tmpdir: "/tmp" });
    expect(choice).toEqual({ socket: "/home/me/Klive/run/automation.sock", kind: "run-dir" });
  });

  it("falls back to XDG_RUNTIME_DIR for a 150-character home (T3)", () => {
    const choice = chooseSocketPath({
      platform: "linux",
      runDir: `${LONG_HOME}/Klive/run`,
      homeKey: `${LONG_HOME}/Klive`,
      tmpdir: "/tmp",
      xdgRuntimeDir: "/run/user/1000"
    });
    expect(choice.kind).toBe("xdg-runtime");
    expect(choice.socket).toMatch(/^\/run\/user\/1000\/klive-[0-9a-f]{16}\.sock$/);
    expect(choice.privateDir).toBeUndefined();
    expect(fitsSocketPath(choice.socket, "linux")).toBe(true);
  });

  it("falls back to a private folder under the temporary folder, named by the home's hash", () => {
    const options = {
      platform: "darwin" as const,
      runDir: `${LONG_HOME}/Klive/run`,
      homeKey: `${LONG_HOME}/Klive`,
      tmpdir: "/var/folders/ab/cdefgh/T"
    };
    const choice = chooseSocketPath(options);
    expect(choice.kind).toBe("tmp");
    expect(choice.privateDir).toMatch(/^\/var\/folders\/ab\/cdefgh\/T\/klive-[0-9a-f]{16}$/);
    expect(choice.socket).toBe(`${choice.privateDir}/a.sock`);
    // --- Stable: the same home always maps to the same folder; another home to another
    expect(chooseSocketPath(options).socket).toBe(choice.socket);
    expect(chooseSocketPath({ ...options, homeKey: "/other" }).socket).not.toBe(choice.socket);
  });

  it("uses /tmp when even the temporary folder is too long", () => {
    const choice = chooseSocketPath({
      platform: "darwin",
      runDir: `${LONG_HOME}/run`,
      homeKey: LONG_HOME,
      tmpdir: LONG_HOME
    });
    expect(choice.socket).toMatch(/^\/tmp\/klive-[0-9a-f]{16}\/a\.sock$/);
  });

  it("uses a random named pipe on Windows", () => {
    const a = chooseSocketPath({ platform: "win32", runDir: "C:\\Users\\me\\Klive\\run", homeKey: "C:\\Users\\me\\Klive", tmpdir: "C:\\Temp", username: "me" });
    const b = chooseSocketPath({ platform: "win32", runDir: "C:\\Users\\me\\Klive\\run", homeKey: "C:\\Users\\me\\Klive", tmpdir: "C:\\Temp", username: "me" });
    expect(a.kind).toBe("pipe");
    expect(a.socket).toMatch(/^\\\\\.\\pipe\\klive-[0-9a-f]{16}-[0-9a-f]{16}$/);
    // --- The user part is stable, the random part is not
    expect(a.socket.slice(0, 32)).toBe(b.socket.slice(0, 32));
    expect(a.socket).not.toBe(b.socket);
  });
});
