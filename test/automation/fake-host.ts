import fs from "fs";
import os from "os";
import path from "path";
import { expect } from "vitest";

import type { AppState } from "@state/AppState";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { CapturedCommandResult } from "@common/messaging/IdeApi";
import type { AutomationHost } from "@main/automation/host";
import type { AutomationLevel, BreakpointHit } from "@common/automation/protocol";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { AutomationServer, type AutomationServerOptions } from "@main/automation/AutomationServer";
import { automationRunDir, connectionFilePath } from "@main/automation/connection-file";

/*
 * An in-process stand-in for Klive behind the automation server: a store, a 128K-style memory
 * (two ROM pages, eight RAM banks, the CPU's view built from the paging), CPU registers, a
 * breakpoint list, a picture, and an IDE that runs a few commands. The protocol tests and the CLI
 * tests drive the real server and the real client against it - no Electron, no WASM.
 */

export type FakeCommand = (text: string) => Promise<CapturedCommandResult> | CapturedCommandResult;

export type FakeHost = AutomationHost & {
  state: AppState;
  setState(patch: Partial<AppState>): void;
  setMachineState(state: MachineControllerState, pc?: number): void;
  setReady(ready: boolean): void;
  /** RAM banks 0-7 and ROM pages R0/R1 (-1/-2) */
  banks: Uint8Array[];
  roms: Uint8Array[];
  /** The bank paged in at $C000 */
  pagedBank: number;
  registers: Record<string, number>;
  breakpoints: BreakpointInfo[];
  stopInfo: { pc: number; breakpoints: BreakpointHit[] };
  /** Every command text the IDE was asked to run */
  commands: { text: string; automation?: boolean }[];
  /** Command handlers by command word */
  commandHandlers: Record<string, FakeCommand>;
  machineCommands: string[];
};

const ok = (output: string[] = [], extra: Partial<CapturedCommandResult> = {}): CapturedCommandResult => ({
  success: true,
  output,
  ...extra
});

export function createFakeHost(options: { ready?: boolean } = {}): FakeHost {
  const listeners = new Set<() => void>();
  let ready = options.ready ?? true;
  const banks = Array.from({ length: 8 }, (_, i) => new Uint8Array(0x4000).fill(i));
  const roms = [new Uint8Array(0x4000).fill(0xf0), new Uint8Array(0x4000).fill(0xf1)];
  // --- Recognisable bytes: "KLIVE" at $8000 (bank 2) and at B5:$0100
  banks[2].set([0x4b, 0x4c, 0x49, 0x56, 0x45], 0);
  banks[5].set([0xde, 0xad, 0xbe, 0xef], 0x100);

  const host: FakeHost = {
    version: "0.64.0",
    state: {
      emuLoaded: true,
      ideLoaded: true,
      emulatorState: {
        machineId: "sp128",
        modelId: "pal",
        machineState: MachineControllerState.Paused,
        pcValue: 0x8000
      } as AppState["emulatorState"],
      project: {
        folderPath: "/home/me/projects/hello",
        isKliveProject: true,
        buildRoots: ["code/main.kz80.asm"]
      },
      userSettings: {}
    } as AppState,
    banks,
    roms,
    pagedBank: 0,
    registers: {
      af: 0x1234,
      bc: 0x5678,
      de: 0x9abc,
      hl: 0xdef0,
      af_: 0,
      bc_: 0,
      de_: 0,
      hl_: 0,
      ix: 0x5c3a,
      iy: 0x5c3a,
      sp: 0xff40,
      pc: 0x8000,
      ir: 0x3f05,
      wz: 0,
      interruptMode: 1
    },
    breakpoints: [],
    stopInfo: { pc: 0x8000, breakpoints: [] },
    commands: [],
    machineCommands: [],
    commandHandlers: {},
    getState: () => host.state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    isReady: () => ready,
    setState(patch) {
      host.state = { ...host.state, ...patch };
      for (const l of [...listeners]) l();
    },
    setMachineState(machineState, pc) {
      host.setState({
        emulatorState: {
          ...host.state.emulatorState!,
          machineState,
          ...(pc !== undefined ? { pcValue: pc } : {})
        }
      });
    },
    setReady(value) {
      ready = value;
      host.setState({});
    },
    emu: {
      issueMachineCommand: async (command) => {
        host.machineCommands.push(command);
        const next: Record<string, MachineControllerState> = {
          start: MachineControllerState.Running,
          debug: MachineControllerState.Running,
          pause: MachineControllerState.Paused,
          stop: MachineControllerState.Stopped,
          reset: MachineControllerState.Running,
          restart: MachineControllerState.Running,
          stepInto: MachineControllerState.Paused,
          stepOver: MachineControllerState.Paused,
          stepOut: MachineControllerState.Paused
        };
        if (command === "pause" && host.state.emulatorState?.machineState !== MachineControllerState.Running) {
          throw new Error("The machine is not running");
        }
        if (command.startsWith("step")) host.registers.pc = (host.registers.pc + 1) & 0xffff;
        host.setMachineState(next[command] ?? MachineControllerState.Paused, host.registers.pc);
      },
      getCpuState: async () =>
        ({
          ...host.registers,
          tacts: 69888,
          iff1: true,
          iff2: true,
          halted: false,
          lastMemoryReads: new Uint16Array([1, 2]),
          lastMemoryWrites: new Uint16Array(0)
        }) as any,
      setRegisterValue: async (register, value) => {
        const name = register.toLowerCase().replace("'", "_");
        host.registers[name] = value;
      },
      getMemoryContents: async (partition?: number) => {
        if (partition === undefined) {
          const flat = new Uint8Array(0x10000);
          flat.set(roms[0], 0);
          flat.set(banks[5], 0x4000);
          flat.set(banks[2], 0x8000);
          flat.set(banks[host.pagedBank], 0xc000);
          return { memory: flat } as any;
        }
        return { memory: partition < 0 ? roms[-partition - 1] : banks[partition] } as any;
      },
      setMemoryBytes: async (address, bytes, partition) => {
        if (partition === undefined) {
          for (let i = 0; i < bytes.length; i++) {
            const a = (address + i) & 0xffff;
            if (a >= 0x4000 && a < 0x8000) banks[5][a - 0x4000] = bytes[i];
            else if (a >= 0x8000 && a < 0xc000) banks[2][a - 0x8000] = bytes[i];
            else if (a >= 0xc000) banks[host.pagedBank][a - 0xc000] = bytes[i];
          }
        } else {
          (partition < 0 ? roms[-partition - 1] : banks[partition]).set(bytes, address);
        }
      },
      getPartitionLabels: async () => ({
        [-1]: "R0",
        [-2]: "R1",
        0: "B0",
        1: "B1",
        2: "B2",
        3: "B3",
        4: "B4",
        5: "B5",
        6: "B6",
        7: "B7"
      }),
      parsePartitionLabel: async (label: string) => {
        const m = label.match(/^([RB])([0-7])$/i);
        if (!m) return undefined;
        const n = Number(m[2]);
        return m[1].toUpperCase() === "R" ? (n < 2 ? -n - 1 : undefined) : n;
      },
      listBreakpoints: async () => ({ breakpoints: host.breakpoints, memorySegments: [] }) as any,
      getScreenImage: async () => ({
        width: 2,
        height: 1,
        pixels: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255])
      }),
      getStopInfo: async () => host.stopInfo
    },
    ide: {
      executeCommandCaptured: async (text, opts) => {
        host.commands.push({ text, automation: opts?.automation });
        const word = text.trim().split(/\s+/)[0];
        if (opts?.automation && ["exit", "settings", "display-dialog", "history-take-over"].includes(word)) {
          return { success: false, denied: true, finalMessage: `'${word}' cannot be run through automation.`, output: [] };
        }
        const handler = host.commandHandlers[word];
        if (handler) return await handler(text);
        return ok([`ran: ${text}`]);
      },
      getProjectStructure: async () => ({
        rootPath: "/home/me/projects/hello",
        hasBuildFile: false,
        buildFunctions: [],
        children: [
          {
            depth: 0,
            name: "code",
            fullPath: "/home/me/projects/hello/code",
            projectPath: "code",
            isFolder: true,
            isReadonly: false,
            isBinary: false,
            canBeBuildRoot: false,
            children: [
              {
                depth: 1,
                name: "main.kz80.asm",
                fullPath: "/home/me/projects/hello/code/main.kz80.asm",
                projectPath: "code/main.kz80.asm",
                isFolder: false,
                isReadonly: false,
                isBinary: false,
                canBeBuildRoot: true
              }
            ]
          }
        ]
      })
    },
    openFolder: async (folder) => {
      if (!folder.startsWith("/")) return `Folder ${folder} does not exist`;
      host.setState({ project: { folderPath: folder, isKliveProject: true, buildRoots: [] } });
      return null;
    }
  };
  return host;
}

/** A temporary Klive home: the settings file's folder (T6) */
export function makeTempHome(prefix = "klive-automation-"): { home: string; settingsFile: string; runDir: string; dispose(): void } {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const settingsFile = path.join(home, "klive.settings");
  return {
    home,
    settingsFile,
    runDir: automationRunDir(settingsFile),
    dispose: () => fs.rmSync(home, { recursive: true, force: true })
  };
}

/**
 * Starts a server on a fake host in a temporary home, and checks - before anything talks to it -
 * that its connection file is inside that home (T6: a test must never reach the developer's IDE).
 */
export async function startFakeServer(
  host: FakeHost,
  level: AutomationLevel = "control",
  extra: Partial<AutomationServerOptions> = {}
): Promise<{ server: AutomationServer; temp: ReturnType<typeof makeTempHome>; log: string[]; stop(): Promise<void> }> {
  const temp = makeTempHome();
  const log: string[] = [];
  const server = new AutomationServer({
    host,
    runDir: temp.runDir,
    homeKey: temp.home,
    level,
    onLog: (line) => log.push(line),
    ...extra
  });
  await server.start();
  const file = connectionFilePath(temp.runDir);
  expect(server.connectionFile).toBe(file);
  expect(path.relative(temp.home, file).startsWith("..")).toBe(false);
  return {
    server,
    temp,
    log,
    stop: async () => {
      await server.stop();
      temp.dispose();
    }
  };
}
