import { vi } from "vitest";
import type { IOutputBuffer } from "@appIde/ToolArea/abstractions";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { AppServices } from "@renderer/abstractions/AppServices";
import type { Store } from "@state/redux-light";
import type { AppState } from "@state/AppState";
import type { MessengerBase } from "@messaging/MessengerBase";
import type { MessageSource } from "@messaging/messages-core";
import type { MachineInfo } from "@common/machines/info-types";
import { MachineControllerState } from "@abstractions/MachineControllerState";

/**
 * Creates a mock IOutputBuffer for testing
 */
export function createMockOutputBuffer(): IOutputBuffer {
  return {
    clear: vi.fn(),
    write: vi.fn(),
    writeLine: vi.fn(),
    writeMessage: vi.fn(),
    color: vi.fn(),
    resetStyle: vi.fn(),
    bold: vi.fn(),
    italic: vi.fn(),
    underline: vi.fn()
  } as any;
}

/**
 * Creates a mock Redux store for testing
 */
export function createMockStore(initialState?: Partial<AppState>): Store<AppState> {
  const defaultState: AppState = {
    emuLoaded: false,
    dimMenu: false,
    emulatorState: {
      machineId: "test-machine",
      machineState: MachineControllerState.None
    },
    project: {
      folderPath: undefined,
      buildRoots: []
    },
    watches: [],
    ...initialState
  } as AppState;

  return {
    getState: vi.fn(() => defaultState),
    dispatch: vi.fn(),
    subscribe: vi.fn()
  } as any;
}

/**
 * Creates a mock EmuApi for testing
 */
export function createMockEmuApi(): any {
  return {
    listBreakpoints: vi.fn<() => Promise<{ breakpoints: any[] }>>().mockResolvedValue({ breakpoints: [] }),
    setBreakpoint: vi.fn<(address: any) => Promise<boolean>>().mockResolvedValue(true),
    removeBreakpoint: vi.fn<(address: any) => Promise<boolean>>().mockResolvedValue(true),
    eraseAllBreakpoints: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    enableBreakpoint: vi.fn<(address: any, enabled: boolean) => Promise<boolean>>().mockResolvedValue(true),
    getCpuState: vi.fn<() => Promise<any>>().mockResolvedValue({ pc: 0x8000 }),
    issueMachineCommand: vi.fn<(command: any) => Promise<void>>().mockResolvedValue(undefined),
    setMemoryContent: vi.fn<(partition: any, address: any, data: any, breakpoints: any) => Promise<void>>().mockResolvedValue(undefined),
    parsePartitionLabel: vi.fn<(label: string) => Promise<number>>().mockResolvedValue(0),
    getPartitionLabels: vi.fn<() => Promise<Record<number, string>>>().mockResolvedValue({}),
    getMemoryContents: vi.fn<(partition: any, address: any) => Promise<Uint8Array>>().mockResolvedValue(new Uint8Array(0))
  };
}

/**
 * Creates a mock MainApi for testing
 */
export function createMockMainApi() {
  return {
    openFolder: vi.fn().mockResolvedValue(undefined),
    closeFolder: vi.fn().mockResolvedValue(undefined),
    exitApp: vi.fn(),
    openWithShell: vi.fn().mockResolvedValue({ path: "test-path" }),
    createKliveProject: vi.fn().mockResolvedValue("/test/project"),
    setGlobalSettingsValue: vi.fn().mockResolvedValue(undefined),
    getGlobalSettingsValue: vi.fn().mockResolvedValue(undefined)
  } as any;
}

/**
 * Creates a mock IdeCommandsService for testing
 */
export function createMockIdeCommandsService() {
  return {
    clearHistory: vi.fn(),
    executeCommand: vi.fn().mockResolvedValue({ success: true }),
    getCommandHistory: vi.fn().mockReturnValue([]),
    getCommandHistoryLength: vi.fn().mockReturnValue(0),
    registerCommand: vi.fn(),
    getRegisteredCommands: vi.fn().mockReturnValue([]),
    getCommandInfo: vi.fn(),
    getCommandByIdOrAlias: vi.fn()
  } as any;
}

/**
 * Creates a mock ProjectService for testing
 */
export function createMockProjectService() {
  return {
    getNodeForFile: vi.fn(),
    performAllDelayedSavesNow: vi.fn().mockResolvedValue(undefined),
    getActiveDocumentHubService: vi.fn().mockReturnValue({
      getDocument: vi.fn(),
      setActiveDocument: vi.fn().mockResolvedValue(undefined),
      openDocument: vi.fn().mockResolvedValue(undefined),
      closeDocument: vi.fn().mockResolvedValue(undefined),
      closeAllDocuments: vi.fn().mockResolvedValue(undefined),
      isOpen: vi.fn().mockReturnValue(false),
      waitOpen: vi.fn().mockResolvedValue({ id: "test-doc" }),
      getDocumentApi: vi.fn()
    }),
    getBreakpointAddressInfo: vi.fn(),
    getDocumentForProjectNode: vi.fn().mockResolvedValue({ id: "test-doc" }),
    createDocumentHubService: vi.fn()
  } as any;
}

/**
 * Creates a mock MachineService for testing
 */
export function createMockMachineService() {
  return {
    getMachineInfo: vi.fn().mockReturnValue({
      machine: {
        features: {}
      }
    })
  } as any;
}

/**
 * Creates a mock AppServices for testing
 */
export function createMockAppServices(): AppServices {
  return {
    ideCommandsService: createMockIdeCommandsService(),
    projectService: createMockProjectService(),
    machineService: createMockMachineService(),
    outputPaneService: {} as any,
    uiService: {} as any,
    validationService: {} as any,
    scriptService: {} as any
  };
}

/**
 * Creates a mock MachineInfo for testing
 */
export function createMockMachineInfo(): MachineInfo {
  return {
    machineId: "test-machine",
    displayName: "Test Machine",
    machine: {
      features: {}
    }
  } as any;
}

/**
 * Creates a complete mock IdeCommandContext for testing
 * @param overrides Optional partial context to override defaults
 */
export function createMockContext(overrides?: Partial<IdeCommandContext>): IdeCommandContext {
  const mockOutput = createMockOutputBuffer();
  const mockStore = createMockStore();
  const mockEmuApi = createMockEmuApi();
  const mockMainApi = createMockMainApi();
  const mockAppServices = createMockAppServices();
  const mockMessenger = {
    sendMessage: vi.fn().mockResolvedValue({ success: true })
  } as any;
  const mockMessageSource = "test" as MessageSource;
  const mockMachineInfo = createMockMachineInfo();

  return {
    commandtext: "test-command",
    argTokens: [],
    output: mockOutput,
    store: mockStore,
    machineInfo: mockMachineInfo,
    service: mockAppServices,
    messenger: mockMessenger,
    messageSource: mockMessageSource,
    emuApi: mockEmuApi,
    mainApi: mockMainApi,
    ...overrides
  };
}

/**
 * Helper to create a context with a specific machine state
 */
export function createMockContextWithMachineState(
  state: MachineControllerState,
  overrides?: Partial<IdeCommandContext>
): IdeCommandContext {
  const mockStore = createMockStore({
    emulatorState: {
      machineId: "test-machine",
      machineState: state
    }
  } as any);

  return createMockContext({
    store: mockStore,
    ...overrides
  });
}

/**
 * Helper to create a context with an open project
 */
export function createMockContextWithProject(
  folderPath: string,
  overrides?: Partial<IdeCommandContext>
): IdeCommandContext {
  const mockStore = createMockStore({
    project: {
      folderPath,
      buildRoots: ["/src"]
    }
  } as any);

  return createMockContext({
    store: mockStore,
    ...overrides
  });
}
