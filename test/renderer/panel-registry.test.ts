import { describe, expect, it } from "vitest";
import {
  getDefaultPrimarySideBarPanels,
  getDefaultSecondarySideBarPanels,
  getPanelContribution,
  getPanelContributionByRendererId,
  panelContributions
} from "../../src/renderer/src/components/ide/panel-registry";

describe("IDE panel registry", () => {
  it("registers each panel contribution id exactly once", () => {
    const ids = panelContributions.map((panel) => panel.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("registers each renderer id exactly once", () => {
    const rendererIds = panelContributions.map((panel) => panel.rendererId);

    expect(new Set(rendererIds).size).toBe(rendererIds.length);
  });

  it("looks up contributions by contribution id and renderer id", () => {
    expect(getPanelContribution("z80Cpu")).toMatchObject({
      title: "Z80 CPU",
      rendererId: "z80Cpu",
      defaultActivityId: "debug"
    });

    expect(getPanelContributionByRendererId("memory")).toMatchObject({
      id: "memory",
      allowMultipleDocumentInstances: true
    });
  });

  it("provides the default Debug primary side bar panels in display order", () => {
    expect(getDefaultPrimarySideBarPanels("debug").map((panel) => panel.id)).toEqual([
      "z80Cpu",
      "callStack",
      "ulaIo",
      "watch",
      "breakpoints"
    ]);
  });

  it("provides default secondary side bar panels", () => {
    expect(getDefaultSecondarySideBarPanels().map((panel) => panel.id)).toEqual([
      "outline",
      "memory"
    ]);
  });
});
