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

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `over`'s keys win; nested objects merge. Neither input is changed. */
function deepMerge(base: Record<string, any>, over: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = { ...base };
  for (const [key, value] of Object.entries(over)) {
    result[key] = isPlainObject(value) && isPlainObject(result[key]) ? deepMerge(result[key], value) : value;
  }
  return result;
}

class SettingsReader {
  constructor (public readonly state: AppState) {}

  /**
   * A setting's value: the project's overrides the user's key by key. Both are nested objects, so
   * a shallow merge of the two would let a project that sets one key of a namespace
   * (`zxbasic.compiler`) hide every user key of it (`zxbasic.root`). Two object values merge deeply.
   */
  readSetting (key: string): any {
    const projectValue = get(this.state?.projectSettings, key);
    const userValue = get(this.state?.userSettings, key);
    if (projectValue === undefined) return userValue;
    if (isPlainObject(projectValue) && isPlainObject(userValue)) return deepMerge(userValue, projectValue);
    return projectValue;
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
