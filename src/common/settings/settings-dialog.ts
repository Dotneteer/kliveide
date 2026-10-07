import type { SettingsPageId } from "./settings-pages";

/** What the main process hands the Settings dialog when it opens it */
export type SettingsDialogData = {
  /** The page to open on; the first page when omitted */
  page?: SettingsPageId;
};
