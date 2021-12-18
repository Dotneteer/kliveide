import * as path from "path";
import * as fs from "fs";
import { getKliveConfiguration } from "../main-state/klive-configuration";
import { getHomeFolder } from "./file-utils";

/**
 * The file that stores the Klive Emulator configuration
 */
export const LOG_FILE_PATH = "Klive/log.txt";

/**
 * This class implements logging for the main process of Klive
 */
class MainProcLogger {
  private readonly _useLog: boolean;
  private readonly _stream: fs.WriteStream;
  constructor() {
    try {
      const config = getKliveConfiguration();
      this._useLog = config?.mainProcLogging ?? false;
      const logFile = path.join(getHomeFolder(), LOG_FILE_PATH);
      this._stream = fs.createWriteStream(logFile, { flags: "a" });
      this.log("Klive main process logging started.");
    } catch (err) {
      console.log(`Warning: Cannot set up main process logging: ${err}`);
      this._stream = null;
      this._useLog = false;
    }
  }

  /**
   * Logs the specified message to the log file
   * @param message 
   * @returns 
   */
  log(message: string): void {
    if (!this._useLog) {
      return;
    }

    try {
      this._stream.write(`${new Date().toISOString()}: ${message}\n`);
    } catch {
      // --- This error is intentionally ignored
    }
  }

  /**
   * Logs the specified message to the log file
   * @param message 
   * @returns 
   */
   logError(message: string, err: any): void {
    const stack = err?.stack ?? "(no stack)";
    const fullMessage = `${message}: ${err}; ${stack}`;
    this.log(fullMessage);
  }

  /**
   * Close the logger stream
   */
  close(): void {
    if (this._stream) {
      this.log("Klive main process logging terminated.");
      this._stream.end();
    }
  }
}

export const mainProcLogger = new MainProcLogger();
