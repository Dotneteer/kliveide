import "mocha";
import * as expect from "expect";

import { breakpointDefinitions } from "../../src/emulator/breakpoints";
import { BreakpointDefinition } from "../../src/shared/machines/api-data";

describe("Breakpoints", () => {
  it("erase all breakpoints", () => {
    breakpointDefinitions.eraseAll();
    expect(breakpointDefinitions.toArray().length).toBe(0);
  });

  it("set execution breakpoint #1", () => {
    breakpointDefinitions.eraseAll();

    const bp: BreakpointDefinition = {
      address: 0x1000,
    };
    breakpointDefinitions.set(bp);

    expect(breakpointDefinitions.toArray().length).toBe(1);
    const backBp = breakpointDefinitions.get(0x1000);
    expect(backBp.mode).toBe(bp.mode);
    expect(backBp.address).toBe(bp.address);
    expect(backBp.partition).toBe(bp.partition);
    expect(backBp.hit).toBe(bp.hit);
    expect(backBp.value).toBe(bp.value);
  });

  it("set execution breakpoint #2", () => {
    breakpointDefinitions.eraseAll();

    const bp1: BreakpointDefinition = {
      address: 0x1000,
    };
    breakpointDefinitions.set(bp1);
    const bp2: BreakpointDefinition = {
      address: 0x2000,
    };
    breakpointDefinitions.set(bp2);

    expect(breakpointDefinitions.toArray().length).toBe(2);
    let backBp = breakpointDefinitions.get(0x1000);
    expect(backBp.mode).toBe(bp1.mode);
    expect(backBp.address).toBe(bp1.address);
    expect(backBp.partition).toBe(bp1.partition);
    expect(backBp.hit).toBe(bp1.hit);
    expect(backBp.value).toBe(bp1.value);
    backBp = breakpointDefinitions.get(0x2000);
    expect(backBp.mode).toBe(bp2.mode);
    expect(backBp.address).toBe(bp2.address);
    expect(backBp.partition).toBe(bp2.partition);
    expect(backBp.hit).toBe(bp2.hit);
    expect(backBp.value).toBe(bp2.value);
  });

  it("set memory read breakpoint #1", () => {
    breakpointDefinitions.eraseAll();

    const bp: BreakpointDefinition = {
      address: 0x1000,
      mode: "mr",
    };
    breakpointDefinitions.set(bp);

    expect(breakpointDefinitions.toArray().length).toBe(1);
    const backBp = breakpointDefinitions.get(0x1000, "mr");
    expect(backBp.mode).toBe(bp.mode);
    expect(backBp.address).toBe(bp.address);
    expect(backBp.partition).toBe(bp.partition);
    expect(backBp.hit).toBe(bp.hit);
    expect(backBp.value).toBe(bp.value);
  });

  it("set memory write breakpoint #1", () => {
    breakpointDefinitions.eraseAll();

    const bp: BreakpointDefinition = {
      address: 0x1000,
      mode: "mw",
    };
    breakpointDefinitions.set(bp);

    expect(breakpointDefinitions.toArray().length).toBe(1);
    const backBp = breakpointDefinitions.get(0x1000, "mw");
    expect(backBp.mode).toBe(bp.mode);
    expect(backBp.address).toBe(bp.address);
    expect(backBp.partition).toBe(bp.partition);
    expect(backBp.hit).toBe(bp.hit);
    expect(backBp.value).toBe(bp.value);
  });

  it("set I/O read breakpoint #1", () => {
    breakpointDefinitions.eraseAll();

    const bp: BreakpointDefinition = {
      address: 0x1000,
      mode: "ir",
    };
    breakpointDefinitions.set(bp);

    expect(breakpointDefinitions.toArray().length).toBe(1);
    const backBp = breakpointDefinitions.get(0x1000, "ir");
    expect(backBp.mode).toBe(bp.mode);
    expect(backBp.address).toBe(bp.address);
    expect(backBp.partition).toBe(bp.partition);
    expect(backBp.hit).toBe(bp.hit);
    expect(backBp.value).toBe(bp.value);
  });

  it("set I/O write breakpoint #1", () => {
    breakpointDefinitions.eraseAll();

    const bp: BreakpointDefinition = {
      address: 0x1000,
      mode: "iw",
    };
    breakpointDefinitions.set(bp);

    expect(breakpointDefinitions.toArray().length).toBe(1);
    const backBp = breakpointDefinitions.get(0x1000, "iw");
    expect(backBp.mode).toBe(bp.mode);
    expect(backBp.address).toBe(bp.address);
    expect(backBp.partition).toBe(bp.partition);
    expect(backBp.hit).toBe(bp.hit);
    expect(backBp.value).toBe(bp.value);
  });

  it("set mixed breakpoint with same address #1", () => {
    breakpointDefinitions.eraseAll();

    const bp1: BreakpointDefinition = {
      address: 0x1000,
    };
    breakpointDefinitions.set(bp1);
    const bp2: BreakpointDefinition = {
      address: 0x1000,
      mode: "mr",
    };
    breakpointDefinitions.set(bp2);

    expect(breakpointDefinitions.toArray().length).toBe(2);
    let backBp = breakpointDefinitions.get(0x1000);
    expect(backBp.mode).toBe(bp1.mode);
    expect(backBp.address).toBe(bp1.address);
    expect(backBp.partition).toBe(bp1.partition);
    expect(backBp.hit).toBe(bp1.hit);
    expect(backBp.value).toBe(bp1.value);
    backBp = breakpointDefinitions.get(0x1000, "mr");
    expect(backBp.mode).toBe(bp2.mode);
    expect(backBp.address).toBe(bp2.address);
    expect(backBp.partition).toBe(bp2.partition);
    expect(backBp.hit).toBe(bp2.hit);
    expect(backBp.value).toBe(bp2.value);
  });

  it("set mixed breakpoint with same address #2", () => {
    breakpointDefinitions.eraseAll();

    const bp1: BreakpointDefinition = {
      address: 0x1000,
      mode: "iw",
    };
    breakpointDefinitions.set(bp1);
    const bp2: BreakpointDefinition = {
      address: 0x1000,
      mode: "mr",
    };
    breakpointDefinitions.set(bp2);

    expect(breakpointDefinitions.toArray().length).toBe(2);
    let backBp = breakpointDefinitions.get(0x1000, "iw");
    expect(backBp.mode).toBe(bp1.mode);
    expect(backBp.address).toBe(bp1.address);
    expect(backBp.partition).toBe(bp1.partition);
    expect(backBp.hit).toBe(bp1.hit);
    expect(backBp.value).toBe(bp1.value);
    backBp = breakpointDefinitions.get(0x1000, "mr");
    expect(backBp.mode).toBe(bp2.mode);
    expect(backBp.address).toBe(bp2.address);
    expect(backBp.partition).toBe(bp2.partition);
    expect(backBp.hit).toBe(bp2.hit);
    expect(backBp.value).toBe(bp2.value);
  });

  it("remove execution breakpoint #1", () => {
    breakpointDefinitions.eraseAll();

    const bp: BreakpointDefinition = {
      address: 0x1000,
    };
    breakpointDefinitions.set(bp);
    breakpointDefinitions.remove(0x1000);

    expect(breakpointDefinitions.toArray().length).toBe(0);
    expect(breakpointDefinitions.get(0x1000)).toBeNull();
  });

  it("remove execution breakpoint #2", () => {
    breakpointDefinitions.eraseAll();

    const bp1: BreakpointDefinition = {
      address: 0x1000,
    };
    breakpointDefinitions.set(bp1);
    const bp2: BreakpointDefinition = {
      address: 0x2000,
    };
    breakpointDefinitions.set(bp2);
    breakpointDefinitions.remove(0x1000);

    expect(breakpointDefinitions.toArray().length).toBe(1);
    expect(breakpointDefinitions.get(0x1000)).toBeNull();
    expect(breakpointDefinitions.get(0x2000)).not.toBeNull();
  });

  it("remove execution breakpoint #3", () => {
    breakpointDefinitions.eraseAll();

    const bp1: BreakpointDefinition = {
      address: 0x1000,
    };
    breakpointDefinitions.set(bp1);
    const bp2: BreakpointDefinition = {
      address: 0x2000,
    };
    breakpointDefinitions.set(bp2);
    breakpointDefinitions.remove(0x1000);
    breakpointDefinitions.remove(0x2000);

    expect(breakpointDefinitions.toArray().length).toBe(0);
    expect(breakpointDefinitions.get(0x1000)).toBeNull();
    expect(breakpointDefinitions.get(0x2000)).toBeNull();
  });

  it("remove execution breakpoint #4", () => {
    breakpointDefinitions.eraseAll();

    const bp1: BreakpointDefinition = {
      address: 0x1000,
    };
    breakpointDefinitions.set(bp1);
    const bp2: BreakpointDefinition = {
      address: 0x1000,
      mode: "iw",
    };
    breakpointDefinitions.set(bp2);
    breakpointDefinitions.remove(0x1000);

    expect(breakpointDefinitions.toArray().length).toBe(1);
    expect(breakpointDefinitions.get(0x1000)).toBeNull();
    expect(breakpointDefinitions.get(0x1000, "iw")).not.toBeNull();
  });
});
