import { MessengerBase } from "@common/messaging/MessengerBase";
import { IdeScriptOutputRequest } from "../../common/messaging/any-to-ide";

class ScriptConsole {
  // --- The store is used to dispatch actions
  constructor(
    private readonly messenger: MessengerBase,
    private readonly id: number
  ) {}

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
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "clear"
    });
  }

  async write(...args: any[]): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "write",
      args: args ?? []
    });
  }

  async writeLine(...args: any[]): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "writeLine",
      args: args ?? []
    });
  }

  async resetStyle(): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "resetStyle"
    });
  }

  async color(color: string): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "color",
      args: [color]
    });
  }

  async backgroundColor(color: string): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "backgroundColor",
      args: [color]
    });
  }

  async bold(use: boolean): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "bold",
      args: [use]
    });
  }

  async italic(use: boolean): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "italic",
      args: [use]
    });
  }

  async underline(use: boolean): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "underline",
      args: [use]
    });
  }

  async strikethru(use: boolean): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "strikethru",
      args: [use]
    });
  }

  async pushStyle(): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "pushStyle"
    });
  }

  async popStyle(): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "popStyle"
    });
  }

  async sendScriptOutput(message: IdeScriptOutputRequest): Promise<void> {
    await this.messenger.sendMessage(message);
  }
}

export const createScriptConsole = (messenger: MessengerBase, id: number) =>
  new ScriptConsole(messenger, id);
