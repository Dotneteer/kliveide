import { expect, test } from "./fixtures/kliveApp";
import { IDE_INTEGRATION_SJASMPLUS } from "../../src/main/ide-integrations-menu";

// --- Stands in for "a previous session saved this". The settings file is the only
// --- carrier of the integration between runs.
test.use({
  kliveSettings: {
    userSettings: {
      sjasmp: {
        root: "/tools/sjasmplus",
        executablePath: "/tools/sjasmplus/sjasmplus",
        version: "v1.24.0"
      }
    }
  }
});

test("restores a saved SJASMPLUS integration into the IDE on the next start", async ({
  kliveApp
}) => {
  await kliveApp.triggerMenuItem(IDE_INTEGRATION_SJASMPLUS);

  const dialog = kliveApp.idePage.getByRole("dialog", { name: "SJASMPLUS Integration" });
  await expect(dialog).toBeVisible();

  // --- The saved settings must reach the IDE renderer, not just the main process
  await expect(dialog.getByTestId("sjasmplus-executable-path")).toHaveText(
    "/tools/sjasmplus/sjasmplus"
  );
  await expect(dialog.getByTestId("sjasmplus-scope")).toHaveText("User settings");
  await expect(dialog.getByTestId("sjasmplus-version")).toHaveText("v1.24.0");
  await expect(dialog.getByTestId("sjasmplus-integrated-badge")).toBeVisible();

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
});
