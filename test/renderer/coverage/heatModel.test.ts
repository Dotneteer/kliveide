import { describe, expect, it } from "vitest";
import { PF_CODE, PF_EXECUTED, PF_READ, PF_SELF_MODIFIED, PF_WRITTEN, type ProfileView } from "@common/profile/profileTypes";
import {
  buildHeatSteps,
  HEAT_KIND_EXEC,
  HEAT_KIND_READ,
  HEAT_KIND_WRITE,
  HEAT_SMC,
  heatKind,
  heatStep,
  heatTooltip,
  rampStep
} from "@renderer/features/coverage/heatModel";

/* The memory heat map's model (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D14, T6) */

function view(flags: number[], counts?: { exec: number[]; read: number[]; write: number[]; counted?: number[] }): ProfileView {
  const n = flags.length;
  return {
    baseAddress: 0,
    flags: Uint8Array.from(flags),
    counts: counts && {
      exec: Uint32Array.from(counts.exec),
      read: Uint32Array.from(counts.read),
      write: Uint32Array.from(counts.write),
      time: new Float64Array(n),
      counted: Uint8Array.from(counts.counted ?? flags.map(() => 1))
    },
    info: {} as never
  };
}

describe("the heat model", () => {
  it("ramps log2 of a count against the view's largest, from 1 to 5", () => {
    expect(rampStep(0, 100)).toBe(0);
    expect(rampStep(1, 1)).toBe(1);
    expect(rampStep(1, 1024)).toBe(1);
    expect(rampStep(1024, 1024)).toBe(5);
    expect(rampStep(32, 1024)).toBe(3);
    for (let c = 1; c < 1024; c++) expect(rampStep(c + 1, 1024)).toBeGreaterThanOrEqual(rampStep(c, 1024));
  });

  it("is off in mode off and without a view", () => {
    expect(buildHeatSteps(view([PF_EXECUTED]), "off")).toBeUndefined();
    expect(buildHeatSteps(undefined, "exec")).toBeUndefined();
  });

  it("draws one kind per mode, and skips bytes that kind never touched", () => {
    const v = view([PF_EXECUTED | PF_CODE, PF_READ, PF_WRITTEN, 0], { exec: [8, 0, 0, 0], read: [0, 2, 0, 0], write: [0, 0, 1, 0] });
    const exec = buildHeatSteps(v, "exec")!;
    expect(heatStep(exec[0])).toBe(5);
    expect(heatKind(exec[0])).toBe(HEAT_KIND_EXEC);
    expect(Array.from(exec.slice(1))).toEqual([0, 0, 0]);
    const read = buildHeatSteps(v, "read")!;
    expect(heatKind(read[1])).toBe(HEAT_KIND_READ);
    expect(heatStep(read[0])).toBe(0);
  });

  it("draws the dominant count's hue in mode all", () => {
    const v = view([PF_READ | PF_WRITTEN], { exec: [0], read: [3], write: [40] });
    const all = buildHeatSteps(v, "all")!;
    expect(heatKind(all[0])).toBe(HEAT_KIND_WRITE);
    expect(heatStep(all[0])).toBe(5);
  });

  it("draws flags alone at step 1 where the pool kept no counts (T6)", () => {
    const v = view([PF_EXECUTED, PF_EXECUTED], { exec: [0, 900], read: [0, 0], write: [0, 0], counted: [0, 1] });
    const heat = buildHeatSteps(v, "exec")!;
    expect(heatStep(heat[0])).toBe(1);
    expect(heatStep(heat[1])).toBe(5);
    expect(heatTooltip(v, 0)).toContain("counts not kept for this page");
    expect(heatTooltip(v, 1)).toBe("E 900 · R 0 · W 0");
  });

  it("marks self-modified bytes whatever the mode", () => {
    const v = view([PF_EXECUTED | PF_WRITTEN | PF_SELF_MODIFIED], { exec: [1], read: [0], write: [1] });
    expect(buildHeatSteps(v, "exec")![0] & HEAT_SMC).toBe(HEAT_SMC);
    expect(heatTooltip(v, 0)).toContain("self-modified");
  });
});
