import type { Action } from "../state/Action";
import {
  closeActiveEditorGroupAction,
  closeEditorsInActiveGroupAction,
  focusEditorGroupAction,
  moveActiveEditorGroupAction,
  moveActiveEditorToGroupAction,
  setEditorGroupLayoutPresetAction,
  splitEditorGroupAction,
  toggleMaximizeEditorGroupAction,
  toggleEditorGroupLayoutAction
} from "../state/actions";

export type EditorLayoutMenuDescriptor =
  | {
      type: "item";
      id: string;
      label: string;
      action: Action;
    }
  | {
      type: "submenu";
      id: string;
      label: string;
      submenu: EditorLayoutMenuDescriptor[];
    }
  | {
      type: "separator";
    };

export function createEditorLayoutMenuDescriptors(): EditorLayoutMenuDescriptor[] {
  return [
    item("split_editor_right", "Split Editor Right", splitEditorGroupAction("right")),
    item("split_editor_down", "Split Editor Down", splitEditorGroupAction("down")),
    item("split_editor_left", "Split Editor Left", splitEditorGroupAction("left")),
    item("split_editor_up", "Split Editor Up", splitEditorGroupAction("up")),
    { type: "separator" },
    item("toggle_editor_group_layout", "Toggle Vertical/Horizontal Editor Layout", toggleEditorGroupLayoutAction()),
    item("single_editor_group", "Single Editor Group", setEditorGroupLayoutPresetAction("single")),
    item("two_columns_editor_layout", "Two Columns", setEditorGroupLayoutPresetAction("twoColumns")),
    item("three_columns_editor_layout", "Three Columns", setEditorGroupLayoutPresetAction("threeColumns")),
    item("two_rows_editor_layout", "Two Rows", setEditorGroupLayoutPresetAction("twoRows")),
    item("three_rows_editor_layout", "Three Rows", setEditorGroupLayoutPresetAction("threeRows")),
    item("grid_editor_layout", "Grid (2x2)", setEditorGroupLayoutPresetAction("grid")),
    item("toggle_maximize_editor_group", "Maximize Editor Group", toggleMaximizeEditorGroupAction()),
    { type: "separator" },
    {
      type: "submenu",
      id: "move_editor_to_group",
      label: "Move Editor to Group",
      submenu: [
        item("move_editor_to_left_group", "Left Group", moveActiveEditorToGroupAction("left")),
        item("move_editor_to_right_group", "Right Group", moveActiveEditorToGroupAction("right")),
        item("move_editor_to_above_group", "Above Group", moveActiveEditorToGroupAction("up")),
        item("move_editor_to_below_group", "Below Group", moveActiveEditorToGroupAction("down"))
      ]
    },
    {
      type: "submenu",
      id: "move_active_editor_group",
      label: "Move Active Editor Group",
      submenu: [
        item("move_active_editor_group_left", "Left", moveActiveEditorGroupAction("left")),
        item("move_active_editor_group_right", "Right", moveActiveEditorGroupAction("right")),
        item("move_active_editor_group_up", "Up", moveActiveEditorGroupAction("up")),
        item("move_active_editor_group_down", "Down", moveActiveEditorGroupAction("down"))
      ]
    },
    {
      type: "submenu",
      id: "focus_editor_group",
      label: "Focus Editor Group",
      submenu: [
        item("focus_left_group", "Left Group", focusEditorGroupAction("left")),
        item("focus_right_group", "Right Group", focusEditorGroupAction("right")),
        item("focus_above_group", "Above Group", focusEditorGroupAction("up")),
        item("focus_below_group", "Below Group", focusEditorGroupAction("down"))
      ]
    },
    { type: "separator" },
    item("close_editors_in_group", "Close Editors in Group", closeEditorsInActiveGroupAction()),
    item("close_active_editor_group", "Close Editor Group", closeActiveEditorGroupAction())
  ];
}

function item(id: string, label: string, action: Action): EditorLayoutMenuDescriptor {
  return {
    type: "item",
    id,
    label,
    action
  };
}
