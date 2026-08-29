export type AboutDialogData = {
  version: string;
  electronVersion: string;
  osVersion: string;
};

export function createAboutDialogData(
  version: string,
  electronVersion: string,
  osVersion: string
): AboutDialogData {
  return { version, electronVersion, osVersion };
}
