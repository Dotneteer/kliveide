import fs from "fs";
import path from "path";
import { expect, test } from "./fixtures/kliveApp";

const expectedVersion = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")
).version as string;

test("shows the current application version in About and closes cleanly", async ({ kliveApp }) => {
  const appVersion = await kliveApp.openAboutDialog();
  expect(appVersion).toBe(expectedVersion);

  const ideDialog = kliveApp.idePage.getByRole("dialog", { name: "About Klive IDE" });
  const emuDialog = kliveApp.emuPage.getByRole("dialog", { name: "About Klive IDE" });
  await expect
    .poll(async () => Number(await ideDialog.isVisible()) + Number(await emuDialog.isVisible()))
    .toBe(1);

  const dialog = (await ideDialog.isVisible()) ? ideDialog : emuDialog;
  await expect(dialog.getByTestId("about-version")).toHaveText(expectedVersion);

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
});
