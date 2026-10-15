import { beforeEach, describe, expect, it } from "vitest";
import {
  rememberSettingsPage,
  resetSettingsPageMemory,
  settingsPageToOpen
} from "../../src/main/settings-page-memory";

/*
 * The Settings dialog reopens on the page it was last showing, unless the open names a page.
 */
describe("Settings page memory", () => {
  beforeEach(() => resetSettingsPageMemory());

  it("opens on the first page (no page) before anything was shown", () => {
    expect(settingsPageToOpen()).toBeUndefined();
  });

  it("reopens on the page last shown", () => {
    expect(rememberSettingsPage("editor")).toBe(true);
    expect(settingsPageToOpen()).toBe("editor");
    rememberSettingsPage("debugging");
    expect(settingsPageToOpen()).toBe("debugging");
  });

  it("lets a named page win, and remembers it", () => {
    rememberSettingsPage("editor");
    expect(settingsPageToOpen("recording")).toBe("recording");
    expect(settingsPageToOpen()).toBe("recording");
  });

  it("ignores a page that does not exist", () => {
    rememberSettingsPage("editor");
    expect(rememberSettingsPage("no-such-page")).toBe(false);
    expect(settingsPageToOpen()).toBe("editor");
  });
});
