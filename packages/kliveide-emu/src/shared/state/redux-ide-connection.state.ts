import { createAction, SpectNetAction } from "./redux-core";
import { VmInfo, IdeConnection } from "./AppState";

export const ideConnectsAction = createAction("IDE_CONNECTS");
export const ideDisconnectsAction = createAction("IDE_DISCONNECTS");

/**
 * This reducer manages IDE connection state changes
 * @param state Input state
 * @param action Action executed
 */
export function ideConnectionStateReducer(
  state: IdeConnection = {
    connected: false,
    lastHeartBeat: 0,
  },
  { type, payload }: SpectNetAction
): IdeConnection {
  switch (type) {
    case "IDE_CONNECTS":
      return { connected: true, lastHeartBeat: Date.now() };
    case "IDE_DISCONNECTS":
      return { connected: false, lastHeartBeat: 0 };
  }
  return state;
}
