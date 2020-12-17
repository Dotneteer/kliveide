// @ts-check

import { ThemeIcon, TreeItem, TreeItemCollapsibleState } from "vscode";
import {
  MachineState,
  SpectrumMachineStateBase,
} from "../shared/machines/machine-state";
import {
  RegisterItem,
  TactsItem,
  TreeItemWithChildren,
} from "../views/hw-registers";
import { Z80MachineViewProviderBase } from "./Z80MachineViewProviderBase";

/**
 * Common root call for all ZX Spectrum view providers
 */
export abstract class ZxSpectrumViewProviderBase extends Z80MachineViewProviderBase {
  /**
   * Override this member to provide additional hardware register
   * data
   * @param state Current machine state
   */
  async getHardwareRegisters(state: MachineState): Promise<TreeItem[]> {
    return [
      new ContentionRootItem(state as SpectrumMachineStateBase),
      new UlaRootItem(state as SpectrumMachineStateBase),
    ];
  }
}

/**
 * Represents a Z80 register/other register value
 */
export class ContentionRootItem
  extends TreeItem
  implements TreeItemWithChildren {
  children: TreeItem[] = [];
  constructor(state: SpectrumMachineStateBase) {
    super("Contention", TreeItemCollapsibleState.Collapsed);
    this.iconPath = new ThemeIcon("folder");
    this.children = [
      new RegisterItem(
        "LCV",
        "Last contention",
        state.lastExecutionContentionValue
      ),
      new RegisterItem("TCV", "Total contention", state.contentionAccummulated),
    ];
  }
}

/**
 * Represents a Z80 register/other register value
 */
export class FrameCountItem extends TreeItem {
  constructor(value: number) {
    super("Frames", TreeItemCollapsibleState.None);
    this.description = `Frames: ${value}`;
    this.iconPath = new ThemeIcon("vm");
  }
}

/**
 * Represents a Z80 register/other register value
 */
export class UlaRootItem extends TreeItem implements TreeItemWithChildren {
  children: TreeItem[] = [];
  constructor(state: SpectrumMachineStateBase) {
    super("ULA Diagnostics", TreeItemCollapsibleState.Collapsed);
    this.iconPath = new ThemeIcon("folder");
    this.children = [
      new FrameCountItem(state.frameCount),
      new TactsItem(
        "ULA Tact",
        "Current tact within the ULA frame",
        state.lastRenderedFrameTact
      ),
      new RegisterItem(
        "BLINE",
        "Beam line",
        Math.floor(state.lastRenderedFrameTact / state.screenWidth)
      ),
      new RegisterItem(
        "BPOS",
        "Beam position",
        state.lastRenderedFrameTact % state.screenWidth
      ),
    ];
  }
}

/**
 * Converts a value to its hexadecimal representation
 * @param input Input value
 * @param digits Number of hexadecimal digits
 */
function toHexa(input: number, digits: number): string {
  return input.toString(16).toUpperCase().padStart(digits, "0");
}
