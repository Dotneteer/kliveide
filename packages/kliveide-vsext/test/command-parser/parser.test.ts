import "mocha";
import * as expect from "expect";

import { InputStream } from "../../src/command-parser/input-stream";
import { TokenStream } from "../../src/command-parser/token-stream";
import { KliveCommandParser } from "../../src/command-parser/klive-command-parser";
import {
  CmdNode,
  RemoveBreakpointCmd,
  SetBreakpointCmd,
} from "../../src/command-parser/command-line-nodes";

describe("Command parser - commands", () => {
  it("sb address only #1", () => {
    const SOURCE = "sb $12ac";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    const cmd = cp.parseCommand();
    expect(cmd).not.toBeNull();
    if (cmd === null) {
      return;
    }
    expect(cmd.type === "SetBreakpointCmd");
    const sbc = cmd as SetBreakpointCmd;
    expect(sbc.mode).toBeUndefined();
    expect(sbc.partition).toBeUndefined();
    expect(sbc.address).toBe(0x12ac);
    expect(sbc.hit).toBeUndefined();
    expect(sbc.value).toBeUndefined();
  });

  it("sb address only #2", () => {
    const SOURCE = "sb 32456";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    const cmd = cp.parseCommand();
    expect(cmd).not.toBeNull();
    if (cmd === null) {
      return;
    }
    expect(cmd.type === "SetBreakpointCmd");
    const sbc = cmd as SetBreakpointCmd;
    expect(sbc.mode).toBeUndefined();
    expect(sbc.partition).toBeUndefined();
    expect(sbc.address).toBe(32456);
    expect(sbc.hit).toBeUndefined();
    expect(sbc.value).toBeUndefined();
  });

  it("sb address only - memory read", () => {
    const SOURCE = "SB MR $12ac";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    const cmd = cp.parseCommand();
    expect(cmd).not.toBeNull();
    if (cmd === null) {
      return;
    }
    expect(cmd.type === "SetBreakpointCmd");
    const sbc = cmd as SetBreakpointCmd;
    expect(sbc.mode).toBe("mr");
    expect(sbc.partition).toBeUndefined();
    expect(sbc.address).toBe(0x12ac);
    expect(sbc.hit).toBeUndefined();
    expect(sbc.value).toBeUndefined();
  });

  it("sb address only - memory write", () => {
    const SOURCE = "sb mw $12ac";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    const cmd = cp.parseCommand();
    expect(cmd).not.toBeNull();
    if (cmd === null) {
      return;
    }
    expect(cmd.type === "SetBreakpointCmd");
    const sbc = cmd as SetBreakpointCmd;
    expect(sbc.mode).toBe("mw");
    expect(sbc.partition).toBeUndefined();
    expect(sbc.address).toBe(0x12ac);
    expect(sbc.hit).toBeUndefined();
    expect(sbc.value).toBeUndefined();
  });

  it("sb address only - I/O read", () => {
    const SOURCE = "sb ir $12ac";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    const cmd = cp.parseCommand();
    expect(cmd).not.toBeNull();
    if (cmd === null) {
      return;
    }
    expect(cmd.type === "SetBreakpointCmd");
    const sbc = cmd as SetBreakpointCmd;
    expect(sbc.mode).toBe("ir");
    expect(sbc.partition).toBeUndefined();
    expect(sbc.address).toBe(0x12ac);
    expect(sbc.hit).toBeUndefined();
    expect(sbc.value).toBeUndefined();
  });

  it("sb address only - I/O write", () => {
    const SOURCE = "sb iw $12ac";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    const cmd = cp.parseCommand();
    expect(cmd).not.toBeNull();
    if (cmd === null) {
      return;
    }
    expect(cmd.type === "SetBreakpointCmd");
    const sbc = cmd as SetBreakpointCmd;
    expect(sbc.mode).toBe("iw");
    expect(sbc.partition).toBeUndefined();
    expect(sbc.address).toBe(0x12ac);
    expect(sbc.hit).toBeUndefined();
    expect(sbc.value).toBeUndefined();
  });

  it("sb partition and address #1", () => {
    const SOURCE = "sb 123:$12ac";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    const cmd = cp.parseCommand();
    expect(cmd).not.toBeNull();
    if (cmd === null) {
      return;
    }
    expect(cmd.type === "SetBreakpointCmd");
    const sbc = cmd as SetBreakpointCmd;
    expect(sbc.mode).toBeUndefined();
    expect(sbc.partition).toBe(123);
    expect(sbc.address).toBe(0x12ac);
    expect(sbc.hit).toBeUndefined();
    expect(sbc.value).toBeUndefined();
  });

  it("sb partition and address #2", () => {
    const SOURCE = "sb $23:23412";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    const cmd = cp.parseCommand();
    expect(cmd).not.toBeNull();
    if (cmd === null) {
      return;
    }
    expect(cmd.type === "SetBreakpointCmd");
    const sbc = cmd as SetBreakpointCmd;
    expect(sbc.mode).toBeUndefined();
    expect(sbc.partition).toBe(0x23);
    expect(sbc.address).toBe(23412);
    expect(sbc.hit).toBeUndefined();
    expect(sbc.value).toBeUndefined();
  });

  it("sb hit count #1", () => {
    const SOURCE = "sb 123:$12ac hit:12";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    const cmd = cp.parseCommand();
    expect(cmd).not.toBeNull();
    if (cmd === null) {
      return;
    }
    expect(cmd.type === "SetBreakpointCmd");
    const sbc = cmd as SetBreakpointCmd;
    expect(sbc.mode).toBeUndefined();
    expect(sbc.partition).toBe(123);
    expect(sbc.address).toBe(0x12ac);
    expect(sbc.hit).toBe(12);
    expect(sbc.value).toBeUndefined();
  });

  it("sb hit count #2", () => {
    const SOURCE = "sb 123:$12ac hit:$12";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    const cmd = cp.parseCommand();
    expect(cmd).not.toBeNull();
    if (cmd === null) {
      return;
    }
    expect(cmd.type === "SetBreakpointCmd");
    const sbc = cmd as SetBreakpointCmd;
    expect(sbc.mode).toBeUndefined();
    expect(sbc.partition).toBe(123);
    expect(sbc.address).toBe(0x12ac);
    expect(sbc.hit).toBe(0x12);
    expect(sbc.value).toBeUndefined();
  });

  it("sb value condition #1", () => {
    const SOURCE = "sb 123:$12ac val:12";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    const cmd = cp.parseCommand();
    expect(cmd).not.toBeNull();
    if (cmd === null) {
      return;
    }
    expect(cmd.type === "SetBreakpointCmd");
    const sbc = cmd as SetBreakpointCmd;
    expect(sbc.mode).toBeUndefined();
    expect(sbc.partition).toBe(123);
    expect(sbc.address).toBe(0x12ac);
    expect(sbc.hit).toBeUndefined();
    expect(sbc.value).toBe(12);
  });

  it("sb value condition #2", () => {
    const SOURCE = "sb 123:$12ac val:$12";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    const cmd = cp.parseCommand();
    expect(cmd).not.toBeNull();
    if (cmd === null) {
      return;
    }
    expect(cmd.type === "SetBreakpointCmd");
    const sbc = cmd as SetBreakpointCmd;
    expect(sbc.mode).toBeUndefined();
    expect(sbc.partition).toBe(123);
    expect(sbc.address).toBe(0x12ac);
    expect(sbc.hit).toBeUndefined();
    expect(sbc.value).toBe(0x12);
  });

  it("sb hit/val #1", () => {
    const SOURCE = "sb 123:$12ac hit:4 val:12";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    const cmd = cp.parseCommand();
    expect(cmd).not.toBeNull();
    if (cmd === null) {
      return;
    }
    expect(cmd.type === "SetBreakpointCmd");
    const sbc = cmd as SetBreakpointCmd;
    expect(sbc.mode).toBeUndefined();
    expect(sbc.partition).toBe(123);
    expect(sbc.address).toBe(0x12ac);
    expect(sbc.hit).toBe(4);
    expect(sbc.value).toBe(12);
  });

  it("sb hit/val #2", () => {
    const SOURCE = "sb 123:$12ac val:4 hit:12";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    const cmd = cp.parseCommand();
    expect(cmd).not.toBeNull();
    if (cmd === null) {
      return;
    }
    expect(cmd.type === "SetBreakpointCmd");
    const sbc = cmd as SetBreakpointCmd;
    expect(sbc.mode).toBeUndefined();
    expect(sbc.partition).toBe(123);
    expect(sbc.address).toBe(0x12ac);
    expect(sbc.hit).toBe(12);
    expect(sbc.value).toBe(4);
  });

  it("sb invalid mode", () => {
    const SOURCE = "sb dummy $12ac";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    let cmd: CmdNode | null = null;
    try {
      cmd = cp.parseCommand();
    } catch {
    }
    expect(cmd).toBeNull();
    expect(cp.hasErrors).toBe(true);
    expect(cp.error.code === "C02").toBe(true);
  });

  it("sb invalid partition", () => {
    const SOURCE = "sb mr part:$1234";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    let cmd: CmdNode | null = null;
    try {
      cmd = cp.parseCommand();
    } catch {
    }
    expect(cmd).toBeNull();
    expect(cp.hasErrors).toBe(true);
    expect(cp.error.code === "C03").toBe(true);
  });

  it("sb missing partition colon", () => {
    const SOURCE = "sb mr $12 1234";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    let cmd: CmdNode | null = null;
    try {
      cmd = cp.parseCommand();
    } catch {
    }
    expect(cmd).toBeNull();
    expect(cp.hasErrors).toBe(true);
    expect(cp.error.code === "C06").toBe(true);
  });

  it("sb missing 'hit' colon #1", () => {
    const SOURCE = "sb mr $12 hit 1234";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    let cmd: CmdNode | null = null;
    try {
      cmd = cp.parseCommand();
    } catch {
    }
    expect(cmd).toBeNull();
    expect(cp.hasErrors).toBe(true);
    expect(cp.error.code === "C04").toBe(true);
  });

  it("sb missing 'hit' colon #2", () => {
    const SOURCE = "sb mr $12 hit 1234";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    let cmd: CmdNode | null = null;
    try {
      cmd = cp.parseCommand();
    } catch {
    }
    expect(cmd).toBeNull();
    expect(cp.hasErrors).toBe(true);
    expect(cp.error.code === "C04").toBe(true);
  });

  it("sb missing 'val' colon #1", () => {
    const SOURCE = "sb mr $12 val";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    let cmd: CmdNode | null = null;
    try {
      cmd = cp.parseCommand();
    } catch {
    }
    expect(cmd).toBeNull();
    expect(cp.hasErrors).toBe(true);
    expect(cp.error.code === "C04").toBe(true);
  });

  it("sb missing 'val' colon #2", () => {
    const SOURCE = "sb mr $12 val 1234";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    let cmd: CmdNode | null = null;
    try {
      cmd = cp.parseCommand();
    } catch {
    }
    expect(cmd).toBeNull();
    expect(cp.hasErrors).toBe(true);
    expect(cp.error.code === "C04").toBe(true);
  });

  it("sb uses invalid parameter #1", () => {
    const SOURCE = "sb mr $12 dummy:12";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    let cmd: CmdNode | null = null;
    try {
      cmd = cp.parseCommand();
    } catch {
    }
    expect(cmd).toBeNull();
    expect(cp.hasErrors).toBe(true);
    expect(cp.error.code === "C05").toBe(true);
  });

  it("rb with address #1", () => {
    const SOURCE = "rb $12ac";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    const cmd = cp.parseCommand();
    expect(cmd).not.toBeNull();
    if (cmd === null) {
      return;
    }
    expect(cmd.type === "RemoveBreakpointCmd");
    const sbc = cmd as RemoveBreakpointCmd;
    expect(sbc.address).toBe(0x12ac);
  });

  it("rb with address #2", () => {
    const SOURCE = "rb 23456";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    const cmd = cp.parseCommand();
    expect(cmd).not.toBeNull();
    if (cmd === null) {
      return;
    }
    expect(cmd.type === "RemoveBreakpointCmd");
    const sbc = cmd as RemoveBreakpointCmd;
    expect(sbc.address).toBe(23456);
  });

  it("rb missing address #1", () => {
    const SOURCE = "rb";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    let cmd: CmdNode | null = null;
    try {
      cmd = cp.parseCommand();
    } catch {
    }
    expect(cmd).toBeNull();
    expect(cp.hasErrors).toBe(true);
    expect(cp.error.code === "C03").toBe(true);
  });

  it("rb missing address #2", () => {
    const SOURCE = "rb dummy";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    let cmd: CmdNode | null = null;
    try {
      cmd = cp.parseCommand();
    } catch {
    }
    expect(cmd).toBeNull();
    expect(cp.hasErrors).toBe(true);
    expect(cp.error.code === "C02").toBe(true);
  });

  it("rb with extra token", () => {
    const SOURCE = "rb $1234 hi";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    let cmd: CmdNode | null = null;
    try {
      cmd = cp.parseCommand();
    } catch {
    }
    expect(cmd).toBeNull();
    expect(cp.hasErrors).toBe(true);
    expect(cp.error.code === "C06").toBe(true);
  });

  it("eab", () => {
    const SOURCE = "eab";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    const cmd = cp.parseCommand();
    expect(cmd).not.toBeNull();
    if (cmd === null) {
      return;
    }
    expect(cmd.type === "EraseAllBreakpointsCmd");
  });

  it("eab with extra token", () => {
    const SOURCE = "eab hi";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    let cmd: CmdNode | null = null;
    try {
      cmd = cp.parseCommand();
    } catch {
    }
    expect(cmd).toBeNull();
    expect(cp.hasErrors).toBe(true);
    expect(cp.error.code === "C06").toBe(true);
  });

  it("lb", () => {
    const SOURCE = "lb";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    const cmd = cp.parseCommand();
    expect(cmd).not.toBeNull();
    if (cmd === null) {
      return;
    }
    expect(cmd.type === "ListBreakpointsCmd");
  });

  it("lb with extra token", () => {
    const SOURCE = "lb hi";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    let cmd: CmdNode | null = null;
    try {
      cmd = cp.parseCommand();
    } catch {
    }
    expect(cmd).toBeNull();
    expect(cp.hasErrors).toBe(true);
    expect(cp.error.code === "C06").toBe(true);
  });

  it("rb memory read", () => {
    const SOURCE = "rb mr $12ac";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    const cmd = cp.parseCommand();
    expect(cmd).not.toBeNull();
    if (cmd === null) {
      return;
    }
    expect(cmd.type === "RemoveBreakpointCmd");
    const sbc = cmd as RemoveBreakpointCmd;
    expect(sbc.address).toBe(0x12ac);
    expect(sbc.mode).toBe("mr");
  });

  it("rb memory write", () => {
    const SOURCE = "rb mw $12ac";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    const cmd = cp.parseCommand();
    expect(cmd).not.toBeNull();
    if (cmd === null) {
      return;
    }
    expect(cmd.type === "RemoveBreakpointCmd");
    const sbc = cmd as RemoveBreakpointCmd;
    expect(sbc.address).toBe(0x12ac);
    expect(sbc.mode).toBe("mw");
  });

  it("rb I/O read", () => {
    const SOURCE = "rb ir $12ac";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    const cmd = cp.parseCommand();
    expect(cmd).not.toBeNull();
    if (cmd === null) {
      return;
    }
    expect(cmd.type === "RemoveBreakpointCmd");
    const sbc = cmd as RemoveBreakpointCmd;
    expect(sbc.address).toBe(0x12ac);
    expect(sbc.mode).toBe("ir");
  });

  it("rb I/O write", () => {
    const SOURCE = "rb iw $12ac";

    const cp = new KliveCommandParser(new TokenStream(new InputStream(SOURCE)));
    const cmd = cp.parseCommand();
    expect(cmd).not.toBeNull();
    if (cmd === null) {
      return;
    }
    expect(cmd.type === "RemoveBreakpointCmd");
    const sbc = cmd as RemoveBreakpointCmd;
    expect(sbc.address).toBe(0x12ac);
    expect(sbc.mode).toBe("iw");
  });
});
