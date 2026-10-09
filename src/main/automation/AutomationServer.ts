import crypto from "crypto";
import fs from "fs";
import net from "net";
import os from "os";

import {
  AUTOMATION_DEFAULT_TIMEOUT_MS,
  AUTOMATION_LEVEL_SETTING,
  AUTOMATION_MAX_LINE_BYTES,
  AUTOMATION_PROTOCOL_VERSION,
  type AutomationConnectionInfo,
  type AutomationEvent,
  type AutomationLevel,
  type BreakpointHit,
  type JsonRpcError,
  type JsonRpcRequest,
  JSONRPC_INVALID_REQUEST,
  JSONRPC_METHOD_NOT_FOUND,
  JSONRPC_PARSE_ERROR,
  KLIVE_SERVER_ERROR,
  levelAllows,
  machineStateName,
  type WaitResult,
  type WaitUntil
} from "@common/automation/protocol";
import type { AutomationHost } from "./host";
import { connectionFilePath, ensurePrivateDir, removeConnectionFile, writeConnectionFile } from "./connection-file";
import { chooseSocketPath } from "./socket-path";
import { toJsonValue } from "./encode";
import { AutomationError, automationError, invalidParams, toJsonRpcError } from "./errors";
import { formatCallLine, redactSecrets } from "./log";
import type { ConnectionState, MethodContext, MethodTable } from "./method-types";
import { AUTOMATION_METHOD_TABLE } from "./methods";
import { helloResult } from "./handlers/session";
import { machineStateOf } from "./handlers/machine";

/*
 * The automation server (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D2–D7, D11, D13, D14).
 *
 * - **Transport** (D2, D3, D6): JSON-RPC 2.0, one message per line, over a Unix domain socket in the
 *   private run folder (or a named pipe on Windows). Never TCP, never HTTP.
 * - **Authentication** (D5): the first request on a connection must be `session.hello` with the
 *   token from the connection file, compared in constant time. Anything else, or a wrong token, is
 *   answered with an error and the connection is closed.
 * - **Levels** (D7): every method declares one; a connection gets the level the settings grant.
 * - **One queue** (D14): queued requests run one at a time, in arrival order, across all clients,
 *   each with a server-side timeout. A timed-out request releases the queue; the work it started
 *   cannot be cancelled and finishes in the background (T5), its late result logged and discarded.
 * - **Readiness** (T2): connections are accepted early; `session.hello` says `ready: false` and the
 *   methods that need the windows wait for them, within their timeout.
 * - **Events** (D11): notifications go only to connections that subscribed; `machine.wait` is built
 *   on the same store subscription, so a client never polls.
 */

export type AutomationStatus = { listening: boolean; clients: number };

export type AutomationServerOptions = {
  host: AutomationHost;
  /** `<klive-home>/run`: the connection file goes here, and normally the socket */
  runDir: string;
  /** The Klive home, for the socket path's fallback folder name */
  homeKey: string;
  level: AutomationLevel;
  /** Lines for the Automation pane (D13) */
  onLog?: (line: string) => void;
  /** Listening and client count, for the status-bar item (D4) */
  onStatus?: (status: AutomationStatus) => void;
  /** Tests: the method table, the default timeout and the platform's folders */
  methods?: MethodTable;
  defaultTimeoutMs?: number;
  platform?: NodeJS.Platform;
  tmpdir?: string;
  xdgRuntimeDir?: string;
};

type Connection = {
  socket: net.Socket;
  state: ConnectionState;
  authenticated: boolean;
  /** Bytes of the line being read */
  pending: Buffer[];
  pendingBytes: number;
  closed: boolean;
  /** Cancels the `machine.wait`s this connection has open */
  waits: Set<() => void>;
};

/** The longest client name kept */
const MAX_CLIENT_NAME = 64;

export class AutomationServer {
  private server: net.Server | undefined;
  private info: AutomationConnectionInfo | undefined;
  private socketPath: string | undefined;
  private readonly connections = new Set<Connection>();
  private nextConnectionId = 1;
  private queue: Promise<void> = Promise.resolve();
  private level: AutomationLevel;
  private readonly methods: MethodTable;
  private readonly defaultTimeoutMs: number;
  private unsubscribeStore: (() => void) | undefined;
  private lastMachineState: number | undefined;

  constructor(private readonly options: AutomationServerOptions) {
    this.level = options.level;
    this.methods = options.methods ?? AUTOMATION_METHOD_TABLE;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? AUTOMATION_DEFAULT_TIMEOUT_MS;
  }

  /** The connection file's path */
  get connectionFile(): string {
    return connectionFilePath(this.options.runDir);
  }

  /** What the connection file says, while the server listens */
  get connectionInfo(): AutomationConnectionInfo | undefined {
    return this.info;
  }

  get isListening(): boolean {
    return !!this.server?.listening;
  }

  /** Authenticated connections */
  get clientCount(): number {
    let count = 0;
    for (const c of this.connections) if (c.authenticated && !c.closed) count++;
    return count;
  }

  get currentLevel(): AutomationLevel {
    return this.level;
  }

  /** Starts listening and publishes the connection file */
  async start(): Promise<AutomationConnectionInfo> {
    if (this.info) return this.info;
    const platform = this.options.platform ?? process.platform;
    ensurePrivateDir(this.options.runDir);
    const choice = chooseSocketPath({
      platform,
      runDir: this.options.runDir,
      homeKey: this.options.homeKey,
      tmpdir: this.options.tmpdir ?? os.tmpdir(),
      xdgRuntimeDir: this.options.xdgRuntimeDir ?? process.env.XDG_RUNTIME_DIR,
      username: safeUserName()
    });
    if (choice.privateDir) ensureOwnedPrivateDir(choice.privateDir);
    if (platform !== "win32") removeStaleSocket(choice.socket);

    const server = net.createServer((socket) => this.accept(socket));
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(choice.socket, () => {
        server.off("error", reject);
        resolve();
      });
    });
    server.on("error", (err) => this.log(`Server error: ${err.message}`));
    if (platform !== "win32") {
      try {
        fs.chmodSync(choice.socket, 0o600);
      } catch {
        // --- The folder is private anyway
      }
    }
    this.server = server;
    this.socketPath = choice.socket;
    this.info = {
      protocol: AUTOMATION_PROTOCOL_VERSION,
      socket: choice.socket,
      token: crypto.randomBytes(32).toString("hex"),
      pid: process.pid,
      version: this.options.host.version,
      startedAt: new Date().toISOString()
    };
    writeConnectionFile(this.connectionFile, this.info);
    this.lastMachineState = this.options.host.getState()?.emulatorState?.machineState;
    this.unsubscribeStore = this.options.host.subscribe(() => this.onStoreChanged());
    this.log(`Listening (level: ${this.level}).`);
    this.reportStatus();
    return this.info;
  }

  /** Closes every connection, stops listening and deletes the connection file */
  async stop(): Promise<void> {
    const server = this.server;
    const info = this.info;
    if (!server || !info) return;
    this.server = undefined;
    this.info = undefined;
    this.unsubscribeStore?.();
    this.unsubscribeStore = undefined;
    for (const connection of [...this.connections]) this.close(connection);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    removeConnectionFile(this.connectionFile, info.token);
    if (this.socketPath && (this.options.platform ?? process.platform) !== "win32") {
      removeStaleSocket(this.socketPath);
    }
    this.socketPath = undefined;
    this.log("Stopped.");
    this.reportStatus();
  }

  /** Synchronous cleanup for the quit path: the connection file must not outlive the process */
  stopNow(): void {
    const info = this.info;
    if (!info) return;
    this.unsubscribeStore?.();
    for (const connection of [...this.connections]) this.close(connection);
    this.server?.close();
    this.server = undefined;
    this.info = undefined;
    removeConnectionFile(this.connectionFile, info.token);
    if (this.socketPath && (this.options.platform ?? process.platform) !== "win32") {
      removeStaleSocket(this.socketPath);
    }
  }

  /** Changes the level; it applies at once, to existing connections too */
  setLevel(level: AutomationLevel): void {
    if (level === this.level) return;
    this.level = level;
    for (const c of this.connections) c.state.level = level;
    this.log(`Level changed to ${level}.`);
  }

  /** Drops every client (Klive › Automation › Disconnect All; D13) */
  disconnectAll(): number {
    const count = this.clientCount;
    for (const connection of [...this.connections]) this.close(connection);
    this.log(`Disconnected ${count} client${count === 1 ? "" : "s"}.`);
    return count;
  }

  /** Sends `ide.output` to the connections that asked for it (D11) */
  publishOutput(pane: string, text: string): void {
    this.publish("ide.output", { pane, text });
  }

  // ==============================================================================================
  // Connections

  private accept(socket: net.Socket): void {
    const connection: Connection = {
      socket,
      state: {
        id: this.nextConnectionId++,
        client: "",
        level: this.level,
        subscriptions: new Set()
      },
      authenticated: false,
      pending: [],
      pendingBytes: 0,
      closed: false,
      waits: new Set()
    };
    this.connections.add(connection);
    socket.on("data", (chunk: Buffer) => this.onData(connection, chunk));
    socket.on("error", () => this.close(connection));
    socket.on("close", () => this.close(connection));
  }

  private close(connection: Connection): void {
    if (connection.closed) return;
    connection.closed = true;
    this.connections.delete(connection);
    for (const cancel of [...connection.waits]) cancel();
    connection.socket.destroy();
    if (connection.authenticated) {
      this.log(`[${this.nameOf(connection)}] disconnected.`);
      this.reportStatus();
    }
  }

  private nameOf(connection: Connection): string {
    return connection.state.client || `#${connection.state.id}`;
  }

  private onData(connection: Connection, chunk: Buffer): void {
    let start = 0;
    for (;;) {
      const newline = chunk.indexOf(0x0a, start);
      const piece = chunk.subarray(start, newline < 0 ? chunk.length : newline);
      connection.pendingBytes += piece.length;
      if (connection.pendingBytes > AUTOMATION_MAX_LINE_BYTES) {
        this.send(connection, {
          jsonrpc: "2.0",
          id: null,
          error: { code: JSONRPC_INVALID_REQUEST, message: "The request is too long." }
        });
        connection.socket.end();
        this.close(connection);
        return;
      }
      connection.pending.push(Buffer.from(piece));
      if (newline < 0) return;
      const line = Buffer.concat(connection.pending).toString("utf8").trim();
      connection.pending = [];
      connection.pendingBytes = 0;
      start = newline + 1;
      if (line) this.onLine(connection, line);
      if (connection.closed) return;
    }
  }

  private onLine(connection: Connection, line: string): void {
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(line);
    } catch {
      this.respondError(connection, null, { code: JSONRPC_PARSE_ERROR, message: "The request is not valid JSON." });
      if (!connection.authenticated) this.reject(connection, "a request that is not JSON");
      return;
    }
    if (
      !request ||
      typeof request !== "object" ||
      Array.isArray(request) ||
      request.jsonrpc !== "2.0" ||
      typeof request.method !== "string"
    ) {
      this.respondError(connection, requestId(request), {
        code: JSONRPC_INVALID_REQUEST,
        message: "Not a JSON-RPC 2.0 request (batches are not supported)."
      });
      if (!connection.authenticated) this.reject(connection, "an invalid request");
      return;
    }

    if (!connection.authenticated) {
      this.authenticate(connection, request);
      return;
    }
    void this.dispatch(connection, request);
  }

  // ==============================================================================================
  // Authentication (D5)

  private authenticate(connection: Connection, request: JsonRpcRequest): void {
    const id = requestId(request);
    if (request.method !== "session.hello") {
      this.respondError(connection, id, {
        code: KLIVE_SERVER_ERROR,
        message: "The first request must be session.hello with the token from the connection file.",
        data: { kind: "unauthorized" }
      });
      this.reject(connection, `'${request.method}' before session.hello`);
      return;
    }
    const params = (request.params ?? {}) as Record<string, unknown>;
    if (!this.info || typeof params.token !== "string" || !tokensMatch(params.token, this.info.token)) {
      this.respondError(connection, id, {
        code: KLIVE_SERVER_ERROR,
        message: "Wrong or missing token.",
        data: { kind: "unauthorized" }
      });
      this.reject(connection, "a wrong or missing token");
      return;
    }
    connection.authenticated = true;
    connection.state.client = clientName(params.client) || `client-${connection.state.id}`;
    connection.state.level = this.level;
    this.log(`[${this.nameOf(connection)}] connected (level: ${this.level}).`);
    this.reportStatus();
    this.respond(connection, id, helloResult({ host: this.options.host, connection: connection.state }));
  }

  /** Answers, then closes an unauthenticated connection */
  private reject(connection: Connection, why: string): void {
    this.log(`Connection #${connection.state.id} refused: ${why}.`);
    connection.socket.end();
    // --- `end` flushes the error first; the socket's own close event finishes the cleanup
    setTimeout(() => this.close(connection), 1000).unref?.();
  }

  // ==============================================================================================
  // Requests

  private async dispatch(connection: Connection, request: JsonRpcRequest): Promise<void> {
    const id = requestId(request);
    const started = Date.now();
    const name = this.nameOf(connection);
    const params = request.params;
    const logOutcome = (outcome: { ok: true } | { ok: false; error: string }) =>
      this.log(formatCallLine(name, request.method, params, outcome, Date.now() - started));

    const definition = Object.prototype.hasOwnProperty.call(this.methods, request.method)
      ? this.methods[request.method]
      : undefined;
    if (!definition) {
      const error = { code: JSONRPC_METHOD_NOT_FOUND, message: `Unknown method '${request.method}'.` };
      logOutcome({ ok: false, error: error.message });
      this.respondError(connection, id, error);
      return;
    }
    if (params !== undefined && (params === null || typeof params !== "object" || Array.isArray(params))) {
      const error = invalidParams("'params' must be an object.").toJsonRpc();
      logOutcome({ ok: false, error: error.message });
      this.respondError(connection, id, error);
      return;
    }
    if (request.method === "session.hello") {
      // --- Already authenticated: describe the session again
      this.respond(connection, id, helloResult({ host: this.options.host, connection: connection.state }));
      return;
    }
    const level = definition.level;
    if (level !== "none" && !levelAllows(connection.state.level, level)) {
      const error = automationError(
        "level-too-low",
        `'${request.method}' needs the '${level}' automation level; this connection has ` +
          `'${connection.state.level}'. Change it in Settings › General › Automation, or with ` +
          `'set -u ${AUTOMATION_LEVEL_SETTING} ${level}'.`,
        { required: level, granted: connection.state.level }
      ).toJsonRpc();
      logOutcome({ ok: false, error: error.message });
      this.respondError(connection, id, error);
      return;
    }

    const args = (params ?? {}) as Record<string, unknown>;
    const timeoutMs = definition.unbounded ? undefined : requestTimeout(args, this.defaultTimeoutMs);
    const deadline = timeoutMs === undefined ? undefined : started + timeoutMs;
    const context: MethodContext = {
      host: this.options.host,
      connection: connection.state,
      timeoutMs: timeoutMs ?? this.defaultTimeoutMs,
      waitForMachine: (until, waitMs) => this.waitForMachine(connection, until, waitMs),
      publish: (event, eventParams) => this.publish(event, eventParams)
    };
    const run = async () => {
      if (definition.needsReady) await this.waitUntilReady(deadline);
      return await definition.handler(args, context);
    };

    try {
      const result = definition.queued
        ? await this.enqueue(run, deadline, request.method)
        : await withDeadline(run(), deadline, request.method);
      logOutcome({ ok: true });
      this.respond(connection, id, result);
    } catch (err) {
      const error = toJsonRpcError(err);
      error.message = redactSecrets(error.message, [this.info?.token]);
      logOutcome({ ok: false, error: error.message });
      this.respondError(connection, id, error);
    }
  }

  /**
   * Runs a task in the global queue (D14). The deadline counts from the request's arrival: a request
   * that times out while it waits never runs; one that times out while it runs releases the queue.
   */
  private enqueue<T>(task: () => Promise<T>, deadline: number | undefined, method: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue = this.queue.then(async () => {
        if (deadline !== undefined && Date.now() >= deadline) {
          reject(timeoutError(method));
          return;
        }
        const work = task();
        try {
          resolve(await withDeadline(work, deadline, method));
        } catch (err) {
          reject(err);
          if (err instanceof AutomationError && err.data.kind === "timeout") {
            // --- T5: the work goes on; say so when it ends
            work.then(
              () => this.log(`${method}: finished after its timeout; the result was discarded.`),
              () => this.log(`${method}: failed after its timeout; the error was discarded.`)
            );
          }
        }
      });
    });
  }

  /** Holds a request until both windows exist (T2) */
  private waitUntilReady(deadline: number | undefined): Promise<void> {
    const host = this.options.host;
    if (host.isReady()) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const unsubscribe = host.subscribe(() => {
        if (!host.isReady()) return;
        if (timer) clearTimeout(timer);
        unsubscribe();
        resolve();
      });
      if (deadline !== undefined) {
        timer = setTimeout(() => {
          unsubscribe();
          reject(automationError("not-ready", "Klive is still starting: the IDE is not ready yet."));
        }, Math.max(0, deadline - Date.now()));
      }
    });
  }

  // ==============================================================================================
  // Machine state: waits and events (D11)

  private machineStateIn(until: WaitUntil[]): boolean {
    const name = machineStateName(this.options.host.getState()?.emulatorState?.machineState);
    return (until as string[]).includes(name);
  }

  /** The breakpoint the machine stopped at, if one stopped it */
  private async stopBreakpoint(): Promise<BreakpointHit | undefined> {
    try {
      const info = await this.options.host.emu.getStopInfo();
      return info?.breakpoints?.[0];
    } catch {
      return undefined;
    }
  }

  private async waitResult(): Promise<WaitResult> {
    const result: WaitResult = machineStateOf({ host: this.options.host });
    if (result.state === "paused") {
      const breakpoint = await this.stopBreakpoint();
      if (breakpoint) result.breakpoint = breakpoint;
    }
    return result;
  }

  private waitForMachine(connection: Connection, until: WaitUntil[], timeoutMs: number | undefined): Promise<WaitResult> {
    const host = this.options.host;
    if (this.machineStateIn(until)) return this.waitResult();
    return new Promise<WaitResult>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        if (timer) clearTimeout(timer);
        unsubscribe();
        connection.waits.delete(cancel);
      };
      const cancel = () => {
        finish();
        reject(automationError("timeout", "The connection closed while waiting."));
      };
      const unsubscribe = host.subscribe(() => {
        if (!this.machineStateIn(until)) return;
        finish();
        this.waitResult().then(resolve, reject);
      });
      connection.waits.add(cancel);
      if (timeoutMs !== undefined) {
        timer = setTimeout(() => {
          finish();
          reject(
            automationError(
              "timeout",
              `The machine did not reach ${until.join(" or ")} within ${timeoutMs} ms ` +
                `(it is ${machineStateName(host.getState()?.emulatorState?.machineState)}).`
            )
          );
        }, timeoutMs);
      }
    });
  }

  private onStoreChanged(): void {
    const emu = this.options.host.getState()?.emulatorState;
    const state = emu?.machineState;
    if (state === this.lastMachineState) return;
    this.lastMachineState = state;
    const result = machineStateOf({ host: this.options.host });
    this.publish("machine.stateChanged", result as Record<string, unknown>);
    if (result.state === "paused" && this.hasSubscribers("machine.breakpointHit")) {
      void this.stopBreakpoint().then((hit) => {
        if (hit) this.publish("machine.breakpointHit", hit as unknown as Record<string, unknown>);
      });
    }
  }

  private hasSubscribers(event: AutomationEvent): boolean {
    for (const c of this.connections) if (c.authenticated && c.state.subscriptions.has(event)) return true;
    return false;
  }

  private publish(event: AutomationEvent, params: Record<string, unknown>): void {
    for (const connection of this.connections) {
      if (!connection.authenticated || connection.closed || !connection.state.subscriptions.has(event)) continue;
      this.send(connection, { jsonrpc: "2.0", method: event, params });
    }
  }

  // ==============================================================================================
  // Output

  private respond(connection: Connection, id: JsonRpcRequest["id"], result: unknown): void {
    if (id === undefined) return; // --- A notification from the client gets no answer
    const encoded = toJsonValue(result);
    this.send(connection, { jsonrpc: "2.0", id, result: encoded === undefined ? null : encoded });
  }

  private respondError(connection: Connection, id: JsonRpcRequest["id"] | null, error: JsonRpcError): void {
    if (id === undefined) return;
    this.send(connection, { jsonrpc: "2.0", id, error: toJsonValue(error) as JsonRpcError });
  }

  private send(connection: Connection, message: object): void {
    if (connection.closed || connection.socket.destroyed || !connection.socket.writable) return;
    try {
      connection.socket.write(JSON.stringify(toJsonValue(message)) + "\n");
    } catch {
      this.close(connection);
    }
  }

  private log(line: string): void {
    this.options.onLog?.(redactSecrets(line, [this.info?.token]));
  }

  private reportStatus(): void {
    this.options.onStatus?.({ listening: this.isListening, clients: this.clientCount });
  }
}

// ================================================================================================
// Helpers

function requestId(request: unknown): JsonRpcRequest["id"] | null {
  const id = (request as JsonRpcRequest)?.id;
  return typeof id === "number" || typeof id === "string" ? id : id === undefined ? undefined : null;
}

/** Compares tokens in constant time: hashing first makes the lengths equal */
export function tokensMatch(given: string, expected: string): boolean {
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b) && given.length === expected.length;
}

/** A client's name, made safe for the log */
function clientName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[^\x20-\x7e]/g, "").trim().slice(0, MAX_CLIENT_NAME);
}

function requestTimeout(params: Record<string, unknown>, fallback: number): number {
  const value = params.timeoutMs;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.min(value, 2 ** 31 - 1);
  return fallback;
}

function timeoutError(method: string): AutomationError {
  return automationError("timeout", `'${method}' did not finish within its timeout.`);
}

function withDeadline<T>(work: Promise<T>, deadline: number | undefined, method: string): Promise<T> {
  if (deadline === undefined) return work;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(timeoutError(method)), Math.max(0, deadline - Date.now()));
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function safeUserName(): string {
  try {
    return os.userInfo().username;
  } catch {
    return "";
  }
}

/** Removes a leftover socket file (only a socket: never a regular file someone put there) */
function removeStaleSocket(socketPath: string): void {
  try {
    if (fs.lstatSync(socketPath).isSocket()) fs.unlinkSync(socketPath);
  } catch {
    // --- Nothing there
  }
}

/**
 * Creates the fallback socket folder, and refuses one that is not a private folder of this user's
 * (a symlink, or someone else's folder planted under the shared temporary folder).
 */
function ensureOwnedPrivateDir(dir: string): void {
  ensurePrivateDir(dir);
  const stat = fs.lstatSync(dir);
  const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
  if (!stat.isDirectory() || (uid !== undefined && stat.uid !== uid) || (stat.mode & 0o077) !== 0) {
    throw new Error(`The automation socket folder ${dir} is not a private folder of this user.`);
  }
}
