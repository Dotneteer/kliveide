import { MessengerBase } from "@common/messaging/MessengerBase";
import type { AppState } from "@common/state/AppState";
import type { Store } from "@common/state/redux-light";
import { IAnyMachine } from "@renderer/abstractions/IAnyMachine";

/**
 * This type stores common information about a particular emulated machine
 */
export type MachineInfo = {
  /**
   * The ID of the machine
   */
  machineId: string;

  /**
   * The friendly name of the machine to display
   */
  displayName: string;

  /**
   * The character set of the machine
   */
  charSet: Record<number, CharDescriptor>;

  /**
   * Machine features (all models have the same features)
   */
  features?: MachineFeatureSet;

  /**
   * The configuratiton of the machine
   */
  config?: MachineConfigSet;

  /**
   * Available machine models
   */
  models?: MachineModel[];

  /**
   * IDs of attached media devices
   */
  mediaIds?: string[];

  /**
   * Information about custom tools
   */
  toolInfo?: Record<string, any>;
};

/**
 * Available machine models
 */
export type MachineModel = {
  /**
   * ID of the machine model
   */
  modelId: string;

  /**
   * The display name of the particular model
   */
  displayName: string;

  /**
   * The configuratiton of the machine
   */
  config: MachineConfigSet;
};

/**
 * Available machine models with their IDs
 */
export type MachineWithModel = {
  /**
   * ID of the machine
   */
  machineId: string;

  /**
   * ID of the machine model
   */
  modelId?: string;

  /**
   * The display name of the particular model
   */
  displayName: string;

  /**
   * The configuratiton of the machine
   */
  config?: MachineConfigSet;
};

/**
 * This type stores renderer information about a particular emulated machine
 */
export type MachineUiRendererInfo = {
  /**
   * The ID of the machine
   */
  machineId: string;

  /**
   * Creates the emulate machine instance
   * @returns The emulated machine instance
   */
  factory: (
    store: Store<AppState>,
    model?: MachineModel,
    config?: MachineConfigSet,
    messenger?: MessengerBase
  ) => IAnyMachine;
};

/**
 * This type represents a set of features of a particular machine
 */
export type MachineFeatureSet = Record<string, any>;

/**
 * This type represents a set of features of a particular machine
 */
export type MachineConfigSet = Record<string, any>;

/**
 * This type represents a machine-related menu item
 */
export type MachineMenuItem = {
  id?: string;
  label?: string;
  type?: "separator" | "submenu" | "normal" | "checkbox" | "radio";
  checked?: boolean;
  enabled?: boolean;
  accelerator?: string;
  click?: (mi?: Electron.MenuItem) => Promise<void>;
  submenu?: MachineMenuItem[];
};

/**
 * This function collects machine-related menu items
 */
export type MachineMenuRenderer = (
  windowInfo: any,
  machine: MachineInfo,
  model?: MachineModel,
  config?: MachineConfigSet
) => MachineMenuItem[];

/**
 * Represents a machine-specifoc help link item
 */
export type HelpLinkInfo = {
  label?: string;
  url?: string;
};

export type CharDescriptor = {
  // --- Character value
  v?: string;

  c?: "ctrl" | "pr" | "graph" | "udg" | "token";

  // --- Character tooltip
  t?: string;
};

/**
 * This type represents a machine-related menu item information
 */
export type MachineMenuInfo = {
  viewItems?: MachineMenuRenderer;
  machineItems?: MachineMenuRenderer;
  projectItems?: MachineMenuRenderer;
  ideItems?: MachineMenuRenderer;
  helpItems?: MachineMenuRenderer;
  helpLinks?: HelpLinkInfo[];
  initializer?: () => Promise<void>;
  setup?: () => Promise<void>;
};
