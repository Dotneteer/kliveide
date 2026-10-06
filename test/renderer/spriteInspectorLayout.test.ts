import { describe, expect, it } from "vitest";

import {
  chooseView,
  effectiveView,
  layoutForWidth,
  MEDIUM_FROM_CH,
  WIDE_FROM_CH
} from "@renderer/appIde/DocumentPanels/SpriteInspector/SpriteInspectorPanel";

// --- The layout follows the document's own width (.plans/mockups/sprite-inspector-layout.html)
describe("Sprite Inspector layout", () => {
  it("picks narrow, medium and wide by width in ch", () => {
    expect(layoutForWidth(94)).toBe("narrow");
    expect(layoutForWidth(MEDIUM_FROM_CH - 1)).toBe("narrow");
    expect(layoutForWidth(MEDIUM_FROM_CH)).toBe("medium");
    expect(layoutForWidth(WIDE_FROM_CH - 1)).toBe("medium");
    expect(layoutForWidth(WIDE_FROM_CH)).toBe("wide");
  });

  it("offers Both only where it fits, and shows the table instead", () => {
    expect(effectiveView("both", "wide")).toBe("both");
    expect(effectiveView("both", "medium")).toBe("sprites");
    expect(effectiveView("both", "narrow")).toBe("sprites");
    expect(effectiveView("patterns", "narrow")).toBe("patterns");
    expect(effectiveView("both", "medium", "patterns")).toBe("patterns");
  });

  it("keeps Both when a tab or a request picks a view where Both does not fit", () => {
    expect(chooseView({ view: "both" }, "patterns", "medium")).toEqual({ view: "both", tab: "patterns" });
    // --- Before the document has measured itself it reads as narrow: Both must survive that too
    expect(chooseView({ view: "both" }, "sprites", "narrow")).toEqual({ view: "both", tab: "sprites" });
  });

  it("leaves Both for a single view where Both is on screen", () => {
    expect(chooseView({ view: "both" }, "sprites", "wide")).toEqual({ view: "sprites", tab: "sprites" });
    expect(chooseView({ view: "sprites" }, "both", "wide")).toEqual({ view: "both", tab: undefined });
    expect(chooseView({ view: "sprites" }, "patterns", "narrow")).toEqual({ view: "patterns", tab: "patterns" });
  });
});
