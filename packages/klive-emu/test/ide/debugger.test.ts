import "mocha";
import * as expect from "expect";
import { addBreakpoint} from "../../src/renderer/machines/debug-helpers"

describe("Debugger", () => {
  // it("Add first binary breakpoint", () => {
  //   const bps = addBreakpoint([], {
  //     type: "binary",
  //     location: 1234
  //   });
  //   expect(bps.length).toBe(1);
  //   expect(bps[0].location).toBe(1234);
  //   expect(bps[0].partition).toBeUndefined();
  // });
  // it("Add second binary breakpoint #1", () => {
  //   let bps = addBreakpoint([], {
  //     type: "binary",
  //     location: 1234
  //   });
  //   bps = addBreakpoint(bps, {
  //     type: "binary",
  //     location: 1234
  //   })
  //   expect(bps.length).toBe(1);
  // });
});
