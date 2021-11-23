import {
  ISettingsService,
  SettingLocation,
  SettingsValue,
} from "@abstractions/settings-service";
import { sendFromIdeToEmu } from "@core/messaging/message-sending";
import { GetAppConfigResponse } from "@core/messaging/message-types";
import { getState } from "@core/service-registry";

export const INVALID_KEY = "$InvalidKey$";

/**
 * This class implements the operations to manage user/project level settings
 */
export class SettingsService implements ISettingsService {
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
    let index = 0;
    let configObj: any = await this.getConfiguration(location);
    while (index < keySegments.length) {
      if (configObj === undefined) {
        return undefined;
      }
      if (index < keySegments.length - 1 && typeof configObj !== "object") {
        return undefined;
      }
      configObj = configObj[keySegments[index++]];
    }
    if (
      configObj === undefined ||
      configObj === null ||
      typeof configObj === "boolean" ||
      typeof configObj === "number" ||
      typeof configObj === "string"
    ) {
      return configObj;
    }
    return undefined;
  }

  /**
   * Saves the specified setting value
   * @param key Setting key
   * @param value Value to save
   * @param location Settings location
   */
  saveSetting(
    key: string,
    value: SettingsValue,
    localtion: SettingLocation
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }

  /**
   * Removes the setting with the specified key
   * @param key Setting key
   * @param location Settings location
   * @returns The previous value of the setting, provided it had any
   */
  removeSetting(
    key: string,
    location: SettingLocation
  ): Promise<SettingsValue | null> {
    throw new Error("Method not implemented.");
  }

  /**
   * Gets the entire configuration set from the specified location
   * @param location Settings location
   * @returns The configuration set
   */
  async getConfiguration(
    location: SettingLocation
  ): Promise<Record<string, any>> {
    const projState = getState().project;
    let isProject = location === "user" ? false : projState?.hasVm ?? false;
    console.log(`IsUser? ${!isProject}`);
    const response = await sendFromIdeToEmu<GetAppConfigResponse>({
      type: "GetAppConfig",
      fromUser: !isProject,
    });
    return response.config?.ide ?? null;
  }

  /**
   * Tests if a key contains valid characters
   * @param key Key to test
   */
  testSettingKey(key: string): boolean {
    return /[a-zA-Z0-9_$-]+/g.test(key);
  }
}
