import { describe, expect, it } from "vitest";

import {
  AUTOMATION_LEVELS,
  AUTOMATION_METHODS,
  levelAllows,
  machineStateName,
  parseAutomationLevel,
  parseAutomationSwitch
} from "@common/automation/protocol";
import { AUTOMATION_METHOD_TABLE } from "@main/automation/methods";

/*
 * The method table (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D7, D8): every method is listed, and
 * every listed method declares a level.
 */

describe("automation method table", () => {
  it("lists exactly the protocol's methods", () => {
    expect(Object.keys(AUTOMATION_METHOD_TABLE).sort()).toEqual([...AUTOMATION_METHODS].sort());
  });

  it("gives every method a level; only session.hello needs none", () => {
    for (const [name, definition] of Object.entries(AUTOMATION_METHOD_TABLE)) {
      if (name === "session.hello") {
        expect(definition.level).toBe("none");
      } else {
        expect(AUTOMATION_LEVELS, name).toContain(definition.level);
      }
    }
  });

  it("keeps file-system reach at the full level (D7)", () => {
    expect(AUTOMATION_METHOD_TABLE["ide.command"].level).toBe("full");
    expect(AUTOMATION_METHOD_TABLE["project.open"].level).toBe("full");
    const full = Object.entries(AUTOMATION_METHOD_TABLE)
      .filter(([, d]) => d.level === "full")
      .map(([n]) => n)
      .sort();
    expect(full).toEqual(["ide.command", "project.open"]);
  });

  it("puts reading at read and changing at control", () => {
    for (const name of ["session.info", "machine.state", "machine.wait", "cpu.get", "memory.read", "breakpoints.list", "project.info", "screen.capture"]) {
      expect(AUTOMATION_METHOD_TABLE[name].level, name).toBe("read");
    }
    for (const name of ["machine.start", "machine.step", "cpu.set", "memory.write", "breakpoints.set", "project.build", "project.export"]) {
      expect(AUTOMATION_METHOD_TABLE[name].level, name).toBe("control");
    }
  });

  it("runs waits and session methods outside the queue (D14)", () => {
    expect(AUTOMATION_METHOD_TABLE["machine.wait"].queued).toBe(false);
    expect(AUTOMATION_METHOD_TABLE["machine.wait"].unbounded).toBe(true);
    expect(AUTOMATION_METHOD_TABLE["session.info"].queued).toBe(false);
    expect(AUTOMATION_METHOD_TABLE["project.build"].queued).toBe(true);
  });

  it("orders the levels read < control < full", () => {
    expect(levelAllows("control", "read")).toBe(true);
    expect(levelAllows("control", "full")).toBe(false);
    expect(levelAllows("full", "control")).toBe(true);
  });

  it("reads the settings the way set -u stores them", () => {
    expect(parseAutomationSwitch("1")).toBe(true);
    expect(parseAutomationSwitch("true")).toBe(true);
    expect(parseAutomationSwitch(1)).toBe(true);
    expect(parseAutomationSwitch("0")).toBe(false);
    expect(parseAutomationSwitch(undefined)).toBe(false);
    expect(parseAutomationLevel("FULL")).toBe("full");
    expect(parseAutomationLevel("bogus")).toBe("control");
    expect(parseAutomationLevel(undefined)).toBe("control");
    expect(machineStateName(3)).toBe("paused");
    expect(machineStateName(undefined)).toBe("none");
  });
});
