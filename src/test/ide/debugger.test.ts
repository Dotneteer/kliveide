import "mocha";
import * as expect from "expect";
import { addBreakpoint, removeBreakpoint} from "../../core/abstractions/debug-helpers";
import { BinaryBreakpoint, SourceCodeBreakpoint} from "../../core/abstractions/code-runner-service";

describe("Debugger", () => {
  it("Add first binary breakpoint", () => {
    const bps = addBreakpoint([], {
      type: "binary",
      location: 1234
    });
    expect(bps.length).toBe(1);
    let bp = bps[0] as BinaryBreakpoint;
    expect(bp.location).toBe(1234);
    expect(bp.partition).toBeUndefined();
  });

  it("Add second binary breakpoint #1", () => {
    let bps = addBreakpoint([], {
      type: "binary",
      location: 1234
    });
    bps = addBreakpoint(bps, {
      type: "binary",
      location: 1234
    })
    expect(bps.length).toBe(1);
    let bp = bps[0] as BinaryBreakpoint;
    expect(bp.location).toBe(1234);
    expect(bp.partition).toBeUndefined();
  });

  it("Add second binary breakpoint #2", () => {
    let bps = addBreakpoint([], {
      type: "binary",
      location: 1234
    });
    bps = addBreakpoint(bps, {
      type: "binary",
      location: 3241
    })
    expect(bps.length).toBe(2);
    let bp = bps[0] as BinaryBreakpoint;
    expect(bp.location).toBe(1234);
    expect(bp.partition).toBeUndefined();
    bp = bps[1] as BinaryBreakpoint;
    expect(bp.location).toBe(3241);
    expect(bp.partition).toBeUndefined();
  });

  it("Add second binary breakpoint #3", () => {
    let bps = addBreakpoint([], {
      type: "binary",
      location: 1234
    });
    bps = addBreakpoint(bps, {
      type: "binary",
      partition: 1,
      location: 1234
    })
    expect(bps.length).toBe(2);
    let bp = bps[0] as BinaryBreakpoint;
    expect(bp.location).toBe(1234);
    expect(bp.partition).toBeUndefined();
    bp = bps[1] as BinaryBreakpoint;
    expect(bp.location).toBe(1234);
    expect(bp.partition).toBe(1);
  });

  it("Add first source breakpoint", () => {
    const bps = addBreakpoint([], {
      type: "source",
      resource: "f",
      line: 123
    });
    expect(bps.length).toBe(1);
    let bp = bps[0] as SourceCodeBreakpoint;
    expect(bp.resource).toBe("f");
    expect(bp.line).toBe(123);
  });

  it("Add second source breakpoint #1", () => {
    let bps = addBreakpoint([], {
      type: "source",
      resource: "f",
      line: 123
    });
    bps = addBreakpoint([], {
      type: "source",
      resource: "f",
      line: 123
    });
    expect(bps.length).toBe(1);
    let bp = bps[0] as SourceCodeBreakpoint;
    expect(bp.resource).toBe("f");
    expect(bp.line).toBe(123);
  });

  it("Add second source breakpoint #2", () => {
    let bps = addBreakpoint([], {
      type: "source",
      resource: "f",
      line: 123
    });
    bps = addBreakpoint(bps, {
      type: "source",
      resource: "f",
      line: 321
    });
    expect(bps.length).toBe(2);
    let bp = bps[0] as SourceCodeBreakpoint;
    expect(bp.resource).toBe("f");
    expect(bp.line).toBe(123);
    bp = bps[1] as SourceCodeBreakpoint;
    expect(bp.resource).toBe("f");
    expect(bp.line).toBe(321);
  });

  it("Add second source breakpoint #3", () => {
    let bps = addBreakpoint([], {
      type: "source",
      resource: "f",
      line: 123
    });
    bps = addBreakpoint(bps, {
      type: "source",
      resource: "f1",
      line: 123
    });
    expect(bps.length).toBe(2);
    let bp = bps[0] as SourceCodeBreakpoint;
    expect(bp.resource).toBe("f");
    expect(bp.line).toBe(123);
    bp = bps[1] as SourceCodeBreakpoint;
    expect(bp.resource).toBe("f1");
    expect(bp.line).toBe(123);
  });

  it("Remove binary breakpoint #1", () => {
    let bps = addBreakpoint([], {
      type: "binary",
      location: 1234
    });
    bps = removeBreakpoint(bps, {
      type: "binary",
      location: 3210
    })
    expect(bps.length).toBe(1);
    let bp = bps[0] as BinaryBreakpoint;
    expect(bp.location).toBe(1234);
    expect(bp.partition).toBeUndefined();
  });

  it("Remove binary breakpoint #2", () => {
    let bps = addBreakpoint([], {
      type: "binary",
      location: 1234
    });
    bps = removeBreakpoint(bps, {
      type: "binary",
      location: 1234,
      partition: 1
    })
    expect(bps.length).toBe(1);
    let bp = bps[0] as BinaryBreakpoint;
    expect(bp.location).toBe(1234);
    expect(bp.partition).toBeUndefined();
  });

  it("Remove binary breakpoint #3", () => {
    let bps = addBreakpoint([], {
      type: "binary",
      location: 1234
    });
    bps = removeBreakpoint(bps, {
      type: "binary",
      location: 1234,
    })
    expect(bps.length).toBe(0);
  });

  it("Remove binary breakpoint #4", () => {
    let bps = addBreakpoint([], {
      type: "binary",
      location: 1234
    });
    bps = addBreakpoint(bps, {
      type: "binary",
      location: 3210
    });
    bps = removeBreakpoint(bps, {
      type: "binary",
      location: 1234,
    })
    expect(bps.length).toBe(1);
    let bp = bps[0] as BinaryBreakpoint;
    expect(bp.location).toBe(3210);
    expect(bp.partition).toBeUndefined();
  });

  it("Remove binary breakpoint #5", () => {
    let bps = addBreakpoint([], {
      type: "binary",
      location: 3210
    });
    bps = addBreakpoint(bps, {
      type: "binary",
      location: 1234
    });
    bps = removeBreakpoint(bps, {
      type: "binary",
      location: 1234,
    })
    expect(bps.length).toBe(1);
    let bp = bps[0] as BinaryBreakpoint;
    expect(bp.location).toBe(3210);
    expect(bp.partition).toBeUndefined();
  });

  it("Remove source breakpoint #1", () => {
    let bps = addBreakpoint([], {
      type: "source",
      resource: "f",
      line: 123
    });
    bps = removeBreakpoint(bps, {
      type: "binary",
      location: 3210
    })
    expect(bps.length).toBe(1);
    let bp = bps[0] as SourceCodeBreakpoint;
    expect(bp.resource).toBe("f");
    expect(bp.line).toBe(123);
  });

  it("Remove source breakpoint #2", () => {
    let bps = addBreakpoint([], {
      type: "source",
      resource: "f",
      line: 123
    });
    bps = removeBreakpoint(bps, {
      type: "source",
      resource: "f",
      line: 321
    })
    expect(bps.length).toBe(1);
    let bp = bps[0] as SourceCodeBreakpoint;
    expect(bp.resource).toBe("f");
    expect(bp.line).toBe(123);
  });

  it("Remove source breakpoint #3", () => {
    let bps = addBreakpoint([], {
      type: "source",
      resource: "f",
      line: 123
    });
    bps = removeBreakpoint(bps, {
      type: "source",
      resource: "f",
      line: 123
    })
    expect(bps.length).toBe(0);
  });

  it("Remove source breakpoint #4", () => {
    let bps = addBreakpoint([], {
      type: "source",
      resource: "f",
      line: 123
    });
    bps = addBreakpoint(bps, {
      type: "binary",
      location: 3210
    });
    bps = removeBreakpoint(bps, {
      type: "source",
      resource: "f",
      line: 123
    })
    expect(bps.length).toBe(1);
    let bp = bps[0] as BinaryBreakpoint;
    expect(bp.location).toBe(3210);
    expect(bp.partition).toBeUndefined();
  });

  it("Remove binary breakpoint #5", () => {
    let bps = addBreakpoint([], {
      type: "binary",
      location: 3210
    });
    bps = addBreakpoint(bps, {
      type: "source",
      resource: "f",
      line: 123
    });
    bps = removeBreakpoint(bps, {
      type: "source",
      resource: "f",
      line: 123
    })
    expect(bps.length).toBe(1);
    let bp = bps[0] as BinaryBreakpoint;
    expect(bp.location).toBe(3210);
    expect(bp.partition).toBeUndefined();
  });
});
