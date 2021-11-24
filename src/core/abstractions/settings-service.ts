/**
 * This interface defines the operations to manage user/project level settings
 */
export interface ISettingsService {
  /**
   * Gets the setting with the specified key
   * @param key Setting key
   * @param location Settings location
   * @returns The value of the setting, if defined; otherwise, null
   */
  getSetting(key: string, location: SettingLocation): Promise<SettingsValue | null>;

  /**
   * Saves the specified setting value
   * @param key Setting key
   * @param value Value to save
   * @param location Settings location
   */
  saveSetting(key: string, value: SettingsValue, localtion: SettingLocation): Promise<void>;

  /**
   * Gets the entire configuration set from the specified location
   * @param location Settings location
   * @returns The configuration set
   */
  getConfiguration(location: SettingLocation): Promise<Map<string, SettingsValue>>
}

/**
 * Storage value of settings
 */
export type SettingsValue = boolean | number | string | undefined;

/**
 * Location of settings
 * user: The Klive/Klive.config file in the user's home folder
 * project: The current project file
 * current: the project file, if there is a project open; otherwise the use config
 */
export type SettingLocation = "user" | "project" | "current";
