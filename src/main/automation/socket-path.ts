import crypto from "crypto";
import path from "path";

/*
 * Where the automation server listens (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D6, T3).
 *
 * POSIX: a Unix domain socket in the private `<klive-home>/run/` folder. A socket path must fit in
 * `sun_path` - 104 bytes on macOS, 108 on Linux, the terminating NUL included - and a longer one
 * makes `listen` fail with `EINVAL` (or, on some systems, silently truncates it). A long home
 * folder, or a test's temporary settings folder, overflows it, so the path falls back to
 * `$XDG_RUNTIME_DIR` (a per-user `0700` folder) or to a `0700` folder under the temporary folder,
 * named by a hash of the home path, so one home always maps to the same place.
 *
 * Windows: a named pipe, `\\.\pipe\klive-<user hash>-<random>`. The name is random per start and
 * published only in the connection file; the token is what actually guards it (T4).
 *
 * Pure: the caller passes the platform and folders, so every branch is testable on any OS.
 */

/** `sun_path`'s size, the terminating NUL included */
export function socketPathLimit(platform: NodeJS.Platform): number {
  return platform === "darwin" || platform.endsWith("bsd") ? 104 : 108;
}

/** Does a socket path fit `sun_path`? */
export function fitsSocketPath(socketPath: string, platform: NodeJS.Platform): boolean {
  return Buffer.byteLength(socketPath, "utf8") < socketPathLimit(platform);
}

/** A short, stable hash of a string, for folder and pipe names */
export function shortHash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export type SocketPathOptions = {
  platform: NodeJS.Platform;
  /** `<klive-home>/run` */
  runDir: string;
  /** What identifies this Klive home (its path): the fallback folder's name derives from it */
  homeKey: string;
  /** `os.tmpdir()` */
  tmpdir: string;
  /** `$XDG_RUNTIME_DIR`, when set */
  xdgRuntimeDir?: string;
  /** The user's name, for the Windows pipe name */
  username?: string;
  /** Random hex for the Windows pipe name */
  random?: string;
};

export type SocketPathChoice = {
  /** The socket path or pipe name */
  socket: string;
  /**
   * A folder the server must create as `0700` (and check it owns) before listening, when the
   * socket is not in the run folder
   */
  privateDir?: string;
  /** Which rule chose it */
  kind: "run-dir" | "xdg-runtime" | "tmp" | "pipe";
};

/** Chooses where the server listens */
export function chooseSocketPath(options: SocketPathOptions): SocketPathChoice {
  const { platform } = options;
  if (platform === "win32") {
    const user = shortHash(`${options.username ?? ""}|${options.homeKey}`);
    const random = options.random ?? crypto.randomBytes(8).toString("hex");
    return { socket: `\\\\.\\pipe\\klive-${user}-${random}`, kind: "pipe" };
  }

  const inRunDir = path.posix.join(options.runDir, "automation.sock");
  if (fitsSocketPath(inRunDir, platform)) {
    return { socket: inRunDir, kind: "run-dir" };
  }

  const hash = shortHash(options.homeKey);
  if (options.xdgRuntimeDir) {
    const inXdg = path.posix.join(options.xdgRuntimeDir, `klive-${hash}.sock`);
    if (fitsSocketPath(inXdg, platform)) {
      return { socket: inXdg, kind: "xdg-runtime" };
    }
  }

  // --- The temporary folder (macOS's is under /var/folders and fits); /tmp when even that does not
  for (const base of [options.tmpdir, "/tmp"]) {
    const dir = path.posix.join(base, `klive-${hash}`);
    const socket = path.posix.join(dir, "a.sock");
    if (fitsSocketPath(socket, platform)) {
      return { socket, privateDir: dir, kind: "tmp" };
    }
  }
  throw new Error("No socket path short enough for this system could be found.");
}
