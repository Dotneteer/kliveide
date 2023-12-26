import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { IZ80Machine } from "@renderer/abstractions/IZ80Machine";
import { MF_TAPE_SUPPORT } from "./constants";

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
  factory: (store: Store<AppState>, model: MachineModel) => IZ80Machine;
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
  click?: () => Promise<void>;
  submenu?: MachineMenuItem[];
};

/**
 * This function collects machine-related menu items
 */
export type MachineMenuRenderer = (
  windowInfo: any,
  machine: MachineInfo,
  model?: MachineModel
) => MachineMenuItem[];

/**
 * Represents a machine-specifoc help link item
 */
export type HelpLinkInfo = {
  label?: string;
  url?: string;
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
};

