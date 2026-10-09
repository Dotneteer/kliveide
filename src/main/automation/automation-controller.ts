import path from "path";

import {
  AUTOMATION_SWITCH,
  type AutomationLevel,
  parseAutomationLevel,
  parseAutomationSwitch
} from "@common/automation/protocol";
import { PANE_ID_AUTOMATION } from "@common/integration/constants";
import type { OutputSpecification } from "@renderer/appIde/ToolArea/abstractions";
import { setAutomationStatusAction } from "@state/actions";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { KLIVE_APP_VERSION } from "../app-version";
import { mainStore } from "../main-store";
import { openFolderByPath } from "../projects";
import { appSettings, getSettingsFilePath } from "../settings-utils";
import { AutomationServer, type AutomationStatus } from "./AutomationServer";
import { automationRunDir } from "./connection-file";
import type { AutomationEmuApi, AutomationHost, AutomationIdeApi } from "./host";

/*
 * Starts and stops the automation server (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D4, D13).
 *
 * - On while the user setting `automation.enabled` is on, or for this run when Klive was started
 *   with `--automation`. Off by default. A change of the setting takes effect at once, no restart.
 * - The level is `automation.level` (default `control`). **Both are read from user settings only**,
 *   never from a project's settings: opening a downloaded project must not be able to switch the
 *   server on or raise its level.
 * - Its log goes to the Automation output pane; its status to the store, for the status bar.
 */

let server: AutomationServer | undefined;
let wanted: { on: boolean; level: AutomationLevel } = { on: false, level: "control" };
let unsubscribe: (() => void) | undefined;

/** Lines logged before the IDE window could show them */
const pendingLog: string[] = [];
const MAX_PENDING_LOG = 200;

/** `--automation` on the command line turns the server on for this run (D4, Q4) */
const forcedOn = process.argv.includes(AUTOMATION_SWITCH);

/** A proxy that resolves the API on every call: the windows (and their messengers) can be recreated */
function lazyApi<T extends object>(get: () => T): T {
  return new Proxy({} as T, {
    get: (_target, prop) => (...args: unknown[]) => (get() as any)[prop](...args)
  });
}

const host: AutomationHost = {
  version: KLIVE_APP_VERSION,
  getState: () => mainStore.getState(),
  subscribe: (listener) => mainStore.subscribe(listener),
  isReady: () => {
    const state = mainStore.getState();
    return !!state?.emuLoaded && !!state?.ideLoaded && !!state?.emulatorState?.machineId;
  },
  emu: lazyApi<AutomationEmuApi>(() => getEmuApi()),
  ide: lazyApi<AutomationIdeApi>(() => getIdeApi()),
  openFolder: (folder) => openFolderByPath(folder)
};

/** What the user settings ask for */
function readWanted(): { on: boolean; level: AutomationLevel } {
  const settings = mainStore.getState()?.userSettings ?? appSettings.userSettings ?? {};
  return {
    on: forcedOn || parseAutomationSwitch(settings?.automation?.enabled),
    level: parseAutomationLevel(settings?.automation?.level)
  };
}

function writeLog(line: string): void {
  const stamp = new Date().toLocaleTimeString();
  const text = `${stamp}  ${line}`;
  if (!host.isReady()) {
    pendingLog.push(text);
    if (pendingLog.length > MAX_PENDING_LOG) pendingLog.shift();
    return;
  }
  const lines = pendingLog.splice(0, pendingLog.length);
  lines.push(text);
  const specs: OutputSpecification[] = lines.map((l) => ({
    pane: PANE_ID_AUTOMATION,
    text: l,
    writeLine: true
  }));
  getIdeApi()
    .displayOutputBatch(specs)
    .catch(() => {
      // --- The IDE is going away; the log is not worth an error
    });
}

function reportStatus(status: AutomationStatus): void {
  mainStore.dispatch(
    setAutomationStatusAction({ ...status, level: server?.currentLevel ?? wanted.level }),
    "main"
  );
}

async function apply(): Promise<void> {
  const next = readWanted();
  if (next.on === !!server && (!server || server.currentLevel === next.level)) return;
  wanted = next;
  if (next.on && !server) {
    const settingsFile = getSettingsFilePath();
    const candidate = new AutomationServer({
      host,
      runDir: automationRunDir(settingsFile),
      homeKey: path.dirname(settingsFile),
      level: next.level,
      onLog: writeLog,
      onStatus: reportStatus
    });
    server = candidate;
    try {
      await candidate.start();
    } catch (err) {
      server = undefined;
      writeLog(`Automation could not start: ${(err as Error).message}`);
      reportStatus({ listening: false, clients: 0 });
    }
    return;
  }
  if (!next.on && server) {
    const stopping = server;
    server = undefined;
    await stopping.stop();
    return;
  }
  if (server) {
    server.setLevel(next.level);
    reportStatus({ listening: server.isListening, clients: server.clientCount });
  }
}

let applying = false;
let applyAgain = false;

/** Serializes `apply`: a burst of store changes must never start two servers */
function scheduleApply(): void {
  if (applying) {
    applyAgain = true;
    return;
  }
  applying = true;
  void (async () => {
    try {
      do {
        applyAgain = false;
        await apply();
      } while (applyAgain);
    } finally {
      applying = false;
    }
  })();
}

/**
 * Starts the server when it is wanted, and watches the settings. Call once, after the windows and
 * their messengers exist.
 */
export function initAutomation(): void {
  if (unsubscribe) return;
  let wasReady = host.isReady();
  unsubscribe = mainStore.subscribe(() => {
    // --- Never start or stop from inside a store notification
    setImmediate(scheduleApply);
    // --- A window that loads after the server started missed its status and its first log lines
    const ready = host.isReady();
    if (ready && !wasReady) setImmediate(onIdeReady);
    wasReady = ready;
  });
  scheduleApply();
}

/** The IDE came up (or back): give it the status it missed, and the log lines held for it */
function onIdeReady(): void {
  if (!server) return;
  reportStatus({ listening: server.isListening, clients: server.clientCount });
  if (pendingLog.length) writeLog(`IDE ready; ${pendingLog.length} earlier line(s) above.`);
}

/** Klive › Automation › Disconnect All (D13) */
export function disconnectAllAutomationClients(): number {
  return server?.disconnectAll() ?? 0;
}

/** Is the server listening? (The menu enables Disconnect All by it.) */
export function isAutomationListening(): boolean {
  return !!server?.isListening;
}

/** The quit path: the connection file must not outlive the process (D5) */
export function stopAutomationNow(): void {
  unsubscribe?.();
  unsubscribe = undefined;
  server?.stopNow();
  server = undefined;
}

// ================================================================================================
// `ide.output` (D11): output the main process forwards to the IDE, as whole lines per pane

const partialLines = new Map<string, string>();

/**
 * Taps output on its way from the emulator to the IDE's panes (the Emulator and Log panes): each
 * completed line becomes an `ide.output` notification for the clients that asked for it.
 */
export function tapAutomationOutput(specs: OutputSpecification[] | OutputSpecification | undefined): void {
  if (!server?.isListening || !specs) return;
  for (const spec of Array.isArray(specs) ? specs : [specs]) {
    if (!spec || typeof spec.pane !== "string" || spec.pane === PANE_ID_AUTOMATION) continue;
    const text = (partialLines.get(spec.pane) ?? "") + (spec.text ?? "");
    if (spec.writeLine) {
      partialLines.delete(spec.pane);
      server.publishOutput(spec.pane, text);
    } else {
      partialLines.set(spec.pane, text.length > 4096 ? text.slice(-4096) : text);
    }
  }
}
