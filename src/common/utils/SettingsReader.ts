import { AppState } from "../state/AppState";

/**
 * Implementation of a function similar to lodash.get that safely retrieves values
 * from nested objects using a path string or array
 * @param obj The object to query
 * @param path Path of the property to get
 * @param defaultValue Value returned if resolution fails
 * @returns Value at path or defaultValue if path doesn't exist
 */
function get(obj: any, path: string | string[], defaultValue?: any): any {
  if (obj === null || obj === undefined) {
    return defaultValue;
  }

  // Convert string path to array (e.g. 'a.b[0].c' -> ['a', 'b', '0', 'c'])
  const pathArray = Array.isArray(path) 
    ? path 
    : path.replace(/\[(\w+)\]/g, '.$1') // convert [0] to .0
         .replace(/^\./, '')            // remove leading dot
         .split('.');

  // Recursively traverse the path
  let result = obj;
  for (const key of pathArray) {
    if (result === null || result === undefined || typeof result !== 'object') {
      return defaultValue;
    }
    result = result[key];
    if (result === undefined) {
      return defaultValue;
    }
  }
  
  return result;
}

class SettingsReader {
  constructor (public readonly state: AppState) {}

  readSetting (key: string): any {
    const mergedSettings = {
      ...(this.state?.userSettings ?? {}),
      ...(this.state?.projectSettings ?? {})
    };
    return get(mergedSettings, key);
  }

  readBooleanSetting (key: string): boolean {
    const value = this.readSetting(key);
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    switch (value) {
      case "true":
      case "yes":
      case "1":
        return true;
      default:
        return false;
    }
  }
}

/**
 * Creates an object to read settings from the specified store
 * @param store
 * @returns
 */
export function createSettingsReader (state: AppState): SettingsReader {
  return new SettingsReader(state);
}
