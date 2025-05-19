import { runWorker } from "./runWorker";
import { EventEmitter } from "events";

export type CompilationEvents = "success" | "failure" | "timeout" | "cancelled";

export class BackgroundCompiler extends EventEmitter {
  private cancelled = false;
  private workerPromise: Promise<any> | null = null;

  async compile(filePath: string, timeout = 5000) {
    this.cancelled = false;
    try {
      this.workerPromise = runWorker<{ filePath: string }, string>({ filePath }, timeout);
      const result = await this.workerPromise;
      this.workerPromise = null; // Reset the promise after completion
      if (!this.cancelled) {
        this.emit("success", result);
      } else {
        this.emit("cancelled");
      }
    } catch (err: any) {
      if (this.cancelled) {
        this.emit("cancelled");
      } else if (err && err.message && err.message.includes("timed out")) {
        this.emit("timeout", err);
      } else {
        this.emit("failure", err);
      }
    }
  }

  terminate() {
    this.cancelled = true;
    // Optionally, if runWorker supports cancellation, call it here.
  }

  isInProgress(): boolean {
    return this.workerPromise !== null;
  }
}
