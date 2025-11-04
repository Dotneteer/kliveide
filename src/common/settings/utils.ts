import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { get } from "lodash";
import { KliveGlobalSettings } from "./setting-definitions";

export function getGlobalSetting(store: Store<AppState>, settingId: string): any {
  const settingsDef = KliveGlobalSettings[settingId];
  if (!settingsDef) {
    return null;
  }
  return get(store.getState()?.globalSettings ?? {}, settingId, settingsDef.defaultValue);
}

