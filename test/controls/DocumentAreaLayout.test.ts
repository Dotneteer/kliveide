import { describe, expect, it } from "vitest";
import {
  createSingleAreaLayout,
  findAreaIds,
  removeArea,
  setSplitSize,
  splitArea,
  type DocumentAreaLayout
} from "@renderer/features/documents/documentAreaLayout";

describe("documentAreaLayout", () => {
  it("creates a single leaf area", () => {
    const layout = createSingleAreaLayout("area-1");

    expect(layout).toEqual({
      type: "leaf",
      areaId: "area-1"
    });
    expect(findAreaIds(layout)).toEqual(["area-1"]);
  });

  it("splits a leaf after the target area", () => {
    const layout = splitArea(
      createSingleAreaLayout("area-1"),
      "area-1",
      "area-2",
      "horizontal"
    );

    expect(layout).toEqual({
      type: "split",
      direction: "horizontal",
      first: {
        type: "leaf",
        areaId: "area-1"
      },
      second: {
        type: "leaf",
        areaId: "area-2"
      }
    });
    expect(findAreaIds(layout)).toEqual(["area-1", "area-2"]);
  });

  it("splits a leaf before the target area", () => {
    const layout = splitArea(
      createSingleAreaLayout("area-1"),
      "area-1",
      "area-2",
      "vertical",
      "before",
      "40%"
    );

    expect(layout).toEqual({
      type: "split",
      direction: "vertical",
      size: "40%",
      first: {
        type: "leaf",
        areaId: "area-2"
      },
      second: {
        type: "leaf",
        areaId: "area-1"
      }
    });
  });

  it("splits a nested target without changing neighboring areas", () => {
    const layout: DocumentAreaLayout = {
      type: "split",
      direction: "horizontal",
      first: createSingleAreaLayout("area-1"),
      second: createSingleAreaLayout("area-2")
    };

    const nextLayout = splitArea(layout, "area-2", "area-3", "vertical");

    expect(findAreaIds(nextLayout)).toEqual(["area-1", "area-2", "area-3"]);
    expect(nextLayout).toEqual({
      type: "split",
      direction: "horizontal",
      first: {
        type: "leaf",
        areaId: "area-1"
      },
      second: {
        type: "split",
        direction: "vertical",
        first: {
          type: "leaf",
          areaId: "area-2"
        },
        second: {
          type: "leaf",
          areaId: "area-3"
        }
      }
    });
  });

  it("balances uncustomized horizontal areas when adding a third area", () => {
    const initialLayout = splitArea(
      createSingleAreaLayout("area-1"),
      "area-1",
      "area-2",
      "horizontal"
    );

    expect(splitArea(initialLayout, "area-1", "area-3", "horizontal")).toEqual({
      type: "split",
      direction: "horizontal",
      size: "33.333333%",
      first: createSingleAreaLayout("area-1"),
      second: {
        type: "split",
        direction: "horizontal",
        size: "50%",
        first: createSingleAreaLayout("area-3"),
        second: createSingleAreaLayout("area-2")
      }
    });
  });

  it("balances uncustomized vertical areas when adding a third area", () => {
    const initialLayout = splitArea(
      createSingleAreaLayout("area-1"),
      "area-1",
      "area-2",
      "vertical"
    );

    expect(splitArea(initialLayout, "area-2", "area-3", "vertical")).toEqual({
      type: "split",
      direction: "vertical",
      size: "33.333333%",
      first: createSingleAreaLayout("area-1"),
      second: {
        type: "split",
        direction: "vertical",
        size: "50%",
        first: createSingleAreaLayout("area-2"),
        second: createSingleAreaLayout("area-3")
      }
    });
  });

  it("preserves a customized sibling size when splitting an area", () => {
    const initialLayout = setSplitSize(
      splitArea(
        createSingleAreaLayout("area-1"),
        "area-1",
        "area-2",
        "horizontal"
      ),
      [],
      "80%"
    );

    expect(splitArea(initialLayout, "area-1", "area-3", "horizontal")).toEqual({
      type: "split",
      direction: "horizontal",
      size: "80%",
      isSizeCustomized: true,
      first: {
        type: "split",
        direction: "horizontal",
        first: createSingleAreaLayout("area-1"),
        second: createSingleAreaLayout("area-3")
      },
      second: createSingleAreaLayout("area-2")
    });
  });

  it("preserves a customized vertical sibling size when splitting an area", () => {
    const initialLayout = setSplitSize(
      splitArea(
        createSingleAreaLayout("area-1"),
        "area-1",
        "area-2",
        "vertical"
      ),
      [],
      "80%"
    );

    expect(splitArea(initialLayout, "area-1", "area-3", "vertical")).toEqual({
      type: "split",
      direction: "vertical",
      size: "80%",
      isSizeCustomized: true,
      first: {
        type: "split",
        direction: "vertical",
        first: createSingleAreaLayout("area-1"),
        second: createSingleAreaLayout("area-3")
      },
      second: createSingleAreaLayout("area-2")
    });
  });

  it("collapses the parent split when removing an area", () => {
    const layout = splitArea(
      splitArea(createSingleAreaLayout("area-1"), "area-1", "area-2", "horizontal"),
      "area-2",
      "area-3",
      "vertical"
    );

    const nextLayout = removeArea(layout, "area-2");

    expect(nextLayout).toEqual({
      type: "split",
      direction: "horizontal",
      first: {
        type: "leaf",
        areaId: "area-1"
      },
      second: {
        type: "leaf",
        areaId: "area-3"
      }
    });
  });

  it("keeps the layout when removing the last area or an unknown area", () => {
    const layout = createSingleAreaLayout("area-1");

    expect(removeArea(layout, "area-1")).toBe(layout);
    expect(removeArea(layout, "missing")).toBe(layout);
  });
});
