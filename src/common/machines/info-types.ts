import { MessengerBase } from "@common/messaging/MessengerBase";
import type { AppState } from "@common/state/AppState";
import type { Store } from "@common/state/redux-light";
import { IAnyMachine } from "@renderer/abstractions/IAnyMachine";
import { labelRecord } from "@common/i18n/labels";
import type { MessageKey } from "@common/i18n/keys.generated";

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

  /**
   * The model's own character set, when it differs from the machine's (the HT-1080Z's Series I,
   * Series II and /64 each have their own character ROM)
   */
  charSet?: Record<number, CharDescriptor>;
};

/** The character set of a machine's model: the model's own, or the machine's. */
export function charSetOfModel(
  info: { machine: MachineInfo; model?: MachineModel } | undefined
): Record<number, CharDescriptor> | undefined {
  return info?.model?.charSet ?? info?.machine?.charSet;
}

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
/** A Help-menu link; an entry with neither label nor key is a separator */
export type HelpLinkInfo = {
  /** Translation key of the link's text (`.plans/LOCALIZATION_PLAN.md` D7) */
  labelKey?: MessageKey;
  /** Untranslated text, for a link that has no key */
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
 * The device submenus of the Machine menu, in their display order
 */
export const MACHINE_DEVICE_MENUS = ["tape", "program", "disks", "cartridge", "sdCard", "input"] as const;
export type MachineDeviceMenuId = (typeof MACHINE_DEVICE_MENUS)[number];

/** The label of each device submenu */
/** Translated each time a label is read (`labelRecord`) */
export const MACHINE_DEVICE_MENU_LABELS: Readonly<Record<MachineDeviceMenuId, string>> =
  labelRecord<MachineDeviceMenuId>({
    tape: "menu.machine.device.tape",
    program: "menu.machine.device.program",
    disks: "menu.machine.device.disks",
    cartridge: "menu.machine.device.cartridge",
    sdCard: "menu.machine.device.sdCard",
    input: "menu.machine.device.input"
  });

/**
 * This type represents a machine-related menu item information
 */
export type MachineMenuInfo = {
  /**
   * One submenu per device the machine has, under Machine (`.plans/MENU_REDESIGN_PLAN.md` P4). A
   * renderer that returns a single submenu item (such as "Floppy Disks") is unwrapped, so its items
   * become the device submenu's items. An empty result hides the submenu.
   */
  devices?: Partial<Record<MachineDeviceMenuId, MachineMenuRenderer>>;
  /** Machine-specific hardware actions, in a submenu named after the machine */
  hardwareItems?: MachineMenuRenderer;
  /** The machine's views, under View › Machine Views (they open in the IDE) */
  viewItems?: MachineMenuRenderer;
  /** Machine-specific debugging commands, at the end of the Debug menu */
  debugItems?: MachineMenuRenderer;
  /** Machine-specific recordings (RZX), in Machine › Record */
  recordItems?: MachineMenuRenderer;
  helpLinks?: HelpLinkInfo[];
  initializer?: () => Promise<void>;
  setup?: () => Promise<void>;
};
