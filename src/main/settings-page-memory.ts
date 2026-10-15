/*
 * The Settings dialog's last page, kept in the main process so that both windows share it: the
 * dialog opens in whichever window has the focus, and each window is its own renderer process.
 *
 * An open that names its page (Machine › Input…, "Appearance Settings…") shows that page; an open
 * that does not (File › Settings…, the activity bar's gear) shows the page the dialog was last on.
 * Memory only: a restart opens on the first page again.
 */
import { SETTINGS_PAGES, type SettingsPageId } from "@common/settings/settings-pages";

let lastPage: SettingsPageId | undefined;

function isSettingsPageId(page: unknown): page is SettingsPageId {
  return SETTINGS_PAGES.some((p) => p.id === page);
}

/**
 * Records the page the dialog is showing.
 * @returns false when `page` is not a Settings page
 */
export function rememberSettingsPage(page: unknown): boolean {
  if (!isSettingsPageId(page)) return false;
  lastPage = page;
  return true;
}

/** The page to open the dialog on: the requested one, else the remembered one */
export function settingsPageToOpen(requested?: SettingsPageId): SettingsPageId | undefined {
  if (requested && rememberSettingsPage(requested)) return requested;
  return lastPage;
}

/** Tests only: forgets the remembered page */
export function resetSettingsPageMemory(): void {
  lastPage = undefined;
}
