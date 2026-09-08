import { createIdeApi, IdeApi } from "@common/messaging/IdeApi";

import { MessengerBase } from "@messaging/MessengerBase";
import { BufferOperation } from "@renderer/appIde/ToolArea/abstractions";

type QueuedOperation = { operation: BufferOperation; args?: any[] };

/**
 * The script-side `console`, running in the main process and writing into a renderer output pane.
 *
 * Every operation crosses IPC as its own awaited, correlated request. Because style here is
 * *stateful* — a `color` applies to whatever `write`s follow it — one coloured line of script
 * output is seven of them: `pushStyle`, `resetStyle`, `color`, `write`, `write`, `writeLine`,
 * `popStyle`. That is what made script output slow, and none of it was rendering.
 *
 * So operations are queued and flushed as a single `scriptOutputBatch` on the next microtask. The
 * composite methods below (`error`, `warn`, `log`, ...) enqueue synchronously and await only once,
 * at the end, which is what collapses a line to one message: an `await` in the middle would yield
 * to the microtask queue and flush what had accumulated so far.
 *
 * Ordering is preserved. A batch keeps its own order, and batches are sent in the order they flush.
 */
class ScriptConsole {
  private readonly ideApi: IdeApi;

  /** Operations accumulated since the last flush, in order. */
  private pending: QueuedOperation[] = [];

  /**
   * The in-flight flush, shared by every operation queued for it.
   *
   * Returning it from each method keeps `await console.write(...)` meaningful: it resolves once the
   * batch carrying that write has been delivered, not merely queued.
   */
  private flush: Promise<void> | null = null;

  constructor(
    messenger: MessengerBase,
    private readonly id: number
  ) {
    this.ideApi = createIdeApi(messenger);
  }

  async assert(...args: any[]): Promise<void> {
    if (args.length === 0 || typeof args[0] !== "function") return;
    const result = await args[0]();
    if (!result) {
      this.enqueue("pushStyle");
      this.enqueue("resetStyle");
      this.enqueue("color", ["red"]);
      this.enqueue("write", [args.length === 1 ? "Assertion failed" : args[1].toString()]);
      this.enqueue("popStyle");
      if (args.length > 2) {
        //this.queueLog(args.slice(2));
      } else {
        this.enqueue("writeLine", []);
      }
      await this.pendingFlush();
    }
  }

  async log(...args: any[]): Promise<void> {
    this.queueLog(args);
    await this.pendingFlush();
  }

  async error(...args: any[]): Promise<void> {
    await this.prefixed("red", "Error: ", args);
  }

  async warn(...args: any[]): Promise<void> {
    await this.prefixed("yellow", "Warning: ", args);
  }

  async info(...args: any[]): Promise<void> {
    await this.prefixed("cyan", "Info: ", args);
  }

  async success(...args: any[]): Promise<void> {
    await this.prefixed("green", "Success: ", args);
  }

  async clear(): Promise<void> {
    await this.enqueue("clear");
  }

  async write(...args: any[]): Promise<void> {
    await this.enqueue("write", args ?? []);
  }

  async writeLine(...args: any[]): Promise<void> {
    await this.enqueue("writeLine", args ?? []);
  }

  async resetStyle(): Promise<void> {
    await this.enqueue("resetStyle");
  }

  async color(color: string): Promise<void> {
    await this.enqueue("color", [color]);
  }

  async backgroundColor(color: string): Promise<void> {
    await this.enqueue("backgroundColor", [color]);
  }

  async bold(use: boolean): Promise<void> {
    await this.enqueue("bold", [use]);
  }

  async italic(use: boolean): Promise<void> {
    await this.enqueue("italic", [use]);
  }

  async underline(use: boolean): Promise<void> {
    await this.enqueue("underline", [use]);
  }

  async strikethru(use: boolean): Promise<void> {
    await this.enqueue("strikethru", [use]);
  }

  async pushStyle(): Promise<void> {
    await this.enqueue("pushStyle");
  }

  async popStyle(): Promise<void> {
    await this.enqueue("popStyle");
  }

  /**
   * Sends a single operation.
   *
   * Kept because it is the documented seam for callers that hold a console and drive it directly;
   * it goes through the same queue, so it batches with whatever else is pending.
   */
  async sendScriptOutput(id: number, operation: BufferOperation, args?: any[]): Promise<void> {
    if (id !== this.id) {
      // --- A different script's buffer cannot share this console's batch.
      await this.ideApi.scriptOutput(id, operation, args);
      return;
    }
    await this.enqueue(operation, args);
  }

  /** A coloured prefix followed by the logged arguments — one message for the whole line. */
  private async prefixed(color: string, prefix: string, args: any[]): Promise<void> {
    this.enqueue("pushStyle");
    this.enqueue("resetStyle");
    this.enqueue("color", [color]);
    this.enqueue("write", [prefix]);
    this.queueLog(args);
    this.enqueue("popStyle");
    await this.pendingFlush();
  }

  /** `log`'s body without the await, so composite methods can fold it into their own batch. */
  private queueLog(args: any[]): void {
    let first = true;
    for (const arg of args) {
      if (!first) this.enqueue("write", [" "]);
      this.enqueue("write", [arg]);
      first = false;
    }
    this.enqueue("writeLine", []);
  }

  /** Queues an operation and schedules the flush that will carry it. */
  private enqueue(operation: BufferOperation, args?: any[]): Promise<void> {
    this.pending.push({ operation, args });
    if (!this.flush) {
      this.flush = new Promise<void>((resolve, reject) => {
        queueMicrotask(() => {
          const operations = this.pending;
          this.pending = [];
          this.flush = null;
          this.ideApi.scriptOutputBatch(this.id, operations).then(resolve, reject);
        });
      });
    }
    return this.flush;
  }

  /** The flush carrying whatever is currently queued, or nothing if the queue is empty. */
  private pendingFlush(): Promise<void> {
    return this.flush ?? Promise.resolve();
  }
}

export const createScriptConsole = (messenger: MessengerBase, id: number) =>
  new ScriptConsole(messenger, id);
