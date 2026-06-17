import { createMetadata, wrapComponent } from "xmlui";
import type { ComponentMetadata } from "xmlui";
import { SharedAppStateReact } from "./SharedAppStateReact";

const COMP = "SharedAppState";

export const SharedAppStateMd: ComponentMetadata = createMetadata({
  status: "experimental",
  description: "Exposes the shared Redux-style AppState to XMLUI components.",
  props: {
    fireDidChangeOnInit: {
      description: "When true, fires didChange after the initial shared state is set.",
      valueType: "boolean",
      defaultValue: true
    }
  },
  events: {
    didChange: {
      description: "Fires when the shared application state changes.",
      signature: "didChange(appState: AppState, previousAppState?: AppState): void"
    }
  },
  apis: {
    dispatch: {
      description: "Dispatches a reducer action into the shared application store.",
      signature: "dispatch(action: Action): AppState"
    },
    dispatchSetTheme: {
      description: "Dispatches SET_THEME into the shared application store.",
      signature: "dispatchSetTheme(themeId: string): AppState"
    },
    dispatchSetGlobalSetting: {
      description: "Dispatches SET_GLOBAL_SETTING into the shared application store.",
      signature: "dispatchSetGlobalSetting(key: string, value: any): AppState"
    },
    dispatchSelectActivity: {
      description: "Dispatches SET_ACTIVITY into the shared application store.",
      signature: "dispatchSelectActivity(activityId: string): AppState"
    },
    globalSettings: {
      description: "Reads a global setting from the current shared application state.",
      signature: "globalSettings(key: string, defaultValue?: any): any"
    },
    getSettingValue: {
      description: "Reads a defined persisted setting through the main process.",
      signature: "getSettingValue(key: string): Promise<any>"
    },
    getAllSettingValues: {
      description: "Reads all defined persisted settings through the main process.",
      signature: "getAllSettingValues(): Promise<Record<string, any>>"
    },
    setSettingValue: {
      description: "Updates a defined persisted setting through the main process.",
      signature: "setSettingValue(key: string, value: any): Promise<any>"
    },
    update: {
      description: "Stores a value under globalSettings through SET_GLOBAL_SETTING.",
      signature: "update(key: string, value: any): AppState"
    }
  },
  nonVisual: true
});

export const sharedAppStateComponentRenderer = wrapComponent(
  COMP,
  SharedAppStateReact,
  SharedAppStateMd,
  {
    exposeRegisterApi: true,
    stateful: true,
    events: { didChange: "onDidChange" }
  }
);
