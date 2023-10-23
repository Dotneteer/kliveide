import _ from "lodash";
import { AppState } from "../state/AppState";
import { Store } from "../state/redux-light";

class SettingsReader {
  constructor (public readonly store: Store<AppState>) {}

  readSetting(key: string): any {
    const state = this.store.getState();
    const mergedSettings = {...(state?.userSettings ?? {}), ...(state?.projectSettings ?? {})}
    return _.get(mergedSettings, key);
  }
}

/**
 * Creates an object to read settings from the specified store
 * @param store 
 * @returns 
 */
export function createSettingsReader (
  store: Store<AppState>
): SettingsReader {
  return new SettingsReader(store);
}
