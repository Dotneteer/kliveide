import { MessengerBase } from "@common/messaging/MessengerBase";
import { IdeScriptOutputRequest } from "../../common/messaging/any-to-ide";

class ScriptConsole {
  // --- The store is used to dispatch actions
  constructor (
    private readonly messenger: MessengerBase,
    private readonly id: number
  ) {}

  async assert (...args: any[]): Promise<void> {
    if (args.length === 0 || typeof args[0] !== "function") return;
    const result = await args[0]();
    if (!result) {
      this.pushStyle();
      this.resetStyle();
      this.color("red");
      await this.write(
        args.length === 1 ? "Assertion failed" : args[1].toString()
      );
      this.popStyle();
      if (args.length > 2) {
        //await this.log("", ...args.slice(2));
      } else {
        await this.writeLine();
      }
    }
  }

  async log (...args: any[]): Promise<void> {
    let first = true;
    args.forEach(arg => {
      if (!first) {
        this.write(" ");
      }
      this.write(arg);
      first = false;
    });
    this.writeLine();
  }

  async error (...args: any[]): Promise<void> {
    this.pushStyle();
    this.resetStyle();
    this.color("red");
    await this.write("Error: ");
    await this.log(...args);
    this.popStyle();
  }

  async warn (...args: any[]): Promise<void> {
    this.pushStyle();
    this.resetStyle();
    this.color("yellow");
    await this.write("Warning: ");
    await this.log(...args);
    this.popStyle();
  }

  async info (...args: any[]): Promise<void> {
    this.pushStyle();
    this.resetStyle();
    this.color("cyan");
    await this.write("Info: ");
    await this.log(...args);
    this.popStyle();
  }

  async success (...args: any[]): Promise<void> {
    this.pushStyle();
    this.resetStyle();
    this.color("green");
    await this.write("Success: ");
    await this.log(...args);
    this.popStyle();
  }

  async clear (): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "clear"
    });
  }

  async write (...args: any[]): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "write",
      args: args?.map(outputValue) ?? []
    });
  }

  async writeLine (...args: any[]): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "writeLine",
      args: args?.map(outputValue) ?? []
    });
  }

  async resetStyle (): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "resetStyle"
    });
  }

  async color (color: string): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "color",
      args: [color]
    });
  }

  async backgroundColor (color: string): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "backgroundColor",
      args: [color]
    });
  }

  async bold (use: boolean): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "bold",
      args: [use]
    });
  }

  async italic (use: boolean): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "italic",
      args: [use]
    });
  }

  async underline (use: boolean): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "underline",
      args: [use]
    });
  }

  async strikethru (use: boolean): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "strikethru",
      args: [use]
    });
  }

  async pushStyle (): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "pushStyle"
    });
  }

  async popStyle (): Promise<void> {
    await this.sendScriptOutput({
      type: "IdeScriptOutput",
      id: this.id,
      operation: "popStyle"
    });
  }

  async sendScriptOutput (message: IdeScriptOutputRequest): Promise<void> {
    await this.messenger.sendMessage(message);
  }
}

function outputValue (value: any): string {
  switch (typeof value) {
    case "string":
      return value;
    case "number":
    case "boolean":
      return value.toString();
    case "undefined":
      return "undefined";
    case "object":
      if (value === null) {
        return "null";
      }
      return safeStringify(value);
    default:
      return value.toString();
  }
}

function safeStringify (obj: any, indent = 2) {
  let cache = new Map<any, number>();
  let refIndex = 1;
  const retVal = JSON.stringify(
    obj,
    (_, value) =>
      typeof value === "object" && value !== null && value !== undefined
        ? cache.has(value)
          ? `$ref-${cache.get(value)}`
          : (cache.set(value, refIndex++), value)
        : value,
    indent
  );
  cache = null;
  return retVal;
}

export const createScriptConsole = (
  messenger: MessengerBase,
  id: number
) => new ScriptConsole(messenger, id);
