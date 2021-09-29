// @ts-check

import { ThemeIcon, TreeItem, TreeItemCollapsibleState } from "vscode";
import {
  MachineState,
  SpectrumMachineStateBase,
} from "@shared/machines/machine-state";
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
        state.contentionAccummulated - state.lastExecutionContentionValue
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
    const tactInFrame = state.lastRenderedFrameTact % state.tactsInFrame;
    this.children = [
      new FrameCountItem(state.frameCount),
      new TactsItem(
        "ULA Tact",
        "Current tact within the ULA frame",
        tactInFrame
      ),
      new RegisterItem(
        "BLINE",
        "Beam line",
        Math.floor(tactInFrame / state.screenWidth)
      ),
      new RegisterItem(
        "BPOS",
        "Beam position",
        tactInFrame % state.screenWidth
      ),
      new RenderingPhaseItem(state.renderingPhase),
      new RenderingAddressItem(
        state.renderingPhase,
        state.pixelAddr,
        state.attrAddr
      ),
    ];
  }
}

/**
 * Represents the current ULA rendering phase item
 */
export class RenderingPhaseItem extends TreeItem {
  constructor(type: number) {
    super("Phase", TreeItemCollapsibleState.None);
    let phase = "None";
    switch (type) {
      case 0x04:
        phase = "Border";
        break;
      case 0x05:
        phase = "BorderFetchPixel";
        break;
      case 0x06:
        phase = "BorderFetchAttr";
        break;
      case 0x08:
        phase = "DisplayB1";
        break;
      case 0x09:
        phase = "DisplayB1FetchB2";
        break;
      case 0x0a:
        phase = "DisplayB1FetchA2";
        break;
      case 0x410:
        phase = "DisplayB2";
        break;
      case 0x11:
        phase = "DisplayB2FetchB1";
        break;
      case 0x12:
        phase = "DisplayB2FetchA1";
        break;
    }
    this.description = `${phase}`;
    this.iconPath = new ThemeIcon("paintcan");
  }
}

/**
 * Represents the current ULA pixel/attr address
 */
export class RenderingAddressItem extends TreeItem {
  constructor(type: number, pixelAddr: number, attrAddr: number) {
    super("Address", TreeItemCollapsibleState.None);
    let addr = "---";
    if (type & 0x01) {
      addr = `$${toHexa(pixelAddr, 4)} (${pixelAddr})`;
    } else if (type & 0x02) {
      addr = `$${toHexa(attrAddr, 4)} (${attrAddr})`;
    }
    this.description = addr;
    this.tooltip = `Address ${addr}`;
    this.iconPath = new ThemeIcon("symbol-variable");
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
