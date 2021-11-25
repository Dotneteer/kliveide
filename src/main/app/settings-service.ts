import {
  ISettingsService,
  SettingLocation,
  SettingsValue,
} from "@abstractions/settings-service";
import { getState } from "@core/service-registry";
import { appSettings } from "../main-state/klive-configuration";

export const INVALID_KEY = "$InvalidKey$";

/**
 * This class implements the operations to manage user/project level settings
 */
export class MainSettingsService implements ISettingsService {
  /**
   * Gets the setting with the specified key
   * @param key Setting key
   * @param location Settings location
   * @returns The value of the setting, if defined; otherwise, null
   */
  async getSetting(
    key: string,
    location: SettingLocation
  ): Promise<SettingsValue | null> {
    const keySegments = key.split(".");
    if (keySegments.some((s) => !this.testSettingKey(s))) {
      throw new Error(INVALID_KEY);
    }
    let configObj = await this.getConfiguration(location);
    return configObj.get(key) ?? null;
  }

  /**
   * Saves the specified setting value. If value is undefined, removes the setting value
   * @param key Setting key
   * @param value Value to save
   * @param location Settings location
   */
  async saveSetting(
    key: string,
    value: SettingsValue,
    location: SettingLocation
  ): Promise<void> {
    throw new Error("Not supported.");
  }

  /**
   * Gets the entire configuration set from the specified location
   * @param location Settings location
   * @returns The configuration set
   */
  async getConfiguration(
    location: SettingLocation
  ): Promise<Map<string, SettingsValue>> {
    const configObj = await this.getConfigurationObject(location);
    const configMap = new Map<string, SettingsValue>();
    addConfigProps(configObj);
    return configMap;

    function addConfigProps(obj: any, prefix: string = "") {
      const type = typeof obj;
      if (
        type === "string" ||
        type === "number" ||
        type === "boolean" ||
        type === "undefined"
      ) {
        configMap.set(prefix, obj);
        return;
      }
      if (obj === null) {
        configMap.set(prefix, obj);
        return;
      }
      if (type !== "object") {
        return;
      }
      for (const propKey in obj) {
        const value = obj[propKey];
        if (value) {
          const newPrefix = prefix ? `${prefix}.${propKey}` : propKey;
          addConfigProps(value, newPrefix);
        }
      }
    }
  }

  /**
   * Gets the entire configuration set from the specified location
   * @param location Settings location
   * @returns The configuration set
   */
  async getConfigurationObject(
    location: SettingLocation
  ): Promise<Record<string, any>> {
    const projState = getState().project;
    let isProject = location === "user" ? false : projState?.hasVm ?? false;
    return (isProject ? getState().ideConfig : appSettings.ide) ?? {};
  }

  /**
   * Tests if a key contains valid characters
   * @param key Key to test
   */
  testSettingKey(key: string): boolean {
    return /[a-zA-Z0-9_$-]+/g.test(key);
  }
}
