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

test("restores a saved SJASMPLUS integration and re-tests it on the next start", async ({
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

  // --- Nothing lives at the saved path, so opening the dialog re-tests it and
  // --- refuses to present it as a working integration.
  await expect(dialog.getByTestId("sjasmplus-broken-badge")).toBeVisible();
  await expect(dialog.getByTestId("sjasmplus-status")).toHaveText("Not working");
  await expect(dialog.getByTestId("sjasmplus-status-error")).toContainText(
    "/tools/sjasmplus/sjasmplus"
  );
  await expect(dialog.getByTestId("sjasmplus-integrated-badge")).toBeHidden();
  await expect(dialog.getByTestId("sjasmplus-version")).toBeHidden();

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
});
