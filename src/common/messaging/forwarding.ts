import { Action } from "@/common/state/Action";
import { MessageBase } from "./messages-core";

/**
 * This message type forwards an action from the main process to the emulator or vice versa
 */
export interface ForwardActionRequest extends MessageBase {
  type: "ForwardAction";
  action: Action;
}
