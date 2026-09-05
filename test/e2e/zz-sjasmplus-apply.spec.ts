import { expect, test } from "./fixtures/kliveApp";

async function callMain(page: any, method: string, args: any[]): Promise<any> {
  return await page.evaluate(
    async ({ method, args }: { method: string; args: any[] }) => {
      const ipcRenderer = (window as any).electron.ipcRenderer;
      const correlationId = 987654;
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout")), 20000);
        const handler = (_ev: any, response: any) => {
          if (response?.correlationId !== correlationId) return;
          clearTimeout(timer);
          resolve(response);
        };
        ipcRenderer.on("IdeToMainResponse", handler);
        ipcRenderer.send("IdeToMain", {
          type: "ApiMethodRequest",
          method,
          targetId: "main",
          args,
          correlationId,
          sourceId: "ide"
        });
      });
    },
    { method, args }
  );
}

test("apply persists sjasmplus user settings", async ({ kliveApp }) => {
  const response = await callMain(kliveApp.idePage, "applySjasmplusIntegration", [
    {
      scope: "user",
      installFolder: "/tools/sjasmplus",
      executablePath: "/tools/sjasmplus/sjasmplus",
      version: "v1.24.0"
    }
  ]);
  console.log("APPLY RESPONSE:", JSON.stringify(response));

  const settings = kliveApp.readSettings() as any;
  console.log("USER SETTINGS:", JSON.stringify(settings.userSettings));
  expect(settings.userSettings?.sjasmp?.executablePath).toBe("/tools/sjasmplus/sjasmplus");
});
