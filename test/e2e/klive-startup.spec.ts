import { expect, test } from "./fixtures/kliveApp";

test.use({
  kliveSettings: {
    theme: "dark",
    startScreenDisplayed: true
  }
});

test("starts Klive with isolated settings and reaches both renderer windows", async ({ kliveApp }) => {
  await expect(kliveApp.idePage.locator("#appMain")).toBeVisible();
  await expect(kliveApp.emuPage.locator("#appMain")).toBeVisible();
});
