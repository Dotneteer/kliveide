import { createIdeApi, IdeApi } from "@common/messaging/IdeApi";

import { MessengerBase } from "@messaging/MessengerBase";
import { BufferOperation } from "@renderer/appIde/ToolArea/abstractions";

class ScriptConsole {
  private readonly ideApi: IdeApi;
  // --- The store is used to dispatch actions
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
      this.pushStyle();
      this.resetStyle();
      this.color("red");
      await this.write(args.length === 1 ? "Assertion failed" : args[1].toString());
      this.popStyle();
      if (args.length > 2) {
        //await this.log("", ...args.slice(2));
      } else {
        await this.writeLine();
      }
    }
  }

  async log(...args: any[]): Promise<void> {
    let first = true;
    args.forEach((arg) => {
      if (!first) {
        this.write(" ");
      }
      this.write(arg);
      first = false;
    });
    this.writeLine();
  }

  async error(...args: any[]): Promise<void> {
    this.pushStyle();
    this.resetStyle();
    this.color("red");
    await this.write("Error: ");
    await this.log(...args);
    this.popStyle();
  }

  async warn(...args: any[]): Promise<void> {
    this.pushStyle();
    this.resetStyle();
    this.color("yellow");
    await this.write("Warning: ");
    await this.log(...args);
    this.popStyle();
  }

  async info(...args: any[]): Promise<void> {
    this.pushStyle();
    this.resetStyle();
    this.color("cyan");
    await this.write("Info: ");
    await this.log(...args);
    this.popStyle();
  }

  async success(...args: any[]): Promise<void> {
    this.pushStyle();
    this.resetStyle();
    this.color("green");
    await this.write("Success: ");
    await this.log(...args);
    this.popStyle();
  }

  async clear(): Promise<void> {
    await this.sendScriptOutput(this.id, "clear");
  }

  async write(...args: any[]): Promise<void> {
    await this.sendScriptOutput(this.id, "write", args ?? []);
  }

  async writeLine(...args: any[]): Promise<void> {
    await this.sendScriptOutput(this.id, "writeLine", args ?? []);
  }

  async resetStyle(): Promise<void> {
    await this.sendScriptOutput(this.id, "resetStyle");
  }

  async color(color: string): Promise<void> {
    await this.sendScriptOutput(this.id, "color", [color]);
  }

  async backgroundColor(color: string): Promise<void> {
    await this.sendScriptOutput(this.id, "backgroundColor", [color]);
  }

  async bold(use: boolean): Promise<void> {
    await this.sendScriptOutput(this.id, "bold", [use]);
  }

  async italic(use: boolean): Promise<void> {
    await this.sendScriptOutput(this.id, "italic", [use]);
  }

  async underline(use: boolean): Promise<void> {
    await this.sendScriptOutput(this.id, "underline", [use]);
  }

  async strikethru(use: boolean): Promise<void> {
    await this.sendScriptOutput(this.id, "strikethru", [use]);
  }

  async pushStyle(): Promise<void> {
    await this.sendScriptOutput(this.id, "pushStyle");
  }

  async popStyle(): Promise<void> {
    await this.sendScriptOutput(this.id, "popStyle");
  }

  async sendScriptOutput(id: number, operation: BufferOperation, args?: any[]): Promise<void> {
    await this.ideApi.scriptOutput(id, operation, args);
  }
}

export const createScriptConsole = (messenger: MessengerBase, id: number) =>
  new ScriptConsole(messenger, id);
