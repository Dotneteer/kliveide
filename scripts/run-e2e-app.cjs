const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const settingsOptionIndex = process.argv.indexOf("--settings-file");
const providedSettingsFile =
  settingsOptionIndex === -1 ? undefined : process.argv[settingsOptionIndex + 1];

if (settingsOptionIndex !== -1 && !providedSettingsFile) {
  throw new Error("Missing value for --settings-file");
}
if (providedSettingsFile && !path.isAbsolute(providedSettingsFile)) {
  throw new Error("--settings-file must be an absolute path");
}

const settingsDirectory = providedSettingsFile
  ? undefined
  : fs.mkdtempSync(path.join(os.tmpdir(), "klive-e2e-manual-"));
const settingsFile = providedSettingsFile ?? path.join(settingsDirectory, "klive.settings");

if (!providedSettingsFile) {
  fs.writeFileSync(
    settingsFile,
    JSON.stringify(
      {
        startScreenDisplayed: true,
        windowStates: { showIdeOnStartup: true }
      },
      null,
      2
    ),
    "utf8"
  );
}

const electronVite = path.join(
  __dirname,
  "..",
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron-vite.cmd" : "electron-vite"
);
const child = spawn(electronVite, ["dev", "--config", "build/electron.vite.config.ts", "--", "--showide"], {
  cwd: path.join(__dirname, ".."),
  env: { ...process.env, KLIVE_SETTINGS_FILE: settingsFile },
  stdio: "inherit"
});

child.on("error", (error) => {
  console.error(`Could not start Klive: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (settingsDirectory) {
    fs.rmSync(settingsDirectory, { recursive: true, force: true });
  }
  process.exitCode = code ?? (signal ? 1 : 0);
});
