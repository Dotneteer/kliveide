import { OutputColor } from "@/controls/ToolArea/abstractions";
import { MessageBase } from "./messages-core";

/**
 * You can sens an output pane message with these request to the IDE
 */
export interface DisplayOutputRequest extends MessageBase {
  type: "DisplayOutput";
  pane: string;
  text: string;
  color?: OutputColor;
  backgroundColor?: OutputColor;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikeThru?: boolean;
  data?: unknown;
  actionable?: boolean;
  writeLine?: boolean;
}
