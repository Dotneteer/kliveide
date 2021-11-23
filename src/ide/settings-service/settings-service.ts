import {
  ISettingsService,
  SettingLocation,
  SettingsValue,
} from "@abstractions/settings-service";
import { getState } from "@core/service-registry";

/**
 * This class implements the operations to manage user/project level settings
 */
 export class SettingsService implements ISettingsService {
  getSetting(key: string, location: SettingLocation): Promise<SettingsValue | null> {
    throw new Error("Method not implemented.");
  }
  saveSetting(
    key: string,
    value: SettingsValue,
    localtion: SettingLocation
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
  removeSetting(key: string, location: SettingLocation): Promise<SettingsValue | null> {
    throw new Error("Method not implemented.");
  }

  /**
   * Gets the entire configuration set from the specified location
   * @param location Settings location
   * @returns The configuration set
   */
  async getConfiguration(location: SettingLocation): Promise<Record<string, any>> {
    const projState = getState().project;
    let isProject = location === "user"
      ? false
      : projState?.hasVm ?? false;
    
    return {};
  }

  /**
   * Tests if a key contains valid characters
   * @param key Key to test
   */
  testSettingKey(key: string): boolean {
    return /[a-zA-Z0-9_$-]+/g.test(key);
  }
}
