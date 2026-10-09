import net from "net";
import os from "os";
import path from "path";

import {
  AUTOMATION_PROTOCOL_VERSION,
  type AutomationConnectionInfo,
  type HelloResult,
  type JsonRpcError,
  type JsonRpcNotification,
  type JsonRpcResponse
} from "@common/automation/protocol";
import {
  automationRunDir,
  connectionFilePath,
  lookUpConnection,
  type ConnectionLookup
} from "@main/automation/connection-file";
import { resolveSettingsFilePath } from "@main/settings-path";

/*
 * The client side of the automation protocol (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` §4.1, D12):
 * find the connection file, connect, say hello, send requests, receive notifications. Node only;
 * no Electron. The `klive ide` verbs and the live tests use it.
 */

/** The environment variable that names a connection file directly (for a portable install) */
export const KLIVE_AUTOMATION_FILE_ENV = "KLIVE_AUTOMATION_FILE";

/**
 * The connection file a client looks for: `KLIVE_AUTOMATION_FILE`, else `run/automation.json` beside
 * the settings file (`KLIVE_SETTINGS_FILE`, else `~/Klive/klive.settings`) - the same rule the
 * server follows, so an isolated test instance is found by its own settings path only (T6).
 */
export function resolveConnectionFile(env: NodeJS.ProcessEnv = process.env, home = os.homedir()): string {
  const direct = env[KLIVE_AUTOMATION_FILE_ENV];
  if (direct) return path.resolve(direct);
  return connectionFilePath(automationRunDir(resolveSettingsFilePath(home, env)));
}

/** An error the server answered with */
export class RpcError extends Error {
  constructor(
    public readonly error: JsonRpcError,
    public readonly method: string
  ) {
    super(error.message);
  }
}

/** The connection closed or failed (the server went away, or refused this client) */
export class ConnectionError extends Error {}

type Pending = {
  method: string;
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
};

export type ClientOptions = {
  /** The name the server's log shows */
  client?: string;
};

export class AutomationClient {
  private socket: net.Socket | undefined;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private buffer = "";
  private closed = false;
  private readonly listeners = new Set<(n: JsonRpcNotification) => void>();
  private readonly closeListeners = new Set<() => void>();
  hello: HelloResult | undefined;

  constructor(public readonly info: AutomationConnectionInfo) {}

  /** Connects and authenticates with `session.hello` */
  async connect(options: ClientOptions = {}): Promise<HelloResult> {
    if (this.info.protocol !== AUTOMATION_PROTOCOL_VERSION) {
      throw new ConnectionError(
        `Klive speaks automation protocol ${this.info.protocol}; this client speaks ${AUTOMATION_PROTOCOL_VERSION}.`
      );
    }
    const socket = net.connect(this.info.socket);
    this.socket = socket;
    socket.setEncoding("utf8");
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", (err) => reject(new ConnectionError(`Cannot connect to Klive: ${err.message}`)));
    });
    socket.on("data", (chunk: string) => this.onData(chunk));
    socket.on("error", () => this.onClosed());
    socket.on("close", () => this.onClosed());
    this.hello = (await this.request("session.hello", {
      token: this.info.token,
      client: options.client ?? "klive-cli"
    })) as HelloResult;
    return this.hello;
  }

  /**
   * Sends a request and waits for its answer.
   * @param timeoutMs A client-side guard; undefined waits as long as the server does
   */
  request<T = unknown>(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<T> {
    if (this.closed || !this.socket) return Promise.reject(new ConnectionError("Not connected to Klive."));
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const entry: Pending = { method, resolve: resolve as (v: unknown) => void, reject };
      if (timeoutMs !== undefined) {
        entry.timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new RpcError({ code: -32000, message: `No answer to ${method} within ${timeoutMs} ms.`, data: { kind: "timeout" } }, method));
        }, timeoutMs);
      }
      this.pending.set(id, entry);
      const message = { jsonrpc: "2.0", id, method, ...(params ? { params } : {}) };
      this.socket!.write(JSON.stringify(message) + "\n");
    });
  }

  /** Receives the notifications the connection subscribed to */
  onNotification(listener: (notification: JsonRpcNotification) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Called when the connection ends */
  onClose(listener: () => void): void {
    this.closeListeners.add(listener);
  }

  close(): void {
    this.socket?.end();
    this.socket?.destroy();
    this.onClosed();
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let newline: number;
    while ((newline = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      let message: JsonRpcResponse & JsonRpcNotification;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      if (message.id !== undefined && message.id !== null && this.pending.has(message.id as number)) {
        const entry = this.pending.get(message.id as number)!;
        this.pending.delete(message.id as number);
        if (entry.timer) clearTimeout(entry.timer);
        if (message.error) entry.reject(new RpcError(message.error, entry.method));
        else entry.resolve(message.result);
      } else if (message.id === null && message.error) {
        // --- An error the server could not tie to a request (a refused connection)
        for (const [id, entry] of this.pending) {
          this.pending.delete(id);
          entry.reject(new RpcError(message.error, entry.method));
        }
      } else if (typeof message.method === "string") {
        for (const listener of this.listeners) listener(message);
      }
    }
  }

  private onClosed(): void {
    if (this.closed) return;
    this.closed = true;
    for (const [, entry] of this.pending) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.reject(new ConnectionError("Klive closed the connection."));
    }
    this.pending.clear();
    for (const listener of this.closeListeners) listener();
  }
}

/** Looks up the connection file */
export function findConnection(env: NodeJS.ProcessEnv = process.env): { file: string; lookup: ConnectionLookup } {
  const file = resolveConnectionFile(env);
  return { file, lookup: lookUpConnection(file) };
}
