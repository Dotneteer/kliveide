import { describe, expect, it } from "vitest";
import {
  createEditorLayoutMenuDescriptors,
  type EditorLayoutMenuDescriptor
} from "../../src/common/menus/editor-layout-menu";

describe("editor layout menu descriptors", () => {
  it("maps split commands to editor split actions", () => {
    const items = flattenItems(createEditorLayoutMenuDescriptors());

    expect(items.find((item) => item.id === "split_editor_right")).toMatchObject({
      label: "Split Editor Right",
      action: {
        type: "SPLIT_EDITOR_GROUP",
        payload: { text: "right" }
      }
    });
    expect(items.find((item) => item.id === "split_editor_up")).toMatchObject({
      label: "Split Editor Up",
      action: {
        type: "SPLIT_EDITOR_GROUP",
        payload: { text: "up" }
      }
    });
  });

  it("maps editor layout preset commands to preset actions", () => {
    const items = flattenItems(createEditorLayoutMenuDescriptors());

    expect(items.find((item) => item.id === "single_editor_group")).toMatchObject({
      label: "Single Editor Group",
      action: {
        type: "SET_EDITOR_GROUP_LAYOUT_PRESET",
        payload: { text: "single" }
      }
    });
    expect(items.find((item) => item.id === "grid_editor_layout")).toMatchObject({
      label: "Grid (2x2)",
      action: {
        type: "SET_EDITOR_GROUP_LAYOUT_PRESET",
        payload: { text: "grid" }
      }
    });
    expect(items.find((item) => item.id === "three_columns_editor_layout")).toMatchObject({
      label: "Three Columns",
      action: {
        type: "SET_EDITOR_GROUP_LAYOUT_PRESET",
        payload: { text: "threeColumns" }
      }
    });
    expect(items.find((item) => item.id === "three_rows_editor_layout")).toMatchObject({
      label: "Three Rows",
      action: {
        type: "SET_EDITOR_GROUP_LAYOUT_PRESET",
        payload: { text: "threeRows" }
      }
    });
  });

  it("maps move, focus, and close commands to their reducer actions", () => {
    const items = flattenItems(createEditorLayoutMenuDescriptors());

    expect(items.find((item) => item.id === "move_editor_to_right_group")).toMatchObject({
      action: {
        type: "MOVE_ACTIVE_EDITOR_TO_GROUP",
        payload: { text: "right" }
      }
    });
    expect(items.find((item) => item.id === "move_active_editor_group_up")).toMatchObject({
      action: {
        type: "MOVE_ACTIVE_EDITOR_GROUP",
        payload: { text: "up" }
      }
    });
    expect(items.find((item) => item.id === "focus_below_group")).toMatchObject({
      action: {
        type: "FOCUS_EDITOR_GROUP",
        payload: { text: "down" }
      }
    });
    expect(items.find((item) => item.id === "toggle_maximize_editor_group")).toMatchObject({
      label: "Maximize Editor Group",
      action: {
        type: "TOGGLE_MAXIMIZE_EDITOR_GROUP"
      }
    });
    expect(items.find((item) => item.id === "close_active_editor_group")).toMatchObject({
      label: "Close Editor Group",
      action: {
        type: "CLOSE_ACTIVE_EDITOR_GROUP"
      }
    });
  });
});

type EditorLayoutItem = Extract<EditorLayoutMenuDescriptor, { type: "item" }>;

function flattenItems(descriptors: EditorLayoutMenuDescriptor[]): EditorLayoutItem[] {
  return descriptors.flatMap((descriptor): EditorLayoutItem[] => {
    if (descriptor.type === "item") {
      return [descriptor];
    }
    if (descriptor.type === "submenu") {
      return flattenItems(descriptor.submenu);
    }
    return [];
  });
}
